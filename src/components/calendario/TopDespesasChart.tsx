import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatters';
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
      <div className="metric-card animate-fade-in flex items-center justify-center min-h-[300px]">
        <p className="text-sm text-muted-foreground">Sem despesas neste mês</p>
      </div>
    );
  }

  return (
    <div className="metric-card animate-fade-in">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
        Top 5 Despesas
      </h3>

      <div className="flex flex-col md:flex-row items-center gap-4">
        {/* Donut */}
        <div className="relative w-[180px] h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="valor"
                nameKey="categoria"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [formatCurrency(value), 'Valor']}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-sm font-semibold text-foreground">{formatCurrencyShort(total)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 flex-1">
          {data.map((item, i) => (
            <div key={item.categoria} className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              <span className="text-xs text-foreground flex-1 truncate">{item.categoria}</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatCurrencyShort(item.valor)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
