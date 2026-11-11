import { SectionCard } from '@/components/shared/SectionCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/utils/formatters';

export interface CategoryExpense {
  categoria: string;
  valor: number;
  cor: string;
  /** null = "Sem categoria". */
  categoria_id?: string | null;
}

interface ExpensesByCategoryChartProps {
  data: CategoryExpense[];
  title?: string;
  /** Clique numa fatia ou na legenda: abre os lançamentos da categoria. */
  onCategoriaClick?: (item: CategoryExpense) => void;
}

export function ExpensesByCategoryChart({ 
  data, 
  title = 'Despesas por Categoria',
  onCategoriaClick,
}: ExpensesByCategoryChartProps) {
  const total = data.reduce((sum, item) => sum + item.valor, 0);

  // Custom label renderer
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    if (percent < 0.05) return null; // Don't show label for slices < 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryExpense }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = ((item.valor / total) * 100).toFixed(1);
      return (
        <div className="rounded-2xl border border-border bg-popover px-3.5 py-3 shadow-lg">
          <p className="text-[13px] font-semibold text-foreground">{item.categoria}</p>
          <p className="text-[12px] tabular-nums text-foreground-muted">
            {formatCurrency(item.valor)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const renderLegend = (props: unknown) => {
    const { payload } = props as { payload?: Array<{ value: string; color?: string; payload: { valor: number } }> };
    if (!payload) return null;

    return (
      <div className="mt-4 flex flex-wrap justify-center gap-x-3 gap-y-1.5">
        {payload.map((entry, index) => (
          <button
            key={index}
            type="button"
            disabled={!onCategoriaClick}
            onClick={() => { const item = data.find((d) => d.categoria === entry.value); if (item) onCategoriaClick?.(item); }}
            className="flex items-center gap-1.5 text-[12px] enabled:hover:underline"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color || 'hsl(var(--foreground-muted))' }}
            />
            <span className="text-foreground-muted">{entry.value}</span>
          </button>
        ))}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <SectionCard title={title}>
        <div className="flex h-[200px] items-center justify-center text-sm text-foreground-muted">
          Nenhuma despesa registrada
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={title}
      className="overflow-hidden"
      action={
        <span className="text-[13px] text-foreground-muted">
          Total <span className="font-heading font-semibold tabular-nums text-foreground">{formatCurrency(total)}</span>
        </span>
      }
    >

      <div className="h-[200px] md:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              innerRadius={40}
              dataKey="valor"
              nameKey="categoria"
              className={onCategoriaClick ? 'cursor-pointer' : undefined}
              onClick={(entry: { payload?: CategoryExpense }) => { if (entry?.payload) onCategoriaClick?.(entry.payload); }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.cor} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

// Mock data for development
export const MOCK_EXPENSES_BY_CATEGORY: CategoryExpense[] = [
  { categoria: 'Ferramentas e Software', valor: 2500, cor: '#3B82F6' },
  { categoria: 'Marketing', valor: 1800, cor: '#EC4899' },
  { categoria: 'Infraestrutura', valor: 1200, cor: '#10B981' },
  { categoria: 'Pessoal', valor: 3200, cor: '#8B5CF6' },
  { categoria: 'Impostos', valor: 950, cor: '#EF4444' },
  { categoria: 'Outros', valor: 508, cor: '#6B7280' },
];
