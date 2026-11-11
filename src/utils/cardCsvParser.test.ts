import { describe, expect, it } from 'vitest';
import { parseCardCsv } from './cardCsvParser';

describe('parseCardCsv', () => {
  it('formato tipo Nubank (vírgula, data ISO, ponto decimal)', () => {
    const { rows, warning } = parseCardCsv('date,title,amount\n2026-11-01,Uber *Trip,23.45\n2026-11-02,Mercado,1234.5');
    expect(warning).toBeUndefined();
    expect(rows).toEqual([
      { index: 0, data: '2026-11-01', descricao: 'Uber *Trip', valor: 23.45, parcela: undefined },
      { index: 1, data: '2026-11-02', descricao: 'Mercado', valor: 1234.5, parcela: undefined },
    ]);
  });

  it('formato de banco tradicional (ponto e vírgula, dd/MM/yyyy, "1.234,56")', () => {
    const { rows } = parseCardCsv('data;lançamento;valor\n10/11/2026;LOJA X;1.234,56\n11/11/2026;PADARIA;12,90');
    expect(rows.map((r) => [r.data, r.descricao, r.valor])).toEqual([
      ['2026-11-10', 'LOJA X', 1234.56],
      ['2026-11-11', 'PADARIA', 12.9],
    ]);
  });

  it('BOM, preâmbulo, aspas com vírgula dentro e "R$"', () => {
    const csv = '﻿Fatura cartão final 1234\n"data","descrição","valor"\n"10/11/2026","PADARIA, CENTRO","R$ 12,90"';
    const { rows } = parseCardCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ data: '2026-11-10', descricao: 'PADARIA, CENTRO', valor: 12.9 });
  });

  it('ano com 2 dígitos e separador "-"', () => {
    const { rows } = parseCardCsv('data;descricao;valor\n10-11-26;X;1,00');
    expect(rows[0].data).toBe('2026-11-10');
  });

  it('milhar com vírgula e decimal com ponto ("1,234.56")', () => {
    const { rows } = parseCardCsv('data;descricao;valor\n10/11/2026;X;1,234.56');
    expect(rows[0].valor).toBe(1234.56);
  });

  it('coluna de parcela entra na descrição', () => {
    const { rows } = parseCardCsv('data;descricao;valor;parcela\n10/11/2026;TV;500,00;2/10');
    expect(rows[0]).toMatchObject({ descricao: 'TV (Parcela 2/10)', parcela: '2/10', valor: 500 });
  });

  it('vários blocos de cartão no mesmo arquivo', () => {
    const csv = [
      'data;descricao;valor',
      '01/11/2026;A;10,00',
      'Cartão final 9999;;',
      'data;descricao;valor',
      '02/11/2026;B;20,00',
    ].join('\n');
    expect(parseCardCsv(csv).rows.map((r) => r.descricao)).toEqual(['A', 'B']);
  });

  it('CSV vazio ou sem colunas reconhecíveis devolve aviso', () => {
    expect(parseCardCsv('').warning).toMatch(/vazio/);
    expect(parseCardCsv('foo;bar\n1;2').warning).toMatch(/Não foi possível identificar colunas/);
  });

  // Era bug, corrigido em 11/2026 (cardCsvParser.ts:154): `valor: Math.abs(amount)` transforma créditos
  // (estorno, "Pagamento recebido" que vem negativo no CSV do Nubank) em despesas
  // positivas. O diálogo de importação marca todas as linhas como selecionadas, então
  // um estorno de R$ 50 vira uma despesa de R$ 50 na fatura.
  it('linha negativa (estorno/pagamento) não vira despesa positiva', () => {
    const { rows } = parseCardCsv('date,title,amount\n2026-11-01,Compra,100.00\n2026-11-03,Estorno Compra,-50.00');
    const estorno = rows.find((r) => r.descricao === 'Estorno Compra');
    expect(estorno?.valor).not.toBe(50);
  });
});
