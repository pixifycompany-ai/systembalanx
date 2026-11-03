import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { montarEmailCobranca, enviarEmailResend, preencherEmailTpl, EMAIL_ASSUNTO_PADRAO, EMAIL_CORPO_PADRAO, type ResendAnexo } from "../_shared/email.ts";
import { buscarBoletoUrl, temBoleto } from "../_shared/asaas.ts";
import { anexoDaNota } from "../_shared/notas.ts";
import { frasePrazo } from "../_shared/prazo.ts";

// Worker do cron: roda 1x/dia, encontra cobranças que casam com a regra de
// auto-envio (global ou exceção do contrato) e dispara pelo WhatsApp (Pixify),
// anexando a nota fiscal (PDF) quando houver. Protegido por CRON_SECRET.

const TPL_PADRAO =
  "Olá {cliente}! 👋\n\nSua cobrança de *{descricao}* {prazo}:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\nLink para pagamento:\n{link}\n\nQualquer dúvida, é só chamar!";
const TPL_PIX_PADRAO =
  "Olá {cliente}! 👋\n\nSua cobrança de *{descricao}* {prazo}:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\n🔑 *Chave PIX:* {pix}\n👤 Em nome de: {titular}\n\nApós o pagamento, é só enviar o comprovante. Obrigado!";

