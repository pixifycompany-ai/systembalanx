import { TrendingDown, TrendingUp } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { SectionCard } from '@/components/shared/SectionCard';
import { cn } from '@/lib/utils';
import { CHART, tooltipProps } from '@/components/relatorios/chartTheme';
import type { ChurnData } from '@/hooks/useAnalises';

interface ChurnRateChartProps {
  churnData: ChurnData;
}

export function ChurnRateChart({ churnData }: ChurnRateChartProps) {
  const { taxaChurnMensal, clientesPerdidos, clientesNovos, clientesAtivos, historicoChurn } = churnData;

  // Calculate variation vs previous month
  const variacao = historicoChurn.length >= 2
    ? taxaChurnMensal - historicoChurn[historicoChurn.length - 2].taxa
    : 0;

  const isPositive = variacao <= 0; // Lower churn is better

  return (
    <SectionCard title="Taxa de Churn" description="Dados do último mês completo" className="flex h-full flex-col animate-fade-in">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-heading text-[34px] font-semibold leading-none tabular-nums tracking-[-0.03em] text-foreground">
          {taxaChurnMensal.toFixed(1)}%
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold',
            isPositive ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg',
          )}
        >
          {isPositive ? <TrendingDown className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
          {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}% vs mês anterior
        </span>
      </div>

      <div className="my-4 h-20 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={historicoChurn} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="mes" tick={false} axisLine={false} tickLine={false} height={4} />
            <Tooltip
              {...tooltipProps}
              formatter={(value: number) => [`${value.toFixed(1)}%`, 'Taxa']}
              labelFormatter={(label) => `Mês: ${label}`}
            />
            <Line type="monotone" dataKey="taxa" stroke={CHART.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[16px] border border-border bg-border">
        <div className="flex flex-col gap-0.5 bg-surface px-3 py-2.5">
          <span className="text-[11px] text-foreground-muted">Novos</span>
          <span className="font-heading text-lg font-semibold tabular-nums text-[hsl(var(--success-fg))]">+{clientesNovos}</span>
        </div>
        <div className="flex flex-col gap-0.5 bg-surface px-3 py-2.5">
          <span className="text-[11px] text-foreground-muted">Perdidos</span>
          <span className="font-heading text-lg font-semibold tabular-nums text-[hsl(var(--danger-fg))]">-{clientesPerdidos}</span>
        </div>
        <div className="flex flex-col gap-0.5 bg-surface px-3 py-2.5">
          <span className="text-[11px] text-foreground-muted">Ativos</span>
          <span className="font-heading text-lg font-semibold tabular-nums text-foreground">{clientesAtivos}</span>
        </div>
      </div>
    </SectionCard>
  );
}
