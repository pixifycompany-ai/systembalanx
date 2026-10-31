import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import type { FluxoCaixaData } from '@/hooks/useRelatorios';
import { SectionCard } from '@/components/shared/SectionCard';
import { ChartLegend } from './ReportKit';
import { CHART, axisProps, gridProps, tooltipProps } from './chartTheme';

interface FluxoCaixaTabProps {
  data: FluxoCaixaData;
}

const LABELS: Record<string, string> = { entradas: 'Entradas', saidas: 'Saídas', saldo: 'Acumulado no período' };

export function FluxoCaixaTab({ data }: FluxoCaixaTabProps) {
  return (
    <SectionCard
      className="animate-fade-in"
      title="Fluxo de Caixa realizado — resultado acumulado no período"
      description="Entradas recebidas × saídas pagas em cada mês (o que de fato entrou e saiu do banco, inclusive distribuição de lucros). Mesmo critério dos cards da Início."
    >
      <ChartLegend
        className="mb-3"
        items={[
          { label: LABELS.entradas, color: CHART.primary },
          { label: LABELS.saidas, color: CHART.danger, dashed: true },
          { label: LABELS.saldo, color: CHART.ink },
        ]}
      />
      <div className="h-[260px] md:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data.chartData} margin={{ top: 5, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="mes" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              {...tooltipProps}
              formatter={(value: number, name: string) => [formatCurrency(value), LABELS[name] || name]}
            />
            <Line type="monotone" dataKey="entradas" stroke={CHART.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="saidas" stroke={CHART.danger} strokeWidth={2} strokeDasharray="5 6" dot={false} activeDot={{ r: 4 }} />
            <Line type="monotone" dataKey="saldo" stroke={CHART.ink} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: CHART.ink }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}
