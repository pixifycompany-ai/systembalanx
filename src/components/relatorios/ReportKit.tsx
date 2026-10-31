// Peças visuais compartilhadas pelas telas de análise (Relatórios, Análises, Calendário):
// tema dos gráficos recharts, legenda, chips de período, faixa de KPIs e o botão "?" de ajuda.
// Só apresentação — nenhum cálculo aqui.

import type { ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/** Botão "?" com a explicação de como o número é calculado. */
export function InfoHint({ text, onNavy }: { text: ReactNode; onNavy?: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Como é calculado"
          className={cn(
            'no-touch-min inline-grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors',
            onNavy ? 'text-white/75 hover:text-white' : 'text-foreground-muted hover:text-foreground',
          )}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 text-xs leading-relaxed text-foreground-muted">
        {text}
      </PopoverContent>
    </Popover>
  );
}

/** Título de bloco com o "?" ao lado. */
export function TitleWithInfo({ title, info }: { title: ReactNode; info?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{title}</span>
      {info && <InfoHint text={info} />}
    </span>
  );
}

export interface LegendItem {
  label: string;
  color: string;
  dashed?: boolean;
}

/** Legenda compacta (pontos/tracinhos + rótulo), substitui a <Legend> padrão do recharts. */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px] text-foreground-muted', className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          {it.dashed ? (
            <span className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: it.color }} />
          ) : (
            <span className="h-2 w-2 rounded-full" style={{ background: it.color }} />
          )}
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Chips de período (3M / 6M / 12M…) no cabeçalho de um gráfico; selecionado = navy. */
export function RangeChips<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div role="group" className={cn('flex items-center gap-1.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'no-touch-min h-8 rounded-full px-3 text-[12px] font-semibold transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'border border-border bg-surface text-foreground-muted hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export type KpiStripTone = 'default' | 'success' | 'danger' | 'warning';

export interface KpiStripItem {
  label: string;
  value: string;
  hint?: string;
  info?: string;
  tone?: KpiStripTone;
  /** Célula navy de destaque (no máximo uma por tela). */
  highlight?: boolean;
}

const STRIP_TONE: Record<KpiStripTone, string> = {
  default: 'text-foreground',
  success: 'text-[hsl(var(--success-fg))]',
  danger: 'text-[hsl(var(--danger-fg))]',
  warning: 'text-[hsl(var(--warning-fg))]',
};

/**
 * Faixa de KPIs colados (divisória de 1px), no mesmo desenho do KpiTriple,
 * mas aceitando valores já formatados (%, meses, "x") e o "?" de ajuda.
 */
export function KpiStrip({ items, className }: { items: KpiStripItem[]; className?: string }) {
  const odd = items.length % 2 === 1;
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-border bg-border',
        items.length >= 4 ? 'md:grid-cols-4' : items.length === 3 ? 'md:grid-cols-3' : '',
        odd && '[&>*:first-child]:col-span-2 md:[&>*:first-child]:col-span-1',
        className,
      )}
    >
      {items.map((k) => (
        <div
          key={k.label}
          className={cn('flex min-w-0 flex-col gap-1 px-4 py-3.5 md:px-5 md:py-4', k.highlight ? 'text-white' : 'bg-surface')}
          style={k.highlight ? { background: 'hsl(var(--navy-card))' } : undefined}
        >
          <span className="flex min-w-0 items-center gap-1">
            <span className={cn('truncate text-[12px] md:text-[13px]', k.highlight ? 'text-white/75' : 'text-foreground-muted')}>
              {k.label}
            </span>
            {k.info && <InfoHint text={k.info} onNavy={k.highlight} />}
          </span>
          <span
            className={cn(
              'truncate font-heading text-[19px] font-semibold tabular-nums leading-tight tracking-[-0.02em] md:text-[24px]',
              !k.highlight && STRIP_TONE[k.tone ?? 'default'],
            )}
          >
            {k.value}
          </span>
          {k.hint && (
            <span className={cn('truncate text-[11.5px]', k.highlight ? 'text-white/70' : 'text-foreground-muted')}>
              {k.hint}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/** Bloco de lista mobile: linhas separadas por borda (padrão Fluxo). */
export function MobileList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('md:hidden', className)}>{children}</div>;
}

/** Linha de lista mobile dentro de um SectionCard flush. */
export function MobileRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 border-t border-border px-4 py-3', className)}>
      {children}
    </div>
  );
}

/** Mensagem curta de "sem dados" dentro de um bloco. */
export function EmptyNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[160px] items-center justify-center px-4 text-center text-sm text-foreground-muted', className)}>
      {children}
    </div>
  );
}
