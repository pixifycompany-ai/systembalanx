import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Exclusão de conta (LGPD — direito de eliminação).
// Apaga TUDO do usuário: cancela assinatura Asaas (se houver), remove o avatar do
// storage, apaga o usuário do auth.users (que CASCATEIA todos os dados: receitas,
// despesas, contas, contratos, clientes, categorias, metas, profile, memberships…)
// e limpa tenants que ficarem sem membros.

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
    const url = Deno.env.get("SUPABASE_URL")!;

    // Client do usuário (só pra validar quem é) e client admin (service role) pra apagar.
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await asUser.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = user.id;

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      return new Response(JSON.stringify({ error: "Service role não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const admin = createClient(url, serviceKey);

    // 1) Tenants onde o usuário é MEMBRO (pra descobrir os que ficarão órfãos).
    const { data: minhasMemberships } = await admin.from("tenant_members").select("tenant_id, papel").eq("user_id", userId);
    const meusTenantIds = (minhasMemberships || []).map((m: any) => m.tenant_id);

    // Tenants em que o usuário é o ÚNICO membro → serão apagados (e a assinatura cancelada).
    const soloTenantIds: string[] = [];
    for (const tid of meusTenantIds) {
      const { count } = await admin.from("tenant_members").select("id", { count: "exact", head: true }).eq("tenant_id", tid);
      if ((count ?? 0) <= 1) soloTenantIds.push(tid);
    }

    // 2) Cancela assinaturas Asaas dos tenants solo (best-effort — não bloqueia a exclusão).
    const asaasKey = Deno.env.get("ASAAS_API_KEY");
    if (asaasKey && soloTenantIds.length) {
      const { data: tenants } = await admin.from("tenants").select("id, asaas_subscription_id").in("id", soloTenantIds);
      for (const t of tenants || []) {
        const subId = (t as any).asaas_subscription_id;
        if (!subId) continue;
        try {
          await fetch(`${asaasBase()}/subscriptions/${subId}`, { method: "DELETE", headers: { access_token: asaasKey } });
        } catch (e) {
          console.error("Falha ao cancelar assinatura Asaas (segue mesmo assim):", e);
        }
      }
    }

    // 3) Remove os arquivos de avatar do storage (não cascateiam pelo banco).
    try {
      const { data: files } = await admin.storage.from("avatars").list(userId);
      if (files?.length) {
        await admin.storage.from("avatars").remove(files.map((f: any) => `${userId}/${f.name}`));
      }
    } catch (e) {
      console.error("Falha ao remover avatar (segue mesmo assim):", e);
    }

    // 4) Apaga o usuário → CASCATEIA todos os dados (user_id ON DELETE CASCADE),
    //    profile, tenant_members e platform_admins.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error("Erro ao apagar usuário:", delErr);
      return new Response(JSON.stringify({ error: "Não foi possível excluir a conta. Tente novamente." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5) Limpa os tenants que ficaram sem membros (órfãos após a exclusão).
    if (soloTenantIds.length) {
      await admin.from("tenants").delete().in("id", soloTenantIds);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("excluir-conta error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
