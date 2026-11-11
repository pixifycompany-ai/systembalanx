import { format, parseISO } from 'date-fns';

/** Lançamento em aberto para a checagem de duplicados. */
export interface ItemDuplicavel {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  tipo: 'receita' | 'despesa';
  fornecedor_cliente: string;
}

const parcela = (d: string) => d.match(/\((\d+)\s*\/\s*\d+\)/)?.[1] ?? null;

/**
 * Possíveis duplicados: mesmo valor, mesmo cliente/fornecedor e mesmo mês.
 * Não conta: parcelas diferentes da mesma série ("(2/6)" x "(3/6)", ex.: quinzenal)
 * ou cada lançamento com a sua própria cobrança no Asaas.
 * Devolve os grupos (2+ itens) já filtrados.
 */
export function gruposDuplicados<T extends ItemDuplicavel>(itens: T[], cobrancaDe: Map<string, string>): T[][] {
  const mapa = new Map<string, T[]>();
  for (const item of itens) {
    if (!item.data_vencimento) continue;
    const mes = format(parseISO(item.data_vencimento), 'yyyy-MM');
    const chave = `${item.tipo}-${item.valor}-${item.fornecedor_cliente.toLowerCase().trim()}-${mes}`;
    mapa.set(chave, [...(mapa.get(chave) || []), item]);
  }
  const conflitam = (a: T, b: T) => {
    const pa = parcela(a.descricao), pb = parcela(b.descricao);
    if (pa && pb && pa !== pb) return false;
    const ca = cobrancaDe.get(a.id), cb = cobrancaDe.get(b.id);
    if (ca && cb && ca !== cb) return false;
    return true;
  };
  const grupos: T[][] = [];
  mapa.forEach((grupo) => {
    const g = grupo.filter((a) => grupo.some((b) => b !== a && conflitam(a, b)));
    if (g.length > 1) grupos.push(g);
  });
  return grupos;
}
