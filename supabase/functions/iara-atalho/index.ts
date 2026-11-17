// IARA pelo Atalho do iPhone ("Tocar atrás" → falar → a IARA responde em voz).
//
// Dois jeitos de chamar:
// 1) Pelo Atalho: Authorization: Bearer iara_xxx (chave pessoal) + corpo {"texto": "..."}
//    (ou texto puro). Responde em TEXTO PURO, curto, para o iPhone ler em voz alta.
//    Por dentro abre uma sessão do próprio usuário e chama a financial-advisor — então
//    a IARA só enxerga o que a pessoa já enxerga (RLS). Ações que mudam algo NÃO são
//    aplicadas: viram "pendentes" para confirmar no app (com push, se houver).
// 2) Pelo app (JWT do usuário): {action: "status" | "gerar" | "revogar"}.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { p256 } from "npm:@noble/curves@2.2.0/nist.js";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });
const texto = (t: string, status = 200) => new Response(t, { status, headers: { ...cors, "Content-Type": "text/plain; charset=utf-8" } });

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

async function sha256(s: string) {
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}
function novaChave() {
  const alfa = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint8Array(32));
  return "iara_" + [...r].map((x) => alfa[x % alfa.length]).join("");
}

/** Texto para falar: sem markdown, tabelas nem emojis. */
function paraVoz(t: string) {
  return t
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*\|.*\|\s*$/gm, "")
    .replace(/\*\*|__|`|^#+\s*/gm, "")
    .replace(/^\s*[-•*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\p{Extended_Pictographic}|️/gu, "")
    .replace(/R\$\s?/g, "R$ ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

// ---- Push (mesma configuração do notify-test) ----
let pushPronto = false;
function prepararPush() {
  if (pushPronto) return true;
  const priv = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!priv) return false;
  const raw = (Deno.env.get("VAPID_SUBJECT") || "mailto:no-reply@pixify.company").trim().replace(/\s+/g, "");
  const subject = /^(mailto:|https?:\/\/)/.test(raw) ? raw : `mailto:${raw}`;
  const b64 = (priv + "=".repeat((4 - (priv.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const pub = p256.getPublicKey(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)), false);
  const pubB64 = btoa(String.fromCharCode(...pub)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  webpush.setVapidDetails(subject, pubB64, priv);
  pushPronto = true;
  return true;
}
async function avisarNoCelular(userId: string, corpo: string, url: string) {
  if (!prepararPush()) return 0;
  const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId);
  let enviados = 0;
  for (const s of (subs || []) as any[]) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: "IARA", body: corpo, url, tag: `iara-${Date.now()}` }));
      enviados++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return enviados;
}

/** Sessão curta do próprio usuário (para a IARA rodar com a RLS dele). */
async function sessaoDoUsuario(userId: string): Promise<string> {
  const { data: u, error } = await admin.auth.admin.getUserById(userId);
  if (error || !u?.user?.email) throw new Error("usuário não encontrado");
  const { data: link, error: e2 } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
  if (e2 || !link?.properties?.hashed_token) throw new Error("não consegui abrir a sessão");
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: s, error: e3 } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "email" });
  if (e3 || !s?.session?.access_token) throw new Error("não consegui abrir a sessão");
  return s.session.access_token;
}
async function encerrarSessao(token: string) {
  await fetch(`${SUPABASE_URL}/auth/v1/logout?scope=local`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  }).catch(() => {});
}

/** Chama a IARA (financial-advisor) e junta a resposta do stream. */
async function perguntarIara(token: string, pergunta: string) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/financial-advisor`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: pergunta }], canal: "voz" }),
  });
  if (!r.ok) {
    let msg = "A IARA não respondeu agora.";
    try { const j = await r.json(); if (j?.error) msg = j.error; } catch { /* sem corpo */ }
    return { resposta: msg, acoes: [] as any[], lancamentos: [] as any[] };
  }
  const bruto = await r.text();
  let resposta = ""; let acoes: any[] = []; let lancamentos: any[] = [];
  for (const linha of bruto.split("\n")) {
    if (!linha.startsWith("data: ")) continue;
    const s = linha.slice(6).trim();
    if (!s || s === "[DONE]") continue;
    try {
      const p = JSON.parse(s);
      const d = p.choices?.[0]?.delta?.content;
      if (d) resposta += d;
      if (Array.isArray(p.acoes) && p.acoes.length) acoes = p.acoes;
      if (Array.isArray(p.lancamentos) && p.lancamentos.length) lancamentos = p.lancamentos;
    } catch { /* linha incompleta */ }
  }
  return { resposta, acoes, lancamentos };
}

