import { addMonths, format, getDaysInMonth, parseISO, startOfMonth } from 'date-fns';

/**
 * Dada uma data de compra e o dia de fechamento do cartão,
 * retorna a competência (1º dia do mês) da fatura.
 *
 * Regra: se a compra é DEPOIS do dia de fechamento daquele mês,
 * entra na fatura do mês seguinte.
 */
export function calcularCompetenciaFatura(
  dataCompra: string | Date,
  diaFechamento: number
): Date {
  const compra = typeof dataCompra === 'string' ? parseISO(dataCompra) : dataCompra;
  const dia = compra.getDate();
  const baseMes = startOfMonth(compra);
  // Fechamento em dia que o mês não tem (ex.: 31 em fevereiro) cai no último dia.
  const fechamentoNoMes = Math.min(diaFechamento, getDaysInMonth(compra));
  // Compras feitas no dia do fechamento ou depois entram na fatura do próximo mês
  return dia >= fechamentoNoMes ? addMonths(baseMes, 1) : baseMes;
}

/**
 * Dia clamp - se o mês não tem aquele dia, usa o último dia do mês.
 */
function clampDia(ano: number, mes0: number, dia: number): Date {
  const d = new Date(ano, mes0, 1);
  const last = getDaysInMonth(d);
  return new Date(ano, mes0, Math.min(dia, last));
}

/**
 * A partir da competência (mês da fatura) e dos dias de fechamento/vencimento,
 * calcula data de fechamento e data de vencimento daquela fatura.
 *
 * Competência 05/2026 com fechamento 28 = compras de 28/04 a 27/05.
 *  - Fechamento: no mês da competência (28/05), dia seguinte à última compra.
 *  - Vencimento: o primeiro `diaVencimento` depois do fechamento — no mês
 *    seguinte quando vence num dia menor/igual ao do fechamento (fecha 28,
 *    vence 10 → 10/06); no mesmo mês quando vence depois (fecha 3, vence 10 →
 *    competência 05 fecha 03/05 e vence 10/05).
 */
export function calcularDatasFatura(
  competencia: Date,
  diaFechamento: number,
  diaVencimento: number
): { data_fechamento: Date; data_vencimento: Date } {
  const data_fechamento = clampDia(competencia.getFullYear(), competencia.getMonth(), diaFechamento);
  const mesVenc = diaVencimento > data_fechamento.getDate() ? competencia : addMonths(competencia, 1);
  const data_vencimento = clampDia(mesVenc.getFullYear(), mesVenc.getMonth(), diaVencimento);
  return { data_fechamento, data_vencimento };
}

/**
 * Variante anchor-based: usa uma data completa de vencimento (anchor) como
 * referência e deriva o vencimento de qualquer competência somando N meses
 * em relação à competência da anchor. Útil quando o ciclo do cartão não
 * encaixa na regra fixa "competência + 1 mês".
 */
export function calcularDatasFaturaComAnchor(
  competencia: Date,
  diaFechamento: number,
  anchor: Date
): { data_fechamento: Date; data_vencimento: Date } {
  // A anchor (um vencimento real) pertence à competência que fecha antes dela:
  // vence depois do dia de fechamento → mesma competência do mês da anchor;
  // senão → competência do mês anterior (fecha 26, vence 10/07 → competência 06).
  const anchorCompetencia = anchor.getDate() > diaFechamento
    ? startOfMonth(anchor)
    : addMonths(startOfMonth(anchor), -1);
  const monthsDiff =
    (competencia.getFullYear() - anchorCompetencia.getFullYear()) * 12 +
    (competencia.getMonth() - anchorCompetencia.getMonth());
  const venc = addMonths(anchor, monthsDiff);
  const data_vencimento = clampDia(venc.getFullYear(), venc.getMonth(), anchor.getDate());
  const data_fechamento = clampDia(competencia.getFullYear(), competencia.getMonth(), diaFechamento);
  return { data_fechamento, data_vencimento };
}

/**
 * Melhor dia para comprar no cartão: o próprio dia do fechamento — a compra já
 * entra na fatura seguinte e ganha o prazo máximo até o vencimento.
 */
export function melhorDiaDeCompra(diaFechamento: number): number {
  if (!diaFechamento || diaFechamento < 1) return 1;
  return Math.min(diaFechamento, 31);
}

export function rotuloCompetencia(competencia: Date | string): string {
  const d = typeof competencia === 'string' ? parseISO(competencia) : competencia;
  return format(d, 'MM/yyyy');
}

export function toISODate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

/**
 * Seleciona a "fatura atual" de um cartão:
 *  1. Fatura cuja competência == competência calculada para hoje
 *     (regra: dia >= dia_fechamento entra no mês seguinte).
 *  2. Senão, primeira fatura aberta com valor_total > 0 (vencimento ascendente).
 *  3. Fallback: primeira fatura aberta qualquer (vencimento ascendente).
 */
export function getFaturaAtual<F extends {
  cartao_id: string;
  competencia: string;
  data_vencimento: string;
  status: string;
  valor_total: number | string;
}>(
  cartao: { id: string; dia_fechamento?: number | null },
  faturas: F[],
): F | null {
  const minhas = faturas.filter((f) => f.cartao_id === cartao.id && f.status !== 'paga');
  if (minhas.length === 0) return null;

  const dia = cartao.dia_fechamento ?? 1;
  const competenciaAtual = calcularCompetenciaFatura(new Date(), dia);
  const competenciaIso = format(competenciaAtual, 'yyyy-MM-dd');

  const matchCompetencia = minhas.find((f) => f.competencia === competenciaIso);
  if (matchCompetencia) return matchCompetencia;

  const ordenadas = [...minhas].sort((a, b) =>
    a.data_vencimento.localeCompare(b.data_vencimento),
  );
  const comValor = ordenadas.find((f) => Number(f.valor_total) > 0);
  return comValor || ordenadas[0] || null;
}
