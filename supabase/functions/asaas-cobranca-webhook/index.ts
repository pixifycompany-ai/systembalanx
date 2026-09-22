import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Webhook das COBRANÇAS dos clientes (conta Asaas do próprio tenant).
// Cada tenant configura, no Asaas dele, esta URL + o token (asaas-access-token).
// Identificamos o tenant pelo token e atualizamos a cobrança + a receita.

function mapStatus(s: string): string {
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
      return "pendente";
  }
}
const isPago = (s: string) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(s);

// Lança o juros/multa efetivamente recebido (informado pelo Asaas) como receita
// EXTRA na categoria "Juros/Multa", vinculada à receita principal — espelha o
// campo "Juros/Multa" do lançamento manual do Fluxo de Caixa.
// deno-lint-ignore no-explicit-any
async function lancarJurosMulta(admin: any, cob: any, p: any, dataPag: string | null) {
  if (!cob?.receita_id) return;
  let extra = Number(p?.interestValue) || 0;
  if (!extra && p?.originalValue != null) extra = Number(p.value) - Number(p.originalValue);
  extra = Math.round((extra + Number.EPSILON) * 100) / 100;
  if (!(extra > 0)) return;
  const { data: existente } = await admin.from("receitas")
    .select("id").eq("origem_receita_id", cob.receita_id).ilike("descricao", "Juros/Multa%").limit(1).maybeSingle();
  if (existente) return;
  const { data: cat } = await admin.from("categorias")
    .select("id").eq("nome", "Juros/Multa").eq("tipo", "receita").eq("is_padrao", true).is("user_id", null).limit(1).maybeSingle();
  const dia = dataPag || cob.vencimento;
  await admin.from("receitas").insert({
    user_id: cob.user_id,
    cliente_id: cob.cliente_id,
    conta_id: cob.conta_id,
    categoria_id: cat?.id ?? null,
    descricao: `Juros/Multa - ${cob.descricao || "Cobrança"}`,
    valor: extra,
    data_vencimento: dia,
    data_recebimento: dia,
    status: "recebido",
    origem_receita_id: cob.receita_id,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const event: string = body.event || "";
    const payment = body.payment;
    if (!payment?.id) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });

    // Identifica o tenant pelo token do webhook
    const token = req.headers.get("asaas-access-token") || req.headers.get("Asaas-Access-Token") || "";
    const { data: cfg } = await admin.from("cobranca_config").select("user_id").eq("webhook_token", token).maybeSingle();
    if (!cfg?.user_id) {
      // Sem token válido: responde 200 pra não ficar reenfileirando, mas não processa.
      return new Response(JSON.stringify({ ok: true, unauthorized: true }), { status: 200 });
    }
    const userId = cfg.user_id as string;

    const novoStatus = mapStatus(payment.status);
    const pago = isPago(payment.status);
    const dataPag = payment.paymentDate || payment.clientPaymentDate || null;

    // Acha a cobrança existente por payment id
    let { data: cob } = await admin.from("cobrancas").select("*").eq("asaas_payment_id", payment.id).eq("user_id", userId).maybeSingle();

    // Cobrança nova gerada por uma assinatura recorrente → cria cobrança + receita a receber
    if (!cob && payment.subscription) {
      const { data: base } = await admin.from("cobrancas")
        .select("cliente_id, contrato_id, conta_id, descricao")
        .eq("asaas_subscription_id", payment.subscription).eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: rec } = await admin.from("receitas").insert({
        user_id: userId,
        cliente_id: base?.cliente_id ?? null,
        conta_id: base?.conta_id ?? null,
        descricao: base?.descricao || payment.description || "Assinatura",
        valor: Number(payment.value),
        data_vencimento: payment.dueDate,
        status: pago ? "recebido" : "pendente",
        data_recebimento: pago ? dataPag : null,
      } as never).select("id").single();
      const { data: novo } = await admin.from("cobrancas").insert({
        user_id: userId,
        cliente_id: base?.cliente_id ?? null,
        contrato_id: base?.contrato_id ?? null,
        conta_id: base?.conta_id ?? null,
        receita_id: rec?.id ?? null,
        tipo: "recorrente",
        asaas_payment_id: payment.id,
        asaas_subscription_id: payment.subscription,
        descricao: base?.descricao || payment.description || "Assinatura",
        valor: Number(payment.value),
        vencimento: payment.dueDate,
        forma_pagamento: payment.billingType || "UNDEFINED",
        status: novoStatus,
        invoice_url: payment.invoiceUrl ?? null,
        data_pagamento: pago ? dataPag : null,
      } as never).select("*").single();
      cob = novo;
      return new Response(JSON.stringify({ ok: true, created: true }), { status: 200 });
    }

    if (!cob) return new Response(JSON.stringify({ ok: true, notfound: true }), { status: 200 });

    // Evento de exclusão → cancela e remove receita pendente
    if (event === "PAYMENT_DELETED" || payment.status === "DELETED") {
      if (cob.receita_id) await admin.from("receitas").delete().eq("id", cob.receita_id).eq("status", "pendente");
      await admin.from("cobrancas").update({ status: "cancelado", updated_at: new Date().toISOString() }).eq("id", cob.id);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    // Atualiza cobrança
    await admin.from("cobrancas").update({
      status: novoStatus,
      invoice_url: payment.invoiceUrl ?? cob.invoice_url,
      data_pagamento: pago ? dataPag : null,
      updated_at: new Date().toISOString(),
    }).eq("id", cob.id);

    // Baixa / atualiza a receita vinculada
    if (cob.receita_id) {
      if (pago) {
        await admin.from("receitas").update({ status: "recebido", data_recebimento: dataPag || cob.vencimento }).eq("id", cob.receita_id);
        await lancarJurosMulta(admin, cob, payment, dataPag); // juros/multa de atraso → receita extra
      } else if (payment.status === "OVERDUE") {
        await admin.from("receitas").update({ status: "atrasado" }).eq("id", cob.receita_id);
      } else if (["REFUNDED", "REFUND_REQUESTED"].includes(payment.status)) {
        await admin.from("receitas").update({ status: "pendente", data_recebimento: null }).eq("id", cob.receita_id);
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("asaas-cobranca-webhook error", e);
    // 200 pra evitar reprocessamento infinito no Asaas; logamos o erro.
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }
});
