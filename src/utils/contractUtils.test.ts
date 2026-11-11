process.env.TZ = 'America/Sao_Paulo';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { endOfMonth, startOfMonth } from 'date-fns';
import {
  calcularLTVContrato,
  getClientesAtivosNoPeriodo,
  getDataFimEfetiva,
  getMesesRelacionamento,
  getValorMensalEquivalente,
  getValorVigenteNaData,
  isContratoAtivoHoje,
  isContratoAtivoNoPeriodo,
  type AditivoBase,
  type ContratoBase,
} from './contractUtils';

const contrato = (extra: Partial<ContratoBase> = {}): ContratoBase => ({
  id: 'k1', cliente_id: 'cli1', data_inicio: '2026-01-01', status: 'ativo', valor: 1000, recorrencia: 'mensal', ...extra,
});

const agora = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('getValorMensalEquivalente', () => {
  it('converte cada recorrência para o valor mensal', () => {
    expect(getValorMensalEquivalente(100, 'semanal')).toBeCloseTo(433.33, 2);
    expect(getValorMensalEquivalente(100, 'quinzenal')).toBe(200);
    expect(getValorMensalEquivalente(100, 'mensal')).toBe(100);
    expect(getValorMensalEquivalente(300, 'trimestral')).toBe(100);
    expect(getValorMensalEquivalente(600, 'semestral')).toBe(100);
    expect(getValorMensalEquivalente(1200, 'anual')).toBe(100);
    expect(getValorMensalEquivalente(5000, 'unico')).toBe(0);
    expect(getValorMensalEquivalente(100, 'desconhecida')).toBe(100);
  });
});

describe('getDataFimEfetiva', () => {
  it('prioridade: data_inativacao > data_fim > null', () => {
    expect(getDataFimEfetiva(contrato({ data_fim: '2026-12-31', data_inativacao: '2026-06-15' }))!.getDate()).toBe(15);
    expect(getDataFimEfetiva(contrato({ data_fim: '2026-12-31' }))!.getMonth()).toBe(11);
    expect(getDataFimEfetiva(contrato())).toBeNull();
  });

  it('cancelado/encerrado sem datas usa "agora"', () => {
    agora('2026-11-10T10:00:00-03:00');
    expect(getDataFimEfetiva(contrato({ status: 'cancelado' }))!.getTime()).toBe(Date.now());
  });
});

describe('isContratoAtivoNoPeriodo', () => {
  const nov = [startOfMonth(new Date(2026, 10, 1)), endOfMonth(new Date(2026, 10, 1))] as const;

  it('contrato que começa no meio do mês conta no mês', () => {
    expect(isContratoAtivoNoPeriodo(contrato({ data_inicio: '2026-11-15' }), ...nov)).toBe(true);
  });

  it('contrato que começa no último dia do mês conta no mês', () => {
    expect(isContratoAtivoNoPeriodo(contrato({ data_inicio: '2026-11-30' }), ...nov)).toBe(true);
  });

  it('contrato que começa no mês seguinte não conta', () => {
    expect(isContratoAtivoNoPeriodo(contrato({ data_inicio: '2026-12-01' }), ...nov)).toBe(false);
  });

  it('contrato encerrado no dia 1 conta no mês; encerrado no dia 31 do mês anterior não', () => {
    expect(isContratoAtivoNoPeriodo(contrato({ data_fim: '2026-11-01' }), ...nov)).toBe(true);
    expect(isContratoAtivoNoPeriodo(contrato({ data_fim: '2026-10-31' }), ...nov)).toBe(false);
  });
});

describe('isContratoAtivoHoje', () => {
  it('status diferente de ativo nunca está ativo', () => {
    agora('2026-11-10T10:00:00-03:00');
    expect(isContratoAtivoHoje(contrato({ status: 'pausado' }))).toBe(false);
  });

  it('começa hoje → ativo; começa amanhã → não', () => {
    agora('2026-11-10T10:00:00-03:00');
    expect(isContratoAtivoHoje(contrato({ data_inicio: '2026-11-10' }))).toBe(true);
    expect(isContratoAtivoHoje(contrato({ data_inicio: '2026-11-11' }))).toBe(false);
  });

  it('terminou ontem → não ativo', () => {
    agora('2026-11-10T10:00:00-03:00');
    expect(isContratoAtivoHoje(contrato({ data_fim: '2026-11-09' }))).toBe(false);
  });

  // Era bug, corrigido em 11/2026 (contractUtils.ts:59): data_fim vira meia-noite (00:00) do último dia e é
  // comparada com o instante atual. A partir de 00:00:01 do último dia do contrato
  // ele já sai de "ativo hoje" (MRR do dashboard, lista de vigentes).
  it('contrato cujo último dia é hoje ainda está ativo às 10:00', () => {
    agora('2026-11-10T10:00:00-03:00');
    expect(isContratoAtivoHoje(contrato({ data_fim: '2026-11-10' }))).toBe(true);
  });
});

