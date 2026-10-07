import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { montarEmailCobranca, enviarEmailResend, preencherEmailTpl, EMAIL_ASSUNTO_PADRAO, EMAIL_CORPO_PADRAO, type ResendAnexo } from "../_shared/email.ts";

// Worker do cron: roda 1x/dia, encontra cobranças que casam com a regra de
// auto-envio (global ou exceção do contrato) e dispara pelo WhatsApp (Pixify),
// anexando a nota fiscal (PDF) quando houver. Protegido por CRON_SECRET.

const TPL_PADRAO =
  "Olá {cliente}! 👋\n\nSegue sua cobrança de *{descricao}*:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\nLink para pagamento:\n{link}\n\nQualquer dúvida, é só chamar!";
const TPL_PIX_PADRAO =
  "Olá {cliente}! 👋\n\nSegue sua cobrança de *{descricao}*:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\n🔑 *Chave PIX:* {pix}\n👤 Em nome de: {titular}\n\nApós o pagamento, é só enviar o comprovante. Obrigado!";

function normalizarWhats(tel: string): string | null {
  let d = String(tel || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("55")) d = d.slice(2);
  if (d.length < 10) return null;
  const ddd = d.slice(0, 2);
  let num = d.slice(2);
  if (num.length === 9 && num[0] === "9") num = num.slice(1);
  if (num.length < 8) return null;
  return "55" + ddd + num;
}
const brl = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => { const [y, m, d] = String(iso).split("-"); return d ? `${d}/${m}/${y}` : iso; };
function preencher(tpl: string, d: Record<string, string>) {
  return (tpl || TPL_PADRAO)
    .replace(/\{cliente\}/g, d.cliente).replace(/\{descricao\}/g, d.descricao)
    .replace(/\{valor\}/g, d.valor).replace(/\{vencimento\}/g, d.vencimento)
    .replace(/\{link\}/g, d.link || "").replace(/\{pix\}/g, d.pix || "").replace(/\{titular\}/g, d.titular || "");
}
function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD
}
function diffDias(dueISO: string, hojeISO: string): number {
  const a = new Date(dueISO + "T12:00:00Z").getTime();
  const b = new Date(hojeISO + "T12:00:00Z").getTime();
  return Math.round((a - b) / 86400000);
}

