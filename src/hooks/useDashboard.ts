import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format, addMonths, parseISO, isAfter, isBefore, addDays, startOfDay } from 'date-fns';
import { isContratoAtivoHoje, isContratoAtivoNoPeriodo, getValorMensalNaData, getMesesRelacionamento, getClientesAtivosHoje } from '@/utils/contractUtils';
import { ptBR } from 'date-fns/locale';
import type { Alert } from '@/components/dashboard/AlertsWidget';
import type { ContractsWidgetData } from '@/components/dashboard/ContractsWidget';
import type { CategoryExpense } from '@/components/dashboard/ExpensesByCategoryChart';
import type { UpcomingItem } from '@/components/dashboard/UpcomingDueWidget';
import type { LTVData } from '@/components/dashboard/LTVWidget';
import type { DashboardData, TopCliente, FaturamentoVsDespesas, MRRHistorico } from '@/types/finance';
import type { AccountBalance } from '@/components/dashboard/ConsolidatedBalanceCard';
import type { CreditCardData } from '@/components/dashboard/CreditCardsWidget';
import { getFaturaAtual } from '@/utils/faturaCalculator';

export type EmpresaFonte = 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO';

export interface ReceitaPorEmpresa {
  empresa: EmpresaFonte;
  valor_mes: number;
  valor_anterior: number;
  delta_percent: number;
}

interface DashboardResult {
  dashboardData: DashboardData;
  contractsData: ContractsWidgetData;
  expensesByCategory: CategoryExpense[];
  alerts: Alert[];
  upcomingItems: UpcomingItem[];
  ltvData: LTVData;
  accountBalances: AccountBalance[];
  consolidatedHistory: { mes: string; valor: number }[];
  revenueData3m: FaturamentoVsDespesas[];
  revenueData6m: FaturamentoVsDespesas[];
  revenueData12m: FaturamentoVsDespesas[];
  receitaPorEmpresa: ReceitaPorEmpresa[];
  creditCardsData: CreditCardData[];
  isLoading: boolean;
  error: string | null;
}

