import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ListRowCardProps {
  /** Inicial mostrada no avatar quadrado (ex.: primeira letra) */
  initial?: string;
  /** Substitui o avatar por um ícone ou imagem custom */
  leading?: ReactNode;
  /** Cor do avatar — default preto */
  avatarTone?: 'dark' | 'muted' | 'success' | 'danger';
  title: ReactNode;
  subtitle?: ReactNode;
  /** Linha do valor principal à direita */
  value?: ReactNode;
  /** Linha auxiliar abaixo do valor (data, status pill, etc) */
  meta?: ReactNode;
  onClick?: () => void;
  className?: string;
  /** Visualmente "apagado" (ex.: já pago) */
  dimmed?: boolean;
}

const toneCls: Record<NonNullable<ListRowCardProps['avatarTone']>, string> = {
  dark: 'bg-[hsl(240_10%_10%)] text-white',
  muted: 'bg-secondary text-foreground-muted',
  success: 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))]',
  danger: 'bg-[hsl(var(--danger-bg))] text-[hsl(var(--danger-fg))]',
};

export function ListRowCard({
  initial,
  leading,
  avatarTone = 'dark',
  title,
  subtitle,
  value,
  meta,
  onClick,
  className,
  dimmed,
}: ListRowCardProps) {
  const interactive = Boolean(onClick);
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-surface/70 backdrop-blur-xl border border-border/60 px-4 py-3 shadow-md transition-all',
        interactive && 'hover:border-border-strong active:scale-[0.99] cursor-pointer',
        dimmed && 'opacity-60',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold',
          toneCls[avatarTone],
        )}
      >
        {leading ?? (initial ? initial.charAt(0).toUpperCase() : null)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-foreground-muted truncate mt-0.5">{subtitle}</div>
        )}
      </div>

      {(value || meta) && (
        <div className="flex flex-col items-end shrink-0 gap-0.5 max-w-[45%]">
          {value && (
            <div className="text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
              {value}
            </div>
          )}
          {meta && <div className="text-[11px] text-foreground-muted whitespace-nowrap">{meta}</div>}
        </div>
      )}
    </div>
  );
}
