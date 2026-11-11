// Testes das partes puras de: conferência de saldo, estender recorrência e pausa de contrato.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { causasProvaveis, parseValorBR, saldoNaData, type Movimento } from '@/lib/conferenciaSaldo';
import { comParcela, dataNaSerie, inferirFrequencia, lerParcela, planejarExtensao, podeEstender } from '@/lib/estenderRecorrencia';
import { estadoPausa } from '@/lib/pausaContrato';
import { isContratoAtivoNoPeriodo, pausaCobre } from '@/utils/contractUtils';

process.env.TZ = 'America/Sao_Paulo';

const mov = (p: Partial<Movimento>): Movimento => ({
  id: Math.random().toString(36).slice(2), tabela: 'receitas', descricao: 'X', valor: 100, data: '2026-11-05',
  status: 'pendente', conta_id: 'c1', ...p,
});

describe('conferência de saldo', () => {
  it('lê valores no formato brasileiro', () => {
    expect(parseValorBR('12.345,67')).toBe(12345.67);
    expect(parseValorBR('R$ 1.000')).toBe(1000);
    expect(parseValorBR('-1.234,5')).toBe(-1234.5);
    expect(parseValorBR('1234.56')).toBe(1234.56);
    expect(parseValorBR('')).toBeNaN();
    expect(parseValorBR('abc')).toBeNaN();
  });

  it('saldo na data só soma o que foi efetivado até ela', () => {
    const efetivados = [
      mov({ valor: 500, data: '2026-11-01' }),
      mov({ tabela: 'despesas', valor: -200, data: '2026-11-03' }),
      mov({ valor: 1000, data: '2026-11-20' }),
    ];
    expect(saldoNaData(100, efetivados, '2026-11-10')).toBe(400);
    expect(saldoNaData(100, efetivados, '2026-11-20')).toBe(1400);
  });

  it('sem diferença não há causas', () => {
    expect(causasProvaveis(0.004, [mov({})], [], [])).toEqual([]);
  });

  it('acha o recebimento não baixado que bate exatamente com a diferença', () => {
    const alvo = mov({ id: 'r1', valor: 397, descricao: 'Vikings' });
    const causas = causasProvaveis(397, [alvo, mov({ valor: 50 })], [], []);
    expect(causas[0].tipo).toBe('exato');
    expect(causas[0].itens[0].id).toBe('r1');
  });

  it('banco com menos: considera pagamentos não baixados, não recebimentos', () => {
    const pag = mov({ id: 'd1', tabela: 'despesas', valor: -280 });
    const rec = mov({ id: 'r1', valor: 280 });
    const causas = causasProvaveis(-280, [rec, pag], [], []);
    expect(causas[0].itens.map((i) => i.id)).toEqual(['d1']);
  });

  it('dois lançamentos que somam a diferença', () => {
    const causas = causasProvaveis(300, [mov({ id: 'a', valor: 100 }), mov({ id: 'b', valor: 200 }), mov({ id: 'c', valor: 1000 })], [], []);
    expect(causas[0].tipo).toBe('combinacao');
    expect(causas[0].itens.map((i) => i.id).sort()).toEqual(['a', 'b']);
  });

  it('lançamento em dobro na conta explica banco com menos entrada', () => {
    const a = mov({ id: 'a', valor: 760, descricao: 'Mensalidade OMNEO', status: 'recebido', data: '2026-11-10' });
    const b = mov({ id: 'b', valor: 760, descricao: 'Mensalidade OMNEO', status: 'recebido', data: '2026-11-11' });
    const causas = causasProvaveis(-760, [], [], [a, b]);
    expect(causas[0].tipo).toBe('exato');
    expect(causas[0].detalhe).toMatch(/duas vezes/);
  });

  it('pago sem conta aparece como causa quando não bate exato', () => {
    const sc = mov({ id: 's', tabela: 'despesas', valor: -6295.47, conta_id: null, status: 'pago' });
    const causas = causasProvaveis(-6700.8, [], [sc], []);
    expect(causas.some((c) => c.tipo === 'sem-conta' && c.itens[0].id === 's')).toBe(true);
  });
});

