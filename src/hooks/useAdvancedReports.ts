// Advanced financial reports for balanx — agency-focused KPIs.
// All queries scoped to the authenticated user via RLS.
//
// Tabs covered:
//   Phase 1: MRR/ARR, Top Clients (ABC), Revenue by Category,
//            Expenses by Category, AR Aging, AP Aging, Burn & Runway
//   Phase 2: Client Margin, LTV/CAC/Payback, Cards Summary,
//            Reconciliation, Operational KPIs, 12m Projection, Tax view

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { addMonths, differenceInDays, endOfMonth, format, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const monthKey = (d: Date) => {
  const s = format(d, 'MMM/yy', { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fromIso = (s: string | null | undefined) => (s ? parseISO(s) : null);

export interface MRRPoint { month: string; mrr: number; arr: number; newMRR: number; churnMRR: number; }
export interface TopClient { id: string; nome: string; total: number; share: number; cumulative: number; classe: 'A' | 'B' | 'C'; }
export interface CategoryAggregate { id: string; nome: string; total: number; share: number; cor?: string; }
export interface AgingBucket { label: string; count: number; total: number; }
export interface BurnPoint { month: string; burn: number; }
export interface BurnRunway { burnAvg: number; cashOnHand: number; runwayMonths: number; series: BurnPoint[]; }
export interface ClientMargin { id: string; nome: string; receita: number; custoDireto: number; margem: number; margemPct: number; }
export interface LTVCAC { ltv: number; cac: number; payback: number; ratio: number; }
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
  clientMargins: [], ltvCac: { ltv: 0, cac: 0, payback: 0, ratio: 0 },
  cards: [], reconciliation: [], opKPIs: { ticketMedio: 0, clientesAtivos: 0, contratosAtivos: 0, receitaPorCliente: 0 },
  projection: [], taxes: [],
};

async function fetchAll(): Promise<AdvancedReports> {
  const today = new Date();
  const since12 = startOfMonth(subMonths(today, 11));
  const sinceStr = format(since12, 'yyyy-MM-dd');

  const [recRes, despRes, contRes, cliRes, catRes, contasRes, faturasRes] = await Promise.all([
    supabase.from('receitas').select('id, valor, data_competencia, data_vencimento, data_recebimento, status, contrato_id, cliente_id, categoria_id, clientes(nome), categorias(nome, cor)').gte('data_competencia', sinceStr),
    supabase.from('despesas').select('id, valor, data_competencia, data_vencimento, data_pagamento, status, tipo, categoria_id, cliente_id, fatura_id, fornecedor, categorias(nome, cor)').gte('data_competencia', sinceStr),
    supabase.from('contratos').select('id, valor, recorrencia, status, data_inicio, data_inativacao, cliente_id'),
    supabase.from('clientes').select('id, nome, status, created_at'),
    supabase.from('categorias').select('id, nome, tipo, cor'),
    supabase.from('contas').select('id, nome, tipo, saldo_inicial, limite, bandeira, ativa').eq('ativa', true),
    supabase.from('cartao_faturas').select('cartao_id, valor_total, valor_pago, status'),
  ]);

  const receitas = recRes.data || [];
  const despesas = despRes.data || [];
  const contratos = contRes.data || [];
  const clientes = cliRes.data || [];
  const categorias = catRes.data || [];
  const contas = contasRes.data || [];
  const faturas = faturasRes.data || [];

  // ===== MRR / ARR =====
  // MRR = sum of monthly-recurring contract revenue active in that month
  const mrrSeries: MRRPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = startOfMonth(subMonths(today, i));
    const mEnd = endOfMonth(m);
    const active = contratos.filter((c) => {
      const ini = fromIso(c.data_inicio); const fim = fromIso(c.data_inativacao);
      if (!ini || ini > mEnd) return false;
      if (fim && fim < m) return false;
      return c.recorrencia === 'mensal';
    });
    const mrr = active.reduce((s, c) => s + Number(c.valor), 0);
    // new = started this month, churn = inactivated this month
    const newMRR = contratos.filter((c) => c.recorrencia === 'mensal' && c.data_inicio && parseISO(c.data_inicio) >= m && parseISO(c.data_inicio) <= mEnd).reduce((s, c) => s + Number(c.valor), 0);
    const churnMRR = contratos.filter((c) => c.recorrencia === 'mensal' && c.data_inativacao && parseISO(c.data_inativacao) >= m && parseISO(c.data_inativacao) <= mEnd).reduce((s, c) => s + Number(c.valor), 0);
    mrrSeries.push({ month: monthKey(m), mrr, arr: mrr * 12, newMRR, churnMRR });
  }

  // ===== Top Clients (ABC) =====
  const clientMap = new Map<string, { nome: string; total: number }>();
  receitas.forEach((r) => {
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

  // ===== Receita / Despesa por Categoria =====
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
  const receitaPorCategoria = aggByCategory(receitas as never);
  const despesaPorCategoria = aggByCategory(
    (despesas as { fatura_id: string | null; fornecedor: string | null }[]).filter(
      (d) => !d.fatura_id && d.fornecedor !== '[pagamento-fatura]'
    ) as never
  );

  // ===== Aging =====
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
  const agingPagar = buildAging(
    (despesas as { fatura_id: string | null; fornecedor: string | null }[]).filter(
      (d) => !d.fatura_id && d.fornecedor !== '[pagamento-fatura]'
    ) as never,
    'pago'
  );

  // ===== Burn Rate & Runway =====
  const burnSeries: BurnPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = startOfMonth(subMonths(today, i));
    const mEnd = endOfMonth(m);
    const burn = despesas
      .filter((d) => {
        if ((d as { fatura_id: string | null }).fatura_id) return false;
        if ((d as { fornecedor: string | null }).fornecedor === '[pagamento-fatura]') return false;
        const dt = fromIso(d.data_competencia);
        return dt && dt >= m && dt <= mEnd;
      })
      .reduce((s, d) => s + Number(d.valor), 0);
    burnSeries.push({ month: monthKey(m), burn });
  }
  const last3 = burnSeries.slice(-3);
  const burnAvg = last3.length ? last3.reduce((s, x) => s + x.burn, 0) / last3.length : 0;
  // Cash on hand from contas (sum saldo_inicial as a baseline approximation; real saldo lives in useContas)
  const cashOnHand = contas
    .filter((c) => c.tipo !== 'cartao_credito')
    .reduce((s, c) => s + Number(c.saldo_inicial), 0);
  const runwayMonths = burnAvg > 0 ? cashOnHand / burnAvg : 0;

  // ===== Client margin (receita − despesas vinculadas a cliente_id) =====
  const expByClient = new Map<string, number>();
  despesas.forEach((d) => {
    if (!d.cliente_id) return;
    expByClient.set(d.cliente_id, (expByClient.get(d.cliente_id) ?? 0) + Number(d.valor));
  });
  const clientMargins: ClientMargin[] = sortedClients.map(([id, v]) => {
    const custoDireto = expByClient.get(id) ?? 0;
    const margem = v.total - custoDireto;
    return { id, nome: v.nome, receita: v.total, custoDireto, margem, margemPct: v.total ? margem / v.total : 0 };
  });

  // ===== LTV / CAC / Payback =====
  // LTV = avg monthly contract value * avg lifetime months
  const activeContracts = contratos.filter((c) => c.status === 'ativo' && c.recorrencia === 'mensal');
  const avgTicket = activeContracts.length ? activeContracts.reduce((s, c) => s + Number(c.valor), 0) / activeContracts.length : 0;
  const lifetimes = contratos
    .filter((c) => c.data_inicio)
    .map((c) => {
      const ini = parseISO(c.data_inicio);
      const fim = c.data_inativacao ? parseISO(c.data_inativacao) : today;
      return Math.max(1, Math.round(differenceInDays(fim, ini) / 30));
    });
  const avgLifetime = lifetimes.length ? lifetimes.reduce((s, m) => s + m, 0) / lifetimes.length : 0;
  const ltv = avgTicket * avgLifetime;
  // CAC = total marketing/commercial expenses / new clients in the period
  const commercialExpense = despesas
    .filter((d) => {
      const nome = ((d.categorias as { nome?: string } | null)?.nome || '').toLowerCase();
      return nome.includes('marketing') || nome.includes('comercial') || nome.includes('venda') || nome.includes('mídia') || nome.includes('midia');
    })
    .reduce((s, d) => s + Number(d.valor), 0);
  const newClientsCount = clientes.filter((c) => fromIso(c.created_at) && (fromIso(c.created_at) as Date) >= since12).length;
  const cac = newClientsCount > 0 ? commercialExpense / newClientsCount : 0;
  const payback = avgTicket > 0 ? cac / avgTicket : 0;
  const ltvCac: LTVCAC = { ltv, cac, payback, ratio: cac > 0 ? ltv / cac : 0 };

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

  // ===== Reconciliation =====
  const reconciliation: ReconRow[] = contas
    .filter((c) => c.tipo !== 'cartao_credito')
    .map((c) => {
      const entradas = receitas.filter((r) => (r as { conta_id?: string }).conta_id === c.id && r.status === 'recebido').reduce((s, r) => s + Number(r.valor), 0);
      const saidas = despesas.filter((d) => (d as { conta_id?: string }).conta_id === c.id && d.status === 'pago').reduce((s, d) => s + Number(d.valor), 0);
      const saldoCalculado = Number(c.saldo_inicial) + entradas - saidas;
      return { conta: c.nome, saldoInicial: Number(c.saldo_inicial), entradas, saidas, saldoCalculado };
    });

  // ===== Operational KPIs =====
  const ticketMedio = receitas.length ? receitas.reduce((s, r) => s + Number(r.valor), 0) / receitas.length : 0;
  const clientesAtivos = clientes.filter((c) => c.status === 'ativo').length;
  const contratosAtivos = contratos.filter((c) => c.status === 'ativo').length;
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

  // ===== Tax view (impostos categorizados como 'imposto' / 'tributo') =====
  const taxesByMonth = new Map<string, { receita: number; deducoes: number }>();
  receitas.forEach((r) => {
    const k = monthKey(parseISO(r.data_competencia));
    const cur = taxesByMonth.get(k) ?? { receita: 0, deducoes: 0 };
    cur.receita += Number(r.valor);
    taxesByMonth.set(k, cur);
  });
  despesas.forEach((d) => {
    const nome = ((d.categorias as { nome?: string } | null)?.nome || '').toLowerCase();
    if (nome.includes('imposto') || nome.includes('tributo') || nome.includes('iss') || nome.includes('das') || nome.includes('simples')) {
      const k = monthKey(parseISO(d.data_competencia));
      const cur = taxesByMonth.get(k) ?? { receita: 0, deducoes: 0 };
      cur.deducoes += Number(d.valor);
      taxesByMonth.set(k, cur);
    }
  });
  const taxes: TaxRow[] = Array.from(taxesByMonth.entries()).map(([mes, v]) => ({
    mes, receita: v.receita, deducoes: v.deducoes, receitaLiquida: v.receita - v.deducoes,
  }));

  // Sort by parsing back to date for predictable monthly ordering
  const monthOrder = (label: string) => {
    const map: Record<string, number> = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };
    const [m, y] = label.toLowerCase().split('/');
    return Number('20' + y) * 12 + (map[m] ?? 0);
  };
  taxes.sort((a, b) => monthOrder(a.mes) - monthOrder(b.mes));

  // Unused — silence lint
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

export function useAdvancedReports() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['advanced-reports'],
    queryFn: fetchAll,
    staleTime: 60_000,
  });
  return { reports: data ?? empty, isLoading, refetch };
}
