import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  format,
} from 'date-fns';

export type CalendarioModo = 'mes' | 'semana' | 'hoje';

export interface DayItem {
  id: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  status: string;
  clienteOuFornecedor: string;
  empresaFonte?: 'PIXIFY' | 'REVVUE' | 'CLARIO' | 'TABELIO' | null;
  categoria?: string;
  categoriaCor?: string;
}

export interface DayTransactions {
  date: string;
  receitas: number;
  despesas: number;
  items: DayItem[];
}

export interface TopDespesaCategoria {
  categoria: string;
  valor: number;
  cor: string;
}

interface CalendarioData {
  days: Record<string, DayTransactions>;
  topDespesas: TopDespesaCategoria[];
  totalDespesas: number;
}

function getRange(modo: CalendarioModo, ref: Date): { start: string; end: string } {
  if (modo === 'hoje') {
    const d = format(ref, 'yyyy-MM-dd');
    return { start: d, end: d };
  }
  if (modo === 'semana') {
    return {
      start: format(startOfWeek(ref, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end: format(endOfWeek(ref, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    };
  }
  return {
    start: format(startOfMonth(ref), 'yyyy-MM-dd'),
    end: format(endOfMonth(ref), 'yyyy-MM-dd'),
  };
}

async function fetchCalendarioData(
  modo: CalendarioModo,
  ref: Date,
): Promise<CalendarioData> {
  const { start, end } = getRange(modo, ref);

  const [receitasRes, despesasRes] = await Promise.all([
    supabase
      .from('receitas')
      .select(
        'id, descricao, valor, data_vencimento, status, cliente:clientes(nome, empresa_fonte)',
      )
      .gte('data_vencimento', start)
      .lte('data_vencimento', end),
    supabase
      .from('despesas')
      .select(
        'id, descricao, valor, data_vencimento, status, fornecedor, categoria:categorias(nome, cor)',
      )
      .gte('data_vencimento', start)
      .lte('data_vencimento', end)
      .is('fatura_id', null)
      .neq('fornecedor', '[pagamento-fatura]'),
  ]);

  const receitas = receitasRes.data || [];
  const despesas = despesasRes.data || [];

  const days: Record<string, DayTransactions> = {};

  const ensureDay = (d: string) => {
    if (!days[d]) days[d] = { date: d, receitas: 0, despesas: 0, items: [] };
  };

  receitas.forEach((r) => {
    const d = r.data_vencimento;
    ensureDay(d);
    days[d].receitas += Number(r.valor);
    days[d].items.push({
      id: r.id,
      tipo: 'receita',
      descricao: r.descricao,
      valor: Number(r.valor),
      status: r.status,
      clienteOuFornecedor: (r.cliente as any)?.nome || '',
      empresaFonte: (r.cliente as any)?.empresa_fonte || null,
    });
  });

  despesas.forEach((d) => {
    const dt = d.data_vencimento;
    ensureDay(dt);
    days[dt].despesas += Number(d.valor);
    days[dt].items.push({
      id: d.id,
      tipo: 'despesa',
      descricao: d.descricao,
      valor: Number(d.valor),
      status: d.status,
      clienteOuFornecedor: d.fornecedor || '',
      categoria: (d.categoria as any)?.nome,
      categoriaCor: (d.categoria as any)?.cor,
    });
  });

  // Top 5 despesas by category
  const catMap: Record<string, { valor: number; cor: string }> = {};
  despesas.forEach((d) => {
    const nome = (d.categoria as any)?.nome || 'Outros';
    const cor = (d.categoria as any)?.cor || '#6B7280';
    if (!catMap[nome]) catMap[nome] = { valor: 0, cor };
    catMap[nome].valor += Number(d.valor);
  });

  const topDespesas = Object.entries(catMap)
    .map(([categoria, data]) => ({ categoria, ...data }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const totalDespesas = topDespesas.reduce((s, d) => s + d.valor, 0);

  return { days, topDespesas, totalDespesas };
}

/**
 * Calendar data hook supporting three modes.
 * - mes: full month range (default, backward compatible)
 * - semana: monday-to-sunday range of the reference date
 * - hoje: a single day range
 */
export function useCalendario(
  yearOrModo: number | CalendarioModo,
  monthOrRef?: number | Date,
  refDate?: Date,
) {
  // Backward-compatible signature: useCalendario(year, month)
  let modo: CalendarioModo;
  let ref: Date;

  if (typeof yearOrModo === 'number') {
    modo = 'mes';
    ref = new Date(yearOrModo, (monthOrRef as number) ?? 0, 1);
  } else {
    modo = yearOrModo;
    ref = (monthOrRef as Date) || refDate || new Date();
  }

  const cacheKey = format(ref, 'yyyy-MM-dd');

  const { data, isLoading } = useQuery({
    queryKey: ['calendario', modo, cacheKey],
    queryFn: () => fetchCalendarioData(modo, ref),
  });

  return {
    days: data?.days || {},
    topDespesas: data?.topDespesas || [],
    totalDespesas: data?.totalDespesas || 0,
    isLoading,
  };
}