describe('estender recorrência', () => {
  it('lê e troca o "(n/m)"', () => {
    expect(lerParcela('Mensalidade X (3/12)')).toMatchObject({ prefixo: 'Mensalidade X', n: 3, total: 12 });
    expect(lerParcela('Omnichat (5/8) - 08 USUARIOS')).toMatchObject({ prefixo: 'Omnichat', base: 'Omnichat - 08 USUARIOS' });
    expect(lerParcela('Sem parcela')).toBeNull();
    expect(comParcela('Mensalidade X (12/12)', 12, 24)).toBe('Mensalidade X (12/24)');
    expect(comParcela('Aluguel', 1, 6)).toBe('Aluguel (1/6)');
  });

  it('descobre a frequência pelos vencimentos', () => {
    expect(inferirFrequencia(['2026-01-10', '2026-02-10', '2026-03-10'])).toBe('mensal');
    expect(inferirFrequencia(['2026-01-01', '2026-01-15', '2026-01-29'])).toBe('quinzenal');
    expect(inferirFrequencia(['2026-01-01', '2026-01-08'])).toBe('semanal');
    expect(inferirFrequencia(['2026-01-10', '2027-01-10'])).toBe('anual');
    expect(inferirFrequencia(['2026-01-10'])).toBe('mensal');
  });

  it('mensal a partir do dia 31 não "gruda" no 28 depois de fevereiro', () => {
    expect(dataNaSerie('2026-01-31', 'mensal', 1)).toBe('2026-02-28');
    expect(dataNaSerie('2026-01-31', 'mensal', 2)).toBe('2026-03-31');
  });

  it('planeja os próximos e renumera a série', () => {
    const serie = [1, 2, 3].map((n) => ({
      id: `s${n}`, descricao: `Mensalidade (${n}/3)`, valor: 3997, status: 'pendente',
      data_vencimento: `2026-0${n}-31`.replace('2026-02-31', '2026-02-28'), data_competencia: `2026-0${n}-01`,
    }));
    serie[0].data_vencimento = '2026-01-31';
    serie[2].data_vencimento = '2026-03-31';
    const p = planejarExtensao(serie, 2);
    expect(p.freq).toBe('mensal');
    expect(p.totalNovo).toBe(5);
    expect(p.novos.map((n) => [n.descricao, n.data_vencimento])).toEqual([
      ['Mensalidade (4/5)', '2026-04-30'],
      ['Mensalidade (5/5)', '2026-05-31'],
    ]);
    expect(p.renomear.map((r) => r.descricao)).toEqual(['Mensalidade (1/5)', 'Mensalidade (2/5)', 'Mensalidade (3/5)']);
  });

  it('não oferece para contrato, cartão ou lançamento sem série', () => {
    const base = { id: '1', tabela_origem: 'receitas', descricao: 'X (1/3)' };
    expect(podeEstender(base)).toBe(true);
    expect(podeEstender({ ...base, contrato_id: 'c' })).toBe(false);
    expect(podeEstender({ ...base, tabela_origem: 'despesas', fatura_id: 'f' })).toBe(false);
    expect(podeEstender({ ...base, descricao: 'Avulsa' })).toBe(false);
    expect(podeEstender({ ...base, descricao: 'Avulsa', recurrence_group_id: 'g' })).toBe(true);
  });
});

describe('pausa de contrato', () => {
  it('estado da pausa', () => {
    expect(estadoPausa({ id: '1' }, '2026-11-10')).toBeNull();
    expect(estadoPausa({ id: '1', pausado_desde: '2026-12-01' }, '2026-11-10')).toBe('agendada');
    expect(estadoPausa({ id: '1', pausado_desde: '2026-11-01' }, '2026-11-10')).toBe('pausado');
    expect(estadoPausa({ id: '1', pausado_desde: '2026-11-01', pausado_ate: '2026-11-10' }, '2026-11-10')).toBe('pausado');
    expect(estadoPausa({ id: '1', pausado_desde: '2026-11-01', pausado_ate: '2026-11-09' }, '2026-11-10')).toBeNull();
  });

  it('mês inteiro em pausa não conta como contrato ativo no período', () => {
    const c = { id: 'k', cliente_id: 'x', data_inicio: '2026-01-01', status: 'ativo', valor: 100, recorrencia: 'mensal', pausado_desde: '2026-12-01' };
    expect(pausaCobre(c, new Date(2026, 11, 1), new Date(2026, 11, 31, 23, 59))).toBe(true);
    expect(isContratoAtivoNoPeriodo(c, new Date(2026, 11, 1), new Date(2026, 11, 31, 23, 59))).toBe(false);
    expect(isContratoAtivoNoPeriodo(c, new Date(2026, 10, 1), new Date(2026, 10, 30, 23, 59))).toBe(true);
    // Pausa que começa no meio do mês: o mês ainda conta.
    expect(isContratoAtivoNoPeriodo({ ...c, pausado_desde: '2026-12-15' }, new Date(2026, 11, 1), new Date(2026, 11, 31))).toBe(true);
  });
});
