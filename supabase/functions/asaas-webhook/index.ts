import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Recebe webhooks do ASAAS e atualiza o status de assinatura do tenant.
// Sem JWT do Supabase (ASAAS posta direto) — protegido por token compartilhado.
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  try {
    // Autenticação do webhook (token configurado no painel do ASAAS)
    const expected = Deno.env.get("ASAAS_WEBHOOK_TOKEN");
    const got = req.headers.get("asaas-access-token") || req.headers.get("Asaas-Access-Token");
    if (expected && got !== expected) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const event: string = body?.event || "";
    const payment = body?.payment || body?.subscription || {};
    const subscriptionId: string | null = payment?.subscription || (body?.subscription?.id ?? null);
    const customerId: string | null = payment?.customer || null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Descobre o tenant pela assinatura ou cliente
    let query = admin.from("tenants").select("id, cortesia");
    if (subscriptionId) query = query.eq("asaas_subscription_id", subscriptionId);
    else if (customerId) query = query.eq("asaas_customer_id", customerId);
    else return new Response(JSON.stringify({ ok: true, skipped: "sem referência" }), { headers: { "Content-Type": "application/json" } });

    const { data: tenant } = await query.maybeSingle();
    if (!tenant) {
      return new Response(JSON.stringify({ ok: true, skipped: "tenant não encontrado" }), { headers: { "Content-Type": "application/json" } });
    }
    if (tenant.cortesia) {
      // Cortesia não é afetada por cobrança
      return new Response(JSON.stringify({ ok: true, skipped: "cortesia" }), { headers: { "Content-Type": "application/json" } });
    }

    // Cartão (crédito/débito): o dinheiro é "confirmado" na hora (PAYMENT_CONFIRMED) e só
    // LIQUIDADO ~30 dias depois (PAYMENT_RECEIVED). Pix/boleto: cai direto no PAYMENT_RECEIVED.
    // Regra: cartão libera no CONFIRMED; Pix/boleto libera no RECEIVED. Assim o RECEIVED
    // atrasado do cartão NÃO reativa a assinatura (ex.: se foi cancelada no meio).
    const billingType = String(payment?.billingType || "").toUpperCase();
    const isCartao = billingType.includes("CARD"); // CREDIT_CARD, DEBIT_CARD

    let novoStatus: string | null = null;
    if (event === "PAYMENT_CONFIRMED") {
      novoStatus = "ativa"; // cartão/débito libera aqui (e qualquer confirmação imediata)
    } else if (event === "PAYMENT_RECEIVED") {
      // Pix/boleto liberam aqui. Cartão NÃO — já liberou no CONFIRMED.
      if (!isCartao) novoStatus = "ativa";
    } else if (event === "PAYMENT_OVERDUE") {
      novoStatus = "inadimplente";
    } else if (event === "SUBSCRIPTION_DELETED" || event === "PAYMENT_DELETED" || event === "PAYMENT_REFUNDED") {
      novoStatus = "cancelada";
    }

    if (novoStatus) {
      await admin.from("tenants").update({ status_assinatura: novoStatus, updated_at: new Date().toISOString() }).eq("id", tenant.id);
    }

    return new Response(JSON.stringify({ ok: true, event, status: novoStatus }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("asaas-webhook error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
