// Google (OAuth + Agenda + Tarefas) — utilitários comuns às edge functions.
// deno-lint-ignore-file no-explicit-any
type Db = any;

export const ESCOPOS = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/calendar.app.created",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/tasks",
].join(" ");

export const CAL = "https://www.googleapis.com/calendar/v3";
export const TASKS = "https://tasks.googleapis.com/tasks/v1";
export const FUSO = "America/Sao_Paulo";

export function credenciais() {
  const id = Deno.env.get("GOOGLE_CLIENT_ID");
  const secret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!id || !secret) throw new Error("Integração com o Google não configurada (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).");
  return { id, secret };
}

// state = base64url(user_id.timestamp).assinatura (HMAC com o client secret)
async function hmac(texto: string): Promise<string> {
  const { secret } = credenciais();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(texto)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function criarState(userId: string): Promise<string> {
  const corpo = btoa(`${userId}.${Date.now()}`).replace(/=+$/, "");
  return `${corpo}.${await hmac(corpo)}`;
}
export async function conferirState(state: string, userId: string): Promise<boolean> {
  const [corpo, sig] = String(state || "").split(".");
  if (!corpo || !sig || sig !== await hmac(corpo)) return false;
  const [uid, ts] = atob(corpo).split(".");
  return uid === userId && Date.now() - Number(ts) < 30 * 60 * 1000;
}

/** Access token válido (renova com o refresh token quando faltar < 2 min). */
export async function tokenValido(admin: Db, integ: any): Promise<string> {
  if (integ.access_token && integ.token_expira && new Date(integ.token_expira).getTime() - Date.now() > 120_000) {
    return integ.access_token;
  }
  if (!integ.refresh_token) throw new Error("reconectar");
  const { id, secret } = credenciais();
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: id, client_secret: secret, refresh_token: integ.refresh_token, grant_type: "refresh_token" }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const erro = (j as any)?.error === "invalid_grant" ? "reconectar" : `token: ${(j as any)?.error || r.status}`;
    await admin.from("google_integracoes").update({ ultimo_erro: erro }).eq("user_id", integ.user_id);
    throw new Error(erro);
  }
  const expira = new Date(Date.now() + Number((j as any).expires_in || 3600) * 1000).toISOString();
  await admin.from("google_integracoes").update({ access_token: (j as any).access_token, token_expira: expira }).eq("user_id", integ.user_id);
  integ.access_token = (j as any).access_token;
  integ.token_expira = expira;
  return (j as any).access_token;
}

/** fetch na API do Google com o token; devolve { ok, status, json }. */
export async function gapi(token: string, url: string, init: RequestInit = {}) {
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const texto = await r.text();
  let json: any = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
  return { ok: r.ok, status: r.status, json };
}
