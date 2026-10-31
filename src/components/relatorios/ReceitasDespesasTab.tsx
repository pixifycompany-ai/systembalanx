import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import type { RecDespResumo } from '@/hooks/useRelatorios';
import { SectionCard } from '@/components/shared/SectionCard';
import { ChartLegend, KpiStrip } from './ReportKit';
import { CHART, axisProps, barCursor, gridProps, tooltipProps } from './chartTheme';

interface ReceitasDespesasTabProps {
  data: RecDespResumo;
}

const BRAND_TOKEN: Record<string, string> = {
  PIXIFY: 'var(--brand-pixify)',
  REVVUE: 'var(--brand-revvue)',
  CLARIO: 'var(--brand-clario)',
  TABELIO: 'var(--brand-tabelio)',
};

export function ReceitasDespesasTab({ data }: ReceitasDespesasTabProps) {
  const totalEmpresas = data.receitaPorEmpresa.reduce((s, e) => s + e.valor, 0);

  return (
    <div className="animate-fade-in space-y-4 md:space-y-6">
      <KpiStrip
        items={[
          { label: 'Total Receitas', value: formatCurrency(data.totalReceitas), tone: 'success' },
          { label: 'Total Despesas', value: formatCurrency(data.totalDespesas), tone: 'danger' },
          { label: 'Resultado', value: formatCurrency(data.resultado), highlight: true },
          { label: 'Margem', value: `${data.margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, tone: data.margem >= 0 ? 'default' : 'danger' },
        ]}
      />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-5">
        {/* Receitas vs despesas por mês */}
        <SectionCard className="xl:col-span-3" title="Receitas vs Despesas por Mês">
          <ChartLegend
            className="mb-3"
            items={[
              { label: 'Receitas', color: CHART.primary },
              { label: 'Despesas', color: CHART.secondary },
            ]}
          />
          <div className="h-[260px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.barData} margin={{ top: 5, right: 8, left: -8, bottom: 0 }} barGap={4}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="mes" {...axisProps} />
                <YAxis {...axisProps} width={44} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  {...tooltipProps}
                  cursor={barCursor}
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'receitas' ? 'Receitas' : 'Despesas']}
                />
                <Bar dataKey="receitas" fill={CHART.primary} radius={[6, 6, 0, 0]} maxBarSize={28} />
                <Bar dataKey="despesas" fill={CHART.secondary} radius={[6, 6, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Receita por empresa-fonte */}
        <SectionCard className="xl:col-span-2" title="Receita por Empresa">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-1">
            {data.receitaPorEmpresa.map((item) => {
              const color = BRAND_TOKEN[item.empresa];
              const percent = totalEmpresas > 0 ? (item.valor / totalEmpresas) * 100 : 0;
              return (
                <div key={item.empresa} className="rounded-[16px] border border-border p-3.5">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />
                    <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
                      {item.empresa}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                    <p className="font-heading text-base font-semibold tabular-nums tracking-[-0.02em] text-foreground md:text-lg">
                      {formatCurrency(item.valor)}
                    </p>
                    <p className="text-[11.5px] tabular-nums text-foreground-muted">{percent.toFixed(1)}% do total</p>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: `hsl(${color})` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
