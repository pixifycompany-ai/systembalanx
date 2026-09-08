// ============================================================================
// PLANO ÚNICO DO BALANX — fonte única de verdade (preço, ciclo, features, trial).
// Inspirado no modelo "um plano só, tudo liberado": mensal ou anual (~metade).
// ============================================================================

export type Ciclo = 'mensal' | 'anual';

export const PLAN = {
  id: 'balanx',
  nome: 'BALANX',
  descricao: 'Um plano só, tudo liberado e sem limites.',

  precoMensal: 49.9,          // R$ 49,90 / mês
  precoAnualParcela: 24.9,    // 12× R$ 24,90 no anual
  precoAnualTotal: 24.9 * 12, // R$ 298,80 / ano (~metade do mensal)

  trialDias: 14,

  features: [
    'Lançamentos ilimitados (receitas, despesas, transferências, cartões e parcelamento)',
    'IARA — assistente financeiro com IA, ilimitada',
    'Lançar por voz',
    'Cartões com bandeiras, contratos e MRR, metas e categorias',
    'Relatórios (DRE, fluxo de caixa, análises) e calendário',
    'Multiusuário / equipe (owner, admin, financeiro, membro)',
    'Importação por IA (extrato, CSV de cartão, contrato em PDF)',
  ],
} as const;

/** Preço mensal-equivalente de um ciclo (útil pra MRR da plataforma). */
export function mrrEquivalente(ciclo: Ciclo): number {
  return ciclo === 'anual' ? PLAN.precoAnualParcela : PLAN.precoMensal;
}

/** Rótulo curto do preço por ciclo. */
export function precoLabel(ciclo: Ciclo): string {
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  return ciclo === 'anual'
    ? `12× ${fmt(PLAN.precoAnualParcela)} (${fmt(PLAN.precoAnualTotal)}/ano)`
    : `${fmt(PLAN.precoMensal)}/mês`;
}
