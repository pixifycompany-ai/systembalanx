// Criação de lançamentos a partir de uma lista "proposta" (voz ou chat da IARA).
// Centraliza a lógica que ANTES só existia no LancarVoz, para que a IARA do chat
// crie exatamente do mesmo jeito: cartão de crédito cai na fatura, parcelado
// distribui nas faturas, recorrente repete a série, forma/fornecedor preservados.
import { format, parseISO, addDays, addWeeks, addMonths, addYears } from 'date-fns';

export interface ItemLancamento {
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  categoria_id: string | null;
  categoria_nome: string | null;
  data: string;
  conta_id: string | null;
  /** true = já pago/recebido; false = pendente. Cartão de crédito sempre vira fatura. */
  quitado: boolean;
  forma_pagamento?: string | null;
  fornecedor?: string | null;
  /** nº de parcelas no cartão (>=2) */
  parcelas?: number | null;
  /** lançamento que se repete */
  recorrente?: { frequencia: string; repeticoes: number } | null;
}

/** Próxima data de uma série recorrente (índice i a partir da base). */
export function proximaDataSerie(base: string, freq: string, i: number): string {
  const d = parseISO(base);
  switch (freq) {
    case 'semanal': return format(addWeeks(d, i), 'yyyy-MM-dd');
    case 'quinzenal': return format(addDays(d, i * 15), 'yyyy-MM-dd');
    case 'bimestral': return format(addMonths(d, i * 2), 'yyyy-MM-dd');
    case 'trimestral': return format(addMonths(d, i * 3), 'yyyy-MM-dd');
    case 'semestral': return format(addMonths(d, i * 6), 'yyyy-MM-dd');
    case 'anual': return format(addYears(d, i), 'yyyy-MM-dd');
    default: return format(addMonths(d, i), 'yyyy-MM-dd'); // mensal
  }
}

export const FREQ_LABEL: Record<string, string> = {
  semanal: 'semana', quinzenal: 'quinzena', mensal: 'mês', bimestral: '2 meses',
  trimestral: 'trimestre', semestral: 'semestre', anual: 'ano',
};

export const FORMA_LABEL: Record<string, string> = {
  pix: 'Pix', boleto: 'Boleto', cartao_credito: 'Crédito', cartao_debito: 'Débito',
  dinheiro: 'Dinheiro', transferencia: 'Transferência',
};

interface CriarResult { success?: boolean }
export interface SalvarDeps {
  contas: Array<{ id: string; tipo?: string | null; ativa?: boolean }>;
  // `any` nos dados: cada hook tem seu próprio FormData; a forma é montada aqui.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createReceita: (data: any, silent?: boolean) => Promise<CriarResult | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createDespesa: (data: any, silent?: boolean) => Promise<CriarResult | undefined>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createDespesaParcelada: (data: any, parcelas: number) => Promise<CriarResult | undefined>;
}

/** Conta padrão: primeira corrente (não-cartão); senão a primeira conta ativa. */
export function contaPadrao(contas: SalvarDeps['contas']): string | null {
  const ativas = (contas || []).filter((c) => c.ativa !== false);
  const corrente = ativas.find((c) => c.tipo === 'corrente') || ativas.find((c) => c.tipo !== 'cartao_credito');
  return corrente?.id || ativas[0]?.id || null;
}

/**
 * Cria todos os itens. Retorna quantos foram criados com sucesso.
 * Mesma lógica usada no lançamento por voz (cartão/parcelado/recorrente).
 */
export async function salvarItens(itens: ItemLancamento[], deps: SalvarDeps): Promise<{ ok: number; total: number }> {
  const isCartao = (contaId: string | null | undefined) =>
    !!contaId && (deps.contas || []).find((c) => c.id === contaId)?.tipo === 'cartao_credito';

  let ok = 0;
  for (const it of itens) {
    try {
      const card = isCartao(it.conta_id);
      const rep = it.recorrente ? Math.max(1, it.recorrente.repeticoes) : 1;
      if (it.tipo === 'receita') {
        const status = it.quitado ? 'recebido' : 'pendente';
        let good = true;
        for (let i = 0; i < rep; i++) {
          const d = it.recorrente ? proximaDataSerie(it.data, it.recorrente.frequencia, i) : it.data;
          const r = await deps.createReceita({
            descricao: it.descricao, valor: it.valor, categoria_id: it.categoria_id || undefined,
            conta_id: it.conta_id || undefined, forma_pagamento: it.forma_pagamento || undefined,
            data_competencia: d, data_vencimento: d,
            data_recebimento: it.quitado ? d : undefined,
            status,
          }, true);
          if (!r?.success) good = false;
        }
        if (good) ok++;
      } else {
        const status = it.quitado ? 'pago' : 'pendente';
        const base = {
          descricao: it.descricao, valor: it.valor, categoria_id: it.categoria_id || undefined,
          conta_id: it.conta_id || undefined, fornecedor: it.fornecedor || undefined,
          forma_pagamento: it.forma_pagamento || undefined,
          data_competencia: it.data, data_vencimento: it.data,
          data_pagamento: (!card && it.quitado) ? it.data : undefined,
          status, tipo: 'variavel' as const,
        };
        if (card && it.parcelas && it.parcelas > 1) {
          const r = await deps.createDespesaParcelada(base, it.parcelas);
          if (r?.success) ok++;
        } else if (it.recorrente) {
          let good = true;
          for (let i = 0; i < rep; i++) {
            const d = proximaDataSerie(it.data, it.recorrente.frequencia, i);
            const r = await deps.createDespesa({ ...base, data_competencia: d, data_vencimento: d, data_pagamento: (!card && it.quitado) ? d : undefined }, true);
            if (!r?.success) good = false;
          }
          if (good) ok++;
        } else {
          const r = await deps.createDespesa(base, true);
          if (r?.success) ok++;
        }
      }
    } catch { /* segue para o próximo */ }
  }
  return { ok, total: itens.length };
}
