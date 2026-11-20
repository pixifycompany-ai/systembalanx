// Regras de exibição de um lançamento do fluxo (status claro, série, fatura).
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';

export const hojeISO = () => format(new Date(), 'yyyy-MM-dd');

export type BaseData = 'caixa' | 'vencimento' | 'competencia' | 'efetivacao';

/** Já saiu/entrou da conta (pago, recebido ou transferência)? */
export const efetivado = (t: Pick<TransacaoUnificada, 'status' | 'tabela_origem'>) =>
  t.tabela_origem === 'transferencia' || t.status === 'pago' || t.status === 'recebido';

/**
 * Dia em que o lançamento aparece na lista, conforme a data escolhida no filtro.
 * 'caixa' (padrão): em aberto no dia do VENCIMENTO; pago/recebido no dia da BAIXA — como no extrato.
 */
export function dataDoLancamento(t: TransacaoUnificada, base: BaseData = 'caixa'): string {
  if (base === 'competencia') return t.data_competencia || t.data_vencimento;
  if (base === 'efetivacao') return t.data_efetivacao || t.data_vencimento;
  if (base === 'vencimento') return t.data_vencimento;
  return efetivado(t) && t.data_efetivacao ? t.data_efetivacao : t.data_vencimento;
}

export type SituacaoLanc = 'aberto' | 'atrasado' | 'efetivado';
/** Em aberto (no prazo), atrasado (passou do vencimento) ou efetivado (pago/recebido/transferido). */
export function situacaoDe(t: TransacaoUnificada): SituacaoLanc {
  if (efetivado(t)) return 'efetivado';
  return statusInfo(t).tom === 'atraso' ? 'atrasado' : 'aberto';
}

/** Fatura de cartão (linha de sistema): a baixa é pelo "Pagar fatura". */
export const ehFatura = (t: Pick<TransacaoUnificada, 'fornecedor'>) => t.fornecedor === '[fatura]';

/** Separa o sufixo de série "(3/12)" da descrição. */
export function serieDe(descricao: string): { base: string; serie: string | null } {
  const m = descricao.match(/\s*\((\d+)\/(\d+)\)\s*$/);
  if (!m) return { base: descricao, serie: null };
  return { base: descricao.slice(0, m.index).trim() || descricao, serie: `${m[1]}/${m[2]}` };
}

/** Status claro do lançamento: Atrasado Nd / Vence hoje / A receber / A pagar / Recebido / Pago / Transferida. */
export function statusInfo(t: TransacaoUnificada): { txt: string; cls: string; tom: 'ok' | 'atraso' | 'hoje' | 'aberto' | 'transf' } {
  if (t.tabela_origem === 'transferencia') return { txt: 'Transferida', cls: 'bg-info-bg text-info-fg', tom: 'transf' };
  if (t.status === 'recebido' || t.status === 'pago') {
    return { txt: t.status === 'recebido' ? 'Recebido' : 'Pago', cls: 'bg-success-bg text-success-fg', tom: 'ok' };
  }
  const dias = differenceInCalendarDays(parseISO(t.data_vencimento), new Date());
  if (t.status === 'atrasado' || dias < 0) {
    return { txt: `Atrasado ${Math.max(1, -dias)}d`, cls: 'bg-danger-bg text-danger-fg', tom: 'atraso' };
  }
  if (dias === 0) return { txt: 'Vence hoje', cls: 'bg-warning-bg text-warning-fg', tom: 'hoje' };
  return { txt: t.tipo === 'entrada' ? 'A receber' : 'A pagar', cls: 'bg-surface-2 text-foreground-muted', tom: 'aberto' };
}

/** Rótulo de forma de pagamento. */
export const FORMA_LABEL: Record<string, string> = {
  pix: 'Pix',
  boleto: 'Boleto',
  cartao_debito: 'Cartão débito',
  cartao_credito: 'Cartão crédito',
  transferencia: 'Transferência',
  dinheiro: 'Dinheiro',
};
