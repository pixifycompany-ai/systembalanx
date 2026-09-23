// Conciliação cobrança (Asaas) ↔ receita "a receber".
// Antes da integração as mensalidades eram lançadas à mão (ex.: "Mensalidade
// Clario (7/8)") sem vínculo com o contrato. Ao registrar uma cobrança,
// procuramos essa receita e a vinculamos em vez de criar outra (evita duplicar).
// deno-lint-ignore-file no-explicit-any

const DIA = 86400000;
const ts = (iso: string) => new Date(String(iso).slice(0, 10) + "T12:00:00Z").getTime();
const diffDias = (a: string, b: string) => Math.round((ts(a) - ts(b)) / DIA);
const mes = (iso: string) => String(iso).slice(0, 7);
const somaDias = (iso: string, n: number) => new Date(ts(iso) + n * DIA).toISOString().slice(0, 10);

// Palavras genéricas que não identificam o serviço ("Mensalidade", "Assinatura"...)
const GENERICAS = new Set([
  "mensalidade", "assinatura", "servico", "servicos", "plataforma", "parcela", "contrato",
  "cobranca", "pagamento", "referente", "mensal", "valor", "fatura", "usuarios", "cliente",
]);
function palavras(txt: string): Set<string> {
  const norm = String(txt || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return new Set(norm.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !GENERICAS.has(w) && !/^\d+$/.test(w)));
}
function descricaoParecida(a: string, b: string): boolean {
  const pa = palavras(a);
  for (const w of palavras(b)) if (pa.has(w)) return true;
  return false;
}

export interface AlvoReceita {
  user_id: string;
  cliente_id: string | null;
  contrato_id: string | null;
  conta_id: string | null;
  descricao: string;
  valor: number;
  vencimento: string; // YYYY-MM-DD
  pago: boolean;
  data_pagamento?: string | null;
}

export interface Candidata {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: string;
  contrato_id: string | null;
  conta_id: string | null;
  diasDiferenca: number;
  mesmoValor: boolean;
  plausivel: boolean; // parece ser a mesma cobrança (valor, contrato ou descrição)
  confiavel: boolean; // bate valor/contrato E está no mesmo período
}

// Receitas em aberto do mesmo cliente, sem cobrança ligada, perto do vencimento.
export async function buscarCandidatas(admin: any, alvo: AlvoReceita, janelaDias = 35): Promise<Candidata[]> {
  if (!alvo.cliente_id) return [];
  const { data: recs } = await admin.from("receitas")
    .select("id, descricao, valor, data_vencimento, status, contrato_id, conta_id")
    .eq("user_id", alvo.user_id).eq("cliente_id", alvo.cliente_id)
    .in("status", ["pendente", "atrasado"]).is("origem_receita_id", null)
    .gte("data_vencimento", somaDias(alvo.vencimento, -janelaDias))
    .lte("data_vencimento", somaDias(alvo.vencimento, janelaDias));
  if (!recs?.length) return [];

  const { data: ligadas } = await admin.from("cobrancas")
    .select("receita_id").eq("user_id", alvo.user_id).not("receita_id", "is", null);
  const usadas = new Set((ligadas || []).map((l: any) => l.receita_id));

  return recs
    .filter((r: any) => !usadas.has(r.id) && (!r.contrato_id || r.contrato_id === alvo.contrato_id))
    .map((r: any): Candidata => {
      const d = diffDias(r.data_vencimento, alvo.vencimento);
      const mesmoValor = Math.abs(Number(r.valor) - Number(alvo.valor)) < 0.01;
      const mesmoContrato = !!alvo.contrato_id && r.contrato_id === alvo.contrato_id;
      const perto = mes(r.data_vencimento) === mes(alvo.vencimento) || Math.abs(d) <= 15;
      return {
        id: r.id, descricao: r.descricao, valor: Number(r.valor), data_vencimento: r.data_vencimento,
        status: r.status, contrato_id: r.contrato_id, conta_id: r.conta_id, diasDiferenca: d, mesmoValor,
        plausivel: mesmoValor || mesmoContrato || descricaoParecida(r.descricao, alvo.descricao),
        confiavel: perto && (mesmoValor || mesmoContrato),
      };
    })
    .sort((a: Candidata, b: Candidata) =>
      Number(b.confiavel) - Number(a.confiavel) ||
      Number(b.plausivel) - Number(a.plausivel) ||
      Math.abs(a.diasDiferenca) - Math.abs(b.diasDiferenca));
}

// "Mensalidade Revvue (4/12)" → { base: "mensalidade revvue", n: 4, total: 12 }.
// Parcelas lançadas à mão não têm grupo de recorrência gravado; a série é
// reconhecida pelo nome + "(n/total)" (o que vier depois, ex. " - 08 USUARIOS", é ignorado).
function parcela(desc: string): { base: string; n: number; total: number } | null {
  const m = String(desc || "").match(/^(.*?)\s*\((\d+)\s*\/\s*(\d+)\)/);
  if (!m) return null;
  const base = m[1].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  return base ? { base, n: Number(m[2]), total: Number(m[3]) } : null;
}

