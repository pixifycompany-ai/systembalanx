import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Só superadmin
    const { data: isAdmin } = await supabase.rpc("is_platform_admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "Apenas superadmin." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { preco_mensal, preco_anual_parcela } = await req.json();
    const pm = Number(preco_mensal), pa = Number(preco_anual_parcela);
    if (!(pm > 0) || !(pa > 0)) {
      return new Response(JSON.stringify({ error: "Preços inválidos." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

    // 1) Atualiza o config global
    await admin.from("plataforma_config").update({
      preco_mensal: pm, preco_anual_parcela: pa, updated_at: new Date().toISOString(),
    }).eq("id", true);

    // 2) Sincroniza assinaturas ativas no ASAAS (não-cortesia, com subscription)
    let atualizadas = 0;
    const apiKey = Deno.env.get("ASAAS_API_KEY");
    if (apiKey) {
      const base = asaasBase();
      const headers = { "Content-Type": "application/json", access_token: apiKey };
      const { data: tenants } = await admin
        .from("tenants")
        .select("id, ciclo, asaas_subscription_id, cortesia")
        .not("asaas_subscription_id", "is", null)
        .eq("cortesia", false);
      for (const t of tenants || []) {
        const value = t.ciclo === "anual" ? pa * 12 : pm;
        try {
          const r = await fetch(`${base}/subscriptions/${t.asaas_subscription_id}`, {
            method: "PUT", headers,
            body: JSON.stringify({ value, updatePendingPayments: true }),
          });
          if (r.ok) atualizadas++;
        } catch (_e) { /* segue */ }
      }
    }

    return new Response(JSON.stringify({ ok: true, preco_mensal: pm, preco_anual_parcela: pa, assinaturas_atualizadas: atualizadas }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("asaas-sync-plano error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
