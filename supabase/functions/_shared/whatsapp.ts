// WhatsApp de cada empresa via AstraCalls. A sessão (sid) da empresa fica em
// public.whatsapp_conexoes; a chave-mestra da AstraCalls (WHATSAPP_API_KEY) só existe
// no servidor e nunca vai para o navegador.
// deno-lint-ignore-file no-explicit-any

export const ASTRA = "https://apiastracalls.pixify.company";

export function chaveAstra(): string | null {
  return Deno.env.get("WHATSAPP_API_KEY") || null;
}

export async function astra(caminho: string, opts: { method?: string; body?: unknown } = {}) {
  const key = chaveAstra();
  if (!key) throw new Error("WHATSAPP_API_KEY não configurado.");
  const r = await fetch(`${ASTRA}${caminho}`, {
    method: opts.method || (opts.body ? "POST" : "GET"),
    headers: { "Content-Type": "application/json", "X-Api-Key": key },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const txt = await r.text();
  let data: any = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  return { ok: r.ok, status: r.status, data };
}

/** Sessão do WhatsApp conectada pela empresa (ou null se ela ainda não conectou). */
export async function sessaoDaEmpresa(admin: any, userId: string): Promise<string | null> {
  const { data } = await admin.from("whatsapp_conexoes").select("sid").eq("user_id", userId).maybeSingle();
  return data?.sid || null;
}

/** Estado da sessão na AstraCalls (sem credenciais). */
export async function estadoSessao(sid: string): Promise<{ existe: boolean; estado: string | null; numero: string | null }> {
  const r = await astra("/api/sessions");
  const lista = (r.data?.sessions || r.data || []) as any[];
  const s = Array.isArray(lista) ? lista.find((x) => x.id === sid) : null;
  if (!s) return { existe: false, estado: null, numero: null };
  const jid = String(s.jid || s.lastJid || "");
  return { existe: true, estado: s.state || null, numero: jid ? jid.split(/[:@]/)[0] : null };
}

/** Enviar pelo aparelho conectado deixa o número "online" e o celular do dono para de
 *  receber notificação: depois de enviar, volta a sessão para offline (falha em silêncio). */
export async function ficarOffline(sid: string) {
  await astra(`/api/sessions/${sid}/presence`, { body: { available: false } }).catch(() => null);
}

export const SEM_WHATSAPP = "Conecte o WhatsApp da sua empresa em Meu Perfil → WhatsApp para enviar por lá.";

/** Registra uma tentativa de envio em public.whatsapp_envios (histórico da cobrança).
 *  Best-effort: nunca derruba o envio (tabela ausente, erro de rede etc. são ignorados). */
export async function registrarEnvioWhats(admin: any, linha: {
  user_id: string; cobranca_id?: string | null; telefone: string;
  origem: "manual" | "auto"; status: "enviado" | "falhou"; erro?: string | null; documentos?: number;
}) {
  try {
    await admin.from("whatsapp_envios").insert({
      user_id: linha.user_id,
      cobranca_id: linha.cobranca_id || null,
      telefone: linha.telefone,
      origem: linha.origem,
      status: linha.status,
      erro: linha.erro ? String(linha.erro).slice(0, 500) : null,
      documentos: linha.documentos || 0,
    });
  } catch (_e) { /* registro é best-effort */ }
}
