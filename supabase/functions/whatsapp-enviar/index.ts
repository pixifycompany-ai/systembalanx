import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Normaliza pro formato usado no fluxo antigo: 55 + DDD + numero SEM o nono dígito.
// Ex.: "(65) 99902-0102" / "5565999020102" -> "556599020102"
function normalizarWhats(tel: string): string | null {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55")) d = d.slice(2); // tira o DDI se já vier
  if (d.length < 10) return null;
  const ddd = d.slice(0, 2);
  let num = d.slice(2);
  if (num.length === 9 && num[0] === "9") num = num.slice(1); // remove o nono dígito
  if (num.length < 8) return null;
  return "55" + ddd + num;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { telefone, text, documento_url, documento_nome } = await req.json().catch(() => ({}));
    const to = normalizarWhats(String(telefone || ""));
    if (!to) return json({ error: "Telefone do cliente inválido/ausente. Cadastre o WhatsApp com DDD." }, 400);
    if (!text || !String(text).trim()) return json({ error: "Mensagem vazia." }, 400);

    const apiKey = Deno.env.get("WHATSAPP_API_KEY");
    if (!apiKey) return json({ error: "WHATSAPP_API_KEY não configurado nos secrets da função." }, 500);
    const sid = Deno.env.get("WHATSAPP_SID") || "90d5bea1c485ebc40a7bbb5ba33ab2db";

    const resp = await fetch(`https://apiastracalls.pixify.company/api/sessions/${sid}/messages/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({ to, text: String(text) }),
    });
    const bodyText = await resp.text();
    if (!resp.ok) {
      console.error("whatsapp send error", resp.status, bodyText);
      const detalhe = bodyText ? ` — ${bodyText.slice(0, 300)}` : "";
      const dica = resp.status === 401
        ? " (chave do WhatsApp inválida ou sessão do Pixify desconectada)"
        : resp.status === 404
        ? " (sessão do WhatsApp não encontrada — confira o SID)"
        : "";
      return json({ error: `Falha ao enviar (${resp.status})${dica}${detalhe}`, status: resp.status, to }, 400);
    }

    // Envia o PDF (nota fiscal) como documento, logo após o texto.
    let docEnviado = false;
    if (documento_url) {
      const dr = await fetch(`https://apiastracalls.pixify.company/api/sessions/${sid}/messages/document`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({ to, url: String(documento_url), filename: documento_nome || "documento.pdf", mimetype: "application/pdf" }),
      });
      if (dr.ok) docEnviado = true;
      else console.error("whatsapp document error", dr.status, await dr.text().catch(() => ""));
    }
    return json({ ok: true, to, docEnviado });
  } catch (e) {
    console.error("whatsapp-enviar error", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
