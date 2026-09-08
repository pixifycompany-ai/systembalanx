import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';

export type KpiTone = 'green' | 'red' | 'amber' | 'steel';

export interface KpiItem {
  label: string;
  value: number;
  tone: KpiTone;
  /** 'currency' (padrão) formata em R$; 'count' mostra o número puro. */
  format?: 'currency' | 'count';
}

const TONE_BAR: Record<KpiTone, string> = {
  green: 'bg-[hsl(var(--success))]',
  red: 'bg-[hsl(var(--danger))]',
  amber: 'bg-[hsl(var(--warning))]',
  steel: 'bg-primary',
};

/**
 * 3 KPIs lado a lado, compactos, com faixa colorida no topo — igual ao `kpi3`
 * do mockup AURO. Fica 3-up mesmo em celular; valores em centavos completos.
 */
export function KpiTriple({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div className={cn('grid grid-cols-3 gap-1.5 md:gap-3 mb-5', className)}>
      {items.map((k) => (
        <div
          key={k.label}
          className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface/70 backdrop-blur-xl px-2.5 py-3 md:px-4 md:py-4"
        >
          <span className={cn('absolute inset-x-0 top-0 h-[3px]', TONE_BAR[k.tone])} />
          <div className="truncate text-[8.5px] md:text-[10px] font-semibold uppercase tracking-wide text-foreground-muted">
            {k.label}
          </div>
          <div className="mt-1.5 whitespace-nowrap text-[11px] md:text-lg font-bold tabular-nums tracking-tight text-foreground">
            {k.format === 'count' ? k.value : formatCurrency(k.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