async function fetchDashboardData(): Promise<Omit<DashboardResult, 'isLoading' | 'error'>> {
  const today = startOfDay(new Date());
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);

  // Fetch all data in parallel
  const [receitasRes, despesasRes, contratosRes, clientesRes, categoriasRes, contasRes, transferenciasRes, aditivosRes, faturasRes] = await Promise.all([
    supabase
      .from('receitas')
      .select('*, cliente:clientes(id, nome, empresa_fonte), categoria:categorias(id, nome, empresa_fonte)')
      .order('data_vencimento', { ascending: true }),
    supabase
      .from('despesas')
      .select('*, categoria:categorias(id, nome, cor)')
      .order('data_vencimento', { ascending: true }),
    supabase
      .from('contratos')
      .select('*, cliente:clientes(id, nome)')
      .order('created_at', { ascending: false }),
    supabase
      .from('clientes')
      .select('*'),
    supabase
      .from('categorias')
      .select('*')
      .eq('tipo', 'despesa'),
    supabase
      .from('contas')
      .select('*')
      .eq('ativa', true),
    supabase
      .from('transferencias')
      .select('*'),
    supabase
      .from('contrato_aditivos' as any)
      .select('*')
      .order('data_vigencia', { ascending: false }),
    supabase
      .from('cartao_faturas')
      .select('*'),
  ]);

  const receitas = receitasRes.data || [];
  const despesas = despesasRes.data || [];
  const contratos = contratosRes.data || [];
  const clientes = clientesRes.data || [];
  const categorias = categoriasRes.data || [];
  const contas = contasRes.data || [];
  const transferencias = transferenciasRes.data || [];
  const allAditivos = (aditivosRes.data as any[]) || [];
  const faturas = (faturasRes.data as any[]) || [];

  // Calculate Caixa Total correctly using account balances
  const caixaTotal = contas.reduce((total, conta) => {
    const receitasConta = receitas
      .filter(r => r.conta_id === conta.id && r.status === 'recebido')
      .reduce((sum, r) => sum + Number(r.valor), 0);
    
    const despesasConta = despesas
      .filter(d => d.conta_id === conta.id && d.status === 'pago')
      .reduce((sum, d) => sum + Number(d.valor), 0);
    
    const transferenciasEnviadas = transferencias
      .filter(t => t.conta_origem_id === conta.id)
      .reduce((sum, t) => sum + Number(t.valor), 0);
    
    const transferenciasRecebidas = transferencias
      .filter(t => t.conta_destino_id === conta.id)
      .reduce((sum, t) => sum + Number(t.valor), 0);
    
    const saldoConta = Number(conta.saldo_inicial) + receitasConta - despesasConta - transferenciasEnviadas + transferenciasRecebidas;
    return total + saldoConta;
  }, 0);

  // Calculate pending expenses (A Pagar) for current month only
  // Exclude credit-card invoice line items (fatura_id != null) — those are represented
  // in cash flow by the consolidated invoice expense, not by individual line items.
  const despesasPendentes = despesas
    .filter(d => {
      const vencimento = parseISO(d.data_vencimento);
      return (d.status === 'pendente' || d.status === 'atrasado') &&
             d.fatura_id == null &&
             vencimento >= currentMonthStart && vencimento <= currentMonthEnd;
    })
    .reduce((sum, d) => sum + Number(d.valor), 0);

  // Current month metrics
  const faturamentoMes = receitas
    .filter(r => {
      const dataRecebimento = r.data_recebimento ? parseISO(r.data_recebimento) : null;
      return r.status === 'recebido' && dataRecebimento && 
        dataRecebimento >= currentMonthStart && dataRecebimento <= currentMonthEnd;
    })
    .reduce((sum, r) => sum + Number(r.valor), 0);

  const despesasMes = despesas
    .filter(d => {
      const dataPagamento = d.data_pagamento ? parseISO(d.data_pagamento) : null;
      return d.status === 'pago' && dataPagamento &&
        d.fatura_id == null &&
        dataPagamento >= currentMonthStart && dataPagamento <= currentMonthEnd;
    })
    .reduce((sum, d) => sum + Number(d.valor), 0);

  const lucroMensal = faturamentoMes - despesasMes;
  const lucroMensalPercentual = faturamentoMes > 0 
    ? ((lucroMensal / faturamentoMes) * 100).toFixed(2) 
    : '0.00';

  // Pending receitas for current month (A Receber)
  const receitasPendentes = receitas
    .filter(r => {
      const vencimento = parseISO(r.data_vencimento);
      return (r.status === 'pendente' || r.status === 'atrasado') && 
             vencimento >= currentMonthStart && vencimento <= currentMonthEnd;
    })
    .reduce((sum, r) => sum + Number(r.valor), 0);

  // MRR from active contracts (using vigência, not just status)
  const contratosAtivos = contratos.filter(c => isContratoAtivoHoje(c as any));
  const mrrTotal = contratosAtivos
    .filter(c => c.recorrencia === 'mensal')
    .reduce((sum, c) => sum + Number(c.valor), 0);

  const receitaAnualProjetada = mrrTotal * 12;

  // Contracts data - use vigência-based active clients
  const clientesAtivosSet = getClientesAtivosHoje(contratos as any[]);
  const clientesAtivos = clientesAtivosSet.size;

  // Find next contract due
  const proximoVencimento = contratosAtivos
    .filter(c => c.data_fim)
    .sort((a, b) => new Date(a.data_fim!).getTime() - new Date(b.data_fim!).getTime())
    .find(c => c.data_fim && new Date(c.data_fim) > today);

  const contractsData: ContractsWidgetData = {
    contratosAtivos: contratosAtivos.length,
    clientesAtivos,
    mrrTotal,
    proximoVencimento: proximoVencimento ? {
      cliente: (proximoVencimento.cliente as { nome: string })?.nome || 'Cliente',
      data: format(parseISO(proximoVencimento.data_fim!), 'dd/MM/yyyy'),
      valor: Number(proximoVencimento.valor),
    } : undefined,
  };

  // Expenses by category for current month only
  const expensesByCategory: CategoryExpense[] = [];
  const despesasPorCategoria: Record<string, { valor: number; cor: string }> = {};

  despesas
    .filter(d => {
      const vencimento = parseISO(d.data_vencimento);
      return vencimento >= currentMonthStart && vencimento <= currentMonthEnd;
    })
    .forEach(d => {
      const categoriaNome = (d.categoria as { nome: string; cor: string })?.nome || 'Outros';
      const categoriaCor = (d.categoria as { nome: string; cor: string })?.cor || '#6B7280';
      
      if (!despesasPorCategoria[categoriaNome]) {
        despesasPorCategoria[categoriaNome] = { valor: 0, cor: categoriaCor };
      }
      despesasPorCategoria[categoriaNome].valor += Number(d.valor);
    });

  Object.entries(despesasPorCategoria).forEach(([categoria, data]) => {
    expensesByCategory.push({
      categoria,
      valor: data.valor,
      cor: data.cor,
    });
  });

  expensesByCategory.sort((a, b) => b.valor - a.valor);

  // Top clients by revenue
  const receitasPorCliente: Record<string, { nome: string; valor: number }> = {};
  
  receitas.forEach(r => {
    const clienteId = r.cliente_id;
    const clienteNome = (r.cliente as { nome: string })?.nome || 'Sem cliente';
    
    if (clienteId) {
      if (!receitasPorCliente[clienteId]) {
        receitasPorCliente[clienteId] = { nome: clienteNome, valor: 0 };
      }
      receitasPorCliente[clienteId].valor += Number(r.valor);
    }
  });

  const topClientes: TopCliente[] = Object.entries(receitasPorCliente)
    .map(([id, data]) => ({
      cliente_id: id,
      cliente: data.nome,
      receita_total: data.valor,
    }))
    .sort((a, b) => b.receita_total - a.receita_total)
    .slice(0, 5);

  // Account balances — exclui cartões de crédito (não compõem caixa)
  const accountBalances: AccountBalance[] = contas
    .filter((c: any) => c.tipo !== 'cartao_credito')
    .map(conta => {
      const receitasConta = receitas
        .filter(r => r.conta_id === conta.id && r.status === 'recebido')
        .reduce((sum, r) => sum + Number(r.valor), 0);
      const despesasConta = despesas
        .filter(d => d.conta_id === conta.id && d.status === 'pago')
        .reduce((sum, d) => sum + Number(d.valor), 0);
      const transferenciasEnviadas = transferencias
        .filter(t => t.conta_origem_id === conta.id)
        .reduce((sum, t) => sum + Number(t.valor), 0);
      const transferenciasRecebidas = transferencias
        .filter(t => t.conta_destino_id === conta.id)
        .reduce((sum, t) => sum + Number(t.valor), 0);
      const saldo = Number(conta.saldo_inicial) + receitasConta - despesasConta - transferenciasEnviadas + transferenciasRecebidas;
      return { id: conta.id, nome: conta.nome, saldo, cor: conta.cor };
    });

  // Credit cards data para o widget
  const creditCardsData: CreditCardData[] = contas
    .filter((c: any) => c.tipo === 'cartao_credito')
    .map((c: any) => {
      const fatura = getFaturaAtual(c, faturas);
      const usado = fatura ? Math.max(Number(fatura.valor_total) - Number(fatura.valor_pago), 0) : 0;
      return {
        id: c.id,
        nome: c.nome,
        usado,
        limite: Number(c.limite || 0),
      };
    });

  // Consolidated balance history (last 4 months)
  const consolidatedHistory: { mes: string; valor: number }[] = [];
  for (let i = 3; i >= 0; i--) {
    const monthDate = subMonths(today, i);
    const monthEnd = endOfMonth(monthDate);
    const mesNome = format(monthDate, 'MMM', { locale: ptBR });
    
    let totalAteMes = contas.reduce((total, conta) => {
      const recConta = receitas
        .filter(r => r.conta_id === conta.id && r.status === 'recebido' && r.data_recebimento && parseISO(r.data_recebimento) <= monthEnd)
        .reduce((s, r) => s + Number(r.valor), 0);
      const despConta = despesas
        .filter(d => d.conta_id === conta.id && d.status === 'pago' && d.data_pagamento && parseISO(d.data_pagamento) <= monthEnd)
        .reduce((s, d) => s + Number(d.valor), 0);
      return total + Number(conta.saldo_inicial) + recConta - despConta;
    }, 0);
    consolidatedHistory.push({ mes: mesNome.charAt(0).toUpperCase() + mesNome.slice(1), valor: totalAteMes });
  }

  // Revenue vs Expenses helper
  function buildRevenueData(months: number): FaturamentoVsDespesas[] {
    const result: FaturamentoVsDespesas[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const mesNome = format(monthDate, 'MMM', { locale: ptBR });

      const receitaMes = receitas
        .filter(r => {
          const dr = r.data_recebimento ? parseISO(r.data_recebimento) : null;
          return r.status === 'recebido' && dr && dr >= monthStart && dr <= monthEnd;
        })
        .reduce((sum, r) => sum + Number(r.valor), 0);

      const despesaMes = despesas
        .filter(d => {
          const dp = d.data_pagamento ? parseISO(d.data_pagamento) : null;
          return d.status === 'pago' && dp && dp >= monthStart && dp <= monthEnd;
        })
        .reduce((sum, d) => sum + Number(d.valor), 0);

      result.push({ mes: mesNome.charAt(0).toUpperCase() + mesNome.slice(1), receita: receitaMes, despesa: despesaMes });
    }
    return result;
  }

  const revenueData3m = buildRevenueData(3);
  const revenueData6m = buildRevenueData(6);
  const revenueData12m = buildRevenueData(12);
  const faturamentoVsDespesas = revenueData6m;

  // Receita por empresa-fonte (mês atual vs mês anterior)
  const previousMonthStart = startOfMonth(subMonths(today, 1));
  const previousMonthEnd = endOfMonth(subMonths(today, 1));
  const empresas: EmpresaFonte[] = ['PIXIFY', 'REVVUE', 'CLARIO', 'TABELIO'];
  const receitaPorEmpresa: ReceitaPorEmpresa[] = empresas.map((empresa) => {
    const valorMes = receitas
      .filter((r) => {
        const dr = r.data_recebimento ? parseISO(r.data_recebimento) : null;
        const ef = (r as any).empresa_fonte
          || (r.categoria as any)?.empresa_fonte
          || (r.cliente as any)?.empresa_fonte;
        return r.status === 'recebido' && dr && dr >= currentMonthStart && dr <= currentMonthEnd && ef === empresa;
      })
      .reduce((sum, r) => sum + Number(r.valor), 0);
    const valorAnterior = receitas
      .filter((r) => {
        const dr = r.data_recebimento ? parseISO(r.data_recebimento) : null;
        const ef = (r as any).empresa_fonte
          || (r.categoria as any)?.empresa_fonte
          || (r.cliente as any)?.empresa_fonte;
        return r.status === 'recebido' && dr && dr >= previousMonthStart && dr <= previousMonthEnd && ef === empresa;
      })
      .reduce((sum, r) => sum + Number(r.valor), 0);
    const deltaPercent = valorAnterior > 0
      ? ((valorMes - valorAnterior) / valorAnterior) * 100
      : valorMes > 0 ? 100 : 0;
    return { empresa, valor_mes: valorMes, valor_anterior: valorAnterior, delta_percent: deltaPercent };
  });

  // MRR chart (last 6 months + 6 months projection)
  // Calculate MRR based on contracts that were active in each specific month
  const mrrHistorico: MRRHistorico[] = [];
  const mrrProjecao: MRRHistorico[] = [];

  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(today, i);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    const mesNome = format(monthDate, 'MMM', { locale: ptBR });
    
    // Calculate MRR for this specific month based on contracts that were active (using vigência)
    const mrrDoMes = contratos
      .filter(c => {
        if (c.recorrencia !== 'mensal') return false;
        return isContratoAtivoNoPeriodo(c as any, monthStart, monthEnd);
      })
      .reduce((sum, c) => {
        const contratoAditivos = allAditivos.filter((a: any) => a.contrato_id === c.id);
        if (contratoAditivos.length === 0) {
          return sum + Number(c.valor);
        }
        const monthStr = format(monthStart, 'yyyy-MM-dd');
        const aplicaveis = contratoAditivos
          .filter((a: any) => a.data_vigencia <= monthStr)
          .sort((a: any, b: any) => b.data_vigencia.localeCompare(a.data_vigencia));
        if (aplicaveis.length > 0) {
          return sum + Number(aplicaveis[0].valor_novo);
        }
        // Month is before any aditivo — use valor_anterior of the earliest aditivo
        const earliest = [...contratoAditivos].sort((a: any, b: any) => a.data_vigencia.localeCompare(b.data_vigencia))[0];
        return sum + Number(earliest.valor_anterior);
      }, 0);
    
    mrrHistorico.push({
      mes: mesNome.charAt(0).toUpperCase() + mesNome.slice(1),
      valor: mrrDoMes,
    });
  }

  // Get the last historical MRR value for projections
  const lastMrr = mrrHistorico.length > 0 ? mrrHistorico[mrrHistorico.length - 1].valor : 0;

  for (let i = 1; i <= 6; i++) {
    const monthDate = addMonths(today, i);
    const mesNome = format(monthDate, 'MMM', { locale: ptBR });
    
    // Simple projection: 5% growth per month based on current MRR
    const projectedMrr = lastMrr * Math.pow(1.05, i);
    mrrProjecao.push({
      mes: mesNome.charAt(0).toUpperCase() + mesNome.slice(1),
      valor: Math.round(projectedMrr),
    });
  }

  // Generate alerts
  const alerts: Alert[] = [];
  
  // Overdue receitas
  const receitasAtrasadas = receitas.filter(r => 
    (r.status === 'pendente' || r.status === 'atrasado') && 
    parseISO(r.data_vencimento) < today
  );
  
  if (receitasAtrasadas.length > 0) {
    alerts.push({
      id: 'receitas-atrasadas',
      type: 'overdue',
      title: 'Receitas atrasadas',
      description: `${receitasAtrasadas.length} receita(s) passaram do vencimento`,
      link: '/receitas?status=atrasado',
      count: receitasAtrasadas.length,
    });
  }

  // Despesas due today
  const despesasHoje = despesas.filter(d => {
    const vencimento = parseISO(d.data_vencimento);
    return d.status === 'pendente' && 
      vencimento.getTime() === today.getTime();
  });

  if (despesasHoje.length > 0) {
    alerts.push({
      id: 'despesas-hoje',
      type: 'due_soon',
      title: 'Vencem hoje',
      description: `${despesasHoje.length} despesa(s) vencem hoje`,
      link: '/despesas',
      count: despesasHoje.length,
    });
  }

  // Upcoming 7 days
  const in7Days = addDays(today, 7);
  const receitasProximas = receitas.filter(r => {
    const vencimento = parseISO(r.data_vencimento);
    return r.status === 'pendente' && 
      isAfter(vencimento, today) && 
      isBefore(vencimento, in7Days);
  });

  if (receitasProximas.length > 0) {
    alerts.push({
      id: 'receitas-proximas',
      type: 'due_soon',
      title: 'Próximos 7 dias',
      description: `${receitasProximas.length} receita(s) vencem em breve`,
      link: '/receitas',
      count: receitasProximas.length,
    });
  }

  // Upcoming items (next 7 days)
  const upcomingItems: UpcomingItem[] = [];

  receitas
    .filter(r => {
      const vencimento = parseISO(r.data_vencimento);
      return r.status === 'pendente' && 
        vencimento >= today && 
        vencimento <= in7Days;
    })
    .forEach(r => {
      upcomingItems.push({
        id: r.id,
        tipo: 'receita',
        descricao: r.descricao,
        valor: Number(r.valor),
        data_vencimento: r.data_vencimento,
        cliente_ou_fornecedor: (r.cliente as { nome: string })?.nome || 'Sem cliente',
      });
    });

  despesas
    .filter(d => {
      const vencimento = parseISO(d.data_vencimento);
      return d.status === 'pendente' && 
        vencimento >= today && 
        vencimento <= in7Days;
    })
    .forEach(d => {
      upcomingItems.push({
        id: d.id,
        tipo: 'despesa',
        descricao: d.descricao,
        valor: Number(d.valor),
        data_vencimento: d.data_vencimento,
        cliente_ou_fornecedor: d.fornecedor || 'Sem fornecedor',
      });
    });

  upcomingItems.sort((a, b) => 
    parseISO(a.data_vencimento).getTime() - parseISO(b.data_vencimento).getTime()
  );

  // Build dashboard data
  const dashboardData: DashboardData = {
    resumo: {
      caixa_total: caixaTotal,
      faturamento_mes: faturamentoMes,
      despesas_mes: despesasMes,
      lucro_mensal: lucroMensal,
      lucro_mensal_percentual: lucroMensalPercentual,
      receitas_pendentes: receitasPendentes,
      despesas_pendentes: despesasPendentes,
      receita_anual_projetada: receitaAnualProjetada,
    },
    meta_faturamento: {
      valor_meta: 15000, // Default goal - actual value comes from useMetas
      valor_realizado: faturamentoMes,
      percentual_atingido: (faturamentoMes / 15000) * 100,
    },
    mrr: {
      historico: mrrHistorico,
      projecao: mrrProjecao,
    },
    faturamento_vs_despesas: faturamentoVsDespesas,
    top_clientes: topClientes,
  };

  // Calculate LTV (Lifetime Value) based on CONTRACTS, not revenue
  // Group contracts by client
  const ltvPorCliente: Record<string, { valorMensalTotal: number; mesesMax: number; ativo: boolean }> = {};

  contratos.forEach(c => {
    if (c.recorrencia === 'unico') return; // skip one-time contracts for LTV
    const clienteId = c.cliente_id;
    const valorMensal = getValorMensalNaData(c as any, allAditivos, today);
    const meses = getMesesRelacionamento(c as any, today);
    const ativo = isContratoAtivoHoje(c as any);

    if (!ltvPorCliente[clienteId]) {
      ltvPorCliente[clienteId] = { valorMensalTotal: 0, mesesMax: 0, ativo: false };
    }
    ltvPorCliente[clienteId].valorMensalTotal += valorMensal;
    if (meses > ltvPorCliente[clienteId].mesesMax) {
      ltvPorCliente[clienteId].mesesMax = meses;
    }
    if (ativo) ltvPorCliente[clienteId].ativo = true;
  });

  const clientesComContrato = Object.keys(ltvPorCliente).length;
  const clientesAtivosComContrato = Object.values(ltvPorCliente).filter(c => c.ativo).length;

  // LTV per client = valorMensalTotal × mesesMax
  let somaLTV = 0;
  let somaTicketMensal = 0;
  let somaTempoRelacionamento = 0;

  Object.values(ltvPorCliente).forEach(data => {
    somaLTV += data.valorMensalTotal * data.mesesMax;
    somaTicketMensal += data.valorMensalTotal;
    somaTempoRelacionamento += data.mesesMax;
  });

  const ltvMedio = clientesComContrato > 0 ? somaLTV / clientesComContrato : 0;
  const ticketMedio = clientesAtivosComContrato > 0 
    ? Object.values(ltvPorCliente).filter(c => c.ativo).reduce((s, c) => s + c.valorMensalTotal, 0) / clientesAtivosComContrato 
    : 0;
  const tempoMedioMeses = clientesComContrato > 0 ? somaTempoRelacionamento / clientesComContrato : 0;
  const receitaTotalContratos = somaLTV; // total contracted value

  const ltvData: LTVData = {
    ltvMedio,
    ticketMedio,
    tempoMedioMeses,
    totalClientes: clientes.length,
    receitaTotal: receitaTotalContratos,
    clientesComReceita: clientesAtivosComContrato,
  };

  return {
    dashboardData,
    contractsData,
    expensesByCategory,
    alerts,
    upcomingItems,
    ltvData,
    accountBalances,
    consolidatedHistory,
    revenueData3m,
    revenueData6m,
    revenueData12m,
    receitaPorEmpresa,
    creditCardsData,
  };
}

