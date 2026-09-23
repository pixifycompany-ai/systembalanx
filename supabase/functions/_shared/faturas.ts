// Faturas do Asaas ↔ linhas de cobrança.
// Uma fatura de assinatura pode cobrar VÁRIOS contratos (agrupamento): nesse caso
// ela vira uma linha de cobrança por contrato, todas com o mesmo asaas_payment_id,
// cada uma com a sua parte do valor e a sua receita a receber.
// deno-lint-ignore-file no-explicit-any
import { vincularOuCriarReceita } from "./conciliar.ts";

// Status Asaas -> status interno da cobrança
export function mapStatus(s: string): string {
  switch (s) {
    case "RECEIVED":
    case "CONFIRMED":
    case "RECEIVED_IN_CASH":
      return "pago";
    case "OVERDUE":
      return "vencido";
    case "REFUNDED":
    case "REFUND_REQUESTED":
    case "CHARGEBACK_REQUESTED":
    case "CHARGEBACK_DISPUTE":
      return "estornado";
    case "DELETED":
      return "cancelado";
    default:
      return "pendente"; // PENDING, AWAITING_RISK_ANALYSIS, etc.
  }
}
export const isPago = (s: string) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(s);
export const STATUS_ABERTO = ["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS", "AWAITING_CHARGEBACK_REVERSAL"];

export interface LinhaCobranca {
  cliente_id: string | null;
  contrato_id: string | null;
  conta_id: string | null;
  tipo: string;
  asaas_payment_id: string | null;
  asaas_subscription_id: string | null;
  descricao: string;
  valor: number;
  vencimento: string;
  forma: string;
  status: string;
  invoice_url: string | null;
  exigir_nf?: boolean;
  data_pagamento?: string | null;
}

// Cria a linha de cobrança + a receita a receber (vinculando a já lançada, se houver).
export async function inserirCobranca(admin: any, userId: string, o: LinhaCobranca) {
  const pago = o.status === "pago";
  const dataPag = pago ? (o.data_pagamento || o.vencimento) : null;
  const rec = await vincularOuCriarReceita(admin, {
    user_id: userId, cliente_id: o.cliente_id, contrato_id: o.contrato_id, conta_id: o.conta_id,
    descricao: o.descricao, valor: o.valor, vencimento: o.vencimento, pago, data_pagamento: dataPag,
  });
  const { data } = await admin.from("cobrancas").insert({
    user_id: userId,
    cliente_id: o.cliente_id,
    contrato_id: o.contrato_id,
    conta_id: o.conta_id,
    receita_id: rec.receita_id,
    tipo: o.tipo,
    asaas_payment_id: o.asaas_payment_id,
    asaas_subscription_id: o.asaas_subscription_id,
    descricao: o.descricao,
    valor: o.valor,
    vencimento: o.vencimento,
    forma_pagamento: o.forma,
    status: o.status,
    invoice_url: o.invoice_url,
    exigir_nf: !!o.exigir_nf,
    data_pagamento: dataPag,
  }).select("*").single();
  return data;
}

// Contratos cobrados pela mesma assinatura (1 = cobrança normal, 2+ = grupo). Ordem estável.
export async function contratosDaAssinatura(admin: any, userId: string, subId: string) {
  const { data } = await admin.from("contratos")
    .select("id, cliente_id, descricao, valor, exigir_nf, recorrencia, dia_vencimento, status, created_at")
    .eq("user_id", userId).eq("asaas_subscription_id", subId)
    .order("created_at", { ascending: true });
  return (data || []) as any[];
}

// Reparte um total entre pesos (valor de cada contrato), em centavos exatos;
// a sobra de arredondamento fica na última parte.
export function repartir(total: number, pesos: number[]): number[] {
  const cents = Math.round(Number(total) * 100);
  const n = pesos.length || 1;
  const soma = pesos.reduce((s, p) => s + (p > 0 ? p : 0), 0);
  const partes = pesos.map((p) => (soma > 0 ? Math.floor((cents * (p > 0 ? p : 0)) / soma) : Math.floor(cents / n)));
  partes[partes.length - 1] += cents - partes.reduce((s, v) => s + v, 0);
  return partes.map((c) => c / 100);
}

