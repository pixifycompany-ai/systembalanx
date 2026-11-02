// DFC — Demonstrativo de Fluxo de Caixa (regime de CAIXA).
// Tudo pela data em que o dinheiro entrou/saiu do banco (data_recebimento /
// data_pagamento) e só nas contas bancárias (cartão não é caixa: a compra no
// cartão sai do banco quando a FATURA é paga). O pagamento da fatura é rateado
// pelas categorias dos itens dela — assim a saída aparece como "Alimentação",
// "Software"… e não como "Fatura do cartão".
// Saldo inicial de cada coluna = saldo real das contas no dia anterior; o saldo
// final do período bate com o saldo real das contas (mesmo cálculo de Contas).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { getMonthColumns, getMonthRange, type DRERow, type PeriodFilter } from '@/hooks/useRelatorios';

type Grupo = 'imposto' | 'custo_variavel' | 'desp_comercial' | 'desp_administrativa' | 'desp_pessoal' | 'desp_operacional' | 'distribuicao_lucro';

const GRUPOS_SAIDA: { grupo: Grupo; label: string }[] = [
  { grupo: 'imposto', label: 'Impostos e deduções' },
  { grupo: 'custo_variavel', label: 'Custos variáveis' },
  { grupo: 'desp_comercial', label: 'Comerciais / Marketing' },
  { grupo: 'desp_administrativa', label: 'Administrativas' },
  { grupo: 'desp_pessoal', label: 'Pessoal' },
  { grupo: 'desp_operacional', label: 'Outras despesas operacionais' },
];

export interface DFCData {
  rows: DRERow[];
  months: string[];
  /** Saldo real das contas bancárias hoje (para conferência). */
  saldoAtualContas: number;
  /** Movimentos pagos/recebidos sem conta bancária (não entram no caixa). */
  semConta: { quantidade: number; valor: number };
  /** Marcados como pagos/recebidos mas com data no FUTURO (provável erro de digitação). */
  quitadosNoFuturo: { tipo: 'entrada' | 'saida'; descricao: string; valor: number; data: string }[];
}

const isoDia = (d: Date) => format(d, 'yyyy-MM-dd');

