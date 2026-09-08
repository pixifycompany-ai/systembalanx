import { formatCurrency } from '@/utils/formatters';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReceitaPorEmpresa } from '@/hooks/useDashboard';

const BRAND_TOKEN: Record<string, string> = {
  PIXIFY: 'var(--brand-pixify)',
  REVVUE: 'var(--brand-revvue)',
  CLARIO: 'var(--brand-clario)',
  TABELIO: 'var(--brand-tabelio)',
};

interface BrandRevenueWidgetProps {
  data: ReceitaPorEmpresa[];
}

export function BrandRevenueWidget({ data }: BrandRevenueWidgetProps) {
  return (
    <div className="metric-card">
      <div className="mb-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Receita por Marca
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Mês atual vs mês anterior</p>
      </div>
      {/* Mobile: snap-scroll pills. Desktop: 4-col grid */}
      <div className="scroll-pills md:grid md:grid-cols-4 md:gap-3 -mx-3 px-3 py-1 md:mx-0 md:px-0 [&]:overflow-y-visible">
        {data.map((item) => {
          const color = BRAND_TOKEN[item.empresa];
          const isUp = item.delta_percent >= 0;
          return (
            <div
              key={item.empresa}
              className="rounded-lg border p-3 transition-all hover:shadow-xs min-w-[160px] md:min-w-0"
              style={{
                borderColor: `hsl(${color} / 0.2)`,
                backgroundColor: `hsl(${color} / 0.04)`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-2">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: `hsl(${color})` }}
                />
                <span
                  className="text-[10px] font-semibold uppercase tracking-wide truncate"
                  style={{ color: `hsl(${color})` }}
                >
                  {item.empresa}
                </span>
              </div>
              <p
                className="text-sm md:text-base font-semibold tabular-nums text-foreground truncate"
                title={formatCurrency(item.valor_mes)}
              >
                {formatCurrency(item.valor_mes)}
              </p>
              <div
                className={cn(
                  'flex items-center gap-0.5 text-[11px] mt-1 tabular-nums',
                  isUp ? 'text-success' : 'text-destructive',
                )}
              >
                {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {isUp ? '+' : ''}
                {item.delta_percent.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
