import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { SectionCard } from '@/components/shared/SectionCard';
import { formatCurrencyShort } from '@/utils/formatters';
import { ChartLegend, RangeChips } from '@/components/relatorios/ReportKit';
import { CHART, axisProps, gridProps, tooltipProps } from '@/components/relatorios/chartTheme';
import type { LTVEvolutionData } from '@/hooks/useAnalises';

interface LTVEvolutionChartProps {
  data: LTVEvolutionData[];
}

const RANGES = [
  { value: '3', label: '3M' },
  { value: '6', label: '6M' },
  { value: '12', label: '12M' },
] as const;
type RangeValue = (typeof RANGES)[number]['value'];

export function LTVEvolutionChart({ data }: LTVEvolutionChartProps) {
  const [range, setRange] = useState<RangeValue>('12');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Recorte só de exibição (a série completa continua vindo do hook).
  const serie = data.slice(-Number(range));

  return (
    <SectionCard
      className="animate-fade-in"
      title="Evolução do LTV"
      description={`Últimos ${range} meses`}
      action={<RangeChips<RangeValue> value={range} onChange={setRange} options={RANGES} />}
    >
      <ChartLegend
        className="mb-3"
        items={[
          { label: 'LTV Médio', color: CHART.primary },
          { label: 'Ticket Médio', color: CHART.secondary, dashed: true },
        ]}
      />
      <div className="h-[260px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={serie} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="mes" {...axisProps} />
            <YAxis yAxisId="left" {...axisProps} width={56} tickFormatter={formatCurrencyShort} />
            <YAxis yAxisId="right" orientation="right" {...axisProps} width={56} tickFormatter={formatCurrencyShort} />
            <Tooltip
              {...tooltipProps}
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'ltv' ? 'LTV Médio' : 'Ticket Médio'
              ]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="ltv"
              stroke={CHART.primary}
              strokeWidth={2.5}
              dot={{ r: 3, strokeWidth: 0, fill: CHART.primary }}
              activeDot={{ r: 5 }}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="ticketMedio"
              stroke={CHART.secondary}
              strokeWidth={2}
              strokeDasharray="5 6"
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
