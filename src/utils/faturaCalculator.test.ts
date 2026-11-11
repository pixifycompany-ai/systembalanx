// Fuso do usuário: datas "de calendário" precisam bater com o relógio do Brasil.
process.env.TZ = 'America/Sao_Paulo';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { addMonths, differenceInCalendarMonths, format, getDaysInMonth, parseISO } from 'date-fns';
import {
  calcularCompetenciaFatura,
  calcularDatasFatura,
  calcularDatasFaturaComAnchor,
  getFaturaAtual,
  melhorDiaDeCompra,
  rotuloCompetencia,
  toISODate,
} from './faturaCalculator';

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
const comp = (compra: string, fech: number) => ymd(calcularCompetenciaFatura(compra, fech));

/** Fatura (fechamento/vencimento) em que uma compra cai, pela regra sem anchor. */
const faturaDaCompra = (compra: string, fech: number, venc: number) => {
  const r = calcularDatasFatura(calcularCompetenciaFatura(compra, fech), fech, venc);
  return { fechamento: ymd(r.data_fechamento), vencimento: ymd(r.data_vencimento) };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('ambiente', () => {
  it('roda no fuso America/Sao_Paulo (UTC-3, sem horário de verão)', () => {
    expect(new Date(2026, 0, 15).getTimezoneOffset()).toBe(180);
    expect(new Date(2026, 6, 15).getTimezoneOffset()).toBe(180);
  });
});

describe('calcularCompetenciaFatura', () => {
  it('compra antes do dia de fechamento fica na competência do próprio mês', () => {
    expect(comp('2026-04-15', 28)).toBe('2026-04-01');
    expect(comp('2026-04-27', 28)).toBe('2026-04-01');
  });

  it('compra no dia do fechamento ou depois vai para a competência seguinte', () => {
    expect(comp('2026-04-28', 28)).toBe('2026-05-01');
    expect(comp('2026-04-30', 28)).toBe('2026-05-01');
  });

  it('virada de ano: compra em dezembro após o fechamento vai para janeiro do ano seguinte', () => {
    expect(comp('2026-12-20', 10)).toBe('2027-01-01');
    expect(comp('2026-12-09', 10)).toBe('2026-12-01');
  });

  it('aceita Date e usa o dia LOCAL (23:30 em São Paulo continua sendo o mesmo dia)', () => {
    expect(ymd(calcularCompetenciaFatura(new Date(2026, 3, 27, 23, 30), 28))).toBe('2026-04-01');
  });

  it('timestamp UTC perto da meia-noite é lido no fuso local (01:00Z do dia 28 = 22:00 do dia 27 no Brasil)', () => {
    expect(comp('2026-04-28T01:00:00Z', 28)).toBe('2026-04-01');
    expect(comp('2026-04-28T03:00:00Z', 28)).toBe('2026-05-01');
  });

  it('fechamento dia 31 em mês de 31 dias', () => {
    expect(comp('2026-01-30', 31)).toBe('2026-01-01');
    expect(comp('2026-01-31', 31)).toBe('2026-02-01');
  });

  // Era bug, corrigido em 11/2026: em mês curto o fechamento "dia 31" é ajustado para o último dia do mês
  // (clampDia em calcularDatasFatura), mas calcularCompetenciaFatura compara o dia
  // bruto (28 >= 31 → falso). A compra feita no próprio dia do fechamento de
  // fevereiro (28/02) fica na fatura que fecha nesse dia, em vez de ir para a
  // próxima, igual à compra de 01/03.
  it('fevereiro: com fechamento dia 31, compra em 28/02 (dia do fechamento) vai para a mesma fatura de 01/03', () => {
    expect(comp('2026-02-28', 31)).toBe(comp('2026-03-01', 31));
  });

  // Era bug, corrigido em 11/2026 (mesma causa, ano bissexto): fechamento dia 30, fevereiro/2028 fecha em 29/02.
  it('ano bissexto: com fechamento dia 30, compra em 29/02/2028 vai para a mesma fatura de 01/03/2028', () => {
    expect(comp('2028-02-29', 30)).toBe(comp('2028-03-01', 30));
  });
});

describe('calcularDatasFatura: ajustes de calendário', () => {
  const competencias = Array.from({ length: 36 }, (_, i) => addMonths(new Date(2026, 0, 1), i));

  it('dia 31 nunca estoura o mês: vira o último dia do mês (30, 28 ou 29)', () => {
    for (const c of competencias) {
      const { data_fechamento, data_vencimento } = calcularDatasFatura(c, 31, 31);
      expect(data_fechamento.getDate()).toBe(getDaysInMonth(data_fechamento));
      expect(data_vencimento.getDate()).toBe(getDaysInMonth(data_vencimento));
    }
  });

  it('dia 30 em fevereiro vira 28 (ou 29 em ano bissexto); nos demais meses fica 30', () => {
    for (const c of competencias) {
      const { data_fechamento, data_vencimento } = calcularDatasFatura(c, 30, 30);
      for (const d of [data_fechamento, data_vencimento]) {
        expect(d.getDate()).toBe(Math.min(30, getDaysInMonth(d)));
      }
    }
  });

  it('fevereiro de 2028 (bissexto) usa 29', () => {
    const fevs = competencias
      .flatMap((c) => Object.values(calcularDatasFatura(c, 31, 31)))
      .filter((d) => d.getFullYear() === 2028 && d.getMonth() === 1);
    expect(fevs.length).toBeGreaterThan(0);
    for (const d of fevs) expect(d.getDate()).toBe(29);
  });

  it('competências consecutivas geram fechamentos e vencimentos em meses consecutivos (não pula nem repete mês na virada)', () => {
    for (let i = 1; i < competencias.length; i++) {
      const a = calcularDatasFatura(competencias[i - 1], 31, 5);
      const b = calcularDatasFatura(competencias[i], 31, 5);
      expect(differenceInCalendarMonths(b.data_fechamento, a.data_fechamento)).toBe(1);
      expect(differenceInCalendarMonths(b.data_vencimento, a.data_vencimento)).toBe(1);
    }
  });

  it('vencimento é sempre depois do fechamento', () => {
    for (const c of competencias) {
      const { data_fechamento, data_vencimento } = calcularDatasFatura(c, 28, 10);
      expect(data_vencimento.getTime()).toBeGreaterThan(data_fechamento.getTime());
    }
  });
});

describe('compra → fatura (fechamento e vencimento reais do cartão)', () => {
  it('cartão fecha 28 e vence 10: compra em 15/04 vence em 10/05', () => {
    expect(faturaDaCompra('2026-04-15', 28, 10).vencimento).toBe('2026-05-10');
  });

  it('cartão fecha 28 e vence 10: compra no dia do fechamento (28/04) vence em 10/06', () => {
    expect(faturaDaCompra('2026-04-28', 28, 10).vencimento).toBe('2026-06-10');
  });

  it('virada de ano: cartão fecha 20 e vence 5, compra em 22/12/2026 vence em 05/02/2027', () => {
    expect(faturaDaCompra('2026-12-22', 20, 5).vencimento).toBe('2027-02-05');
  });

  // Era bug, corrigido em 11/2026: calcularDatasFatura põe o fechamento no mês ANTERIOR à competência,
  // mas calcularCompetenciaFatura coloca a compra de 15/04 (fech. 28) na
  // competência 04/2026. Resultado: a fatura dessa compra "fechou" em 28/03,
  // antes da própria compra. O correto é 28/04. Isso faz useDashboard.ts:566
  // tratar a fatura em aberto como "fechada".
  it('a fatura de uma compra fecha DEPOIS da compra (fecha 28, compra 15/04 → fechamento 28/04)', () => {
    expect(faturaDaCompra('2026-04-15', 28, 10).fechamento).toBe('2026-04-28');
  });

  // Era bug, corrigido em 11/2026: quando o vencimento é depois do fechamento no mesmo mês (fecha 3, vence 10,
  // padrão de vários bancos digitais), a regra fixa "vencimento = competência + 1 mês"
  // joga o vencimento um mês para frente. Compra 15/04 → fecha 03/05 → vence 10/05.
  it('cartão fecha 3 e vence 10: compra em 15/04 vence em 10/05 (não 10/06)', () => {
    expect(faturaDaCompra('2026-04-15', 3, 10).vencimento).toBe('2026-05-10');
  });
});

describe('calcularDatasFaturaComAnchor', () => {
  const anchor = new Date(2026, 4, 10); // próximo vencimento informado: 10/05/2026

  it('a anchor pertence à competência do mês anterior a ela', () => {
    expect(ymd(calcularDatasFaturaComAnchor(new Date(2026, 3, 1), 28, anchor).data_vencimento)).toBe('2026-05-10');
  });

  it('deriva vencimentos de competências anteriores e posteriores', () => {
    expect(ymd(calcularDatasFaturaComAnchor(new Date(2026, 2, 1), 28, anchor).data_vencimento)).toBe('2026-04-10');
    expect(ymd(calcularDatasFaturaComAnchor(new Date(2026, 4, 1), 28, anchor).data_vencimento)).toBe('2026-06-10');
  });

  it('virada de ano', () => {
    // Fecha 5, vence 15: a anchor 15/12/2026 é a fatura que fecha 05/12 (competência 12/2026).
    const a = new Date(2026, 11, 15);
    expect(ymd(calcularDatasFaturaComAnchor(new Date(2026, 11, 1), 5, a).data_vencimento)).toBe('2026-12-15');
    expect(ymd(calcularDatasFaturaComAnchor(new Date(2027, 0, 1), 5, a).data_vencimento)).toBe('2027-01-15');
  });

  it('anchor no dia 31: fevereiro vira 28 e os meses seguintes voltam para 31/30 (sem "grudar" no 28)', () => {
    // Fecha dia 1, vence dia 31: a fatura que fecha 01/01 vence 31/01 (mesma competência).
    const a31 = new Date(2026, 0, 31);
    const venc = (ano: number, mes0: number) =>
      ymd(calcularDatasFaturaComAnchor(new Date(ano, mes0, 1), 1, a31).data_vencimento);
    expect(venc(2026, 0)).toBe('2026-01-31');
    expect(venc(2026, 1)).toBe('2026-02-28');
    expect(venc(2026, 2)).toBe('2026-03-31');
    expect(venc(2026, 3)).toBe('2026-04-30');
  });

  it('anchor no dia 31 em ano bissexto: fevereiro vira 29', () => {
    const a31 = new Date(2028, 0, 31);
    expect(ymd(calcularDatasFaturaComAnchor(new Date(2028, 1, 1), 1, a31).data_vencimento)).toBe('2028-02-29');
  });

  // Era bug, corrigido em 11/2026: mesmo problema de calcularDatasFatura (faturaCalculator.ts:72-73):
  // fechamento no mês anterior à competência, antes da própria compra.
  it('fechamento da fatura da compra de 15/04 (fecha 28) é 28/04', () => {
    const competencia = calcularCompetenciaFatura('2026-04-15', 28);
    expect(ymd(calcularDatasFaturaComAnchor(competencia, 28, anchor).data_fechamento)).toBe('2026-04-28');
  });
});

describe('melhorDiaDeCompra', () => {
  it('devolve sempre um dia entre 1 e 31', () => {
    for (let f = 1; f <= 31; f++) {
      const m = melhorDiaDeCompra(f);
      expect(m).toBeGreaterThanOrEqual(1);
      expect(m).toBeLessThanOrEqual(31);
    }
  });

  // Era bug, corrigido em 11/2026: pela regra de calcularCompetenciaFatura, compra no dia do fechamento já
  // entra na fatura seguinte, então o melhor dia é o próprio dia do fechamento.
  // A véspera (fechamento - 1), que a função devolve, é o ÚLTIMO dia da fatura
  // atual: o pior dia para comprar.
  it('comprar no "melhor dia" cai numa fatura posterior à de quem comprou na véspera', () => {
    for (const f of [5, 10, 28]) {
      const m = melhorDiaDeCompra(f);
      const dd = (n: number) => String(n).padStart(2, '0');
      const noMelhorDia = calcularCompetenciaFatura(`2026-04-${dd(m)}`, f);
      const naVespera = calcularCompetenciaFatura(`2026-04-${dd(m - 1)}`, f);
      expect(noMelhorDia.getTime()).toBeGreaterThan(naVespera.getTime());
    }
  });
});

describe('rotuloCompetencia e toISODate', () => {
  it('rotula competência como MM/yyyy a partir de string ou Date', () => {
    expect(rotuloCompetencia('2026-05-01')).toBe('05/2026');
    expect(rotuloCompetencia(new Date(2027, 0, 1))).toBe('01/2027');
  });

  it('toISODate usa a data local, mesmo às 23:30 (já é o dia seguinte em UTC)', () => {
    expect(toISODate(new Date(2026, 10, 10, 23, 30))).toBe('2026-11-10');
    expect(toISODate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('getFaturaAtual', () => {
  type F = { id: string; cartao_id: string; competencia: string; data_vencimento: string; status: string; valor_total: number | string };
  const f = (id: string, competencia: string, data_vencimento: string, extra: Partial<F> = {}): F => ({
    id, cartao_id: 'c1', competencia, data_vencimento, status: 'aberta', valor_total: 100, ...extra,
  });
  const cartao = { id: 'c1', dia_fechamento: 11 };
  const faturas = [f('nov', '2026-11-01', '2026-12-05'), f('dez', '2026-12-01', '2027-01-05')];

  it('às 23:30 do dia 10 (02:30 UTC do dia 11), cartão que fecha dia 11 ainda está na fatura de novembro', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T23:30:00-03:00'));
    expect(getFaturaAtual(cartao, faturas)?.id).toBe('nov');
  });

  it('à 00:30 do dia 11 (dia do fechamento) passa para a fatura de dezembro', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-11T00:30:00-03:00'));
    expect(getFaturaAtual(cartao, faturas)?.id).toBe('dez');
  });

  it('ignora faturas pagas e de outros cartões', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'));
    const lista = [
      f('paga', '2026-11-01', '2026-12-05', { status: 'paga' }),
      f('outro', '2026-11-01', '2026-12-05', { cartao_id: 'c2' }),
      f('dez', '2026-12-01', '2027-01-05'),
    ];
    expect(getFaturaAtual(cartao, lista)?.id).toBe('dez');
  });

  it('sem fatura da competência atual, pega a primeira (por vencimento) com valor > 0, aceitando valor em string', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'));
    const lista = [
      f('fev', '2027-02-01', '2027-03-05', { valor_total: '50.00' }),
      f('jan', '2027-01-01', '2027-02-05', { valor_total: '0.00' }),
      f('mar', '2027-03-01', '2027-04-05', { valor_total: 10 }),
    ];
    expect(getFaturaAtual(cartao, lista)?.id).toBe('fev');
  });

  it('se todas estão zeradas, devolve a de vencimento mais próximo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'));
    const lista = [
      f('fev', '2027-02-01', '2027-03-05', { valor_total: 0 }),
      f('jan', '2027-01-01', '2027-02-05', { valor_total: 0 }),
    ];
    expect(getFaturaAtual(cartao, lista)?.id).toBe('jan');
  });

  it('sem faturas em aberto devolve null', () => {
    expect(getFaturaAtual(cartao, [])).toBeNull();
    expect(getFaturaAtual(cartao, [f('p', '2026-11-01', '2026-12-05', { status: 'paga' })])).toBeNull();
  });

  it('sem dia_fechamento usa dia 1 (qualquer dia do mês já vai para a competência seguinte)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00-03:00'));
    expect(getFaturaAtual({ id: 'c1', dia_fechamento: null }, faturas)?.id).toBe('dez');
  });
});

// Garante que os helpers de teste interpretam datas como o app (meia-noite local).
describe('sanidade dos helpers', () => {
  it('parseISO de data pura é meia-noite local', () => {
    expect(parseISO('2026-11-10').getHours()).toBe(0);
    expect(parseISO('2026-11-10').getDate()).toBe(10);
  });
});
