import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';

interface HeroStatFooterItem {
  label: string;
  value: number | string;
  align?: 'left' | 'right';
  valueClassName?: string;
}

interface HeroStatCardProps {
  /** Pequeno label acima do número (ex.: "Orçamento Mensal", "Saldo Consolidado") */
  eyebrow: string;
  /** Texto curto à direita do eyebrow (ex.: mês "JUN") */
  context?: string;
  /** Valor principal — formatado como moeda automaticamente quando number */
  value: number | string;
  /** Subtítulo opcional logo abaixo do valor */
  subtitle?: ReactNode;
  /** Progresso 0..1; quando definido renderiza barra fina */
  progress?: number;
  /** Cor da barra de progresso */
  progressTone?: 'success' | 'danger' | 'warning' | 'neutral';
  /** Itens do rodapé (2 colunas) */
  footer?: HeroStatFooterItem[];
  /** Botão pílula sobreposto na borda inferior */
  action?: { label: string; onClick: () => void };
  className?: string;
  /** Variante de cor */
  variant?: 'dark' | 'light';
}

const toneClass: Record<NonNullable<HeroStatCardProps['progressTone']>, string> = {
  success: 'bg-[hsl(var(--success))]',
  danger: 'bg-[hsl(var(--danger))]',
  warning: 'bg-[hsl(var(--warning))]',
  neutral: 'bg-white/70',
};

export function HeroStatCard({
  eyebrow,
  context,
  value,
  subtitle,
  progress,
  progressTone = 'success',
  footer,
  action,
  className,
  variant = 'dark',
}: HeroStatCardProps) {
  const isDark = variant === 'dark';
  const display = typeof value === 'number' ? formatCurrency(value) : value;

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'auro-card relative overflow-hidden rounded-3xl px-5 py-5 md:px-7 md:py-6 animate-fade-in',
          isDark
            ? 'text-white border border-white/10'
            : 'bg-surface text-foreground border border-border',
        )}
        style={
          isDark
            ? {
                background:
                  'linear-gradient(160deg, rgba(6,10,18,0.24), rgba(6,10,18,0.55)), radial-gradient(120% 96% at 6% -4%, rgba(42,114,226,0.92), transparent 54%), radial-gradient(120% 82% at 99% 2%, rgba(226,144,48,0.72), transparent 52%), radial-gradient(150% 120% at 55% 134%, rgba(60,132,236,0.88), transparent 58%), #0b1420',
              }
            : undefined
        }
      >
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              'text-[11px] font-medium tracking-wide',
              isDark ? 'text-white/55' : 'text-foreground-muted',
            )}
          >
            {eyebrow}
          </span>
          {context && (
            <span
              className={cn(
                'text-[10px] font-semibold uppercase tracking-widest',
                isDark ? 'text-white/45' : 'text-foreground-subtle',
              )}
            >
              {context}
            </span>
          )}
        </div>

        <div
          className={cn(
            'text-3xl md:text-[2.6rem] font-semibold tabular-nums tracking-tight leading-none',
          )}
        >
          {display}
        </div>

        {subtitle && (
          <div
            className={cn(
              'mt-2 text-xs',
              isDark ? 'text-white/60' : 'text-foreground-muted',
            )}
          >
            {subtitle}
          </div>
        )}

        {typeof progress === 'number' && (
          <div
            className={cn(
              'mt-4 h-1 w-full rounded-full overflow-hidden',
              isDark ? 'bg-white/12' : 'bg-border',
            )}
          >
            <div
              className={cn('h-full rounded-full transition-all', toneClass[progressTone])}
              style={{ width: `${Math.max(0, Math.min(progress, 1)) * 100}%` }}
            />
          </div>
        )}

        {footer && footer.length > 0 && (
          <div className="mt-4 flex items-end justify-between gap-4">
            {footer.map((item, i) => (
              <div
                key={i}
                className={cn('flex flex-col gap-0.5', item.align === 'right' && 'items-end ml-auto')}
              >
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-wider',
                    isDark ? 'text-white/45' : 'text-foreground-subtle',
                  )}
                >
                  {item.label}
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    item.valueClassName,
                  )}
                >
                  {typeof item.value === 'number' ? formatCurrency(item.value) : item.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="no-touch-min absolute left-1/2 -bottom-3 -translate-x-1/2 rounded-full bg-surface text-foreground text-xs font-medium px-4 py-1.5 shadow-md border border-border hover:bg-surface-2 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
