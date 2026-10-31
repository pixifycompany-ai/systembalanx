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

const TONE_TEXT: Record<Exclude<KpiTone, 'steel'>, string> = {
  green: 'text-[hsl(var(--success-fg))]',
  red: 'text-[hsl(var(--danger-fg))]',
  amber: 'text-[hsl(var(--warning-fg))]',
};

/**
 * Faixa de 3 KPIs colados (divisória de 1px), padrão BALANX:
 * valores coloridos pelo tom; o tom 'steel' vira a célula navy de destaque (ex.: saldo).
 */
export function KpiTriple({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div
      className={cn(
        'mb-5 grid gap-px overflow-hidden rounded-[20px] border border-border bg-border',
        items.length === 2 ? 'grid-cols-2' : items.length >= 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3',
        className,
      )}
    >
      {items.map((k) => {
        const navy = k.tone === 'steel';
        return (
          <div
            key={k.label}
            className={cn('flex min-w-0 flex-col gap-1 px-3 py-3 md:px-5 md:py-4', navy ? 'text-white' : 'bg-surface')}
            style={navy ? { background: 'hsl(var(--navy-card))' } : undefined}
          >
            <span className={cn('truncate text-[11px] md:text-[13px]', navy ? 'text-white/75' : 'text-foreground-muted')}>
              {k.label}
            </span>
            <span
              className={cn(
                'whitespace-nowrap font-heading text-[13px] font-semibold tabular-nums tracking-[-0.02em] md:text-[22px]',
                !navy && TONE_TEXT[k.tone as Exclude<KpiTone, 'steel'>],
              )}
            >
              {k.format === 'count' ? k.value : formatCurrency(k.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
