process.env.TZ = 'America/Sao_Paulo';

import { describe, expect, it } from 'vitest';
import { gruposDuplicados, type ItemDuplicavel } from './duplicados';

let seq = 0;
const item = (extra: Partial<ItemDuplicavel> = {}): ItemDuplicavel => ({
  id: `i${++seq}`,
  descricao: 'Aluguel',
  valor: 1500,
  data_vencimento: '2026-11-10',
  tipo: 'despesa',
  fornecedor_cliente: 'Imobiliária Centro',
  ...extra,
});
const ids = (grupos: ItemDuplicavel[][]) => grupos.map((g) => g.map((i) => i.id).sort());
const semCobranca = new Map<string, string>();

describe('gruposDuplicados', () => {
  it('mesmo valor, mesmo fornecedor (sem diferenciar maiúsculas/espaços) e mesmo mês → duplicado', () => {
    const a = item({ id: 'a' });
    const b = item({ id: 'b', fornecedor_cliente: '  imobiliária centro ', data_vencimento: '2026-11-25' });
    expect(ids(gruposDuplicados([a, b], semCobranca))).toEqual([['a', 'b']]);
  });

  it('meses diferentes não são duplicados (inclusive 31/10 x 01/11)', () => {
    const a = item({ data_vencimento: '2026-10-31' });
    const b = item({ data_vencimento: '2026-11-01' });
    expect(gruposDuplicados([a, b], semCobranca)).toEqual([]);
  });

  it('virada de ano: dezembro/2026 x dezembro/2027 não são duplicados', () => {
    expect(gruposDuplicados([item({ data_vencimento: '2026-12-10' }), item({ data_vencimento: '2027-12-10' })], semCobranca)).toEqual([]);
  });

  it('valores diferentes não são duplicados', () => {
    expect(gruposDuplicados([item({ valor: 1500 }), item({ valor: 1500.01 })], semCobranca)).toEqual([]);
  });

  it('parcelas diferentes da mesma série ("(1/6)" x "(2/6)", ex.: quinzenal) NÃO são duplicadas', () => {
    const a = item({ descricao: 'Consultoria (1/6)' });
    const b = item({ descricao: 'Consultoria (2/6)', data_vencimento: '2026-11-25' });
    expect(gruposDuplicados([a, b], semCobranca)).toEqual([]);
  });

  it('aceita espaços na marcação da parcela: "(1 / 6)" x "(2 / 6)"', () => {
    expect(gruposDuplicados([item({ descricao: 'X (1 / 6)' }), item({ descricao: 'X (2 / 6)' })], semCobranca)).toEqual([]);
  });

  it('a MESMA parcela lançada duas vezes é duplicada', () => {
    const a = item({ id: 'a', descricao: 'Consultoria (2/6)' });
    const b = item({ id: 'b', descricao: 'Consultoria (2/6)' });
    expect(ids(gruposDuplicados([a, b], semCobranca))).toEqual([['a', 'b']]);
  });

  it('em três itens, só ficam no grupo os que conflitam entre si', () => {
    const a = item({ id: 'a', descricao: 'Consultoria (1/6)' });
    const b = item({ id: 'b', descricao: 'Consultoria (2/6)' });
    const c = item({ id: 'c', descricao: 'Consultoria (2/6)' });
    expect(ids(gruposDuplicados([a, b, c], semCobranca))).toEqual([['b', 'c']]);
  });

  it('cada lançamento com sua própria cobrança no Asaas NÃO é duplicado', () => {
    const a = item({ id: 'a', tipo: 'receita' });
    const b = item({ id: 'b', tipo: 'receita' });
    const cobrancas = new Map([['a', 'cob1'], ['b', 'cob2']]);
    expect(gruposDuplicados([a, b], cobrancas)).toEqual([]);
  });

  it('mesma cobrança, ou só um dos lados com cobrança → continua suspeito', () => {
    const a = item({ id: 'a', tipo: 'receita' });
    const b = item({ id: 'b', tipo: 'receita' });
    expect(ids(gruposDuplicados([a, b], new Map([['a', 'cob1'], ['b', 'cob1']])))).toEqual([['a', 'b']]);
    expect(ids(gruposDuplicados([a, b], new Map([['a', 'cob1']])))).toEqual([['a', 'b']]);
  });

  it('itens sem data de vencimento são ignorados', () => {
    expect(gruposDuplicados([item({ data_vencimento: '' }), item({ data_vencimento: '' })], semCobranca)).toEqual([]);
  });

  it('item único não forma grupo', () => {
    expect(gruposDuplicados([item()], semCobranca)).toEqual([]);
  });

  // Era bug, corrigido em 11/2026 (duplicados.ts:26): a chave não inclui `tipo`. usePendencias.ts:165-169 junta
  // receitas e despesas na mesma lista, então uma receita de R$ 1.500 do cliente X e
  // uma despesa de R$ 1.500 para o fornecedor X no mesmo mês viram "Possível duplicado",
  // e a pendência sugere excluir um deles.
  it('receita e despesa com mesmo valor/nome/mês não são duplicadas entre si', () => {
    const r = item({ id: 'r', tipo: 'receita', fornecedor_cliente: 'Fulano' });
    const d = item({ id: 'd', tipo: 'despesa', fornecedor_cliente: 'Fulano' });
    expect(gruposDuplicados([r, d], semCobranca)).toEqual([]);
  });
});