// deno-lint-ignore no-explicit-any
function regraEfetiva(contrato: any, cfg: any): { antes: number; noDia: boolean; atrasoDiario: boolean; atrasoMax: number } | null {
  const modo = contrato?.cobranca_auto_modo || "padrao";
  if (modo === "off") return null;
  if (modo === "custom") {
    return {
      antes: contrato.cobranca_auto_antes_dias ?? 0,
      noDia: !!contrato.cobranca_auto_no_dia,
      atrasoDiario: !!contrato.cobranca_auto_atraso_diario,
      atrasoMax: cfg?.auto_wpp_atraso_max_dias ?? 0,
    };
  }
  if (!cfg?.auto_wpp_enabled) return null;
  return {
    antes: cfg.auto_wpp_antes_dias ?? 0,
    noDia: !!cfg.auto_wpp_no_dia,
    atrasoDiario: !!cfg.auto_wpp_atraso_diario,
    atrasoMax: cfg.auto_wpp_atraso_max_dias ?? 0,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  const secret = Deno.env.get("CRON_SECRET");
  const got = req.headers.get("x-cron-secret") || "";
  if (!secret || got !== secret) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const apiKey = Deno.env.get("WHATSAPP_API_KEY");
  const sid = Deno.env.get("WHATSAPP_SID") || "90d5bea1c485ebc40a7bbb5ba33ab2db";
  if (!apiKey) return new Response(JSON.stringify({ error: "WHATSAPP_API_KEY ausente" }), { status: 500 });
  // E-mail (Resend) é opcional: se não configurado, o canal de e-mail é só ignorado.
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const emailFrom = (Deno.env.get("EMAIL_FROM") || "noreply@balanx.com.br").trim();

  const hoje = hojeSP();

  const { data: cfgs } = await admin.from("cobranca_config")
    .select("user_id, asaas_account_name, email_assunto, email_corpo, whatsapp_template, whatsapp_template_pix, pix_chave, pix_titular, auto_wpp_enabled, auto_wpp_antes_dias, auto_wpp_no_dia, auto_wpp_atraso_diario, auto_wpp_atraso_max_dias");
  const cfgBy = new Map((cfgs || []).map((c) => [c.user_id, c]));
  // Reply-To do e-mail = e-mail de login da agência (resolvido sob demanda, com cache).
  const emailAgenciaCache = new Map<string, string | null>();
  const emailAgencia = async (userId: string): Promise<string | null> => {
    if (emailAgenciaCache.has(userId)) return emailAgenciaCache.get(userId)!;
    let email: string | null = null;
    try { const { data } = await admin.auth.admin.getUserById(userId); email = data?.user?.email ?? null; } catch { /* noop */ }
    emailAgenciaCache.set(userId, email);
    return email;
  };

  const { data: cobs } = await admin.from("cobrancas")
    .select("id, user_id, cliente_id, contrato_id, asaas_payment_id, descricao, valor, vencimento, invoice_url, status, exigir_nf, envio_pix, nota_fiscal_path, nota_fiscal_nome, nota_fiscal_enviada, auto_wpp_ultimo_dia, auto_email_ultimo_dia, created_at, clientes(nome, telefone, email, canal_cobranca), contratos(cobranca_auto_modo, cobranca_auto_antes_dias, cobranca_auto_no_dia, cobranca_auto_atraso_diario)")
    .in("status", ["pendente", "vencido"])
    .order("created_at", { ascending: true });

  // Uma mensagem por FATURA: contratos agrupados numa assinatura têm várias linhas
  // para a mesma fatura (valor = soma; descrição = "A + B"; regra do 1º contrato).
  // deno-lint-ignore no-explicit-any
  const faturas = new Map<string, any[]>();
  for (const c of cobs || []) {
    const k = c.asaas_payment_id || c.id;
    if (!faturas.has(k)) faturas.set(k, []);
    faturas.get(k)!.push(c);
  }

  let enviados = 0, enviadosEmail = 0, pulados = 0, faltaNf = 0, erros = 0;

  for (const linhas of faturas.values()) {
    const cob = linhas[0];
    try {
      const cfg = cfgBy.get(cob.user_id);
      // deno-lint-ignore no-explicit-any
      const regra = regraEfetiva(cob.contratos as any, cfg);
      if (!regra) { pulados++; continue; }

      const d = diffDias(cob.vencimento, hoje);
      let deve = false;
      if (d > 0 && regra.antes > 0 && d === regra.antes) deve = true;
      else if (d === 0 && regra.noDia) deve = true;
      else if (d < 0 && regra.atrasoDiario) {
        const atraso = -d;
        if (regra.atrasoMax === 0 || atraso <= regra.atrasoMax) deve = true;
      }
      if (!deve) { pulados++; continue; }

      // deno-lint-ignore no-explicit-any
      const cli = cob.clientes as any;
      const canal = (cli?.canal_cobranca || "whatsapp") as string;
      const wantWpp = canal === "whatsapp" || canal === "ambos";
      const wantEmail = canal === "email" || canal === "ambos";

      // Dados comuns da fatura (grupo = soma das linhas, descrição "A + B").
      const descricao = linhas.map((l) => l.descricao).filter(Boolean).join(" + ") || "cobrança";
      const valorNum = linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
      const comNf = linhas.find((l) => l.nota_fiscal_path);
      const exigeNf = linhas.some((l) => l.exigir_nf);
      const nfJaEnviada = linhas.some((l) => l.nota_fiscal_enviada);
      const bloqueadoPorNf = exigeNf && !comNf && !nfJaEnviada;
      const nfPath: string | null = comNf?.nota_fiscal_path ?? null;
      const nfNome = comNf?.nota_fiscal_nome || "nota-fiscal.pdf";
      const usaPix = linhas.some((l) => l.envio_pix) && !!cfg?.pix_chave;

      let algoEnviado = false;      // marcou canal com sucesso?
      let removerNf = false;        // NF entregue em algum canal → pode apagar
      let fezAlgumaTentativa = false;

      // ---------- WhatsApp ----------
      const jaWppHoje = linhas.some((l) => l.auto_wpp_ultimo_dia === hoje);
      const to = wantWpp ? normalizarWhats(cli?.telefone || "") : null;
      if (wantWpp && to && !jaWppHoje) {
        fezAlgumaTentativa = true;
        if (bloqueadoPorNf) { faltaNf++; }
        else {
          const tpl = usaPix ? (cfg?.whatsapp_template_pix || TPL_PIX_PADRAO) : (cfg?.whatsapp_template || TPL_PADRAO);
          const text = preencher(tpl, {
            cliente: cli?.nome || "cliente", descricao, valor: brl(valorNum), vencimento: dataBR(cob.vencimento),
            link: cob.invoice_url || "", pix: cfg?.pix_chave || "", titular: cfg?.pix_titular || "",
          });
          const tr = await fetch(`https://apiastracalls.pixify.company/api/sessions/${sid}/messages/text`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
            body: JSON.stringify({ to, text }),
          });
          if (!tr.ok) { erros++; console.error("auto text fail", cob.id, tr.status, await tr.text().catch(() => "")); }
          else {
            if (nfPath) {
              const { data: signed } = await admin.storage.from("notas-fiscais").createSignedUrl(nfPath, 600);
              if (signed?.signedUrl) {
                const dr = await fetch(`https://apiastracalls.pixify.company/api/sessions/${sid}/messages/document`, {
                  method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
                  body: JSON.stringify({ to, url: signed.signedUrl, filename: nfNome, mimetype: "application/pdf" }),
                }).catch(() => null);
                if (dr && dr.ok) removerNf = true;
              }
            }
            await admin.from("cobrancas").update({ auto_wpp_ultimo_dia: hoje }).in("id", linhas.map((l) => l.id));
            enviados++; algoEnviado = true;
          }
        }
      }

      // ---------- E-mail (Resend) ----------
      const jaEmailHoje = linhas.some((l) => l.auto_email_ultimo_dia === hoje);
      const para = wantEmail ? String(cli?.email || "").trim() : "";
      const emailValido = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(para);
      if (wantEmail && resendKey && emailValido && !jaEmailHoje) {
        fezAlgumaTentativa = true;
        if (bloqueadoPorNf) { faltaNf++; }
        else {
          const remetenteNome = (cfg?.asaas_account_name || "BALANX").trim();
          const valsEmail = {
            cliente: cli?.nome || "cliente", descricao, valor: brl(valorNum), vencimento: dataBR(cob.vencimento),
            link: cob.invoice_url || "", pix: usaPix ? (cfg?.pix_chave || "") : "", titular: usaPix ? (cfg?.pix_titular || "") : "",
          };
          const { subject, html, text } = montarEmailCobranca({
            cliente: valsEmail.cliente, descricao, valor: valsEmail.valor, vencimento: valsEmail.vencimento,
            link: cob.invoice_url || null, pix: usaPix ? (cfg?.pix_chave || null) : null,
            titular: usaPix ? (cfg?.pix_titular || null) : null, remetenteNome,
            subject: preencherEmailTpl(cfg?.email_assunto || EMAIL_ASSUNTO_PADRAO, valsEmail),
            intro: preencherEmailTpl(cfg?.email_corpo || EMAIL_CORPO_PADRAO, valsEmail),
          });
          const attachments: ResendAnexo[] = [];
          if (nfPath) {
            const { data: signed } = await admin.storage.from("notas-fiscais").createSignedUrl(nfPath, 600);
            if (signed?.signedUrl) attachments.push({ filename: nfNome, path: signed.signedUrl });
          }
          const r = await enviarEmailResend({
            apiKey: resendKey, from: `${remetenteNome.replace(/[<>\n"]/g, "")} <${emailFrom}>`,
            to: para, subject, html, text, replyTo: await emailAgencia(cob.user_id),
            attachments: attachments.length ? attachments : undefined,
          });
          if (!r.ok) { erros++; console.error("auto email fail", cob.id, r.status, r.error); }
          else {
            if (attachments.length) removerNf = true;
            await admin.from("cobrancas").update({ auto_email_ultimo_dia: hoje }).in("id", linhas.map((l) => l.id));
            enviadosEmail++; algoEnviado = true;
          }
        }
      }

      // NF entregue em pelo menos um canal → apaga do Storage e marca enviada.
      if (removerNf && comNf && nfPath) {
        await admin.from("cobrancas").update({ nota_fiscal_path: null, nota_fiscal_nome: null, nota_fiscal_enviada: true }).eq("id", comNf.id);
        await admin.storage.from("notas-fiscais").remove([nfPath]).catch(() => {});
      }
      if (!fezAlgumaTentativa && !algoEnviado) pulados++;
    } catch (e) {
      erros++;
      console.error("auto disparo erro", cob.id, e instanceof Error ? e.message : e);
    }
  }

  return new Response(JSON.stringify({ ok: true, hoje, total: faturas.size, enviados, enviadosEmail, pulados, faltaNf, erros }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
