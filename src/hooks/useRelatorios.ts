import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth, endOfMonth, subMonths, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export type PeriodFilter = 'month' | 'quarter' | 'year' | 'custom';

export interface DRERow {
  label: string;
  type: 'group' | 'item' | 'result';
  icon?: string;
  values: Record<string, number>; // key = "Jan 2026", value = amount
}

export interface RecDespResumo {
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  margem: number;
  barData: { mes: string; receitas: number; despesas: number }[];
}

export interface RecDespResumo {
  totalReceitas: number;
  totalDespesas: number;
  resultado: number;
  margem: number;
  barData: { mes: string; receitas: number; despesas: number }[];
  receitaPorEmpresa: { empresa: string; valor: number }[];
}

export interface FluxoCaixaData {
  chartData: { mes: string; entradas: number; saidas: number; saldo: number }[];
}

export interface ComparativoData {
  rows: { label: string; periodo1: number; periodo2: number; variacao: number; variacaoPercent: number }[];
  periodo1Label: string;
  periodo2Label: string;
}

function getMonthRange(period: PeriodFilter, customStart?: Date, customEnd?: Date) {
  const today = new Date();
  let start: Date;
  let end: Date;

  switch (period) {
    case 'month':
      start = startOfMonth(today);
      end = endOfMonth(today);
      break;
    case 'quarter':
      start = startOfMonth(subMonths(today, 2));
      end = endOfMonth(today);
      break;
    case 'year':
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      break;
    case 'custom':
      start = customStart || startOfMonth(today);
      end = customEnd || endOfMonth(today);
      break;
    default:
      start = startOfMonth(today);
      end = endOfMonth(today);
  }

  return { start, end };
}

function getMonthColumns(start: Date, end: Date): string[] {
  const cols: string[] = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  while (current <= end) {
    const label = format(current, 'MMM yyyy', { locale: ptBR });
    cols.push(label.charAt(0).toUpperCase() + label.slice(1));
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
  }
  return cols;
}

