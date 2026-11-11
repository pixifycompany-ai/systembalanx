process.env.TZ = 'America/Sao_Paulo';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { endOfMonth } from 'date-fns';
import {
  calculatePercentageChange,
  formatCNPJ,
  formatCPF,
  formatCPFCNPJ,
  formatCurrency,
  formatCurrencyShort,
  formatDate,
  formatDateISO,
  formatNumber,
  formatPercentage,
  formatPhone,
  getDaysUntilDue,
  getMonthNameFull,
  getMonthNameShort,
  getRelativeTime,
  isOverdue,
  maskCpfCnpj,
  onlyDigits,
  parseBRDate,
} from './formatters';

/** Intl usa espaço não separável entre "R$" e o número. */
const n = (s: string) => s.replace(/[  ]/g, ' ');

const agora = (iso: string) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
};

afterEach(() => {
  vi.useRealTimers();
});

describe('formatCurrency', () => {
  it('formata em reais com milhar "." e decimal ","', () => {
    expect(n(formatCurrency(1234.56))).toBe('R$ 1.234,56');
    expect(n(formatCurrency(1000000))).toBe('R$ 1.000.000,00');
    expect(n(formatCurrency(0))).toBe('R$ 0,00');
  });

  it('valores negativos levam o sinal', () => {
    expect(n(formatCurrency(-1234.5))).toBe('-R$ 1.234,50');
  });

  it('não exibe o ruído de ponto flutuante (0,1 + 0,2)', () => {
    expect(n(formatCurrency(0.1 + 0.2))).toBe('R$ 0,30');
  });
});

describe('formatCurrencyShort', () => {
  it('abaixo de mil usa o formato completo', () => {
    expect(n(formatCurrencyShort(999))).toBe('R$ 999,00');
  });

  it('abrevia milhões e bilhões', () => {
    expect(formatCurrencyShort(2_000_000)).toMatch(/M$/);
    expect(formatCurrencyShort(3_000_000_000)).toMatch(/B$/);
  });

  // Era bug, corrigido em 11/2026 (formatters.ts:123-129): usa toFixed, que gera ponto decimal ("R$ 1.5K").
  // Em pt-BR o ponto é separador de milhar, então "1.5K" lê errado; esperado "1,5".
  it('usa vírgula decimal: 1.500 → "R$ 1,5K"', () => {
    expect(formatCurrencyShort(1500)).toBe('R$ 1,5K');
  });

  // Era bug, corrigido em 11/2026 (formatters.ts:121-131): só testa value >= 1000, então negativos (prejuízo,
  // saldo negativo em eixo de gráfico) nunca são abreviados.
  it('abrevia valores negativos: -2.500 → termina em "K"', () => {
    expect(formatCurrencyShort(-2500)).toMatch(/K$/);
  });
});

describe('formatDate', () => {
  it('data pura "yyyy-MM-dd" não volta um dia no fuso do Brasil', () => {
    expect(formatDate('2026-11-10')).toBe('10/11/2026');
    expect(formatDate('2026-01-01')).toBe('01/01/2026');
    expect(formatDate('2028-02-29')).toBe('29/02/2028');
  });

  it('Date às 23:30 local continua no mesmo dia', () => {
    expect(formatDate(new Date(2026, 10, 10, 23, 30))).toBe('10/11/2026');
  });

  it('vazio vira "-"', () => {
    expect(formatDate('')).toBe('-');
  });

  // Era bug, corrigido em 11/2026 (formatters.ts:18): concatena "T00:00:00" em qualquer string; um timestamp
  // ISO completo vira "2026-11-10T15:00:00ZT00:00:00" → "Invalid Date".
  // (Hoje os chamadores conhecidos fazem .slice(0, 10) antes, mas a função quebra.)
  it('aceita timestamp ISO completo', () => {
    expect(formatDate('2026-11-10T15:00:00Z')).toBe('10/11/2026');
  });
});