// Notas fiscais da linha: `notas_fiscais` (até 10) ou o formato antigo de uma só.
function notasDaLinha(l: any): { path: string; nome: string }[] {
  const arr = Array.isArray(l?.notas_fiscais) ? l.notas_fiscais.filter((n: any) => n?.path) : [];
  if (arr.length) return arr.map((n: any) => ({ path: String(n.path), nome: String(n.nome || "nota-fiscal.pdf") }));
  return l?.nota_fiscal_path ? [{ path: String(l.nota_fiscal_path), nome: String(l.nota_fiscal_nome || "nota-fiscal.pdf") }] : [];
}

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
    .replace(/\{prazo\}/g, d.prazo || "").replace(/\{dias\}/g, d.dias || "")
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
// Fim de semana / rolagem para o próximo dia útil (segunda).
function dowISO(iso: string): number { return new Date(iso + "T12:00:00Z").getUTCDay(); } // 0=dom..6=sáb
function isFimDeSemana(iso: string): boolean { const d = dowISO(iso); return d === 0 || d === 6; }
function addDiasISO(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function proxDiaUtilISO(iso: string): string {
  const d = dowISO(iso);
  if (d === 6) return addDiasISO(iso, 2); // sábado → segunda
  if (d === 0) return addDiasISO(iso, 1); // domingo → segunda
  return iso;
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
    .select("user_id, asaas_account_name, asaas_api_key, asaas_env, email_assunto, email_corpo, whatsapp_template, whatsapp_template_pix, pix_chave, pix_titular, auto_wpp_enabled, auto_wpp_antes_dias, auto_wpp_no_dia, auto_wpp_atraso_diario, auto_wpp_atraso_max_dias, auto_envio_fim_semana");
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
    .select("id, user_id, cliente_id, contrato_id, asaas_payment_id, descricao, valor, vencimento, invoice_url, forma_pagamento, status, exigir_nf, envio_pix, enviar_fim_semana, nota_fiscal_path, nota_fiscal_nome, notas_fiscais, nota_fiscal_enviada, auto_wpp_ultimo_dia, auto_email_ultimo_dia, created_at, clientes(nome, telefone, email, canal_cobranca), contratos(cobranca_auto_modo, cobranca_auto_antes_dias, cobranca_auto_no_dia, cobranca_auto_atraso_diario)")
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

      // Fim de semana: quando desligado, não dispara sáb/dom e "rola" o lembrete
      // (X dias antes / no dia) para a próxima segunda. O atraso diário só pula o fds.
      // Valor POR COBRANÇA (cob.enviar_fim_semana) sobrepõe o padrão do config.
      const permiteFds = (cob.enviar_fim_semana === null || cob.enviar_fim_semana === undefined)
        ? (cfg?.auto_envio_fim_semana !== false)
        : cob.enviar_fim_semana !== false;
      const d = diffDias(cob.vencimento, hoje);
      let deve = false;
      if (regra.antes > 0) {
        let alvo = addDiasISO(cob.vencimento, -regra.antes);
        if (!permiteFds) alvo = proxDiaUtilISO(alvo);
        // só vale como lembrete "antes" se ainda estamos em/antes do vencimento
        if (alvo === hoje && diffDias(cob.vencimento, hoje) >= 0) deve = true;
      }
      if (!deve && regra.noDia) {
        let alvo = cob.vencimento;
        if (!permiteFds) alvo = proxDiaUtilISO(alvo);
        if (alvo === hoje) deve = true;
      }
      if (!deve && regra.atrasoDiario && d < 0) {
        const atraso = -d;
        const dentroMax = regra.atrasoMax === 0 || atraso <= regra.atrasoMax;
        if (dentroMax && (permiteFds || !isFimDeSemana(hoje))) deve = true;
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
      // Frase adaptativa (antes/no dia/atraso) + contagem de dias.
      const prazoTxt = frasePrazo(d);
      const diasTxt = String(Math.abs(d));
      // Notas fiscais (até 10) de todas as linhas da fatura.
      const notas = linhas.flatMap((l) => notasDaLinha(l).map((n) => ({ ...n, linhaId: l.id as string }))).slice(0, 10);
      const exigeNf = linhas.some((l) => l.exigir_nf);
      const nfJaEnviada = linhas.some((l) => l.nota_fiscal_enviada);
      const bloqueadoPorNf = exigeNf && !notas.length && !nfJaEnviada;
      const usaPix = linhas.some((l) => l.envio_pix) && !!cfg?.pix_chave;

      let algoEnviado = false;      // marcou canal com sucesso?
      const nfsEntregues = new Set<string>(); // NFs entregues em algum canal → pode apagar
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
            prazo: prazoTxt, dias: diasTxt,
            link: cob.invoice_url || "", pix: cfg?.pix_chave || "", titular: cfg?.pix_titular || "",
          });
          const tr = await fetch(`https://apiastracalls.pixify.company/api/sessions/${sid}/messages/text`, {
            method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
            body: JSON.stringify({ to, text }),
          });
          if (!tr.ok) { erros++; console.error("auto text fail", cob.id, tr.status, await tr.text().catch(() => "")); }
          else {
            for (const n of notas) {
              const { data: signed } = await admin.storage.from("notas-fiscais").createSignedUrl(n.path, 600);
              if (!signed?.signedUrl) continue;
              const dr = await fetch(`https://apiastracalls.pixify.company/api/sessions/${sid}/messages/document`, {
                method: "POST", headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
                body: JSON.stringify({ to, url: signed.signedUrl, filename: n.nome, mimetype: "application/pdf" }),
              }).catch(() => null);
              if (dr && dr.ok) nfsEntregues.add(n.path);
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
            prazo: prazoTxt, dias: diasTxt,
            link: cob.invoice_url || "", pix: usaPix ? (cfg?.pix_chave || "") : "", titular: usaPix ? (cfg?.pix_titular || "") : "",
          };
          const { subject, html, text } = montarEmailCobranca({
            cliente: valsEmail.cliente, descricao, valor: valsEmail.valor, vencimento: valsEmail.vencimento,
            link: usaPix ? null : (cob.invoice_url || null), pix: usaPix ? (cfg?.pix_chave || null) : null,
            titular: usaPix ? (cfg?.pix_titular || null) : null, remetenteNome,
            subject: preencherEmailTpl(cfg?.email_assunto || EMAIL_ASSUNTO_PADRAO, valsEmail),
            intro: preencherEmailTpl(cfg?.email_corpo || EMAIL_CORPO_PADRAO, valsEmail),
          });
          const attachments: ResendAnexo[] = [];
          const nfsAnexadas: string[] = [];
          for (const n of notas) {
            const anexo = await anexoDaNota(admin, n.path, n.nome);
            if (anexo) { attachments.push(anexo); nfsAnexadas.push(n.path); }
          }
          // Boleto (PDF) do Asaas quando a cobrança é boleto.
          if (cob.asaas_payment_id && temBoleto(cob.forma_pagamento) && cfg?.asaas_api_key && !usaPix) {
            const boletoUrl = await buscarBoletoUrl(cfg.asaas_api_key, cfg.asaas_env, cob.asaas_payment_id);
            if (boletoUrl) attachments.push({ filename: "boleto.pdf", path: boletoUrl });
          }
          const r = await enviarEmailResend({
            apiKey: resendKey, from: `${remetenteNome.replace(/[<>\n"]/g, "")} <${emailFrom}>`,
            to: para, subject, html, text, replyTo: await emailAgencia(cob.user_id),
            attachments: attachments.length ? attachments : undefined,
          });
          // Registra o envio automático (o webhook do Resend atualiza o status depois)
          await admin.from("email_envios").insert({
            user_id: cob.user_id, cobranca_id: cob.id, resend_id: r.ok ? (r.id || null) : null,
            para, assunto: subject, origem: "auto",
            status: r.ok ? "enviado" : "falhou", erro: r.ok ? null : `${r.status}: ${r.error || "recusado pelo Resend"}`,
          }).then(() => {}, () => {});
          if (!r.ok) { erros++; console.error("auto email fail", cob.id, r.status, r.error); }
          else {
            nfsAnexadas.forEach((p) => nfsEntregues.add(p));
            await admin.from("cobrancas").update({ auto_email_ultimo_dia: hoje }).in("id", linhas.map((l) => l.id));
            enviadosEmail++; algoEnviado = true;
          }
        }
      }

      // NF entregue em pelo menos um canal → apaga do Storage e marca enviada.
      if (nfsEntregues.size) {
        for (const l of linhas) {
          const todas = notasDaLinha(l);
          if (!todas.some((n) => nfsEntregues.has(n.path))) continue;
          const restantes = todas.filter((n) => !nfsEntregues.has(n.path));
          await admin.from("cobrancas").update({
            notas_fiscais: restantes,
            nota_fiscal_path: restantes[0]?.path ?? null, nota_fiscal_nome: restantes[0]?.nome ?? null,
            nota_fiscal_enviada: true,
          }).eq("id", l.id);
        }
        await admin.storage.from("notas-fiscais").remove([...nfsEntregues]).catch(() => {});
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
