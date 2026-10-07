import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { montarEmailCobranca, enviarEmailResend, type ResendAnexo } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) return json({ error: "Envio por e-mail não configurado (defina RESEND_API_KEY)." }, 500);
    const fromEmail = (Deno.env.get("EMAIL_FROM") || "noreply@balanx.com.br").trim();

    const b = await req.json().catch(() => ({}));
    const para = String(b.para || "").trim();
    if (!para || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para)) {
      return json({ error: "E-mail do cliente inválido/ausente. Cadastre o e-mail." }, 400);
    }

    // Nome do remetente (assinatura) e Reply-To = e-mail da conta (agência).
    const { data: cfg } = await supabase.from("cobranca_config").select("asaas_account_name").eq("user_id", user.id).maybeSingle();
    const { data: prof } = await supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle();
    const remetenteNome = (cfg?.asaas_account_name || prof?.nome || "BALANX").trim();
    const from = `${remetenteNome.replace(/[<>\n"]/g, "")} <${fromEmail}>`;
    const replyTo = user.email || null;

    const { subject, html, text } = montarEmailCobranca({
      cliente: String(b.cliente || "cliente"),
      descricao: String(b.descricao || "cobrança"),
      valor: String(b.valor || ""),
      vencimento: String(b.vencimento || ""),
      link: b.link || null,
      pix: b.pix || null,
      titular: b.titular || null,
      intro: b.intro || null,
      remetenteNome,
    });

    // Anexa a nota fiscal (PDF) via URL assinada, se houver.
    const attachments: ResendAnexo[] = [];
    if (b.nota_fiscal_path) {
      const { data: signed } = await supabase.storage.from("notas-fiscais").createSignedUrl(String(b.nota_fiscal_path), 600);
      if (signed?.signedUrl) attachments.push({ filename: String(b.nota_fiscal_nome || "nota-fiscal.pdf"), path: signed.signedUrl });
    }

    const r = await enviarEmailResend({
      apiKey, from, to: para, subject, html, text, replyTo,
      attachments: attachments.length ? attachments : undefined,
    });
    if (!r.ok) {
      console.error("email send error", r.status, r.error);
      return json({ error: `Falha ao enviar e-mail (${r.status}): ${r.error || ""}`, status: r.status }, 400);
    }
    return json({ ok: true, id: r.id, docEnviado: attachments.length > 0 });
  } catch (e) {
    console.error("email-enviar error", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