describe('formatDateISO', () => {
  it('meio-dia local devolve o próprio dia', () => {
    expect(formatDateISO(new Date(2026, 10, 10, 12, 0))).toBe('2026-11-10');
  });

  // Era bug, corrigido em 11/2026 (formatters.ts:26): usa toISOString (UTC). Das 21:00 às 23:59 no Brasil
  // já é o dia seguinte em UTC, então devolve o dia errado.
  it('às 22:00 do dia 10 em São Paulo devolve 2026-11-10', () => {
    expect(formatDateISO(new Date(2026, 10, 10, 22, 0))).toBe('2026-11-10');
  });

  it('fim do mês (endOfMonth) não vira o dia 1 do mês seguinte', () => {
    expect(formatDateISO(endOfMonth(new Date(2026, 9, 1)))).toBe('2026-10-31');
  });
});

describe('isOverdue / getDaysUntilDue (perto da meia-noite UTC)', () => {
  it('23:30 do dia 10 em SP (02:30 UTC do dia 11): vencimento dia 10 é hoje, não atrasado', () => {
    agora('2026-11-10T23:30:00-03:00');
    expect(isOverdue('2026-11-10')).toBe(false);
    expect(getDaysUntilDue('2026-11-10')).toBe(0);
    expect(getDaysUntilDue('2026-11-11')).toBe(1);
  });

  it('00:10 do dia 11 em SP: vencimento dia 10 está atrasado 1 dia', () => {
    agora('2026-11-11T00:10:00-03:00');
    expect(isOverdue('2026-11-10')).toBe(true);
    expect(getDaysUntilDue('2026-11-10')).toBe(-1);
    expect(isOverdue('2026-11-11')).toBe(false);
  });

  it('conta dias atravessando fevereiro e virada de ano', () => {
    agora('2026-02-27T10:00:00-03:00');
    expect(getDaysUntilDue('2026-03-01')).toBe(2);
    agora('2028-02-28T10:00:00-03:00');
    expect(getDaysUntilDue('2028-03-01')).toBe(2);
    agora('2026-12-31T22:00:00-03:00');
    expect(getDaysUntilDue('2027-01-01')).toBe(1);
    expect(getDaysUntilDue('2027-01-31')).toBe(31);
  });

  it('string vazia: não atrasado e 0 dias', () => {
    expect(isOverdue('')).toBe(false);
    expect(getDaysUntilDue('')).toBe(0);
  });
});

describe('getRelativeTime', () => {
  it('casos simples no meio do dia', () => {
    agora('2026-11-10T15:00:00-03:00');
    expect(getRelativeTime(new Date('2026-11-10T09:00:00-03:00'))).toBe('Hoje');
    expect(getRelativeTime(new Date('2026-11-09T15:00:00-03:00'))).toBe('Ontem');
    expect(getRelativeTime(new Date('2026-11-07T15:00:00-03:00'))).toBe('3 dias atrás');
  });

  // Era bug, corrigido em 11/2026 (formatters.ts:175-177): data pura "yyyy-MM-dd" é lida como meia-noite UTC
  // (21:00 do dia anterior no Brasil) e a diferença é em horas, não em dias de
  // calendário. Às 23:30 de hoje, a data de hoje aparece como "Ontem".
  it('às 23:30, a data de hoje ("2026-11-10") é "Hoje"', () => {
    agora('2026-11-10T23:30:00-03:00');
    expect(getRelativeTime('2026-11-10')).toBe('Hoje');
  });

  // Era bug, corrigido em 11/2026 (mesma linha): 23:00 de ontem → 08:00 de hoje são 9h, e floor(9/24)=0 → "Hoje".
  it('algo de ontem às 23:00, visto hoje às 08:00, é "Ontem"', () => {
    agora('2026-11-10T08:00:00-03:00');
    expect(getRelativeTime(new Date('2026-11-09T23:00:00-03:00'))).toBe('Ontem');
  });
});

