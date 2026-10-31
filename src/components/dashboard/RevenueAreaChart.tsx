import { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TooltipProps } from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { FaturamentoVsDespesas } from '@/types/finance';

interface RevenueAreaChartProps {
  data3m: FaturamentoVsDespesas[];
  data6m: FaturamentoVsDespesas[];
  data12m: FaturamentoVsDespesas[];
  className?: string;
}

const PERIODOS = [
  { value: '3', label: '3M' },
  { value: '6', label: '6M' },
  { value: '12', label: '12M' },
] as const;
type Periodo = (typeof PERIODOS)[number]['value'];

const COR_RECEITA = 'hsl(var(--primary))';
const COR_DESPESA = 'hsl(var(--danger))';

const kFmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`);

/** Tooltip único: receitas, despesas e o resultado do mês. */
function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const receita = Number(payload.find((p) => p.dataKey === 'receita')?.value ?? 0);
  const despesa = Number(payload.find((p) => p.dataKey === 'despesa')?.value ?? 0);
  const resultado = receita - despesa;
  return (
    <div className="rounded-xl border border-border/70 bg-popover/95 px-3.5 py-3 text-xs shadow-xl backdrop-blur-xl">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      <div className="flex gap-4">
        <div className="border-l-2 pl-2" style={{ borderColor: COR_RECEITA }}>
          <p className="text-foreground-muted">Receitas</p>
          <p className="text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(receita)}</p>
        </div>
        <div className="border-l-2 pl-2" style={{ borderColor: COR_DESPESA }}>
          <p className="text-foreground-muted">Despesas</p>
          <p className="text-[13px] font-semibold tabular-nums text-foreground">{formatCurrency(despesa)}</p>
        </div>
      </div>
      <p className={cn('mt-2 border-t border-border/60 pt-1.5 font-medium tabular-nums', resultado >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
        Resultado {resultado >= 0 ? '+' : ''}{formatCurrency(resultado)}
      </p>
    </div>
  );
}

export function RevenueAreaChart({ data3m, data6m, data12m, className }: RevenueAreaChartProps) {
  const [period, setPeriod] = useState<Periodo>('6');
  const data = { '3': data3m, '6': data6m, '12': data12m }[period];

  return (
    <div
      className={cn(
        'auro-card flex h-[320px] md:h-[400px] flex-col overflow-hidden rounded-2xl border border-border/60 bg-surface/70 p-5 backdrop-blur-xl animate-fade-in',
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-foreground">Receitas × Despesas</h3>
          <div className="mt-1 flex items-center gap-3 text-[11.5px] text-foreground-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COR_RECEITA }} />Receitas</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: COR_DESPESA }} />Despesas</span>
          </div>
        </div>
        <div className="inline-flex rounded-full border border-border/60 bg-background/40 p-0.5">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              className={cn(
                'h-7 rounded-full px-3 text-[11.5px] font-semibold transition-colors',
                period === p.value ? 'bg-primary text-primary-foreground' : 'text-foreground-muted hover:text-foreground',
              )}
              aria-pressed={period === p.value}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR_RECEITA} stopOpacity={0.42} />
                <stop offset="100%" stopColor={COR_RECEITA} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COR_DESPESA} stopOpacity={0.22} />
                <stop offset="100%" stopColor={COR_DESPESA} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 4" stroke="hsl(var(--border))" strokeOpacity={0.6} vertical={false} />
            <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} dy={6} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={kFmt} width={44} />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: 'hsl(var(--foreground))', strokeOpacity: 0.35, strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="despesa"
              stroke={COR_DESPESA}
              strokeWidth={2}
              strokeOpacity={0.85}
              fill="url(#gradDespesa)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: COR_DESPESA }}
            />
            <Area
              type="monotone"
              dataKey="receita"
              stroke={COR_RECEITA}
              strokeWidth={2.5}
              fill="url(#gradReceita)"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 3, stroke: 'hsl(var(--background))', fill: COR_RECEITA }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
