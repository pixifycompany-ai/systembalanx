// E-mail de cobrança: template HTML + envio via Resend.
// Usado no envio manual (email-enviar) e no cron (cobranca-auto-disparar).
// deno-lint-ignore-file no-explicit-any

export interface DadosCobrancaEmail {
  cliente: string;
  descricao: string;
  valor: string; // já formatado (R$ 1.234,56)
  vencimento: string; // já formatado (dd/mm/aaaa)
  link?: string | null;
  pix?: string | null;
  titular?: string | null;
  intro?: string | null; // frase/corpo de abertura (personalizável, já substituído)
  subject?: string | null; // assunto já substituído (sobrescreve o padrão)
  remetenteNome?: string | null; // nome da agência/assinatura no rodapé
}

// Templates padrão (mesmos placeholders do WhatsApp). Usados quando o usuário não
// personalizou no Meu Perfil.
export const EMAIL_ASSUNTO_PADRAO = "Cobrança: {descricao} — vence {vencimento}";
export const EMAIL_CORPO_PADRAO = "Segue sua cobrança de {descricao}. Qualquer dúvida, é só responder este e-mail.";

/** Substitui os placeholders de um template de e-mail (assunto ou corpo). */
export function preencherEmailTpl(tpl: string, d: Record<string, string>): string {
  return (tpl || "")
    .replace(/\{cliente\}/g, d.cliente ?? "")
    .replace(/\{descricao\}/g, d.descricao ?? "")
    .replace(/\{valor\}/g, d.valor ?? "")
    .replace(/\{vencimento\}/g, d.vencimento ?? "")
    .replace(/\{link\}/g, d.link ?? "")
    .replace(/\{pix\}/g, d.pix ?? "")
    .replace(/\{titular\}/g, d.titular ?? "")
    .trim();
}

function esc(s: string): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function assuntoCobranca(d: DadosCobrancaEmail): string {
  const desc = (d.descricao || "cobrança").trim();
  return `Cobrança: ${desc} — vence ${d.vencimento}`;
}

/** Monta o e-mail (HTML + texto puro de fallback). */
export function montarEmailCobranca(d: DadosCobrancaEmail): { subject: string; html: string; text: string } {
  const remetente = (d.remetenteNome || "").trim();
  const intro = (d.intro || `Segue sua cobrança de ${d.descricao}.`).trim();
  const temLink = !!(d.link && d.link.trim());
  const temPix = !!(d.pix && d.pix.trim());

  const botao = temLink
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;">
         <tr><td style="border-radius:12px;background:#2f6bff;">
           <a href="${esc(d.link!)}" target="_blank"
              style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:12px;">
             Pagar agora
           </a>
         </td></tr>
       </table>`
    : "";

  const pixBloco = temPix
    ? `<div style="margin:18px 0;padding:14px 16px;background:#f3f6ff;border:1px solid #dfe6fb;border-radius:12px;">
         <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Chave PIX</div>
         <div style="font-family:'Courier New',monospace;font-size:15px;color:#111827;word-break:break-all;">${esc(d.pix!)}</div>
         ${d.titular ? `<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b7280;margin-top:6px;">Em nome de: ${esc(d.titular)}</div>` : ""}
       </div>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f5f7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #eceef2;">
        <tr><td style="padding:22px 28px 0 28px;">
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#2f6bff;letter-spacing:.02em;">${esc(remetente || "Cobrança")}</div>
        </td></tr>
        <tr><td style="padding:16px 28px 4px 28px;">
          <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111827;">Olá, ${esc(d.cliente)}! 👋</p>
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#374151;">${esc(intro)}</p>
        </td></tr>
        <tr><td style="padding:18px 28px 0 28px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eceef2;border-radius:12px;">
            <tr>
              <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">Descrição</td>
              <td style="padding:14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;text-align:right;font-weight:bold;">${esc(d.descricao)}</td>
            </tr>
            <tr>
              <td style="padding:0 16px 14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">Valor</td>
              <td style="padding:0 16px 14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:18px;color:#111827;text-align:right;font-weight:bold;">${esc(d.valor)}</td>
            </tr>
            <tr>
              <td style="padding:0 16px 14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#6b7280;">Vencimento</td>
              <td style="padding:0 16px 14px 16px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#111827;text-align:right;">${esc(d.vencimento)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td align="center" style="padding:0 28px;">${botao}</td></tr>
        <tr><td style="padding:0 28px;">${pixBloco}</td></tr>
        <tr><td style="padding:8px 28px 26px 28px;">
          <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#9aa1ab;">
            Em caso de dúvida, basta responder este e-mail.${remetente ? ` — ${esc(remetente)}` : ""}
          </p>
        </td></tr>
      </table>
      <p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#b6bcc6;">Enviado via BALANX</p>
    </td></tr>
  </table>
</body></html>`;

  const text = [
    `Olá, ${d.cliente}!`,
    ``,
    intro,
    ``,
    `Descrição: ${d.descricao}`,
    `Valor: ${d.valor}`,
    `Vencimento: ${d.vencimento}`,
    temLink ? `\nPagar: ${d.link}` : "",
    temPix ? `\nChave PIX: ${d.pix}${d.titular ? ` (em nome de ${d.titular})` : ""}` : "",
    ``,
    `Em caso de dúvida, responda este e-mail.${remetente ? ` — ${remetente}` : ""}`,
  ].filter((l) => l !== "").join("\n");

  const subject = (d.subject && d.subject.trim()) ? d.subject.trim() : assuntoCobranca(d);
  return { subject, html, text };
}

export interface ResendAnexo { filename: string; path?: string; content?: string }
export interface EnviarEmailOpts {
  apiKey: string;
  from: string; // "Nome <noreply@balanx.com.br>"
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | null;
  attachments?: ResendAnexo[];
}

/** Envia via Resend. Retorna {ok, status, id?, error?}. */
export async function enviarEmailResend(opts: EnviarEmailOpts): Promise<{ ok: boolean; status: number; id?: string; error?: string }> {
  const body: Record<string, any> = {
    from: opts.from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  };
  if (opts.text) body.text = opts.text;
  if (opts.replyTo) body.reply_to = opts.replyTo;
  if (opts.attachments?.length) body.attachments = opts.attachments;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${opts.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, status: r.status, error: j?.message || j?.error?.message || `Resend ${r.status}` };
  return { ok: true, status: r.status, id: j?.id };
}
