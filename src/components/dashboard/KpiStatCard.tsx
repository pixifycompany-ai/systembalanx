import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { HexWatermark } from '@/components/shared/NavySurface';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW, NAVY_TONE } from '@/components/shared/navyTokens';

/** Variação % entre atual e anterior; null quando não há base de comparação. */
export function variacaoPct(atual: number, anterior: number | undefined | null): number | null {
  if (anterior == null || anterior === 0) return null;
  return ((atual - anterior) / Math.abs(anterior)) * 100;
}

/** "+23,4%" / "-9,9%" */
export function formatDelta(delta: number): string {
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')}%`;
}

interface KpiStatCardProps {
  label: string;
  value: number;
  /** Ícone opcional ao lado do rótulo. */
  icon?: LucideIcon;
  /** Variação % vs período anterior (null = sem comparação). */
  delta?: number | null;
  /** true quando subir é ruim (ex.: despesas) — inverte verde/vermelho. */
  invertDelta?: boolean;
  /** Texto de apoio abaixo do valor (ex.: "vs mesmo período de set"). */
  hint?: string;
  /** Célula navy de destaque (ex.: saldo). Só uma por tela. */
  highlight?: boolean;
  onClick?: () => void;
  /** Conteúdo extra no rodapé do cartão (ex.: barra da meta). Fica fora da área clicável. */
  children?: React.ReactNode;
}

export function KpiStatCard({ label, value, icon: Icon, delta, invertDelta, hint, highlight, onClick, children }: KpiStatCardProps) {
  const temDelta = typeof delta === 'number' && Number.isFinite(delta);
  const bom = temDelta && (invertDelta ? delta! <= 0 : delta! >= 0);
  const Wrapper = onClick ? 'button' : 'div';

  const classes = cn(
    'group relative isolate flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-[24px] p-5 text-left transition-colors',
    highlight ? 'border-0 text-white' : 'border border-border bg-surface text-foreground',
    onClick && !children && 'cursor-pointer',
    onClick && !highlight && 'hover:border-border-strong',
  );
  const estilo = highlight ? { background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW } : undefined;
  const conteudo = (
    <>

      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium',
            highlight ? 'text-white/70' : 'text-foreground-muted',
          )}
        >
          {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="truncate">{label}</span>
        </span>
        {onClick && (
          <ArrowUpRight
            aria-hidden
            className={cn(
              'h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100',
              highlight ? 'text-white/70' : 'text-foreground-muted',
            )}
          />
        )}
      </div>

      <span className="whitespace-nowrap font-heading text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums xl:text-[26px] 2xl:text-[28px]">
        {formatCurrency(value)}
      </span>

      {(temDelta || hint) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {temDelta && (
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-semibold leading-none tabular-nums',
                highlight ? 'bg-white/[0.12]' : bom ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg',
              )}
              style={highlight ? { color: bom ? NAVY_TONE.success : NAVY_TONE.danger } : undefined}
              title={hint}
            >
              {formatDelta(delta!)}
            </span>
          )}
          {hint && (
            <span className={cn('text-[12px]', highlight ? 'text-white/70' : 'text-foreground-muted')}>{hint}</span>
          )}
        </div>
      )}
    </>
  );

  if (children) {
    return (
      <div className={classes} style={estilo}>
        {highlight && <HexWatermark className="-right-10 -top-8 bottom-auto h-48" />}
        {onClick
          ? <button type="button" onClick={onClick} className="flex w-full min-w-0 flex-col gap-3 text-left">{conteudo}</button>
          : <div className="flex min-w-0 flex-col gap-3">{conteudo}</div>}
        <div className="mt-auto">{children}</div>
      </div>
    );
  }

  return (
    <Wrapper type={onClick ? 'button' : undefined} onClick={onClick} className={classes} style={estilo}>
      {highlight && <HexWatermark className="-right-10 -top-8 bottom-auto h-48" />}
      {conteudo}
    </Wrapper>
  );
}
