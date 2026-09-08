import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plano único BALANX (mantido em sincronia com src/lib/plans.ts)
const PRECO_MENSAL = 49.9;
const PRECO_ANUAL = 298.8;

function asaasBase() {
  const env = (Deno.env.get("ASAAS_ENV") || "sandbox").toLowerCase();
  return env === "production" || env === "prod"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ASAAS não configurado (ASAAS_API_KEY vazio). Re-defina o secret." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tenant_id, ciclo, cpfCnpj } = await req.json();
    if (!tenant_id || !["mensal", "anual"].includes(ciclo)) {
      return new Response(JSON.stringify({ error: "Parâmetros inválidos (tenant_id, ciclo)." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Confere que o usuário é owner/admin do tenant (RLS já limita, mas validamos o papel)
    const { data: membership } = await supabase.from("tenant_members").select("papel").eq("tenant_id", tenant_id).eq("user_id", user.id).maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.papel)) {
      return new Response(JSON.stringify({ error: "Apenas owner/admin podem assinar." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: tenant } = await supabase.from("tenants").select("*").eq("id", tenant_id).maybeSingle();
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle();

    const base = asaasBase();
    const headers = { "Content-Type": "application/json", access_token: apiKey };

    // 1) Cliente ASAAS (reusa se já existe)
    let customerId = tenant.asaas_customer_id as string | null;
    if (!customerId) {
      const cRes = await fetch(`${base}/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: tenant.nome || profile?.nome || user.email,
          email: user.email,
          cpfCnpj: (cpfCnpj || "").replace(/\D/g, "") || undefined,
          externalReference: tenant_id,
        }),
      });
      const cJson = await cRes.json();
      if (!cRes.ok) {
        console.error("ASAAS customer error", cJson);
        return new Response(JSON.stringify({ error: cJson?.errors?.[0]?.description || "Erro ao criar cliente no ASAAS." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      customerId = cJson.id;
    }

    // 2) Assinatura recorrente
    const value = ciclo === "anual" ? PRECO_ANUAL : PRECO_MENSAL;
    const cycle = ciclo === "anual" ? "YEARLY" : "MONTHLY";
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 1);

    const sRes = await fetch(`${base}/subscriptions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED", // cliente escolhe Pix/Boleto/Cartão na fatura
        value,
        nextDueDate: nextDueDate.toISOString().split("T")[0],
        cycle,
        description: `BALANX — plano ${ciclo}`,
        externalReference: tenant_id,
      }),
    });
    const sJson = await sRes.json();
    if (!sRes.ok) {
      console.error("ASAAS subscription error", sJson);
      return new Response(JSON.stringify({ error: sJson?.errors?.[0]?.description || "Erro ao criar assinatura." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3) Primeira cobrança → link de pagamento
    let invoiceUrl: string | null = null;
    const pRes = await fetch(`${base}/subscriptions/${sJson.id}/payments`, { headers });
    if (pRes.ok) {
      const pJson = await pRes.json();
      invoiceUrl = pJson?.data?.[0]?.invoiceUrl || null;
    }

    // 4) Salva ids no tenant
    await supabase.from("tenants").update({
      asaas_customer_id: customerId,
      asaas_subscription_id: sJson.id,
      ciclo,
      status_assinatura: tenant.cortesia ? tenant.status_assinatura : "inadimplente",
      updated_at: new Date().toISOString(),
    }).eq("id", tenant_id);

    return new Response(JSON.stringify({ subscriptionId: sJson.id, invoiceUrl }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("asaas-assinar error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