// Ao vincular uma parcela de uma série, as demais parcelas em aberto (sem fatura)
// passam a pertencer ao contrato e as FUTURAS espelham o valor da assinatura.
// Assim cada nova fatura do Asaas encontra a parcela do seu mês sozinha.
export async function propagarSerie(admin: any, receitaId: string, alvo: AlvoReceita) {
  if (!alvo.contrato_id) return;
  const { data: ref } = await admin.from("receitas").select("id, descricao, cliente_id").eq("id", receitaId).maybeSingle();
  const p = ref ? parcela(ref.descricao) : null;
  if (!ref?.cliente_id || !p) return;

  const { data: irmas } = await admin.from("receitas")
    .select("id, descricao, contrato_id")
    .eq("user_id", alvo.user_id).eq("cliente_id", ref.cliente_id)
    .in("status", ["pendente", "atrasado"]).is("origem_receita_id", null).neq("id", receitaId);
  if (!irmas?.length) return;
  const { data: ligadas } = await admin.from("cobrancas")
    .select("receita_id").eq("user_id", alvo.user_id).not("receita_id", "is", null);
  const usadas = new Set((ligadas || []).map((l: any) => l.receita_id));

  for (const r of irmas) {
    if (usadas.has(r.id)) continue; // já tem fatura própria: segue o valor dela
    if (r.contrato_id && r.contrato_id !== alvo.contrato_id) continue;
    const q = parcela(r.descricao);
    if (!q || q.base !== p.base || q.total !== p.total) continue;
    const upd: Record<string, unknown> = { contrato_id: alvo.contrato_id };
    if (q.n > p.n) upd.valor = alvo.valor;
    await admin.from("receitas").update(upd).eq("id", r.id);
  }
}

// Liga a receita existente à cobrança: passa a refletir valor e vencimento do Asaas
// (o que o cliente realmente vai pagar); mantém descrição e categoria.
export async function vincularReceita(admin: any, receitaId: string, alvo: AlvoReceita, contaAtual: string | null) {
  const upd: Record<string, unknown> = { valor: alvo.valor, data_vencimento: alvo.vencimento };
  if (alvo.contrato_id) upd.contrato_id = alvo.contrato_id;
  if (!contaAtual && alvo.conta_id) upd.conta_id = alvo.conta_id;
  if (alvo.pago) {
    upd.status = "recebido";
    upd.data_recebimento = alvo.data_pagamento || alvo.vencimento;
  }
  await admin.from("receitas").update(upd).eq("id", receitaId);
  await propagarSerie(admin, receitaId, alvo);
}

export async function criarReceita(admin: any, alvo: AlvoReceita): Promise<string | null> {
  const { data, error } = await admin.from("receitas").insert({
    user_id: alvo.user_id,
    cliente_id: alvo.cliente_id,
    contrato_id: alvo.contrato_id,
    conta_id: alvo.conta_id,
    descricao: alvo.descricao,
    valor: alvo.valor,
    data_competencia: alvo.vencimento,
    data_vencimento: alvo.vencimento,
    status: alvo.pago ? "recebido" : "pendente",
    data_recebimento: alvo.pago ? (alvo.data_pagamento || alvo.vencimento) : null,
  }).select("id").single();
  if (error) console.error("criarReceita", error.message);
  return data?.id ?? null;
}

// Automático (criação, importação e webhook):
// - uma única candidata confiável → vincula;
// - nenhuma candidata plausível → cria receita nova;
// - ambíguo → não cria nada; fica para a conciliação manual (sem duplicar).
export async function vincularOuCriarReceita(
  admin: any,
  alvo: AlvoReceita,
): Promise<{ receita_id: string | null; modo: "vinculada" | "criada" | "conciliar" }> {
  const cands = await buscarCandidatas(admin, alvo);
  let confiaveis = cands.filter((c) => c.confiavel);
  // Série mensal: se mais de uma parcela é compatível, fica a do mesmo mês da fatura.
  if (confiaveis.length > 1) {
    const doMes = confiaveis.filter((c) => mes(c.data_vencimento) === mes(alvo.vencimento));
    if (doMes.length === 1) confiaveis = doMes;
  }
  if (confiaveis.length === 1) {
    await vincularReceita(admin, confiaveis[0].id, alvo, confiaveis[0].conta_id);
    return { receita_id: confiaveis[0].id, modo: "vinculada" };
  }
  if (confiaveis.length === 0 && !cands.some((c) => c.plausivel)) {
    return { receita_id: await criarReceita(admin, alvo), modo: "criada" };
  }
  return { receita_id: null, modo: "conciliar" };
}
