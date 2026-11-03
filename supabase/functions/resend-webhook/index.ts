import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Webhook do Resend → atualiza o status dos e-mails de cobrança (tabela email_envios).
// Público (o Resend não manda JWT), protegido pela assinatura Svix do Resend:
// RESEND_WEBHOOK_SECRET = "whsec_..." (Signing Secret do webhook no painel do Resend).

const STATUS: Record<string, string> = {
  "email.sent": "enviado",
  "email.delivered": "entregue",
  "email.delivery_delayed": "atrasado",
  "email.bounced": "devolvido",
  "email.complained": "spam",
  "email.failed": "falhou",
};
// Ordem de "força": um evento atrasado não rebaixa um e-mail já entregue/devolvido.
const PESO: Record<string, number> = { enviado: 1, atrasado: 2, entregue: 3, spam: 4, devolvido: 4, falhou: 4 };

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Valida a assinatura Svix: HMAC-SHA256 de "{id}.{timestamp}.{body}" com o segredo. */
async function assinaturaValida(secret: string, id: string, ts: string, body: string, header: string): Promise<boolean> {
  if (!secret || !id || !ts || !header) return false;
  // Rejeita reenvio de evento muito antigo (5 min de tolerância)
  const agora = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(Number(ts)) || Math.abs(agora - Number(ts)) > 300) return false;
  const chave = await crypto.subtle.importKey(
    "raw", b64ToBytes(secret.replace(/^whsec_/, "")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const assinado = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const esperado = btoa(String.fromCharCode(...new Uint8Array(assinado)));
  return header.split(" ").some((parte) => {
    const [versao, sig] = parte.split(",");
    return versao === "v1" && sig === esperado;
  });
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const body = await req.text();
  const ok = await assinaturaValida(
    Deno.env.get("RESEND_WEBHOOK_SECRET") || "",
    req.headers.get("svix-id") || "",
    req.headers.get("svix-timestamp") || "",
    body,
    req.headers.get("svix-signature") || "",
  );
  if (!ok) return new Response(JSON.stringify({ error: "assinatura inválida" }), { status: 401 });

  let evt: { type?: string; data?: Record<string, unknown> } = {};
  try { evt = JSON.parse(body); } catch { return new Response("json inválido", { status: 400 }); }
  const status = STATUS[evt.type || ""];
  const d = (evt.data || {}) as Record<string, any>;
  const resendId = String(d.email_id || "");
  if (!status || !resendId) return new Response(JSON.stringify({ ignorado: true }));

  const motivo = status === "devolvido"
    ? (d.bounce?.message || d.bounce?.subType || "E-mail devolvido pelo servidor do destinatário")
    : status === "falhou"
      ? (d.failed?.reason || "Falha no envio")
      : status === "spam" ? "O destinatário marcou como spam"
        : status === "atrasado" ? "Entrega atrasada (o Resend vai tentar de novo)" : null;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: atual } = await admin.from("email_envios").select("id, status").eq("resend_id", resendId).maybeSingle();
  if (!atual) return new Response(JSON.stringify({ ignorado: "envio desconhecido" })); // e-mail de outro app da mesma conta Resend
  if ((PESO[status] || 0) < (PESO[atual.status] || 0)) return new Response(JSON.stringify({ ok: true, mantido: atual.status }));

  await admin.from("email_envios").update({
    status,
    erro: motivo,
    // Falha nova volta a aparecer no aviso, mesmo se um aviso anterior foi dispensado
    ...(["devolvido", "falhou", "spam"].includes(status) ? { visto: false } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", atual.id);
  return new Response(JSON.stringify({ ok: true, status }));
});
