process.env.TZ = 'America/Sao_Paulo';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDisplayStatus } from './statusHelpers';

const agora = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('getDisplayStatus', () => {
  it('status finais e "atrasado" são mantidos', () => {
    agora('2026-11-10T12:00:00-03:00');
    expect(getDisplayStatus('pago', '2026-01-01')).toBe('pago');
    expect(getDisplayStatus('recebido', '2026-01-01')).toBe('recebido');
    expect(getDisplayStatus('atrasado', '2026-12-01')).toBe('atrasado');
  });

  it('pendente sem data continua pendente; outros status passam direto', () => {
    expect(getDisplayStatus('pendente', null)).toBe('pendente');
    expect(getDisplayStatus('pendente', undefined)).toBe('pendente');
    expect(getDisplayStatus('cancelado', '2020-01-01')).toBe('cancelado');
  });

  it('23:30 em SP (02:30 UTC do dia seguinte): vencimento de hoje é "vence_hoje", não atrasado', () => {
    agora('2026-11-10T23:30:00-03:00');
    expect(getDisplayStatus('pendente', '2026-11-10')).toBe('vence_hoje');
    expect(getDisplayStatus('pendente', '2026-11-09')).toBe('atrasado');
    expect(getDisplayStatus('pendente', '2026-11-11')).toBe('pendente');
  });

  it('00:05 do dia 11 em SP: vencimento do dia 10 passa a atrasado', () => {
    agora('2026-11-11T00:05:00-03:00');
    expect(getDisplayStatus('pendente', '2026-11-10')).toBe('atrasado');
    expect(getDisplayStatus('pendente', '2026-11-11')).toBe('vence_hoje');
  });

  it('virada de ano: 31/12 às 23:59 o vencimento de 01/01 ainda é futuro', () => {
    agora('2026-12-31T23:59:00-03:00');
    expect(getDisplayStatus('pendente', '2027-01-01')).toBe('pendente');
    expect(getDisplayStatus('pendente', '2026-12-31')).toBe('vence_hoje');
  });

  it('aceita data com horário local', () => {
    agora('2026-11-10T08:00:00-03:00');
    expect(getDisplayStatus('pendente', '2026-11-10T18:00:00')).toBe('vence_hoje');
  });
});
