// Pausa de contrato com assinatura no Asaas.
// - Pausa começou (pausado_desde <= hoje): assinatura vai para INACTIVE (para de
//   gerar cobranças) e as cobranças ainda AGUARDANDO com vencimento dentro da
//   pausa são canceladas (no Asaas e aqui), junto com a receita em aberto delas.
// - Pausa acabou (pausado_ate < hoje) ou reativação manual: assinatura volta a
//   ACTIVE com o próximo vencimento a partir de hoje; o trigger do contrato
//   regera as receitas da janela de 12 meses.
// Assinatura dividida com outro contrato não é suspensa (cobraria errado o outro).

import { apagarReceitaSeCriada } from "./faturas.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Contrato = any;

export function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export function asaasBase(env: string) {
  return env === "production" || env === "prod" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

const MESES: Record<string, number> = { mensal: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
const DIAS: Record<string, number> = { semanal: 7, quinzenal: 15 };

function isoUTC(d: Date) { return d.toISOString().slice(0, 10); }

// Próximo vencimento do contrato a partir de `apartir` (inclusive), na mesma
// agenda do gerador de receitas (data_inicio + dia_vencimento).
export function proximaOcorrencia(c: Contrato, apartir: string): string {
  const ini = new Date(String(c.data_inicio) + "T12:00:00Z");
  const meses = MESES[String(c.recorrencia)] || 0;
  const dias = DIAS[String(c.recorrencia)] || 0;
  for (let k = 0; k < 2000; k++) {
    let occ: Date;
    if (meses > 0) {
      const y = ini.getUTCFullYear(), m = ini.getUTCMonth() + k * meses;
      const ultimo = new Date(Date.UTC(y, m + 1, 0, 12)).getUTCDate();
      const dia = Math.min(Number(c.dia_vencimento) || ini.getUTCDate(), ultimo);
      occ = new Date(Date.UTC(y, m, dia, 12));
    } else if (dias > 0) {
      occ = new Date(ini.getTime() + k * dias * 86400000);
    } else break;
    const iso = isoUTC(occ);
    if (iso >= apartir && iso >= String(c.data_inicio)) return iso;
  }
  return apartir;
}

export async function assinaturaCompartilhada(admin: Db, c: Contrato): Promise<boolean> {
  if (!c.asaas_subscription_id) return false;
  const { data } = await admin.from("contratos").select("id")
    .eq("asaas_subscription_id", c.asaas_subscription_id).neq("id", c.id).limit(1);
  return (data || []).length > 0;
}

async function asaasStatus(base: string, headers: Record<string, string>, subId: string, body: Record<string, unknown>) {
  const r = await fetch(`${base}/subscriptions/${subId}`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j?.errors?.[0]?.description || `Asaas recusou a alteração da assinatura (${r.status}).`);
  }
}

// Cancela as cobranças AGUARDANDO do contrato com vencimento dentro da pausa.
async function limparCobrancasDaPausa(admin: Db, base: string, headers: Record<string, string>, c: Contrato, hoje: string) {
  const desde = c.pausado_desde > hoje ? c.pausado_desde : hoje;
  let q = admin.from("cobrancas").select("*").eq("contrato_id", c.id).eq("status", "pendente").gte("vencimento", desde);
  if (c.pausado_ate) q = q.lte("vencimento", c.pausado_ate);
  const { data: cobs } = await q;
  let canceladas = 0;
  for (const cb of cobs || []) {
    if (cb.asaas_payment_id) {
      const { data: outras } = await admin.from("cobrancas").select("id")
        .eq("asaas_payment_id", cb.asaas_payment_id).neq("contrato_id", c.id).limit(1);
      if (!(outras || []).length) {
        await fetch(`${base}/payments/${cb.asaas_payment_id}`, { method: "DELETE", headers }).catch(() => {});
      }
    }
    await apagarReceitaSeCriada(admin, cb);
    await admin.from("cobrancas").update({ status: "cancelado", receita_id: null, updated_at: new Date().toISOString() }).eq("id", cb.id);
    // Receita que já existia (janela de 12 meses) e ficou sem cobrança: sai também.
    if (cb.receita_id) {
      await admin.from("receitas").delete().eq("id", cb.receita_id).eq("status", "pendente")
        .gte("data_vencimento", desde).lte("data_vencimento", c.pausado_ate || "9999-12-31");
    }
    canceladas++;
  }
  return canceladas;
}

// Aplica o estado da pausa no Asaas. Idempotente: pode rodar todo dia.
export async function sincronizarPausa(
  admin: Db, cfg: { asaas_api_key: string; asaas_env?: string | null }, c: Contrato, hoje = hojeSP(),
): Promise<{ acao: "pausou" | "reativou" | "nada"; canceladas: number }> {
  const base = asaasBase(cfg.asaas_env || "production");
  const headers = { "Content-Type": "application/json", access_token: cfg.asaas_api_key };
  const subId = c.asaas_subscription_id as string | null;

  const terminou = !c.pausado_desde || (c.pausado_ate && c.pausado_ate < hoje);
  if (terminou) {
    if (c.asaas_pausado && subId) {
      await asaasStatus(base, headers, subId, { status: "ACTIVE", nextDueDate: proximaOcorrencia(c, hoje) });
    }
    if (c.pausado_desde || c.asaas_pausado) {
      await admin.from("contratos").update({ pausado_desde: null, pausado_ate: null, asaas_pausado: false }).eq("id", c.id);
      return { acao: "reativou", canceladas: 0 };
    }
    return { acao: "nada", canceladas: 0 };
  }

  // Pausa vigente ou agendada: tira já as cobranças aguardando que caem nela.
  const canceladas = subId ? await limparCobrancasDaPausa(admin, base, headers, c, hoje) : 0;
  if (c.pausado_desde <= hoje && subId && !c.asaas_pausado && !(await assinaturaCompartilhada(admin, c))) {
    await asaasStatus(base, headers, subId, { status: "INACTIVE" });
    await admin.from("contratos").update({ asaas_pausado: true }).eq("id", c.id);
    return { acao: "pausou", canceladas };
  }
  return { acao: "nada", canceladas };
}
