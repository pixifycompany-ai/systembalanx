import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { HexWatermark } from '@/components/shared/NavySurface';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW } from '@/components/shared/navyTokens';

/** Variação % entre atual e anterior; null quando não há base de comparação. */
export function variacaoPct(atual: number, anterior: number | undefined | null): number | null {
  if (anterior == null || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

interface KpiStatCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  /** Variação % vs período anterior (null = sem comparação). */
  delta?: number | null;
  /** true quando subir é ruim (ex.: despesas) — inverte verde/vermelho. */
  invertDelta?: boolean;
  /** Texto de apoio abaixo do valor (ex.: "vs mesmo período de set"). */
  hint?: string;
  highlight?: boolean;
  onClick?: () => void;
}

export function KpiStatCard({ label, value, icon: Icon, delta, invertDelta, hint, highlight, onClick }: KpiStatCardProps) {
  const temDelta = typeof delta === 'number' && Number.isFinite(delta);
  const bom = temDelta && (invertDelta ? delta! <= 0 : delta! >= 0);
  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'group relative isolate w-full overflow-hidden rounded-2xl p-5 text-left transition-all animate-fade-in',
        highlight
          ? 'border-0 text-white'
          : 'auro-card border border-border bg-surface text-foreground',
        onClick && 'cursor-pointer hover:-translate-y-0.5',
        onClick && !highlight && 'hover:border-primary/40',
      )}
      style={highlight ? { background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW } : undefined}
    >
      {highlight && <HexWatermark className="h-36 -right-6 -bottom-8" />}
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'grid h-10 w-10 place-items-center rounded-full border',
            highlight ? 'border-white/20 bg-white/10' : 'border-border bg-surface-2',
          )}
        >
          <Icon className={cn('h-[18px] w-[18px]', highlight ? 'text-white' : 'text-foreground/80')} />
        </span>
        {onClick && (
          <ArrowUpRight
            className={cn(
              'h-4 w-4 transition-opacity',
              highlight ? 'text-white/70' : 'text-foreground-muted',
              'opacity-60 group-hover:opacity-100',
            )}
          />
        )}
      </div>

      <p className={cn('mt-5 text-[13px] font-medium', highlight ? 'text-white/80' : 'text-foreground-muted')}>{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="text-[26px] font-semibold leading-tight tracking-[-0.02em] tabular-nums">{formatCurrency(value)}</span>
        {temDelta && (
          <span
            className={cn(
              'inline-flex h-[22px] items-center rounded-md border px-1.5 text-[11px] font-semibold tabular-nums',
              highlight
                ? 'border-white/25 bg-white/10 text-white'
                : bom
                  ? 'border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]'
                  : 'border-[hsl(var(--danger))]/30 bg-[hsl(var(--danger))]/10 text-[hsl(var(--danger))]',
            )}
            title={hint}
          >
            {delta! >= 0 ? '+' : ''}
            {delta!.toFixed(1).replace('.', ',')}%
          </span>
        )}
      </div>
      {hint && <p className={cn('mt-1.5 text-[11.5px]', highlight ? 'text-white/70' : 'text-foreground-muted')}>{hint}</p>}
    </Wrapper>
  );
}
