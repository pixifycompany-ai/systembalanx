// Meu Perfil → WhatsApp: a empresa conecta o PRÓPRIO número (sessão própria na AstraCalls).
// Padrão: QR Code (WhatsApp → Aparelhos conectados → Conectar aparelho → aponta a câmera).
// Alternativa para quem está no próprio celular: código de 8 caracteres
// (Conectar aparelho → Conectar com número de telefone).
// actions: status | qr {novo} | conectar {telefone} | desconectar
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import QRCode from "npm:qrcode@1.5.4";
import { ASTRA, astra, chaveAstra, estadoSessao, ficarOffline } from "../_shared/whatsapp.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const admin = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/** Espera, no stream de eventos da AstraCalls, o próximo QR (ou a conexão) da sessão.
 *  A AstraCalls só entrega o QR por SSE; o QR se renova a cada ~20 s enquanto ninguém lê. */
async function proximoQr(sid: string, iniciarPareamento: boolean, ms = 25_000): Promise<{ qr?: string; conectado?: boolean }> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    const ev = await fetch(`${ASTRA}/api/events`, { headers: { "X-Api-Key": chaveAstra()!, Accept: "text/event-stream" }, signal: ac.signal });
    if (!ev.ok || !ev.body) return {};
    // Abre o stream ANTES de pedir o pareamento, para não perder o primeiro QR.
    if (iniciarPareamento) await astra(`/api/sessions/${sid}/pair`, { method: "POST" }).catch(() => null);
    const rd = ev.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { value, done } = await rd.read();
      if (done) return {};
      buf += dec.decode(value, { stream: true });
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const linha = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!linha.startsWith("data:")) continue;
        let j: any;
        try { j = JSON.parse(linha.slice(5)); } catch { continue; }
        if (j?.sessionId !== sid) continue;
        if (j.type === "auth-state" && j.state === "open") { rd.cancel().catch(() => {}); return { conectado: true }; }
        if ((j.type === "session-qr" || j.type === "auth-state") && j.qr) { rd.cancel().catch(() => {}); return { qr: String(j.qr) }; }
      }
    }
  } catch {
    return {};
  } finally {
    clearTimeout(t);
    ac.abort();
  }
}

function normalizarFone(v: string): string | null {
  let d = String(v || "").replace(/\D/g, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return d.length >= 12 && d.length <= 13 ? d : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) return json({ error: "Não autenticado" }, 401);
    if (!chaveAstra()) return json({ error: "WhatsApp indisponível no momento." }, 500);
    const body = await req.json().catch(() => ({}));
    const acao = body.action || "status";

    const { data: linha } = await admin.from("whatsapp_conexoes").select("*").eq("user_id", user.id).maybeSingle();

    // ---------- status ----------
    if (acao === "status") {
      if (!linha) return json({ conectado: false, estado: null, numero: null });
      const e = await estadoSessao(linha.sid);
      const conectado = e.estado === "open";
      const numero = e.numero || linha.numero;
      if (e.estado !== linha.estado || (numero && numero !== linha.numero)) {
        await admin.from("whatsapp_conexoes").update({
          estado: e.existe ? e.estado : "removida", numero,
          ...(conectado && linha.estado !== "open" ? { conectado_em: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);
        // Acabou de parear: já deixa offline, para o celular continuar recebendo notificação.
        if (conectado && linha.estado !== "open") await ficarOffline(linha.sid);
      }
      return json({ conectado, estado: e.existe ? e.estado : "removida", numero });
    }

    // ---------- qr ----------
    if (acao === "qr") {
      let sid: string | null = linha?.sid || null;
      if (sid) {
        const e = await estadoSessao(sid);
        if (e.estado === "open") return json({ conectado: true, numero: e.numero || linha?.numero || null });
        if (!e.existe) sid = null;
      }
      if (!sid) {
        const c = await astra("/api/sessions", { body: { name: `balanx_${user.id.slice(0, 8)}` } });
        sid = c.data?.id;
        if (!c.ok || !sid) return json({ error: "Não consegui preparar a conexão. Tente de novo." }, 502);
        await admin.from("whatsapp_conexoes").upsert({ user_id: user.id, sid, numero: null, estado: "qr", conectado_em: null, updated_at: new Date().toISOString() });
      } else if (linha?.estado !== "qr") {
        await admin.from("whatsapp_conexoes").update({ estado: "qr", updated_at: new Date().toISOString() }).eq("user_id", user.id);
      }
      // novo = pede um pareamento do zero; senão só espera o próximo QR (renovação).
      const r = await proximoQr(sid, body.novo !== false);
      if (r.conectado) return json({ conectado: true });
      if (!r.qr) return json({ expirado: true });
      const svg = await QRCode.toString(r.qr, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      return json({ qr_svg: svg });
    }

    // ---------- conectar (código) ----------
    if (acao === "conectar") {
      const fone = normalizarFone(body.telefone);
      if (!fone) return json({ error: "Informe o WhatsApp com DDD (ex.: 65 99999-0000)." }, 400);
      let sid: string | null = linha?.sid || null;
      if (sid) {
        const e = await estadoSessao(sid);
        if (e.estado === "open") return json({ error: "Já existe um WhatsApp conectado. Desconecte antes de trocar." }, 400);
        if (!e.existe) sid = null;
      }
      if (!sid) {
        const c = await astra("/api/sessions", { body: { name: `balanx_${user.id.slice(0, 8)}` } });
        sid = c.data?.id;
        if (!c.ok || !sid) return json({ error: "Não consegui preparar a conexão. Tente de novo." }, 502);
        await admin.from("whatsapp_conexoes").upsert({ user_id: user.id, sid, numero: fone, estado: "pairing_code", conectado_em: null, updated_at: new Date().toISOString() });
      } else {
        await admin.from("whatsapp_conexoes").update({ numero: fone, estado: "pairing_code", updated_at: new Date().toISOString() }).eq("user_id", user.id);
      }
      const p = await astra(`/api/sessions/${sid}/pair-code`, { body: { phone: fone } });
      if (!p.ok || !p.data?.code) {
        console.error("pair-code", p.status, p.data);
        return json({ error: "O WhatsApp não gerou o código agora. Confira o número e tente de novo em instantes." }, 502);
      }
      return json({ code: String(p.data.code), numero: fone });
    }

    // ---------- desconectar ----------
    if (acao === "desconectar") {
      if (!linha) return json({ ok: true });
      await astra(`/api/sessions/${linha.sid}/logout`, { method: "POST" }).catch(() => null);
      await astra(`/api/sessions/${linha.sid}`, { method: "DELETE" }).catch(() => null);
      await admin.from("whatsapp_conexoes").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (e) {
    console.error("whatsapp-conexao", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
