import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format, addMonths, parseISO, differenceInMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isContratoAtivoNoPeriodo, getValorMensalNaData, getMesesRelacionamento, isContratoAtivoHoje, getClientesAtivosNoPeriodo, getClientesAtivosHoje, type AditivoBase, type ContratoBase } from '@/utils/contractUtils';

export interface LTVEvolutionData {
  mes: string;
  ltv: number;
  ticketMedio: number;
  clientesAtivos: number;
}

export interface ChurnData {
  taxaChurnMensal: number;
  clientesPerdidos: number;
  clientesNovos: number;
  clientesAtivos: number;
  historicoChurn: { mes: string; taxa: number; perdidos: number }[];
}

export interface CohortData {
  mesEntrada: string;
  clientesIniciais: number;
  retencaoMeses: (number | null)[];
}

export interface RevenueProjection {
  mes: string;
  receitaProjetada: number;
  receitaRecorrente: number;
  receitaVariavel: number;
}

export interface ClientProfitability {
  clienteId: string;
  clienteNome: string;
  receitaTotal: number;
  custoAtribuido: number;
  lucroEstimado: number;
  margemPercentual: number;
  tempoRelacionamento: number;
  ltvCliente: number;
}

export interface HealthScoreFator {
  nome: string;
  valor: number;
  peso: number;
  contribuicao: number;
}

export interface HealthScore {
  score: number;
  categoria: 'critico' | 'atencao' | 'bom' | 'excelente';
  fatores: HealthScoreFator[];
}

export interface AnalysisData {
  ltvEvolution: LTVEvolutionData[];
  churnData: ChurnData;
  cohorts: CohortData[];
  revenueProjection: RevenueProjection[];
  clientProfitability: ClientProfitability[];
  healthScore: HealthScore;
  isLoading: boolean;
  error: string | null;
}

