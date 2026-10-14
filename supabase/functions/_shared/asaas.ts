// Helpers mínimos do Asaas usados fora do fluxo principal de cobrança.
// deno-lint-ignore-file no-explicit-any

export function asaasBase(env?: string | null): string {
  return (env === "sandbox") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3";
}

/** Formas que podem ter boleto disponível (billingType do Asaas). */
export function temBoleto(forma?: string | null): boolean {
  const f = String(forma || "").toUpperCase();
  return f === "BOLETO" || f === "UNDEFINED";
}

export interface AsaasCustomer { id: string; nome: string | null; cpfCnpj: string | null; email: string | null }

/**
 * Busca os dados de um cliente (customer) no Asaas pelo id.
 * Útil para mostrar de QUEM é uma cobrança que veio do Asaas sem vínculo no BALANX
 * (ex.: assinaturas de outra plataforma no mesmo Asaas). Fail-safe: null em erro.
 */
export async function buscarCustomer(apiKey: string, env: string | null, customerId: string): Promise<AsaasCustomer | null> {
  if (!apiKey || !customerId) return null;
  try {
    const r = await fetch(`${asaasBase(env)}/customers/${customerId}`, {
      headers: { access_token: apiKey, "Content-Type": "application/json" },
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return { id: customerId, nome: j?.name ?? null, cpfCnpj: j?.cpfCnpj ?? null, email: j?.email ?? null };
  } catch {
    return null;
  }
}

/**
 * Busca a URL do PDF do boleto (bankSlipUrl) de um pagamento no Asaas.
 * Retorna null se não houver boleto ou se algo falhar (fail-safe).
 */
export async function buscarBoletoUrl(apiKey: string, env: string | null, paymentId: string): Promise<string | null> {
  if (!apiKey || !paymentId) return null;
  try {
    const r = await fetch(`${asaasBase(env)}/payments/${paymentId}`, {
      headers: { access_token: apiKey, "Content-Type": "application/json" },
    });
    if (!r.ok) return null;
    const j: any = await r.json();
    return j?.bankSlipUrl || null;
  } catch {
    return null;
  }
}