describe('formatPercentage / formatNumber', () => {
  it('sem casas decimais', () => {
    expect(formatPercentage(50, 0)).toBe('50%');
  });

  // Era bug, corrigido em 11/2026 (formatters.ts:108): toFixed usa ponto decimal; em pt-BR é "12,5%".
  it('usa vírgula decimal: 12,5%', () => {
    expect(formatPercentage(12.5)).toBe('12,5%');
  });

  it('formatNumber usa separadores pt-BR', () => {
    expect(formatNumber(1234567.891)).toBe('1.234.567,891');
  });
});

describe('calculatePercentageChange', () => {
  it('variações comuns', () => {
    expect(calculatePercentageChange(150, 100)).toBe(50);
    expect(calculatePercentageChange(50, 100)).toBe(-50);
    expect(calculatePercentageChange(10, 0)).toBe(100);
    expect(calculatePercentageChange(0, 0)).toBe(0);
  });

  // Era bug, corrigido em 11/2026 (formatters.ts:168): divide por `previous` sem Math.abs. Resultado que sai de
  // -100 (prejuízo) para -50 melhorou, mas a função devolve -50%.
  it('base negativa: de -100 para -50 é melhora de +50%', () => {
    expect(calculatePercentageChange(-50, -100)).toBe(50);
  });
});

describe('parseBRDate', () => {
  it('lê dd/MM/yyyy como data local', () => {
    const d = parseBRDate('10/11/2026')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 10, 10, 0]);
  });

  it('entradas vazias ou inválidas viram null', () => {
    expect(parseBRDate('')).toBeNull();
    expect(parseBRDate('abc')).toBeNull();
  });

  // Era bug, corrigido em 11/2026 (formatters.ts:160): new Date(2026, 1, 31) "transborda" para 03/03/2026
  // em vez de rejeitar a data inexistente.
  it('31/02/2026 não existe → null', () => {
    expect(parseBRDate('31/02/2026')).toBeNull();
  });
});

describe('documentos e telefone', () => {
  it('formatPhone celular e fixo', () => {
    expect(formatPhone('11987654321')).toBe('(11) 98765-4321');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatPhone('')).toBe('-');
  });

  it('formatCPF / formatCNPJ / formatCPFCNPJ', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
    expect(formatCNPJ('12345678000195')).toBe('12.345.678/0001-95');
    expect(formatCPFCNPJ('123.456.789-01')).toBe('123.456.789-01');
    expect(formatCPFCNPJ('12345678000195')).toBe('12.345.678/0001-95');
    expect(formatCPFCNPJ('123')).toBe('123');
  });

  it('maskCpfCnpj aplica máscara parcial enquanto digita e corta o excesso', () => {
    expect(maskCpfCnpj('123', 'PF')).toBe('123');
    expect(maskCpfCnpj('1234', 'PF')).toBe('123.4');
    expect(maskCpfCnpj('1234567', 'PF')).toBe('123.456.7');
    expect(maskCpfCnpj('12345678901', 'PF')).toBe('123.456.789-01');
    expect(maskCpfCnpj('123456789012345', 'PF')).toBe('123.456.789-01');
    expect(maskCpfCnpj('123456', 'PJ')).toBe('12.345.6');
    expect(maskCpfCnpj('12.345.678/0001-95', 'PJ')).toBe('12.345.678/0001-95');
    expect(maskCpfCnpj('', 'PJ')).toBe('');
  });

  it('onlyDigits', () => {
    expect(onlyDigits('12.345.678/0001-95')).toBe('12345678000195');
    expect(onlyDigits('')).toBe('');
  });
});

describe('nomes de mês', () => {
  it('abreviado e completo, índice fora da faixa vira ""', () => {
    expect(getMonthNameShort(0)).toBe('Jan');
    expect(getMonthNameShort(11)).toBe('Dez');
    expect(getMonthNameFull(2)).toBe('Março');
    expect(getMonthNameFull(12)).toBe('');
  });
});
