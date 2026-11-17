// Conectar / desconectar a conta Google (Agenda + Tarefas).
// actions: "url" (link de autorização), "trocar" (code → tokens; cria a agenda e a
// lista "BALANX"), "desconectar" (revoga e apaga a conexão).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { CAL, ESCOPOS, FUSO, TASKS, conferirState, credenciais, criarState, gapi } from "../_shared/google.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Só estes endereços podem receber o retorno do Google.
const RETORNOS = new Set([
  "https://app.balanx.com.br/integracoes/google/retorno",
  "http://localhost:8080/integracoes/google/retorno",
]);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await supabase.auth.getUser(auth.replace("Bearer ", ""));
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { id, secret } = credenciais();

    if (body.action === "url") {
      const redirect = String(body.redirect_uri || "");
      if (!RETORNOS.has(redirect)) return json({ error: "Endereço de retorno não autorizado." }, 400);
      const p = new URLSearchParams({
        client_id: id, redirect_uri: redirect, response_type: "code", scope: ESCOPOS,
        access_type: "offline", prompt: "consent", include_granted_scopes: "true",
        state: await criarState(user.id),
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${p}` });
    }

    if (body.action === "trocar") {
      const redirect = String(body.redirect_uri || "");
      if (!RETORNOS.has(redirect)) return json({ error: "Endereço de retorno não autorizado." }, 400);
      if (!(await conferirState(body.state, user.id))) return json({ error: "Link de autorização expirado. Tente conectar de novo." }, 400);
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code: String(body.code || ""), client_id: id, client_secret: secret, redirect_uri: redirect, grant_type: "authorization_code" }),
      });
      const tk = await r.json().catch(() => ({}));
      if (!r.ok || !tk.access_token) return json({ error: `O Google recusou a autorização (${tk.error_description || tk.error || r.status}).` }, 400);
      const token = tk.access_token as string;
      const escopos = String(tk.scope || "");
      if (!escopos.includes("calendar.app.created")) return json({ error: "Marque a permissão da Agenda na tela do Google para conectar." }, 400);

      const info = await gapi(token, "https://openidconnect.googleapis.com/v1/userinfo");
      const { data: existente } = await admin.from("google_integracoes").select("calendar_id, tasklist_id, refresh_token").eq("user_id", user.id).maybeSingle();

      // Agenda "BALANX" (reaproveita se ainda existir)
      let calendarId = existente?.calendar_id as string | null;
      if (calendarId) {
        const chk = await gapi(token, `${CAL}/calendars/${encodeURIComponent(calendarId)}`);
        if (!chk.ok) calendarId = null;
      }
      if (!calendarId) {
        const c = await gapi(token, `${CAL}/calendars`, { method: "POST", body: JSON.stringify({ summary: "BALANX", description: "Vencimentos, recebimentos e compromissos do BALANX.", timeZone: FUSO }) });
        if (!c.ok) return json({ error: "Não consegui criar a agenda BALANX no Google." }, 400);
        calendarId = c.json.id;
      }
      // Lista de tarefas "BALANX" (só com a permissão de Tarefas)
      let tasklistId = existente?.tasklist_id as string | null;
      if (escopos.includes("/auth/tasks")) {
        if (tasklistId) {
          const chk = await gapi(token, `${TASKS}/users/@me/lists/${tasklistId}`);
          if (!chk.ok) tasklistId = null;
        }
        if (!tasklistId) {
          const l = await gapi(token, `${TASKS}/users/@me/lists`, { method: "POST", body: JSON.stringify({ title: "BALANX" }) });
          tasklistId = l.ok ? l.json.id : null;
        }
      } else tasklistId = null;

      const { data: perfil } = await admin.from("profiles").select("current_tenant_id").eq("user_id", user.id).maybeSingle();
      const { error } = await admin.from("google_integracoes").upsert({
        user_id: user.id, tenant_id: perfil?.current_tenant_id ?? null,
        email: info.json?.email ?? null,
        refresh_token: tk.refresh_token || existente?.refresh_token || null,
        access_token: token, token_expira: new Date(Date.now() + Number(tk.expires_in || 3600) * 1000).toISOString(),
        escopos, calendar_id: calendarId, tasklist_id: tasklistId,
        sync_token: null, tasks_sync_em: null, ultimo_erro: null,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, email: info.json?.email ?? null, tarefas: !!tasklistId });
    }

    if (body.action === "desconectar") {
      const { data: integ } = await admin.from("google_integracoes").select("refresh_token, access_token").eq("user_id", user.id).maybeSingle();
      const t = integ?.refresh_token || integ?.access_token;
      if (t) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, { method: "POST" }).catch(() => {});
      await admin.from("google_eventos").delete().eq("user_id", user.id);
      await admin.from("agenda_itens").update({ google_event_id: null, google_task_id: null, google_sync_em: null }).eq("user_id", user.id);
      await admin.from("google_integracoes").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
