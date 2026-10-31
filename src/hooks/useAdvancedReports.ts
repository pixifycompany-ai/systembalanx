// Advanced financial reports for balanx — agency-focused KPIs.
// All queries scoped to the authenticated user via RLS.
//
// Period-aware: snapshot aggregates (categorias, ABC, margem, ticket, CAC, KPIs)
// respect the selected period. Time-series by nature (MRR 12m, Burn 6m,
// Projeção 12m, Fiscal 12m) and Conciliação (saldo real, todo o histórico)
// ignore the selector on purpose.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addMonths, differenceInDays, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getValorMensalEquivalente } from '@/utils/contractUtils';
import type { PeriodFilter } from '@/hooks/useRelatorios';

const monthKey = (d: Date) => {
  const s = format(d, 'MMM/yy', { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fromIso = (s: string | null | undefined) => (s ? parseISO(s) : null);

function periodWindow(period: PeriodFilter, customStart?: Date, customEnd?: Date) {
  const today = new Date();
  switch (period) {
    case 'month': return { start: startOfMonth(today), end: endOfMonth(today) };
    case 'quarter': return { start: startOfMonth(subMonths(today, 2)), end: endOfMonth(today) };
    case 'year': return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear(), 11, 31) };
    case 'custom': return { start: customStart ?? startOfMonth(today), end: customEnd ?? endOfMonth(today) };
    default: return { start: startOfMonth(today), end: endOfMonth(today) };
  }
}

export interface MRRPoint { month: string; mrr: number; arr: number; newMRR: number; churnMRR: number; }
export interface TopClient { id: string; nome: string; total: number; share: number; cumulative: number; classe: 'A' | 'B' | 'C'; }
export interface CategoryAggregate { id: string; nome: string; total: number; share: number; cor?: string; }
export interface AgingBucket { label: string; count: number; total: number; }
export interface BurnPoint { month: string; burn: number; }
export interface BurnRunway { burnAvg: number; cashOnHand: number; runwayMonths: number; series: BurnPoint[]; }
export interface ClientMargin { id: string; nome: string; receita: number; custoDireto: number; margem: number; margemPct: number; }
export interface LTVCAC { ltv: number; cac: number; payback: number; ratio: number; avgTicket: number; avgLifetime: number; novosClientes: number; gastoComercial: number; }
export interface CardSummary { id: string; nome: string; bandeira: string | null; limite: number; usado: number; disponivel: number; usoPct: number; }
export interface ReconRow { conta: string; saldoInicial: number; entradas: number; saidas: number; saldoCalculado: number; }
export interface OpKPIs { ticketMedio: number; clientesAtivos: number; contratosAtivos: number; receitaPorCliente: number; }
export interface ProjectionPoint { month: string; entradas: number; saidas: number; saldoAcum: number; }
export interface TaxRow { mes: string; receita: number; deducoes: number; receitaLiquida: number; }

export interface AdvancedReports {
  mrr: MRRPoint[];
  topClients: TopClient[];
  receitaPorCategoria: CategoryAggregate[];
  despesaPorCategoria: CategoryAggregate[];
  agingRecebiveis: AgingBucket[];
  agingPagar: AgingBucket[];
  burnRunway: BurnRunway;
  // Phase 2
  clientMargins: ClientMargin[];
  ltvCac: LTVCAC;
  cards: CardSummary[];
  reconciliation: ReconRow[];
  opKPIs: OpKPIs;
  projection: ProjectionPoint[];
  taxes: TaxRow[];
}

const empty: AdvancedReports = {
  mrr: [], topClients: [], receitaPorCategoria: [], despesaPorCategoria: [],
  agingRecebiveis: [], agingPagar: [],
  burnRunway: { burnAvg: 0, cashOnHand: 0, runwayMonths: 0, series: [] },
  clientMargins: [], ltvCac: { ltv: 0, cac: 0, payback: 0, ratio: 0, avgTicket: 0, avgLifetime: 0, novosClientes: 0, gastoComercial: 0 },
  cards: [], reconciliation: [], opKPIs: { ticketMedio: 0, clientesAtivos: 0, contratosAtivos: 0, receitaPorCliente: 0 },
  projection: [], taxes: [],
};

async function fetchAll(period: PeriodFilter, customStart?: Date, customEnd?: Date): Promise<AdvancedReports> {
  const today = new Date();
  const { start: pStart, end: pEnd } = periodWindow(period, customStart, customEnd);
  const since12 = startOfMonth(subMonths(today, 11));
  const fetchSince = pStart < since12 ? pStart : since12; // widen fetch to cover custom ranges
  const sinceStr = format(fetchSince, 'yyyy-MM-dd');
  const inPeriod = (ds: string | null | undefined) => {
    const d = fromIso(ds);
    return !!d && d >= pStart && d <= pEnd;
  };

  const [recRes, despRes, contRes, cliRes, catRes, contasRes, faturasRes, recAllRes, despAllRes] = await Promise.all([
    supabase.from('receitas').select('id, valor, data_competencia, data_vencimento, data_recebimento, status, contrato_id, cliente_id, categoria_id, conta_id, clientes(nome), categorias(nome, cor)').gte('data_competencia', sinceStr),
    supabase.from('despesas').select('id, valor, data_competencia, data_vencimento, data_pagamento, status, tipo, categoria_id, cliente_id, conta_id, fatura_id, fornecedor, categorias(nome, cor, grupo_dre)').gte('data_competencia', sinceStr),
    supabase.from('contratos').select('id, valor, recorrencia, status, data_inicio, data_inativacao, cliente_id'),
    supabase.from('clientes').select('id, nome, status, created_at'),
    supabase.from('categorias').select('id, nome, tipo, cor'),
    supabase.from('contas').select('id, nome, tipo, saldo_inicial, limite, bandeira, ativa').eq('ativa', true),
    supabase.from('cartao_faturas').select('cartao_id, valor_total, valor_pago, status'),
    // Conciliação usa TODO o histórico de movimentos confirmados (não o período).
    supabase.from('receitas').select('valor, conta_id, status').eq('status', 'recebido'),
    supabase.from('despesas').select('valor, conta_id, status, fatura_id, fornecedor').eq('status', 'pago'),
  ]);

  const receitas = recRes.data || [];
  const despesas = despRes.data || [];
  const contratos = contRes.data || [];
  const clientes = cliRes.data || [];
  const categorias = catRes.data || [];
  const contas = contasRes.data || [];
  const faturas = faturasRes.data || [];
  const recAll = recAllRes.data || [];
  const despAll = despAllRes.data || [];

  // Despesa reconhecida pela competência (DRE/categorias/burn/margem/CAC): entram
  // os ITENS do cartão (fatura_id, categorizados); ficam de fora a despesa-sombra
  // da fatura ('[fatura]') e o pagamento ('[pagamento-fatura]') — senão dobra.
  const isCompetencia = (d: { fornecedor?: string | null }) =>
    d.fornecedor !== '[fatura]' && d.fornecedor !== '[pagamento-fatura]';
  const despesasReais = despesas.filter(isCompetencia);
  // Conta a pagar avulsa (aging): exclui linhas de cartão (a fatura é a conta a pagar).
  const isPayable = (d: { fatura_id?: string | null; fornecedor?: string | null }) =>
    !d.fatura_id && d.fornecedor !== '[pagamento-fatura]';
  const despesasPayable = despesas.filter(isPayable);

  // Fatias do período selecionado
  const receitasP = receitas.filter((r) => inPeriod(r.data_competencia));
  const despesasReaisP = despesasReais.filter((d) => inPeriod(d.data_competencia));

  // ===== MRR / ARR (série 12m — ignora o seletor) =====
  const mrrSeries: MRRPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = startOfMonth(subMonths(today, i));
    const mEnd = endOfMonth(m);
    const active = contratos.filter((c) => {
      const ini = fromIso(c.data_inicio); const fim = fromIso(c.data_inativacao);
      if (!ini || ini > mEnd) return false;
      if (fim && fim < m) return false;
      return c.recorrencia !== 'unico';
    });
    const mrr = active.reduce((s, c) => s + getValorMensalEquivalente(Number(c.valor), c.recorrencia), 0);
    const newMRR = contratos.filter((c) => c.recorrencia !== 'unico' && c.data_inicio && parseISO(c.data_inicio) >= m && parseISO(c.data_inicio) <= mEnd).reduce((s, c) => s + getValorMensalEquivalente(Number(c.valor), c.recorrencia), 0);
    const churnMRR = contratos.filter((c) => c.recorrencia !== 'unico' && c.data_inativacao && parseISO(c.data_inativacao) >= m && parseISO(c.data_inativacao) <= mEnd).reduce((s, c) => s + getValorMensalEquivalente(Number(c.valor), c.recorrencia), 0);
    mrrSeries.push({ month: monthKey(m), mrr, arr: mrr * 12, newMRR, churnMRR });
  }

  // ===== Top Clients (ABC) — período =====
  const clientMap = new Map<string, { nome: string; total: number }>();
  receitasP.forEach((r) => {
    if (!r.cliente_id) return;
    const nome = (r.clientes as { nome: string } | null)?.nome || 'Sem cliente';
    const cur = clientMap.get(r.cliente_id) ?? { nome, total: 0 };
    cur.total += Number(r.valor);
    clientMap.set(r.cliente_id, cur);
  });
  const sortedClients = Array.from(clientMap.entries()).sort((a, b) => b[1].total - a[1].total);
  const grandTotal = sortedClients.reduce((s, [, v]) => s + v.total, 0);
  let cum = 0;
  const topClients: TopClient[] = sortedClients.map(([id, v]) => {
    const share = grandTotal > 0 ? v.total / grandTotal : 0;
    cum += share;
    const classe: 'A' | 'B' | 'C' = cum <= 0.8 ? 'A' : cum <= 0.95 ? 'B' : 'C';
    return { id, nome: v.nome, total: v.total, share, cumulative: cum, classe };
  });

  // ===== Receita / Despesa por Categoria — período =====
  const aggByCategory = (rows: { categoria_id: string | null; valor: number; categorias?: { nome: string; cor: string } | null }[]): CategoryAggregate[] => {
    const map = new Map<string, { nome: string; total: number; cor?: string }>();
    rows.forEach((r) => {
      const key = r.categoria_id || 'sem';
      const nome = (r.categorias as { nome: string } | null)?.nome || 'Sem categoria';
      const cor = (r.categorias as { cor: string } | null)?.cor;
      const cur = map.get(key) ?? { nome, total: 0, cor };
      cur.total += Number(r.valor);
      map.set(key, cur);
    });
    const list = Array.from(map.entries()).sort((a, b) => b[1].total - a[1].total);
    const total = list.reduce((s, [, v]) => s + v.total, 0);
    return list.map(([id, v]) => ({ id, nome: v.nome, total: v.total, share: total ? v.total / total : 0, cor: v.cor }));
  };
  const receitaPorCategoria = aggByCategory(receitasP as never);
  const despesaPorCategoria = aggByCategory(despesasReaisP as never);

  // ===== Aging (saldo em aberto hoje — independe do seletor) =====
  const buildAging = (rows: { valor: number; data_vencimento: string; status: string }[], paidStatus: string): AgingBucket[] => {
    const pending = rows.filter((r) => r.status !== paidStatus && r.data_vencimento);
    const buckets = [
      { label: 'A vencer', min: -9999, max: -1, count: 0, total: 0 },
      { label: '0-30 dias', min: 0, max: 30, count: 0, total: 0 },
      { label: '31-60 dias', min: 31, max: 60, count: 0, total: 0 },
      { label: '61-90 dias', min: 61, max: 90, count: 0, total: 0 },
      { label: '90+ dias', min: 91, max: 9999, count: 0, total: 0 },
    ];
    pending.forEach((r) => {
      const days = differenceInDays(today, parseISO(r.data_vencimento));
      const b = buckets.find((x) => days >= x.min && days <= x.max);
      if (b) { b.count += 1; b.total += Number(r.valor); }
    });
    return buckets.map(({ label, count, total }) => ({ label, count, total }));
  };
  const agingRecebiveis = buildAging(receitas as never, 'recebido');
  const agingPagar = buildAging(despesasPayable as never, 'pago');

  // ===== Conciliação (todo o histórico de movimentos confirmados) =====
  // Saldo do banco = entradas e saídas DAQUELA conta. Compras no cartão ficam na
  // conta do cartão (não entram aqui); o pagamento da fatura é saída do banco (entra).
  const reconciliation: ReconRow[] = contas
    .filter((c) => c.tipo !== 'cartao_credito')
    .map((c) => {
      const entradas = recAll.filter((r) => r.conta_id === c.id).reduce((s, r) => s + Number(r.valor), 0);
      const saidas = despAll.filter((d) => d.conta_id === c.id).reduce((s, d) => s + Number(d.valor), 0);
      const saldoCalculado = Number(c.saldo_inicial) + entradas - saidas;
      return { conta: c.nome, saldoInicial: Number(c.saldo_inicial), entradas, saidas, saldoCalculado };
    });

  // ===== Burn Rate & Runway (série 6m; caixa = saldo real conciliado) =====
  const burnSeries: BurnPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = startOfMonth(subMonths(today, i));
    const mEnd = endOfMonth(m);
    const burn = despesasReais
      .filter((d) => {
        const dt = fromIso(d.data_competencia);
        return dt && dt >= m && dt <= mEnd;
      })
      .reduce((s, d) => s + Number(d.valor), 0);
    burnSeries.push({ month: monthKey(m), burn });
  }
  const last3 = burnSeries.slice(-3);
  const burnAvg = last3.length ? last3.reduce((s, x) => s + x.burn, 0) / last3.length : 0;
  const cashOnHand = reconciliation.reduce((s, r) => s + r.saldoCalculado, 0);
  const runwayMonths = burnAvg > 0 ? cashOnHand / burnAvg : 0;

  // ===== Margem por cliente — período =====
  const expByClient = new Map<string, number>();
  despesasReaisP.forEach((d) => {
    if (!d.cliente_id) return;
    expByClient.set(d.cliente_id, (expByClient.get(d.cliente_id) ?? 0) + Number(d.valor));
  });
  const clientMargins: ClientMargin[] = sortedClients.map(([id, v]) => {
    const custoDireto = expByClient.get(id) ?? 0;
    const margem = v.total - custoDireto;
    return { id, nome: v.nome, receita: v.total, custoDireto, margem, margemPct: v.total ? margem / v.total : 0 };
  });

  // ===== LTV / CAC / Payback =====
  // LTV = ticket médio mensal (contratos recorrentes ativos) × meses médios de permanência.
  const activeContracts = contratos.filter((c) => c.status === 'ativo' && c.recorrencia !== 'unico');
  const avgTicket = activeContracts.length ? activeContracts.reduce((s, c) => s + getValorMensalEquivalente(Number(c.valor), c.recorrencia), 0) / activeContracts.length : 0;
  // Permanência: só contratos recorrentes (únicos não têm "lifetime" de assinatura).
  const lifetimes = contratos
    .filter((c) => c.data_inicio && c.recorrencia !== 'unico')
    .map((c) => {
      const ini = parseISO(c.data_inicio);
      const fim = c.data_inativacao ? parseISO(c.data_inativacao) : today;
      return Math.max(1, Math.round(differenceInDays(fim, ini) / 30));
    });
  const avgLifetime = lifetimes.length ? lifetimes.reduce((s, m) => s + m, 0) / lifetimes.length : 0;
  const ltv = avgTicket * avgLifetime;
  // CAC = despesas comerciais/marketing do período ÷ novos clientes do período.
  const commercialExpense = despesasReaisP
    .filter((d) => {
      const nome = ((d.categorias as { nome?: string } | null)?.nome || '').toLowerCase();
      return nome.includes('marketing') || nome.includes('comercial') || nome.includes('venda') || nome.includes('mídia') || nome.includes('midia') || nome.includes('tráfego') || nome.includes('trafego') || nome.includes('publicidade') || nome.includes('captação') || nome.includes('captacao');
    })
    .reduce((s, d) => s + Number(d.valor), 0);
  const newClientsCount = clientes.filter((c) => inPeriod(c.created_at)).length;
  const cac = newClientsCount > 0 ? commercialExpense / newClientsCount : 0;
  const payback = avgTicket > 0 ? cac / avgTicket : 0;
  const ltvCac: LTVCAC = { ltv, cac, payback, ratio: cac > 0 ? ltv / cac : 0, avgTicket, avgLifetime, novosClientes: newClientsCount, gastoComercial: commercialExpense };

  // ===== Cards summary =====
  const usedByCard = new Map<string, number>();
  faturas.forEach((f) => {
    const cur = usedByCard.get(f.cartao_id) ?? 0;
    usedByCard.set(f.cartao_id, cur + (Number(f.valor_total) - Number(f.valor_pago)));
  });
  const cards: CardSummary[] = contas
    .filter((c) => c.tipo === 'cartao_credito')
    .map((c) => {
      const usado = usedByCard.get(c.id) ?? 0;
      const limite = Number(c.limite ?? 0);
      const disponivel = Math.max(0, limite - usado);
      return { id: c.id, nome: c.nome, bandeira: c.bandeira ?? null, limite, usado, disponivel, usoPct: limite ? usado / limite : 0 };
    });

  // ===== Operational KPIs — período =====
  const clientesAtivos = clientes.filter((c) => c.status === 'ativo').length;
  const contratosAtivos = contratos.filter((c) => c.status === 'ativo').length;
  const receitaPeriodo = receitasP.reduce((s, r) => s + Number(r.valor), 0);
  const ticketMedio = clientesAtivos ? receitaPeriodo / clientesAtivos : 0; // receita do período ÷ clientes ativos
  const receitaPorCliente = clientesAtivos ? grandTotal / clientesAtivos : 0;
  const opKPIs: OpKPIs = { ticketMedio, clientesAtivos, contratosAtivos, receitaPorCliente };

  // ===== 12-month projection (linear from MRR + avg burn) =====
  const lastMRR = mrrSeries[mrrSeries.length - 1]?.mrr ?? 0;
  const projection: ProjectionPoint[] = [];
  let acc = cashOnHand;
  for (let i = 1; i <= 12; i++) {
    const m = addMonths(today, i);
    const entradas = lastMRR;
    const saidas = burnAvg;
    acc += entradas - saidas;
    projection.push({ month: monthKey(m), entradas, saidas, saldoAcum: acc });
  }

  // ===== Tax view (impostos categorizados; série 12m) =====
  const taxesByMonth = new Map<string, { receita: number; deducoes: number }>();
  receitas.forEach((r) => {
    const k = monthKey(parseISO(r.data_competencia));
    const cur = taxesByMonth.get(k) ?? { receita: 0, deducoes: 0 };
    cur.receita += Number(r.valor);
    taxesByMonth.set(k, cur);
  });
  // Impostos = categorias classificadas no DRE como "Deduções da receita" (grupo
  // imposto). Antes era por palavra no nome e "iss"/"das" pegavam Comissão/Vendas.
  despesas.forEach((d) => {
    const grupo = (d.categorias as { grupo_dre?: string | null } | null)?.grupo_dre;
    if (grupo === 'imposto' && isCompetencia(d)) {
      const k = monthKey(parseISO(d.data_competencia));
      const cur = taxesByMonth.get(k) ?? { receita: 0, deducoes: 0 };
      cur.deducoes += Number(d.valor);
      taxesByMonth.set(k, cur);
    }
  });
  const taxes: TaxRow[] = Array.from(taxesByMonth.entries()).map(([mes, v]) => ({
    mes, receita: v.receita, deducoes: v.deducoes, receitaLiquida: v.receita - v.deducoes,
  }));
  const monthOrder = (label: string) => {
    const map: Record<string, number> = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
    const [m, y] = label.toLowerCase().split('/');
    return Number('20' + y) * 12 + (map[m] ?? 0);
  };
  taxes.sort((a, b) => monthOrder(a.mes) - monthOrder(b.mes));

  void categorias;

  return {
    mrr: mrrSeries,
    topClients,
    receitaPorCategoria,
    despesaPorCategoria,
    agingRecebiveis,
    agingPagar,
    burnRunway: { burnAvg, cashOnHand, runwayMonths, series: burnSeries },
    clientMargins,
    ltvCac,
    cards,
    reconciliation,
    opKPIs,
    projection,
    taxes,
  };
}

export function useAdvancedReports(period: PeriodFilter = 'year', customStart?: Date, customEnd?: Date) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['advanced-reports', period, customStart?.toISOString(), customEnd?.toISOString()],
    queryFn: () => fetchAll(period, customStart, customEnd),
    staleTime: 60_000,
  });
  return { reports: data ?? empty, isLoading, refetch };
}