async function lerPergunta(req: Request): Promise<string> {
  const bruto = (await req.text()).trim();
  if (!bruto) return "";
  try {
    const j = JSON.parse(bruto);
    if (typeof j === "string") return j;
    return String(j?.texto ?? j?.text ?? j?.pergunta ?? "");
  } catch {
    try { const f = new URLSearchParams(bruto); const v = f.get("texto") || f.get("text"); if (v) return v; } catch { /* não é form */ }
    return bruto;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();

  // ---------- 1) Chamada do Atalho ----------
  if (token.startsWith("iara_")) {
    const { data: chave } = await admin.from("iara_chaves").select("user_id").eq("hash", await sha256(token)).maybeSingle();
    if (!chave) return texto("Essa chave do atalho não vale mais. Gere outra no BALANX, em Meu Perfil, Atalho do iPhone.", 401);
    const pergunta = (await lerPergunta(req)).slice(0, 2000).trim();
    if (!pergunta) return texto("Não ouvi nada. Tente de novo.");
    await admin.from("iara_chaves").update({ ultimo_uso: new Date().toISOString() }).eq("user_id", chave.user_id);

    let sessao: string | null = null;
    try {
      sessao = await sessaoDoUsuario(chave.user_id);
      const { resposta, acoes, lancamentos } = await perguntarIara(sessao, pergunta);
      let fala = paraVoz(resposta) || "Pronto.";
      if (acoes.length || lancamentos.length) {
        const { data: p } = await admin.from("iara_pendentes").insert({
          user_id: chave.user_id, pergunta, resposta: resposta || fala,
          acoes: acoes.length ? acoes : null, lancamentos: lancamentos.length ? lancamentos : null,
        }).select("id").single();
        const url = p?.id ? `/iara?pendente=${p.id}` : "/iara";
        const n = await avisarNoCelular(chave.user_id, "Preparei o que você pediu. Toque para conferir e confirmar.", url);
        fala += n
          ? " Nada foi alterado ainda: te mandei uma notificação para você conferir e confirmar."
          : " Nada foi alterado ainda: abra a IARA no BALANX para conferir e confirmar.";
      }
      return texto(fala);
    } catch (e) {
      console.error("iara-atalho", e);
      return texto("Não consegui falar com a IARA agora. Tente de novo em instantes.", 500);
    } finally {
      if (sessao) await encerrarSessao(sessao);
    }
  }

  // ---------- 2) Chamada do app (JWT do usuário) ----------
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await userClient.auth.getUser(token);
  if (!user) return json({ error: "Não autenticado" }, 401);
  let body: any = {};
  try { body = await req.json(); } catch { /* sem corpo */ }

  if (body.action === "gerar") {
    const chave = novaChave();
    const { error } = await admin.from("iara_chaves").upsert({
      user_id: user.id, hash: await sha256(chave), prefixo: chave.slice(0, 9), created_at: new Date().toISOString(), ultimo_uso: null,
    });
    if (error) return json({ error: error.message }, 400);
    return json({ chave, url: `${SUPABASE_URL}/functions/v1/iara-atalho` });
  }
  if (body.action === "revogar") {
    await admin.from("iara_chaves").delete().eq("user_id", user.id);
    return json({ ok: true });
  }
  const { data } = await admin.from("iara_chaves").select("prefixo, created_at, ultimo_uso").eq("user_id", user.id).maybeSingle();
  return json({ ativa: !!data, ...(data || {}), url: `${SUPABASE_URL}/functions/v1/iara-atalho` });
});
