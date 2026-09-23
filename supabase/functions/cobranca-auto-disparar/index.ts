import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Worker do cron: roda 1x/dia, encontra cobranças que casam com a regra de
// auto-envio (global ou exceção do contrato) e dispara pelo WhatsApp (Pixify),
// anexando a nota fiscal (PDF) quando houver. Protegido por CRON_SECRET.

const TPL_PADRAO =
  "Olá {cliente}! 👋\n\nSegue sua cobrança de *{descricao}*:\n💰 Valor: *{valor}*\n📅 Vencimento: {vencimento}\n\nLink para pagamento:\n{link}\n\nQualquer dúvida, é só chamar!";

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
    .replace(/\{valor\}/g, d.valor).replace(/\{vencimento\}/g, d.vencimento).replace(/\{link\}/g, d.link);
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

  const hoje = hojeSP();

  const { data: cfgs } = await admin.from("cobranca_config")
    .select("user_id, whatsapp_template, auto_wpp_enabled, auto_wpp_antes_dias, auto_wpp_no_dia, auto_wpp_atraso_diario, auto_wpp_atraso_max_dias");
  const cfgBy = new Map((cfgs || []).map((c) => [c.user_id, c]));

  const { data: cobs } = await admin.from("cobrancas")
    .select("id, user_id, cliente_id, contrato_id, descricao, valor, vencimento, invoice_url, status, exigir_nf, nota_fiscal_path, nota_fiscal_nome, nota_fiscal_enviada, auto_wpp_ultimo_dia, clientes(nome, telefone), contratos(cobranca_auto_modo, cobranca_auto_antes_dias, cobranca_auto_no_dia, cobranca_auto_atraso_diario)")
    .in("status", ["pendente", "vencido"]);

  let enviados = 0, pulados = 0, faltaNf = 0, erros = 0;

  for (const cob of cobs || []) {
    try {
      if (cob.auto_wpp_ultimo_dia === hoje) { pulados++; continue; } // já enviou hoje
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
      const to = normalizarWhats(cli?.telefone || "");
      if (!to) { pulados++; continue; }

      if (cob.exigir_nf && !cob.nota_fiscal_path && !cob.nota_fiscal_enviada) { faltaNf++; continue; } // exige NF e não tem

      const text = preencher(cfg?.whatsapp_template || TPL_PADRAO, {
        cliente: cli?.nome || "cliente",
        descricao: cob.descricao || "cobrança",
        valor: brl(Number(cob.valor)),
        vencimento: dataBR(cob.vencimento),
        link: cob.invoice_url || "",
      });

      const tr = await fetch(`https://apiastracalls.pixify.company/api/sessions/${sid}/messages/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
        body: JSON.stringify({ to, text }),
      });
      if (!tr.ok) { erros++; console.error("auto text fail", cob.id, tr.status, await tr.text().catch(() => "")); continue; }

      // Anexa a NF (PDF) se houver; se enviar com sucesso, apaga do Storage.
      let removerNf = false;
      const nfPath: string | null = cob.nota_fiscal_path;
      if (nfPath) {
        const { data: signed } = await admin.storage.from("notas-fiscais").createSignedUrl(nfPath, 600);
        if (signed?.signedUrl) {
          const dr = await fetch(`https://apiastracalls.pixify.company/api/sessions/${sid}/messages/document`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
            body: JSON.stringify({ to, url: signed.signedUrl, filename: cob.nota_fiscal_nome || "nota-fiscal.pdf", mimetype: "application/pdf" }),
          }).catch(() => null);
          if (dr && dr.ok) removerNf = true;
        }
      }

      await admin.from("cobrancas").update({
        auto_wpp_ultimo_dia: hoje,
        ...(removerNf ? { nota_fiscal_path: null, nota_fiscal_nome: null, nota_fiscal_enviada: true } : {}),
      }).eq("id", cob.id);
      if (removerNf && nfPath) await admin.storage.from("notas-fiscais").remove([nfPath]).catch(() => {});
      enviados++;
    } catch (e) {
      erros++;
      console.error("auto disparo erro", cob.id, e instanceof Error ? e.message : e);
    }
  }

  return new Response(JSON.stringify({ ok: true, hoje, total: (cobs || []).length, enviados, pulados, faltaNf, erros }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
