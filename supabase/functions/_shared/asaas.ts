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
