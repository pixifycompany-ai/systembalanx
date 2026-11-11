process.env.TZ = 'America/Sao_Paulo';

import { describe, expect, it } from 'vitest';
import { contaPadrao, proximaDataSerie } from './lancarItens';

describe('proximaDataSerie', () => {
  it('índice 0 é a própria data base', () => {
    expect(proximaDataSerie('2026-11-10', 'mensal', 0)).toBe('2026-11-10');
  });

  it('mensal a partir do dia 31 não "gruda" no 28: 31/01 → 28/02 → 31/03 → 30/04', () => {
    expect([0, 1, 2, 3].map((i) => proximaDataSerie('2026-01-31', 'mensal', i))).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30',
    ]);
  });

  it('mensal em ano bissexto: 31/01/2028 → 29/02/2028', () => {
    expect(proximaDataSerie('2028-01-31', 'mensal', 1)).toBe('2028-02-29');
  });

  it('virada de ano: dezembro → janeiro do ano seguinte', () => {
    expect(proximaDataSerie('2026-12-15', 'mensal', 1)).toBe('2027-01-15');
  });

  it('frequência desconhecida cai no mensal', () => {
    expect(proximaDataSerie('2026-11-10', 'xyz', 2)).toBe('2027-01-10');
  });

  it('semanal e quinzenal somam dias corridos', () => {
    expect(proximaDataSerie('2026-11-10', 'semanal', 2)).toBe('2026-11-24');
    expect(proximaDataSerie('2026-12-25', 'semanal', 1)).toBe('2027-01-01');
    expect(proximaDataSerie('2026-11-10', 'quinzenal', 1)).toBe('2026-11-25');
    expect(proximaDataSerie('2026-02-20', 'quinzenal', 1)).toBe('2026-03-07');
  });

  it('bimestral, trimestral e semestral ajustam fim de mês', () => {
    expect(proximaDataSerie('2026-12-31', 'bimestral', 1)).toBe('2027-02-28');
    expect(proximaDataSerie('2026-11-30', 'trimestral', 1)).toBe('2027-02-28');
    expect(proximaDataSerie('2026-08-31', 'semestral', 1)).toBe('2027-02-28');
    expect(proximaDataSerie('2027-08-31', 'semestral', 1)).toBe('2028-02-29');
  });

  it('anual a partir de 29/02 vira 28/02 no ano não bissexto', () => {
    expect(proximaDataSerie('2028-02-29', 'anual', 1)).toBe('2029-02-28');
    expect(proximaDataSerie('2028-02-29', 'anual', 4)).toBe('2032-02-29');
  });
});

describe('contaPadrao', () => {
  it('prefere a conta corrente ativa', () => {
    expect(contaPadrao([
      { id: 'cc', tipo: 'cartao_credito' },
      { id: 'inativa', tipo: 'corrente', ativa: false },
      { id: 'poup', tipo: 'poupanca' },
      { id: 'corr', tipo: 'corrente' },
    ])).toBe('corr');
  });

  it('sem corrente, usa a primeira que não é cartão', () => {
    expect(contaPadrao([{ id: 'cc', tipo: 'cartao_credito' }, { id: 'poup', tipo: 'poupanca' }])).toBe('poup');
  });

  it('só cartão: usa o cartão; nenhuma conta: null', () => {
    expect(contaPadrao([{ id: 'cc', tipo: 'cartao_credito' }])).toBe('cc');
    expect(contaPadrao([])).toBeNull();
  });
});