describe('getValorVigenteNaData', () => {
  const aditivos: AditivoBase[] = [
    { contrato_id: 'k1', valor_anterior: 1000, valor_novo: 1500, data_vigencia: '2026-06-01' },
    { contrato_id: 'k1', valor_anterior: 1500, valor_novo: 2000, data_vigencia: '2026-09-01' },
    { contrato_id: 'outro', valor_anterior: 1, valor_novo: 9999, data_vigencia: '2026-01-01' },
  ];

  it('sem aditivos usa o valor do contrato', () => {
    expect(getValorVigenteNaData(contrato(), [], new Date(2026, 10, 10, 12))).toBe(1000);
  });

  it('antes do primeiro aditivo usa valor_anterior; depois, o aditivo mais recente vigente', () => {
    expect(getValorVigenteNaData(contrato(), aditivos, new Date(2026, 4, 15, 12))).toBe(1000);
    expect(getValorVigenteNaData(contrato(), aditivos, new Date(2026, 6, 15, 12))).toBe(1500);
    expect(getValorVigenteNaData(contrato(), aditivos, new Date(2026, 10, 15, 12))).toBe(2000);
  });

  it('o aditivo vale a partir do próprio dia de vigência', () => {
    expect(getValorVigenteNaData(contrato(), aditivos, new Date(2026, 5, 1, 12))).toBe(1500);
  });

  // Era bug, corrigido em 11/2026 (contractUtils.ts:90): converte a data com toISOString (UTC). Às 21:30 de
  // 31/05 no Brasil já é 01/06 em UTC, então o aditivo de 01/06 entra um dia antes.
  it('às 21:30 de 31/05 o aditivo de 01/06 ainda não vale', () => {
    expect(getValorVigenteNaData(contrato(), aditivos, new Date(2026, 4, 31, 21, 30))).toBe(1000);
  });

  // Era bug, corrigido em 11/2026 (mesma linha): useAnalises.ts:110 chama com endOfMonth(mês) = 23:59:59 local,
  // que em UTC é o dia 1 do mês seguinte. O aditivo do mês seguinte é contado no mês atual.
  it('valor de maio (endOfMonth) não inclui o aditivo que começa em 01/06', () => {
    expect(getValorVigenteNaData(contrato(), aditivos, endOfMonth(new Date(2026, 4, 1)))).toBe(1000);
  });
});

describe('getMesesRelacionamento / calcularLTVContrato', () => {
  it('mínimo de 1 mês', () => {
    expect(getMesesRelacionamento(contrato({ data_inicio: '2026-11-10' }), new Date(2026, 10, 10, 12))).toBe(1);
  });

  it('ano cheio = 12 meses', () => {
    expect(getMesesRelacionamento(contrato({ data_inicio: '2026-01-01' }), new Date(2026, 11, 31, 12))).toBe(12);
  });

  it('contrato encerrado conta só até o fim (jan–jun = 6 meses)', () => {
    const c = contrato({ data_inicio: '2026-01-01', data_fim: '2026-06-30' });
    expect(getMesesRelacionamento(c, new Date(2026, 10, 10, 12))).toBe(6);
    expect(calcularLTVContrato(c, [], new Date(2026, 10, 10, 12))).toBe(6000);
  });

  it('LTV usa o valor mensal equivalente (anual 12.000 → 1.000/mês)', () => {
    const c = contrato({ data_inicio: '2026-01-01', data_fim: '2026-06-30', valor: 12000, recorrencia: 'anual' });
    expect(calcularLTVContrato(c, [], new Date(2026, 10, 10, 12))).toBe(6000);
  });
});

describe('getClientesAtivosNoPeriodo', () => {
  it('conta cada cliente uma vez e ignora contratos fora do período', () => {
    const nov = [startOfMonth(new Date(2026, 10, 1)), endOfMonth(new Date(2026, 10, 1))] as const;
    const ids = getClientesAtivosNoPeriodo([
      contrato({ id: 'a', cliente_id: 'x' }),
      contrato({ id: 'b', cliente_id: 'x' }),
      contrato({ id: 'c', cliente_id: 'y', data_fim: '2026-10-31' }),
      contrato({ id: 'd', cliente_id: 'z', data_inicio: '2026-11-30' }),
    ], ...nov);
    expect([...ids].sort()).toEqual(['x', 'z']);
  });
});
