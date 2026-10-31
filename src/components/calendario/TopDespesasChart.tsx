import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatters';
import { SectionCard } from '@/components/shared/SectionCard';
import { EmptyNote } from '@/components/relatorios/ReportKit';
import { tooltipProps } from '@/components/relatorios/chartTheme';
import type { TopDespesaCategoria } from '@/hooks/useCalendario';

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

interface TopDespesasChartProps {
  data: TopDespesaCategoria[];
  total: number;
}

export function TopDespesasChart({ data, total }: TopDespesasChartProps) {
  if (data.length === 0) {
    return (
      <SectionCard title="Top 5 Despesas" className="animate-fade-in">
        <EmptyNote>Sem despesas neste mês</EmptyNote>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="Top 5 Despesas" className="animate-fade-in">
      <div className="flex flex-col items-center gap-5 md:flex-row md:gap-8">
        {/* Donut */}
        <div className="relative h-[180px] w-[180px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="valor"
                nameKey="categoria"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={82}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipProps} formatter={(value: number) => [formatCurrency(value), 'Valor']} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] text-foreground-muted">Total</span>
            <span className="font-heading text-base font-semibold tabular-nums text-foreground">{formatCurrencyShort(total)}</span>
          </div>
        </div>

        {/* Legenda em lista */}
        <div className="w-full flex-1">
          {data.map((item, i) => {
            const pctVal = total > 0 ? Math.round((item.valor / total) * 100) : 0;
            return (
              <div key={item.categoria} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{item.categoria}</span>
                <span className="text-[12px] tabular-nums text-foreground-muted">{pctVal}%</span>
                <span className="w-20 text-right font-heading text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrencyShort(item.valor)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </SectionCard>
  );
}