export function useDashboard(): DashboardResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboardData,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  return {
    dashboardData: data?.dashboardData || {
      resumo: {
        caixa_total: 0,
        faturamento_mes: 0,
        despesas_mes: 0,
        lucro_mensal: 0,
        lucro_mensal_percentual: '0.00',
        receitas_pendentes: 0,
        despesas_pendentes: 0,
        receita_anual_projetada: 0,
      },
      meta_faturamento: {
        valor_meta: 15000,
        valor_realizado: 0,
        percentual_atingido: 0,
      },
      mrr: {
        historico: [],
        projecao: [],
      },
      faturamento_vs_despesas: [],
      top_clientes: [],
    },
    contractsData: data?.contractsData || {
      contratosAtivos: 0,
      clientesAtivos: 0,
      mrrTotal: 0,
    },
    expensesByCategory: data?.expensesByCategory || [],
    alerts: data?.alerts || [],
    upcomingItems: data?.upcomingItems || [],
    ltvData: data?.ltvData || {
      ltvMedio: 0,
      ticketMedio: 0,
      tempoMedioMeses: 0,
      totalClientes: 0,
      receitaTotal: 0,
      clientesComReceita: 0,
    },
    accountBalances: data?.accountBalances || [],
    consolidatedHistory: data?.consolidatedHistory || [],
    revenueData3m: data?.revenueData3m || [],
    revenueData6m: data?.revenueData6m || [],
    revenueData12m: data?.revenueData12m || [],
    creditCardsData: data?.creditCardsData || [],
    receitaPorEmpresa: data?.receitaPorEmpresa || [],
    isLoading,
    error: error?.message || null,
  };
}