// Registra uma fatura de assinatura sem duplicar. Em grupo: uma linha por contrato.
// `fallback` cobre assinaturas antigas cujo contrato não está mais marcado.
export async function registrarFatura(
  admin: any, userId: string, pay: any, subId: string,
  ctx: { conta_id: string | null; fallback?: { contrato_id: string | null; cliente_id: string | null; descricao: string | null; exigir_nf?: boolean } },
): Promise<boolean> {
  const { data: existe } = await admin.from("cobrancas").select("id")
    .eq("user_id", userId).eq("asaas_payment_id", pay.id).limit(1).maybeSingle();
  if (existe) return false;

  const contratos = await contratosDaAssinatura(admin, userId, subId);
  const status = mapStatus(pay.status);
  const comum = {
    conta_id: ctx.conta_id, tipo: "recorrente", asaas_payment_id: pay.id, asaas_subscription_id: subId,
    vencimento: pay.dueDate, forma: pay.billingType || "UNDEFINED", status, invoice_url: pay.invoiceUrl ?? null,
    data_pagamento: status === "pago" ? (pay.paymentDate || pay.clientPaymentDate || null) : null,
  };

  if (contratos.length <= 1) {
    const c = contratos[0];
    const fb = ctx.fallback;
    await inserirCobranca(admin, userId, {
      ...comum,
      cliente_id: c?.cliente_id ?? fb?.cliente_id ?? null,
      contrato_id: c?.id ?? fb?.contrato_id ?? null,
      descricao: c?.descricao || fb?.descricao || pay.description || "Assinatura",
      valor: Number(pay.value),
      exigir_nf: !!(c ? c.exigir_nf : fb?.exigir_nf),
    });
    return true;
  }

  const partes = repartir(Number(pay.value), contratos.map((c) => Number(c.valor) || 0));
  for (let i = 0; i < contratos.length; i++) {
    const c = contratos[i];
    await inserirCobranca(admin, userId, {
      ...comum, cliente_id: c.cliente_id, contrato_id: c.id,
      descricao: c.descricao || "Contrato", valor: partes[i], exigir_nf: !!c.exigir_nf,
    });
  }
  return true;
}

// Linhas da mesma fatura (1 no caso normal, N no grupo), em ordem estável.
export async function linhasDaFatura(admin: any, cob: any): Promise<any[]> {
  if (!cob?.asaas_payment_id) return [cob];
  const { data } = await admin.from("cobrancas").select("*")
    .eq("user_id", cob.user_id).eq("asaas_payment_id", cob.asaas_payment_id)
    .order("created_at", { ascending: true }).order("id", { ascending: true });
  return data?.length ? data : [cob];
}

// Juros/multa efetivamente recebido (informado pelo Asaas) → receita EXTRA na
// categoria "Juros/Multa". Uma vez por fatura (no grupo, ligada à primeira linha).
export async function lancarJurosMulta(admin: any, cob: any, p: any, dataPag: string | null) {
  let extra = Number(p?.interestValue) || 0;
  if (!extra && p?.originalValue != null) extra = Number(p.value) - Number(p.originalValue);
  extra = Math.round((extra + Number.EPSILON) * 100) / 100;
  if (!(extra > 0)) return;

  const linhas = await linhasDaFatura(admin, cob);
  const principal = linhas.find((l) => l.receita_id);
  if (!principal) return;
  const recIds = linhas.map((l) => l.receita_id).filter(Boolean);
  const { data: existente } = await admin.from("receitas")
    .select("id").in("origem_receita_id", recIds).ilike("descricao", "Juros/Multa%").limit(1).maybeSingle();
  if (existente) return;

  const { data: cat } = await admin.from("categorias")
    .select("id").eq("nome", "Juros/Multa").eq("tipo", "receita").eq("is_padrao", true).is("user_id", null).limit(1).maybeSingle();
  const dia = dataPag || principal.vencimento;
  const descr = linhas.map((l) => l.descricao).filter(Boolean).join(" + ") || "Cobrança";
  await admin.from("receitas").insert({
    user_id: principal.user_id,
    cliente_id: principal.cliente_id,
    contrato_id: principal.contrato_id ?? null,
    conta_id: principal.conta_id,
    categoria_id: cat?.id ?? null,
    descricao: `Juros/Multa - ${descr}`,
    valor: extra,
    data_competencia: dia,
    data_vencimento: dia,
    data_recebimento: dia,
    status: "recebido",
    origem_receita_id: principal.receita_id,
  });
}

// Ao cancelar/excluir: a receita só é apagada se foi CRIADA pela integração.
// Parcela lançada à mão e vinculada (ex.: "Revvue (4/12)") é preservada.
export async function apagarReceitaSeCriada(admin: any, cob: any) {
  if (!cob?.receita_id) return;
  const { data: rec } = await admin.from("receitas").select("id, status, created_at").eq("id", cob.receita_id).maybeSingle();
  if (!rec || rec.status !== "pendente") return;
  const criada = new Date(rec.created_at).getTime() >= new Date(cob.created_at).getTime() - 60_000;
  if (criada) await admin.from("receitas").delete().eq("id", rec.id);
}
