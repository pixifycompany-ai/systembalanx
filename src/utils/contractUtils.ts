import { parseISO, differenceInMonths, startOfMonth, endOfMonth } from 'date-fns';

export interface ContratoBase {
  id: string;
  cliente_id: string;
  data_inicio: string;
  data_fim?: string | null;
  data_inativacao?: string | null;
  status: string;
  valor: number;
  recorrencia: string;
}

export interface AditivoBase {
  contrato_id: string;
  valor_anterior: number;
  valor_novo: number;
  data_vigencia: string;
}

/**
 * Returns the effective end date for a contract.
 * Priority: data_inativacao > data_fim > null (still active)
 * For encerrado/cancelado without explicit dates, uses today as fallback.
 */
export function getDataFimEfetiva(contrato: ContratoBase): Date | null {
  if (contrato.data_inativacao) return parseISO(contrato.data_inativacao);
  if (contrato.data_fim) return parseISO(contrato.data_fim);
  // If contract is not active but has no end date, treat as ended today
  if (contrato.status === 'cancelado' || contrato.status === 'encerrado') {
    return new Date();
  }
  return null;
}

/**
 * Checks if a contract was active during a given month period.
 * Uses effective end date logic (data_inativacao > data_fim > status fallback).
 */
export function isContratoAtivoNoPeriodo(
  contrato: ContratoBase,
  periodoInicio: Date,
  periodoFim: Date
): boolean {
  const inicio = parseISO(contrato.data_inicio);
  const fimEfetivo = getDataFimEfetiva(contrato);
  return inicio <= periodoFim && (!fimEfetivo || fimEfetivo >= periodoInicio);
}

/**
 * Checks if a contract is currently active (today).
 * Requires status 'ativo' AND valid date range.
 */
export function isContratoAtivoHoje(contrato: ContratoBase): boolean {
  if (contrato.status !== 'ativo') return false;
  const today = new Date();
  const inicio = parseISO(contrato.data_inicio);
  const fimEfetivo = getDataFimEfetiva(contrato);
  return inicio <= today && (!fimEfetivo || fimEfetivo >= today);
}

/**
 * Returns the monthly equivalent value based on recurrence type.
 * 'unico' returns 0 to avoid distorting recurring metrics.
 */
export function getValorMensalEquivalente(valor: number, recorrencia: string): number {
  switch (recorrencia) {
    case 'mensal': return valor;
    case 'trimestral': return valor / 3;
    case 'semestral': return valor / 6;
    case 'anual': return valor / 12;
    case 'unico': return 0;
    default: return valor;
  }
}

/**
 * Returns the effective contract value at a given date considering aditivos.
 */
export function getValorVigenteNaData(
  contrato: ContratoBase,
  aditivos: AditivoBase[],
  data: Date
): number {
  const contratoAditivos = aditivos.filter(a => a.contrato_id === contrato.id);
  if (contratoAditivos.length === 0) return Number(contrato.valor);

  const dataStr = data.toISOString().split('T')[0];
  const aplicaveis = contratoAditivos
    .filter(a => a.data_vigencia <= dataStr)
    .sort((a, b) => b.data_vigencia.localeCompare(a.data_vigencia));

  if (aplicaveis.length > 0) return Number(aplicaveis[0].valor_novo);

  const earliest = [...contratoAditivos].sort((a, b) => a.data_vigencia.localeCompare(b.data_vigencia))[0];
  return Number(earliest.valor_anterior);
}

/**
 * Returns the monthly equivalent value for a contract at a given date, considering aditivos and recurrence.
 */
export function getValorMensalNaData(
  contrato: ContratoBase,
  aditivos: AditivoBase[],
  data: Date
): number {
  const valorVigente = getValorVigenteNaData(contrato, aditivos, data);
  return getValorMensalEquivalente(valorVigente, contrato.recorrencia);
}

/**
 * Calculates the relationship duration in months for a contract (minimum 1).
 */
export function getMesesRelacionamento(contrato: ContratoBase, referencia?: Date): number {
  const ref = referencia || new Date();
  const inicio = parseISO(contrato.data_inicio);
  const fimEfetivo = getDataFimEfetiva(contrato);
  const dataFinal = fimEfetivo && fimEfetivo < ref ? fimEfetivo : ref;
  return Math.max(1, differenceInMonths(dataFinal, inicio) + 1);
}

/**
 * Calculates the LTV for a single contract: valor_mensal × meses_ativo.
 */
export function calcularLTVContrato(
  contrato: ContratoBase,
  aditivos: AditivoBase[],
  referencia?: Date
): number {
  const ref = referencia || new Date();
  const valorMensal = getValorMensalNaData(contrato, aditivos, ref);
  const meses = getMesesRelacionamento(contrato, ref);
  return valorMensal * meses;
}

/**
 * Returns a set of client IDs that have at least one contract active in a given period.
 */
export function getClientesAtivosNoPeriodo(
  contratos: ContratoBase[],
  periodoInicio: Date,
  periodoFim: Date
): Set<string> {
  const clienteIds = new Set<string>();
  contratos.forEach(c => {
    if (isContratoAtivoNoPeriodo(c, periodoInicio, periodoFim)) {
      clienteIds.add(c.cliente_id);
    }
  });
  return clienteIds;
}

/**
 * Returns a set of client IDs that have at least one contract active today.
 */
export function getClientesAtivosHoje(contratos: ContratoBase[]): Set<string> {
  const clienteIds = new Set<string>();
  contratos.forEach(c => {
    if (isContratoAtivoHoje(c)) {
      clienteIds.add(c.cliente_id);
    }
  });
  return clienteIds;
}