async function fetchRelatoriosData(period: PeriodFilter, customStart?: Date, customEnd?: Date) {
  const { start, end } = getMonthRange(period, customStart, customEnd);
  const startStr = format(start, 'yyyy-MM-dd');
  const endStr = format(end, 'yyyy-MM-dd');

  const [receitasRes, despesasRes] = await Promise.all([
    supabase
      .from('receitas')
      .select('valor, data_competencia, data_recebimento, status, empresa_fonte, categoria:categorias(nome, empresa_fonte), cliente:clientes(empresa_fonte)')
      .gte('data_competencia', startStr)
      .lte('data_competencia', endStr),
    supabase
      .from('despesas')
      .select('valor, data_competencia, data_pagamento, status, tipo, categoria:categorias(nome)')
      .gte('data_competencia', startStr)
      .lte('data_competencia', endStr),
  ]);

  const receitas = receitasRes.data || [];
  const despesas = despesasRes.data || [];
  const months = getMonthColumns(start, end);

  // Helper to get month key from date
  const getMonthKey = (dateStr: string) => {
    const d = parseISO(dateStr);
    const label = format(d, 'MMM yyyy', { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  // Build DRE
  const emptyValues = () => months.reduce((acc, m) => ({ ...acc, [m]: 0 }), {} as Record<string, number>);

  const receitaBruta = emptyValues();
  const prestacaoServicos = emptyValues();
  const outrasReceitas = emptyValues();
  const impostos = emptyValues();
  const custosVariaveis = emptyValues();
  const despOperacionais = emptyValues();
  const despComerciais = emptyValues();
  const despAdministrativas = emptyValues();
  const despPessoal = emptyValues();
  const outrasDespOp = emptyValues();

  receitas.forEach((r) => {
    const mk = getMonthKey(r.data_competencia);
    const val = Number(r.valor);
    receitaBruta[mk] = (receitaBruta[mk] || 0) + val;
    const catNome = ((r.categoria as any)?.nome || '').toLowerCase();
    if (catNome.includes('serviço') || catNome.includes('servico') || catNome.includes('consultoria') || catNome.includes('projeto')) {
      prestacaoServicos[mk] = (prestacaoServicos[mk] || 0) + val;
    } else {
      outrasReceitas[mk] = (outrasReceitas[mk] || 0) + val;
    }
  });

  despesas.forEach((d) => {
    const mk = getMonthKey(d.data_competencia);
    const val = Number(d.valor);
    const catNome = ((d.categoria as any)?.nome || '').toLowerCase();

    if (catNome.includes('imposto') || catNome.includes('comiss') || catNome.includes('desconto')) {
      impostos[mk] = (impostos[mk] || 0) + val;
    } else if (d.tipo === 'variavel' || catNome.includes('plataforma') || catNome.includes(' ia') || catNome === 'plataformas de ia' || catNome.includes('investimento') || catNome.includes('mídia') || catNome.includes('midia') || catNome.includes('tráfego') || catNome.includes('trafego')) {
      custosVariaveis[mk] = (custosVariaveis[mk] || 0) + val;
    } else {
      despOperacionais[mk] = (despOperacionais[mk] || 0) + val;
      if (catNome.includes('marketing') || catNome.includes('comercial')) {
        despComerciais[mk] = (despComerciais[mk] || 0) + val;
      } else if (catNome.includes('pessoal') || catNome.includes('salário') || catNome.includes('salario')) {
        despPessoal[mk] = (despPessoal[mk] || 0) + val;
      } else if (catNome.includes('admin')) {
        despAdministrativas[mk] = (despAdministrativas[mk] || 0) + val;
      } else {
        outrasDespOp[mk] = (outrasDespOp[mk] || 0) + val;
      }
    }
  });

  // Calculate derived rows
  const receitaLiquida = emptyValues();
  const lucroBruto = emptyValues();
  const ebitda = emptyValues();
  const lucroLiquido = emptyValues();

  months.forEach((m) => {
    receitaLiquida[m] = receitaBruta[m] - impostos[m];
    lucroBruto[m] = receitaLiquida[m] - custosVariaveis[m];
    ebitda[m] = lucroBruto[m] - despOperacionais[m];
    lucroLiquido[m] = ebitda[m];
  });

  const dreRows: DRERow[] = [
    { label: 'RECEITA BRUTA', type: 'group', icon: '📈', values: receitaBruta },
    { label: 'Prestação de Serviços', type: 'item', values: prestacaoServicos },
    { label: 'Outras Receitas', type: 'item', values: outrasReceitas },
    { label: 'DEDUÇÕES DA RECEITA', type: 'group', icon: '⊖', values: impostos },
    { label: 'Impostos e Deduções', type: 'item', values: impostos },
    { label: 'Receita Líquida', type: 'result', icon: '⊙', values: receitaLiquida },
    { label: 'CUSTOS VARIÁVEIS', type: 'group', icon: '⊖', values: custosVariaveis },
    { label: 'Custos Variáveis', type: 'item', values: custosVariaveis },
    { label: 'Lucro Bruto', type: 'result', icon: '%', values: lucroBruto },
    { label: 'DESPESAS OPERACIONAIS', type: 'group', icon: '📋', values: despOperacionais },
    { label: 'Despesas Comerciais / Marketing', type: 'item', values: despComerciais },
    { label: 'Despesas Administrativas', type: 'item', values: despAdministrativas },
    { label: 'Despesas com Pessoal', type: 'item', values: despPessoal },
    { label: 'Outras Despesas Operacionais', type: 'item', values: outrasDespOp },
    { label: 'EBITDA / Resultado Operacional', type: 'result', icon: '=', values: ebitda },
    { label: 'LUCRO / PREJUÍZO LÍQUIDO', type: 'result', icon: '=', values: lucroLiquido },
  ];

  // Rec vs Desp
  const barData = months.map((m) => ({
    mes: m,
    receitas: receitaBruta[m],
    despesas: impostos[m] + custosVariaveis[m] + despOperacionais[m],
  }));

  const totalRec = Object.values(receitaBruta).reduce((s, v) => s + v, 0);
  const totalDesp = barData.reduce((s, d) => s + d.despesas, 0);
  const resultado = totalRec - totalDesp;
  const margem = totalRec > 0 ? (resultado / totalRec) * 100 : 0;

  // Receita por empresa-fonte
  const empresasMap: Record<string, number> = { PIXIFY: 0, REVVUE: 0, CLARIO: 0, TABELIO: 0 };
  receitas.forEach((r) => {
    const ef = ((r as any).empresa_fonte) || ((r.categoria as any)?.empresa_fonte) || ((r.cliente as any)?.empresa_fonte) || 'PIXIFY';
    if (empresasMap[ef] !== undefined) {
      empresasMap[ef] += Number(r.valor);
    }
  });
  const receitaPorEmpresa = Object.entries(empresasMap).map(([empresa, valor]) => ({ empresa, valor }));

  const recDespResumo: RecDespResumo = {
    totalReceitas: totalRec,
    totalDespesas: totalDesp,
    resultado,
    margem,
    barData,
    receitaPorEmpresa,
  };

  // Fluxo de Caixa
  let saldoAcumulado = 0;
  const fluxoData: FluxoCaixaData = {
    chartData: months.map((m) => {
      const entradas = receitaBruta[m];
      const saidas = impostos[m] + custosVariaveis[m] + despOperacionais[m];
      saldoAcumulado += entradas - saidas;
      return { mes: m, entradas, saidas, saldo: saldoAcumulado };
    }),
  };

  return { dreRows, months, recDespResumo, fluxoData, receitaBruta, impostos, custosVariaveis, despOperacionais, lucroLiquido };
}

export type ComparativoFilter = 'mes_atual_anterior' | '60dias' | '90dias';

function buildComparativo(
  receitaBruta: Record<string, number>,
  impostos: Record<string, number>,
  custosVariaveis: Record<string, number>,
  despOperacionais: Record<string, number>,
  lucroLiquido: Record<string, number>,
  compFilter: ComparativoFilter,
): ComparativoData {
  const today = new Date();
  let p2Start: Date;
  let p1Start: Date;

  switch (compFilter) {
    case '60dias':
      p2Start = startOfMonth(subMonths(today, 1));
      p1Start = startOfMonth(subMonths(today, 2));
      break;
    case '90dias':
      p2Start = startOfMonth(subMonths(today, 1));
      p1Start = startOfMonth(subMonths(today, 3));
      break;
    case 'mes_atual_anterior':
    default:
      p2Start = startOfMonth(today);
      p1Start = startOfMonth(subMonths(today, 1));
      break;
  }

  const p2Label = format(p2Start, 'MMM yyyy', { locale: ptBR });
  const p1Label = format(p1Start, 'MMM yyyy', { locale: ptBR });
  const p2Key = p2Label.charAt(0).toUpperCase() + p2Label.slice(1);
  const p1Key = p1Label.charAt(0).toUpperCase() + p1Label.slice(1);

  const compRows = [
    { label: 'Receita Bruta', p1: receitaBruta[p1Key] || 0, p2: receitaBruta[p2Key] || 0 },
    { label: 'Deduções', p1: impostos[p1Key] || 0, p2: impostos[p2Key] || 0 },
    { label: 'Custos Variáveis', p1: custosVariaveis[p1Key] || 0, p2: custosVariaveis[p2Key] || 0 },
    { label: 'Despesas Operacionais', p1: despOperacionais[p1Key] || 0, p2: despOperacionais[p2Key] || 0 },
    { label: 'Resultado Líquido', p1: lucroLiquido[p1Key] || 0, p2: lucroLiquido[p2Key] || 0 },
  ];

  return {
    periodo1Label: p1Key || '-',
    periodo2Label: p2Key || '-',
    rows: compRows.map((r) => ({
      label: r.label,
      periodo1: r.p1,
      periodo2: r.p2,
      variacao: r.p2 - r.p1,
      variacaoPercent: r.p1 !== 0 ? ((r.p2 - r.p1) / Math.abs(r.p1)) * 100 : 0,
    })),
  };
}

export function useRelatorios(period: PeriodFilter, customStart?: Date, customEnd?: Date, compFilter: ComparativoFilter = 'mes_atual_anterior') {
  const { data, isLoading } = useQuery({
    queryKey: ['relatorios', period, customStart?.toISOString(), customEnd?.toISOString()],
    queryFn: () => fetchRelatoriosData(period, customStart, customEnd),
  });

  const comparativo = data
    ? buildComparativo(data.receitaBruta, data.impostos, data.custosVariaveis, data.despOperacionais, data.lucroLiquido, compFilter)
    : { periodo1Label: '-', periodo2Label: '-', rows: [] };

  return {
    dreRows: data?.dreRows || [],
    months: data?.months || [],
    recDespResumo: data?.recDespResumo || { totalReceitas: 0, totalDespesas: 0, resultado: 0, margem: 0, barData: [], receitaPorEmpresa: [] },
    fluxoData: data?.fluxoData || { chartData: [] },
    comparativo,
    isLoading,
  };
}
