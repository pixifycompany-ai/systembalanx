import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SectionCard } from '@/components/shared/SectionCard';
import { formatCurrencyShort } from '@/utils/formatters';
import { ChartLegend } from '@/components/relatorios/ReportKit';
import { CHART, axisProps, barCursor, gridProps, tooltipProps } from '@/components/relatorios/chartTheme';
import type { RevenueProjection } from '@/hooks/useAnalises';

interface RevenueProjectionChartProps {
  data: RevenueProjection[];
}

export function RevenueProjectionChart({ data }: RevenueProjectionChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <SectionCard className="animate-fade-in" title="Projeção de Receitas - Próximos 6 Meses">
      <ChartLegend
        className="mb-3"
        items={[
          { label: 'Recorrente', color: CHART.primary },
          { label: 'Variável', color: CHART.secondary },
        ]}
      />
      <div className="h-[260px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="mes" {...axisProps} />
            <YAxis {...axisProps} width={60} tickFormatter={formatCurrencyShort} />
            <Tooltip
              {...tooltipProps}
              cursor={barCursor}
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'receitaRecorrente' ? 'Recorrente' : 'Variável'
              ]}
            />
            <Bar dataKey="receitaRecorrente" stackId="a" fill={CHART.primary} radius={[0, 0, 0, 0]} maxBarSize={40} />
            <Bar dataKey="receitaVariavel" stackId="a" fill={CHART.secondary} radius={[6, 6, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
