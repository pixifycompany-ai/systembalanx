import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function asaasBase(env: string) {
  return env === "production" || env === "prod"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

// Conecta a conta Asaas DO PRÓPRIO usuário (Modelo A): valida a chave contra o
// Asaas e guarda no cobranca_config (server-side). O navegador nunca guarda a chave.
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

    const body = await req.json().catch(() => ({}));
    const action = body.action || "conectar";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Desconectar: remove a config (chave some do banco)
    if (action === "desconectar") {
      await admin.from("cobranca_config").delete().eq("user_id", user.id);
      return new Response(JSON.stringify({ ok: true, connected: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = String(body.apiKey || "").trim();
    const env = (String(body.env || "production")).toLowerCase();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Informe a chave de API do Asaas." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Valida a chave: /customers?limit=1 responde 200 se a chave é válida.
    const base = asaasBase(env);
    const headers = { "Content-Type": "application/json", access_token: apiKey };
    const test = await fetch(`${base}/customers?limit=1`, { headers });
    if (test.status === 401) {
      return new Response(JSON.stringify({ error: "Chave inválida para esse ambiente. Confira a chave e se é sandbox/produção." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!test.ok) {
      const t = await test.text();
      console.error("asaas test error", test.status, t);
      return new Response(JSON.stringify({ error: "Não consegui validar a chave no Asaas. Tente de novo." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Nome da conta (best-effort)
    let accountName: string | null = null;
    try {
      const acc = await fetch(`${base}/myAccount`, { headers });
      if (acc.ok) { const j = await acc.json(); accountName = j?.name || j?.company || j?.email || null; }
    } catch (_) { /* ignore */ }

    // Guarda a config (gera webhook_token se ainda não tiver)
    const { data: existing } = await admin.from("cobranca_config").select("webhook_token").eq("user_id", user.id).maybeSingle();
    const webhookToken = existing?.webhook_token || crypto.randomUUID();
    await admin.from("cobranca_config").upsert({
      user_id: user.id,
      asaas_api_key: apiKey,
      asaas_env: env,
      asaas_account_name: accountName,
      webhook_token: webhookToken,
      updated_at: new Date().toISOString(),
    });

    return new Response(JSON.stringify({ ok: true, connected: true, accountName, env }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("asaas-cobranca-conectar error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