async function fetchDFC(period: PeriodFilter, customStart?: Date, customEnd?: Date): Promise<DFCData> {
  const { start, end } = getMonthRange(period, customStart, customEnd);
  const months = getMonthColumns(start, end);

  const [contasRes, recRes, despRes, itensRes, fatPagRes, faturasRes, transfRes] = await Promise.all([
    supabase.from('contas').select('id, tipo, saldo_inicial, ativa'),
    supabase.from('receitas').select('valor, conta_id, descricao, data_recebimento, categoria:categorias(nome, grupo_dre)').eq('status', 'recebido'),
    supabase.from('despesas').select('id, valor, conta_id, fornecedor, descricao, data_pagamento, categoria:categorias(nome, grupo_dre)').eq('status', 'pago').is('fatura_id', null),
    // Itens de fatura (compras no cartão) — só para ratear o pagamento por categoria
    supabase.from('despesas').select('valor, fatura_id, categoria:categorias(nome, grupo_dre)').not('fatura_id', 'is', null),
    supabase.from('cartao_fatura_pagamentos').select('fatura_id, despesa_id'),
    supabase.from('cartao_faturas').select('id, despesa_id'),
    supabase.from('transferencias').select('valor, conta_origem_id, conta_destino_id, data_transferencia'),
  ]);

  const contas = contasRes.data || [];
  // Mesmas contas do saldo consolidado da Início: ativas e que não são cartão
  const bancos = new Set(contas.filter((c) => c.tipo !== 'cartao_credito' && c.ativa).map((c) => c.id));
  const saldoInicialContas = contas.filter((c) => bancos.has(c.id)).reduce((s, c) => s + Number(c.saldo_inicial || 0), 0);

  type Cat = { nome?: string; grupo_dre?: string } | null;
  const entradas = (recRes.data || []) as { valor: number; conta_id: string | null; descricao: string | null; data_recebimento: string | null; categoria: Cat }[];
  const saidas = (despRes.data || []) as { id: string; valor: number; conta_id: string | null; fornecedor: string | null; descricao: string | null; data_pagamento: string | null; categoria: Cat }[];

  // Rateio do pagamento da fatura pelos itens
  const faturaPorDespesa = new Map<string, string>();
  for (const fp of (fatPagRes.data || []) as { fatura_id: string; despesa_id: string | null }[]) if (fp.despesa_id) faturaPorDespesa.set(fp.despesa_id, fp.fatura_id);
  for (const f of (faturasRes.data || []) as { id: string; despesa_id: string | null }[]) if (f.despesa_id) faturaPorDespesa.set(f.despesa_id, f.id);
  const itensPorFatura = new Map<string, { valor: number; categoria: Cat }[]>();
  for (const i of (itensRes.data || []) as { valor: number; fatura_id: string; categoria: Cat }[]) {
    const arr = itensPorFatura.get(i.fatura_id) || [];
    arr.push(i);
    itensPorFatura.set(i.fatura_id, arr);
  }

  // Transferências: só mexem no caixa total quando um lado NÃO é conta bancária
  const transf = ((transfRes.data || []) as { valor: number; conta_origem_id: string | null; conta_destino_id: string | null; data_transferencia: string | null }[])
    .map((t) => {
      const sai = t.conta_origem_id && bancos.has(t.conta_origem_id);
      const entra = t.conta_destino_id && bancos.has(t.conta_destino_id);
      const efeito = (entra ? Number(t.valor) : 0) - (sai ? Number(t.valor) : 0);
      return { data: t.data_transferencia, efeito };
    })
    .filter((t) => t.efeito !== 0);

  const doBanco = (contaId: string | null) => !!contaId && bancos.has(contaId);
  const semConta = {
    quantidade: entradas.filter((r) => !doBanco(r.conta_id)).length + saidas.filter((d) => !doBanco(d.conta_id)).length,
    valor: entradas.filter((r) => !doBanco(r.conta_id)).reduce((s, r) => s + Number(r.valor), 0)
      - saidas.filter((d) => !doBanco(d.conta_id)).reduce((s, d) => s + Number(d.valor), 0),
  };
  const entradasBanco = entradas.filter((r) => doBanco(r.conta_id) && r.data_recebimento);
  const saidasBanco = saidas.filter((d) => doBanco(d.conta_id) && d.data_pagamento);

  /** Saldo das contas bancárias ao FIM do dia `ate` (inclusive). */
  const saldoAte = (ate: string) =>
    saldoInicialContas
    + entradasBanco.filter((r) => r.data_recebimento! <= ate).reduce((s, r) => s + Number(r.valor), 0)
    - saidasBanco.filter((d) => d.data_pagamento! <= ate).reduce((s, d) => s + Number(d.valor), 0)
    + transf.filter((t) => t.data && t.data <= ate).reduce((s, t) => s + t.efeito, 0);

  // Colunas (mês), recortadas pelo período pedido
  const colunas = months.map((label, idx) => {
    const base = new Date(start.getFullYear(), start.getMonth() + idx, 1);
    const ini = idx === 0 ? start : startOfMonth(base);
    const fim = idx === months.length - 1 ? end : endOfMonth(base);
    return { label, ini: isoDia(ini), fim: isoDia(fim) };
  });
  const zero = () => Object.fromEntries(months.map((m) => [m, 0])) as Record<string, number>;
  const colDe = (data: string) => colunas.find((c) => data >= c.ini && data <= c.fim)?.label;

  const entradaServ = zero(); const entradaOutra = zero();
  const porGrupo: Record<Grupo, Record<string, number>> = {
    imposto: zero(), custo_variavel: zero(), desp_comercial: zero(), desp_administrativa: zero(),
    desp_pessoal: zero(), desp_operacional: zero(), distribuicao_lucro: zero(),
  };
  const detalhe: Record<string, Record<string, Record<string, number>>> = {};
  const addDet = (bucket: string, cat: string, mk: string, v: number) => {
    (detalhe[bucket] ||= {});
    (detalhe[bucket][cat] ||= zero());
    detalhe[bucket][cat][mk] += v;
  };
  const grupoDe = (c: Cat): Grupo => {
    const g = c?.grupo_dre as Grupo | undefined;
    return g && g in porGrupo ? g : 'desp_operacional';
  };

  for (const r of entradasBanco) {
    const mk = colDe(r.data_recebimento!); if (!mk) continue;
    const v = Number(r.valor); const nome = r.categoria?.nome || 'Sem categoria';
    if (r.categoria?.grupo_dre === 'rec_servico') { entradaServ[mk] += v; addDet('rec_servico', nome, mk, v); }
    else { entradaOutra[mk] += v; addDet('rec_outra', nome, mk, v); }
  }

  for (const d of saidasBanco) {
    const mk = colDe(d.data_pagamento!); if (!mk) continue;
    const v = Number(d.valor);
    const faturaId = faturaPorDespesa.get(d.id);
    const itens = faturaId ? itensPorFatura.get(faturaId) || [] : [];
    const totalItens = itens.reduce((s, i) => s + Number(i.valor), 0);
    if (faturaId && totalItens > 0) {
      for (const i of itens) {
        const parte = v * (Number(i.valor) / totalItens);
        const g = grupoDe(i.categoria);
        porGrupo[g][mk] += parte;
        addDet(g, i.categoria?.nome || 'Sem categoria', mk, parte);
      }
    } else {
      const g = grupoDe(d.categoria);
      const nome = d.fornecedor === '[pagamento-fatura]' ? 'Fatura do cartão (sem itens)' : (d.categoria?.nome || 'Sem categoria');
      porGrupo[g][mk] += v;
      addDet(g, nome, mk, v);
    }
  }

  const filhos = (bucket: string) => Object.entries(detalhe[bucket] || {})
    .map(([label, values]) => ({ label, values }))
    .sort((a, b) => Object.values(b.values).reduce((s, x) => s + x, 0) - Object.values(a.values).reduce((s, x) => s + x, 0));

  const saldoInicial = zero(); const entradasTot = zero(); const saidasOp = zero();
  const geracaoOp = zero(); const variacao = zero(); const saldoFinal = zero(); const outrosMov = zero();
  for (const c of colunas) {
    const m = c.label;
    const diaAntes = isoDia(new Date(parseISO(c.ini).getTime() - 86400000));
    saldoInicial[m] = saldoAte(diaAntes);
    entradasTot[m] = entradaServ[m] + entradaOutra[m];
    saidasOp[m] = GRUPOS_SAIDA.reduce((s, g) => s + porGrupo[g.grupo][m], 0);
    geracaoOp[m] = entradasTot[m] - saidasOp[m];
    // Transferências com contas fora do caixa (ex.: investimento cadastrado como cartão) — raro
    outrosMov[m] = transf.filter((t) => t.data && t.data >= c.ini && t.data <= c.fim).reduce((s, t) => s + t.efeito, 0);
    variacao[m] = geracaoOp[m] - porGrupo.distribuicao_lucro[m] + outrosMov[m];
    saldoFinal[m] = saldoInicial[m] + variacao[m];
  }

  const rows: DRERow[] = [
    { label: 'SALDO INICIAL', type: 'result', values: saldoInicial },
    { label: 'ENTRADAS', type: 'group', values: entradasTot },
    { label: 'Recebimentos de clientes / serviços', type: 'item', values: entradaServ, children: filhos('rec_servico') },
    { label: 'Outras entradas', type: 'item', values: entradaOutra, children: filhos('rec_outra') },
    { label: 'SAÍDAS OPERACIONAIS', type: 'group', values: saidasOp },
    ...GRUPOS_SAIDA.map((g) => ({ label: g.label, type: 'item' as const, values: porGrupo[g.grupo], children: filhos(g.grupo) })),
    { label: 'Geração de caixa operacional', type: 'result', values: geracaoOp },
    { label: '(−) DISTRIBUIÇÃO DE LUCROS / RETIRADAS', type: 'group', values: porGrupo.distribuicao_lucro, children: filhos('distribuicao_lucro') },
    ...(months.some((m) => outrosMov[m] !== 0) ? [{ label: 'Transferências com contas fora do caixa', type: 'item' as const, values: outrosMov }] : []),
    { label: 'Variação do caixa', type: 'result', values: variacao },
    { label: 'SALDO FINAL', type: 'result', values: saldoFinal },
  ];

  // Quitado com data futura: o saldo de Contas já desconta (status), mas o caixa por data
  // só desconta no dia — geralmente é ano digitado errado. Mostra pra pessoa corrigir.
  const hoje = isoDia(new Date());
  const quitadosNoFuturo = [
    ...entradasBanco.filter((r) => r.data_recebimento! > hoje).map((r) => ({ tipo: 'entrada' as const, descricao: r.descricao || 'Receita', valor: Number(r.valor), data: r.data_recebimento! })),
    ...saidasBanco.filter((d) => d.data_pagamento! > hoje).map((d) => ({ tipo: 'saida' as const, descricao: [d.descricao, d.fornecedor && !d.fornecedor.startsWith('[') ? d.fornecedor : null].filter(Boolean).join(' · ') || 'Despesa', valor: Number(d.valor), data: d.data_pagamento! })),
  ];

  return { rows, months, saldoAtualContas: saldoAte(hoje), semConta, quitadosNoFuturo };
}

export function useDFC(period: PeriodFilter, customStart?: Date, customEnd?: Date) {
  return useQuery({
    queryKey: ['dfc', period, customStart?.toISOString(), customEnd?.toISOString()],
    queryFn: () => fetchDFC(period, customStart, customEnd),
    staleTime: 60_000,
  });
}
