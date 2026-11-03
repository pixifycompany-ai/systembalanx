import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { montarEmailCobranca, enviarEmailResend, preencherEmailTpl, EMAIL_ASSUNTO_PADRAO, type ResendAnexo } from "../_shared/email.ts";
import { buscarBoletoUrl, temBoleto } from "../_shared/asaas.ts";
import { anexoDaNota } from "../_shared/notas.ts";

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

    // Nome do remetente (assinatura), assunto configurável e Reply-To = e-mail da conta.
    const { data: cfg } = await supabase.from("cobranca_config").select("asaas_account_name, email_assunto").eq("user_id", user.id).maybeSingle();
    const { data: prof } = await supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle();
    const remetenteNome = (cfg?.asaas_account_name || prof?.nome || "BALANX").trim();
    const from = `${remetenteNome.replace(/[<>\n"]/g, "")} <${fromEmail}>`;
    const replyTo = user.email || null;

    // Cobrança marcada "enviar chave PIX": o e-mail leva SÓ a chave (sem link do Asaas e
    // sem boleto anexado), igual ao WhatsApp.
    const modoPix = !!String(b.pix || "").trim();
    const vals = {
      cliente: String(b.cliente || "cliente"), descricao: String(b.descricao || "cobrança"),
      valor: String(b.valor || ""), vencimento: String(b.vencimento || ""),
      prazo: String(b.prazo || ""), dias: String(b.dias || ""),
      link: String(b.link || ""), pix: String(b.pix || ""), titular: String(b.titular || ""),
    };
    const subjectTpl = (cfg?.email_assunto || EMAIL_ASSUNTO_PADRAO);
    const { subject, html, text } = montarEmailCobranca({
      ...vals,
      link: modoPix ? null : (b.link || null),
      pix: b.pix || null,
      titular: b.titular || null,
      intro: b.intro || null, // corpo já personalizado pelo usuário no envio
      subject: preencherEmailTpl(subjectTpl, vals),
      remetenteNome,
    });

    // Anexa as notas fiscais (PDFs, até 10) com o conteúdo do arquivo. `nota_fiscal_path` é o
    // formato antigo (uma só). Para na primeira falha: quem chama apaga as N primeiras.
    const attachments: ResendAnexo[] = [];
    const notas: { path: string; nome?: string }[] = Array.isArray(b.notas)
      ? b.notas.filter((n: { path?: string }) => n?.path).slice(0, 10)
      : b.nota_fiscal_path ? [{ path: String(b.nota_fiscal_path), nome: b.nota_fiscal_nome }] : [];
    for (const n of notas) {
      const anexo = await anexoDaNota(supabase, String(n.path), String(n.nome || "nota-fiscal.pdf"));
      if (!anexo) break;
      attachments.push(anexo);
    }
    const docsEnviados = attachments.length;

    // Anexa o boleto (PDF) do Asaas quando a cobrança é boleto. Usa service role
    // para ler a chave do Asaas (que o cliente autenticado não pode ler).
    if (b.asaas_payment_id && temBoleto(b.forma) && !modoPix) {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceKey) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
        const { data: acfg } = await admin.from("cobranca_config").select("asaas_api_key, asaas_env").eq("user_id", user.id).maybeSingle();
        if (acfg?.asaas_api_key) {
          const boletoUrl = await buscarBoletoUrl(acfg.asaas_api_key, acfg.asaas_env, String(b.asaas_payment_id));
          if (boletoUrl) attachments.push({ filename: "boleto.pdf", path: boletoUrl });
        }
      }
    }

    const r = await enviarEmailResend({
      apiKey, from, to: para, subject, html, text, replyTo,
      attachments: attachments.length ? attachments : undefined,
    });
    // Registra o envio (o webhook do Resend atualiza: entregue / devolvido / falhou…)
    try {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (serviceKey) {
        const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
        await admin.from("email_envios").insert({
          user_id: user.id, cobranca_id: b.cobranca_id || null, resend_id: r.ok ? (r.id || null) : null,
          para, assunto: subject, origem: "manual",
          status: r.ok ? "enviado" : "falhou", erro: r.ok ? null : `${r.status}: ${r.error || "recusado pelo Resend"}`,
        });
      }
    } catch (_e) { /* registro é best-effort */ }
    if (!r.ok) {
      console.error("email send error", r.status, r.error);
      return json({ error: `Falha ao enviar e-mail (${r.status}): ${r.error || ""}`, status: r.status }, 400);
    }
    return json({ ok: true, id: r.id, docEnviado: docsEnviados > 0, docsEnviados, docsTotal: notas.length });
  } catch (e) {
    console.error("email-enviar error", e);
    return json({ error: e instanceof Error ? e.message : "Erro" }, 500);
  }
});
