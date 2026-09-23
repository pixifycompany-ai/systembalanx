import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { apagarReceitaSeCriada, isPago, lancarJurosMulta, mapStatus, registrarFatura } from "../_shared/faturas.ts";

// Webhook das COBRANÇAS dos clientes (conta Asaas do próprio tenant).
// Cada tenant configura, no Asaas dele, esta URL + o token (asaas-access-token).
// Identificamos o tenant pelo token e atualizamos a cobrança + a receita.
// Uma fatura pode ter várias linhas (contratos agrupados numa assinatura só).

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

    // Todas as linhas desta fatura (1 normalmente; N quando os contratos são agrupados)
    const { data: linhas } = await admin.from("cobrancas").select("*")
      .eq("asaas_payment_id", payment.id).eq("user_id", userId)
      .order("created_at", { ascending: true }).order("id", { ascending: true });

    // Fatura nova de uma assinatura → cria as linhas + receitas (vinculando as já lançadas)
    if (!linhas?.length && payment.subscription) {
      const { data: base } = await admin.from("cobrancas")
        .select("cliente_id, contrato_id, conta_id, descricao, exigir_nf")
        .eq("asaas_subscription_id", payment.subscription).eq("user_id", userId)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      await registrarFatura(admin, userId, payment, payment.subscription, {
        conta_id: base?.conta_id ?? null,
        fallback: base
          ? { contrato_id: base.contrato_id, cliente_id: base.cliente_id, descricao: base.descricao, exigir_nf: !!base.exigir_nf }
          : undefined,
      });
      return new Response(JSON.stringify({ ok: true, created: true }), { status: 200 });
    }

    if (!linhas?.length) return new Response(JSON.stringify({ ok: true, notfound: true }), { status: 200 });

    // Exclusão → cancela; a receita só some se foi criada pela integração
    // (parcela lançada à mão fica, apenas desvinculada).
    if (event === "PAYMENT_DELETED" || payment.status === "DELETED") {
      for (const cob of linhas) {
        await apagarReceitaSeCriada(admin, cob);
        await admin.from("cobrancas").update({ status: "cancelado", receita_id: null, updated_at: new Date().toISOString() }).eq("id", cob.id);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }

    for (const cob of linhas) {
      await admin.from("cobrancas").update({
        status: novoStatus,
        invoice_url: payment.invoiceUrl ?? cob.invoice_url,
        data_pagamento: pago ? dataPag : null,
        updated_at: new Date().toISOString(),
      }).eq("id", cob.id);

      // Baixa / atualiza a receita de cada contrato
      if (!cob.receita_id) continue;
      if (pago) {
        await admin.from("receitas").update({ status: "recebido", data_recebimento: dataPag || cob.vencimento }).eq("id", cob.receita_id);
      } else if (payment.status === "OVERDUE") {
        await admin.from("receitas").update({ status: "atrasado" }).eq("id", cob.receita_id);
      } else if (["REFUNDED", "REFUND_REQUESTED"].includes(payment.status)) {
        await admin.from("receitas").update({ status: "pendente", data_recebimento: null }).eq("id", cob.receita_id);
      }
    }
    // Juros/multa de atraso → receita extra, uma vez por fatura
    if (pago) await lancarJurosMulta(admin, linhas[0], payment, dataPag);

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error("asaas-cobranca-webhook error", e);
    // 200 pra evitar reprocessamento infinito no Asaas; logamos o erro.
    return new Response(JSON.stringify({ ok: false }), { status: 200 });
  }
});