async function fetchAnalysisData(): Promise<Omit<AnalysisData, 'isLoading' | 'error'>> {
  const today = new Date();

  const [receitasRes, despesasRes, contratosRes, clientesRes, contasRes, aditivosRes] = await Promise.all([
    supabase.from('receitas').select('*, cliente:clientes(id, nome)'),
    supabase.from('despesas').select('*, cliente:clientes(id, nome)'),
    supabase.from('contratos').select('*, cliente:clientes(id, nome)'),
    supabase.from('clientes').select('*'),
    supabase.from('contas').select('*').eq('ativa', true),
    supabase.from('contrato_aditivos' as any).select('*').order('data_vigencia', { ascending: false }),
  ]);

  const receitas = receitasRes.data || [];
  const despesas = despesasRes.data || [];
  const contratos = contratosRes.data || [];
  const clientes = clientesRes.data || [];
  const contas = contasRes.data || [];
  const allAditivos = (aditivosRes.data as any[] || []) as AditivoBase[];

  // ============ LTV EVOLUTION (last 12 months) - CONTRACT BASED ============
  const ltvEvolution: LTVEvolutionData[] = [];
  
  for (let i = 11; i >= 0; i--) {
    const monthDate = subMonths(today, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const mesNome = format(monthDate, 'MMM/yy', { locale: ptBR });

    // Find contracts active in this month (excluding 'unico')
    const contratosAtivosMes = contratos.filter(c => 
      c.recorrencia !== 'unico' && isContratoAtivoNoPeriodo(c as any, monthStart, monthEnd)
    );

    // Group by client
    const clientesMes: Record<string, { valorMensal: number; meses: number }> = {};
    contratosAtivosMes.forEach(c => {
      const valorMensal = getValorMensalNaData(c as any, allAditivos, monthEnd);
      const meses = getMesesRelacionamento(c as any, monthEnd);
      
      if (!clientesMes[c.cliente_id]) {
        clientesMes[c.cliente_id] = { valorMensal: 0, meses: 0 };
      }
      clientesMes[c.cliente_id].valorMensal += valorMensal;
      if (meses > clientesMes[c.cliente_id].meses) {
        clientesMes[c.cliente_id].meses = meses;
      }
    });

    const numClientes = Object.keys(clientesMes).length;
    const somaLTV = Object.values(clientesMes).reduce((sum, d) => sum + d.valorMensal * d.meses, 0);
    const ltv = numClientes > 0 ? somaLTV / numClientes : 0;
    
    // Ticket médio = average monthly contract value of active clients
    const somaTicket = Object.values(clientesMes).reduce((sum, d) => sum + d.valorMensal, 0);
    const ticketMedio = numClientes > 0 ? somaTicket / numClientes : 0;

    ltvEvolution.push({
      mes: mesNome.charAt(0).toUpperCase() + mesNome.slice(1),
      ltv,
      ticketMedio,
      clientesAtivos: numClientes,
    });
  }

  // ============ CHURN RATE ============
  const historicoChurn: { mes: string; taxa: number; perdidos: number }[] = [];
  let totalPerdidos = 0;
  let totalNovos = 0;

  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(today, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const prevMonthStart = startOfMonth(subMonths(monthDate, 1));
    const prevMonthEnd = endOfMonth(subMonths(monthDate, 1));
    const mesNome = format(monthDate, 'MMM', { locale: ptBR });

    // Use centralized contract utils for consistent active detection
    const clientesPrevMes = getClientesAtivosNoPeriodo(contratos as any[], prevMonthStart, prevMonthEnd);
    const clientesCurrMes = getClientesAtivosNoPeriodo(contratos as any[], monthStart, monthEnd);

    // Churned: was in prev month but not in current
    let perdidos = 0;
    clientesPrevMes.forEach(clienteId => {
      if (!clientesCurrMes.has(clienteId)) perdidos++;
    });

    // New: in current but not in prev
    let novos = 0;
    clientesCurrMes.forEach(clienteId => {
      if (!clientesPrevMes.has(clienteId)) novos++;
    });

    const taxa = clientesPrevMes.size > 0 ? (perdidos / clientesPrevMes.size) * 100 : 0;

    historicoChurn.push({
      mes: mesNome.charAt(0).toUpperCase() + mesNome.slice(1),
      taxa,
      perdidos,
    });

    // Use last COMPLETED month (i === 1) for main metrics — current month is incomplete
    if (i === 1) {
      totalPerdidos = perdidos;
      totalNovos = novos;
    }
  }

  // Current active clients — use contract vigência, not just status
  const clientesAtivosAgora = getClientesAtivosHoje(contratos as any[]);

  const churnData: ChurnData = {
    // Use penultimate entry (last completed month) for the rate
    taxaChurnMensal: historicoChurn.length >= 2 ? historicoChurn[historicoChurn.length - 2].taxa : 0,
    clientesPerdidos: totalPerdidos,
    clientesNovos: totalNovos,
    clientesAtivos: clientesAtivosAgora.size,
    historicoChurn,
  };

  // ============ COHORTS ============
  const cohorts: CohortData[] = [];
  const clientePrimeiroContrato: Record<string, Date> = {};

  contratos.forEach(c => {
    const dataInicio = parseISO(c.data_inicio);
    if (!clientePrimeiroContrato[c.cliente_id] || dataInicio < clientePrimeiroContrato[c.cliente_id]) {
      clientePrimeiroContrato[c.cliente_id] = dataInicio;
    }
  });

  // Group clients by cohort month
  const cohortsByMonth: Record<string, string[]> = {};
  Object.entries(clientePrimeiroContrato).forEach(([clienteId, data]) => {
    const cohortKey = format(data, 'yyyy-MM');
    if (!cohortsByMonth[cohortKey]) cohortsByMonth[cohortKey] = [];
    cohortsByMonth[cohortKey].push(clienteId);
  });

  // Calculate retention for each cohort
  const sortedCohortKeys = Object.keys(cohortsByMonth).sort();
  const lastCohortKeys = sortedCohortKeys.slice(-6); // Last 6 cohorts

  lastCohortKeys.forEach(cohortKey => {
    const cohortClientes = cohortsByMonth[cohortKey];
    const cohortDate = parseISO(cohortKey + '-01');
    const mesEntrada = format(cohortDate, 'MMM/yy', { locale: ptBR });
    
    const retencaoMeses: (number | null)[] = [];
    
    for (let m = 0; m <= 6; m++) {
      const checkMonth = addMonths(cohortDate, m);
      if (checkMonth > today) {
        retencaoMeses.push(null);
        continue;
      }

      const checkMonthStart = startOfMonth(checkMonth);
      const checkMonthEnd = endOfMonth(checkMonth);

      let retidos = 0;
      cohortClientes.forEach(clienteId => {
        // Check if client had active contract in this month
        const hadContract = contratos.some(c => {
          if (c.cliente_id !== clienteId) return false;
          const inicio = parseISO(c.data_inicio);
          const fimEfetivo = c.data_inativacao ? parseISO(c.data_inativacao) : (c.data_fim ? parseISO(c.data_fim) : null);
          return inicio <= checkMonthEnd && (!fimEfetivo || fimEfetivo >= checkMonthStart);
        });
        if (hadContract) retidos++;
      });

      const taxaRetencao = cohortClientes.length > 0 ? (retidos / cohortClientes.length) * 100 : 0;
      retencaoMeses.push(Math.round(taxaRetencao));
    }

    cohorts.push({
      mesEntrada: mesEntrada.charAt(0).toUpperCase() + mesEntrada.slice(1),
      clientesIniciais: cohortClientes.length,
      retencaoMeses,
    });
  });

  // ============ REVENUE PROJECTION (next 6 months) ============
  const revenueProjection: RevenueProjection[] = [];
  
  // Calculate average variable revenue from last 3 months
  let somaVariavel = 0;
  for (let i = 2; i >= 0; i--) {
    const monthDate = subMonths(today, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);

    const receitasVariaveis = receitas.filter(r => {
      const dataRecebimento = r.data_recebimento ? parseISO(r.data_recebimento) : null;
      return r.status === 'recebido' && !r.contrato_id && dataRecebimento && 
        dataRecebimento >= monthStart && dataRecebimento <= monthEnd;
    });
    
    somaVariavel += receitasVariaveis.reduce((sum, r) => sum + Number(r.valor), 0);
  }
  const mediaVariavel = somaVariavel / 3;

  // Current MRR from active contracts (using contract utils)
  const mrrAtual = contratos
    .filter(c => c.recorrencia !== 'unico' && isContratoAtivoHoje(c as any))
    .reduce((sum, c) => sum + getValorMensalNaData(c as any, allAditivos, today), 0);

  for (let i = 1; i <= 6; i++) {
    const monthDate = addMonths(today, i);
    const mesNome = format(monthDate, 'MMM/yy', { locale: ptBR });

    // 3% monthly growth for recurring
    const receitaRecorrente = mrrAtual * Math.pow(1.03, i);
    // Variable stays constant
    const receitaVariavel = mediaVariavel;
    const receitaProjetada = receitaRecorrente + receitaVariavel;

    revenueProjection.push({
      mes: mesNome.charAt(0).toUpperCase() + mesNome.slice(1),
      receitaProjetada,
      receitaRecorrente,
      receitaVariavel,
    });
  }

  // ============ CLIENT PROFITABILITY ============
  const clientProfitability: ClientProfitability[] = [];
  
  // Separate direct (linked) expenses from unlinked expenses
  const despesasPagas = despesas.filter(d => d.status === 'pago');
  const despesasDiretas: Record<string, number> = {}; // cliente_id -> total
  let despesasNaoVinculadas = 0;

  despesasPagas.forEach(d => {
    const valor = Number(d.valor);
    if (d.cliente_id) {
      despesasDiretas[d.cliente_id] = (despesasDiretas[d.cliente_id] || 0) + valor;
    } else {
      despesasNaoVinculadas += valor;
    }
  });

  // Revenue per client
  const receitaPorCliente: Record<string, { valor: number; nome: string }> = {};
  receitas.forEach(r => {
    if (r.cliente_id && r.status === 'recebido') {
      if (!receitaPorCliente[r.cliente_id]) {
        receitaPorCliente[r.cliente_id] = {
          valor: 0,
          nome: (r.cliente as { nome: string })?.nome || 'Sem nome',
        };
      }
      receitaPorCliente[r.cliente_id].valor += Number(r.valor);
    }
  });

  // Total revenue for proportion of unlinked expenses
  const receitaTotalGeral = Object.values(receitaPorCliente).reduce((sum, c) => sum + c.valor, 0);

  // Contract time per client
  const contratosPorCliente: Record<string, { primeiro: Date; ativo: boolean; fim: Date | null }> = {};
  contratos.forEach(c => {
    const inicio = parseISO(c.data_inicio);
    const fimEfetivo = c.data_inativacao ? parseISO(c.data_inativacao) : (c.data_fim ? parseISO(c.data_fim) : null);
    
    if (!contratosPorCliente[c.cliente_id]) {
      contratosPorCliente[c.cliente_id] = {
        primeiro: inicio,
        ativo: c.status === 'ativo',
        fim: fimEfetivo,
      };
    } else {
      if (inicio < contratosPorCliente[c.cliente_id].primeiro) {
        contratosPorCliente[c.cliente_id].primeiro = inicio;
      }
      if (c.status === 'ativo') {
        contratosPorCliente[c.cliente_id].ativo = true;
      }
      if (fimEfetivo && (!contratosPorCliente[c.cliente_id].fim || fimEfetivo > contratosPorCliente[c.cliente_id].fim!)) {
        contratosPorCliente[c.cliente_id].fim = fimEfetivo;
      }
    }
  });

  Object.entries(receitaPorCliente).forEach(([clienteId, data]) => {
    // Direct costs + proportional share of unlinked expenses
    const custoDireto = despesasDiretas[clienteId] || 0;
    const proporcao = receitaTotalGeral > 0 ? data.valor / receitaTotalGeral : 0;
    const custoRateado = despesasNaoVinculadas * proporcao;
    const custoAtribuido = custoDireto + custoRateado;
    const lucroEstimado = data.valor - custoAtribuido;
    const margemPercentual = data.valor > 0 ? (lucroEstimado / data.valor) * 100 : 0;

    let tempoRelacionamento = 0;
    if (contratosPorCliente[clienteId]) {
      const contrato = contratosPorCliente[clienteId];
      const dataFinal = contrato.ativo ? today : (contrato.fim || today);
      tempoRelacionamento = differenceInMonths(dataFinal, contrato.primeiro) + 1;
    }

    clientProfitability.push({
      clienteId,
      clienteNome: data.nome,
      receitaTotal: data.valor,
      custoAtribuido,
      lucroEstimado,
      margemPercentual,
      tempoRelacionamento,
      ltvCliente: tempoRelacionamento > 0 ? (data.valor / tempoRelacionamento) * tempoRelacionamento : data.valor,
    });
  });

  clientProfitability.sort((a, b) => b.receitaTotal - a.receitaTotal);

  // ============ FINANCIAL HEALTH SCORE ============
  // Calculate components
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);
  const prevMonthStart = startOfMonth(subMonths(today, 1));
  const prevMonthEnd = endOfMonth(subMonths(today, 1));

  // 1. Net margin (25%) - fallback to previous month if no received revenue this month
  let receitaMesAtual = receitas
    .filter(r => {
      const data = r.data_recebimento ? parseISO(r.data_recebimento) : null;
      return r.status === 'recebido' && data && data >= currentMonthStart && data <= currentMonthEnd;
    })
    .reduce((sum, r) => sum + Number(r.valor), 0);

  let despesaMesAtual = despesas
    .filter(d => {
      const data = d.data_pagamento ? parseISO(d.data_pagamento) : null;
      return d.status === 'pago' && data && data >= currentMonthStart && data <= currentMonthEnd;
    })
    .reduce((sum, d) => sum + Number(d.valor), 0);

  // Fallback to previous month if no received revenue this month
  if (receitaMesAtual === 0) {
    receitaMesAtual = receitas
      .filter(r => {
        const data = r.data_recebimento ? parseISO(r.data_recebimento) : null;
        return r.status === 'recebido' && data && data >= prevMonthStart && data <= prevMonthEnd;
      })
      .reduce((sum, r) => sum + Number(r.valor), 0);
    
    despesaMesAtual = despesas
      .filter(d => {
        const data = d.data_pagamento ? parseISO(d.data_pagamento) : null;
        return d.status === 'pago' && data && data >= prevMonthStart && data <= prevMonthEnd;
      })
      .reduce((sum, d) => sum + Number(d.valor), 0);
  }

  const margemLiquida = receitaMesAtual > 0 ? ((receitaMesAtual - despesaMesAtual) / receitaMesAtual) * 100 : 0;
  const scoreMargem = Math.min(100, Math.max(0, margemLiquida * 2));

  // 2. Delinquency rate (20%) - based on VALUE of truly overdue receitas
  // Only count receitas whose vencimento has ALREADY PASSED (< today), not future pending ones
  // Scope to last 3 months to avoid ancient history distorting the score
  const threeMonthsAgo = startOfMonth(subMonths(today, 2));
  
  const receitasNoPeriodo = receitas.filter(r => {
    const vencimento = parseISO(r.data_vencimento);
    return vencimento >= threeMonthsAgo && vencimento < today;
  });
  
  const valorAtrasadas = receitasNoPeriodo
    .filter(r => r.status === 'atrasado' || (r.status === 'pendente' && parseISO(r.data_vencimento) < today))
    .reduce((sum, r) => sum + Number(r.valor), 0);
  
  const valorTotalVencidoPeriodo = receitasNoPeriodo
    .filter(r => r.status === 'atrasado' || r.status === 'recebido' || (r.status === 'pendente' && parseISO(r.data_vencimento) < today))
    .reduce((sum, r) => sum + Number(r.valor), 0);
  
  const taxaInadimplencia = valorTotalVencidoPeriodo > 0 
    ? (valorAtrasadas / valorTotalVencidoPeriodo) * 100 
    : 0;
  const scoreInadimplencia = Math.max(0, 100 - taxaInadimplencia * 2);

  // 3. MRR growth (20%) - using contract utils for consistency
  const mrrMesAnterior = contratos
    .filter(c => c.recorrencia !== 'unico' && isContratoAtivoNoPeriodo(c as any, prevMonthStart, prevMonthEnd))
    .reduce((sum, c) => sum + getValorMensalNaData(c as any, allAditivos, prevMonthEnd), 0);

  const crescimentoMRR = mrrMesAnterior > 0 ? ((mrrAtual - mrrMesAnterior) / mrrMesAnterior) * 100 : 0;
  const scoreCrescimento = Math.min(100, Math.max(0, 50 + crescimentoMRR * 5));

  // 4. Churn rate (15%)
  const scoreChurn = Math.max(0, 100 - churnData.taxaChurnMensal * 10);

  // 5. Liquidity - days of cash (20%)
  const caixaTotal = contas.reduce((sum, c) => sum + Number(c.saldo_inicial || 0), 0) +
    receitas.filter(r => r.status === 'recebido').reduce((sum, r) => sum + Number(r.valor), 0) -
    despesas.filter(d => d.status === 'pago').reduce((sum, d) => sum + Number(d.valor), 0);
  
  const despesaMediaDiaria = despesaMesAtual / 30;
  const diasDeCaixa = despesaMediaDiaria > 0 ? caixaTotal / despesaMediaDiaria : 90;
  const scoreLiquidez = Math.min(100, diasDeCaixa / 90 * 100);

  // Calculate final score
  const fatores: HealthScoreFator[] = [
    { nome: 'Margem Líquida', valor: margemLiquida, peso: 25, contribuicao: scoreMargem * 0.25 },
    { nome: 'Inadimplência', valor: taxaInadimplencia, peso: 20, contribuicao: scoreInadimplencia * 0.20 },
    { nome: 'Crescimento MRR', valor: crescimentoMRR, peso: 20, contribuicao: scoreCrescimento * 0.20 },
    { nome: 'Retenção', valor: 100 - churnData.taxaChurnMensal, peso: 15, contribuicao: scoreChurn * 0.15 },
    { nome: 'Liquidez', valor: diasDeCaixa, peso: 20, contribuicao: scoreLiquidez * 0.20 },
  ];

  const scoreTotal = fatores.reduce((sum, f) => sum + f.contribuicao, 0);
  
  let categoria: 'critico' | 'atencao' | 'bom' | 'excelente' = 'critico';
  if (scoreTotal >= 80) categoria = 'excelente';
  else if (scoreTotal >= 60) categoria = 'bom';
  else if (scoreTotal >= 40) categoria = 'atencao';

  const healthScore: HealthScore = {
    score: Math.round(scoreTotal),
    categoria,
    fatores,
  };

  return {
    ltvEvolution,
    churnData,
    cohorts,
    revenueProjection,
    clientProfitability,
    healthScore,
  };
}

export function useAnalises(): AnalysisData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analises'],
    queryFn: fetchAnalysisData,
    staleTime: 60000,
  });

  return {
    ltvEvolution: data?.ltvEvolution || [],
    churnData: data?.churnData || {
      taxaChurnMensal: 0,
      clientesPerdidos: 0,
      clientesNovos: 0,
      clientesAtivos: 0,
      historicoChurn: [],
    },
    cohorts: data?.cohorts || [],
    revenueProjection: data?.revenueProjection || [],
    clientProfitability: data?.clientProfitability || [],
    healthScore: data?.healthScore || {
      score: 0,
      categoria: 'critico',
      fatores: [],
    },
    isLoading,
    error: error?.message || null,
  };
}
