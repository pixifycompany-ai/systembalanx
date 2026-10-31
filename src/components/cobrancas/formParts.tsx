import type { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/**
 * Peças de layout locais (Contratos/Cobranças) no padrão BALANX Claro:
 * cabeçalho de sheet, seção com label em caixa alta, chips de escolha em pílula,
 * select nativo com a mesma cara do Input (h-11) e avatar de iniciais.
 */

/** Classe do <select> nativo, igual ao ui/Input (h-11, bg-surface-2). */
export const NATIVE_SELECT_CLS =
  'h-11 w-full rounded-xl border border-border bg-surface-2 px-3.5 text-sm text-foreground outline-none transition-colors focus:border-border-strong';

/** Label de seção: 11px, caixa alta, cinza. */
export const SECTION_LABEL_CLS = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted';

export function SheetHeading({ eyebrow, title, subtitle, className }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; className?: string }) {
  return (
    <div className={cn('pb-1', className)}>
      {eyebrow && <p className="text-[13px] text-foreground-muted">{eyebrow}</p>}
      <h2 className="mt-0.5 font-heading text-[22px] font-semibold tracking-[-0.02em] text-foreground">{title}</h2>
      {subtitle && <div className="mt-1 text-[13px] leading-relaxed text-foreground-muted">{subtitle}</div>}
    </div>
  );
}

export function FormSection({ label, action, children, className }: { label: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className={SECTION_LABEL_CLS}>{label}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Chip de escolha (forma de pagamento, status, modo…). Selecionado = navy. */
export function ChoiceChip({ active, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'no-touch-min inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors',
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-surface text-foreground hover:border-border-strong',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/** Rodapé de sheet/diálogo: botões pílula lado a lado. */
export function SheetFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex gap-2 pt-2 [&>*]:flex-1', className)}>{children}</div>;
}

/** Iniciais do nome (até 2 letras). */
export function iniciais(nome?: string | null) {
  const partes = (nome || '').trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return '?';
  const a = partes[0][0] || '';
  const b = partes.length > 1 ? partes[partes.length - 1][0] || '' : '';
  return (a + b).toUpperCase();
}

/** Avatar de iniciais 40×40 (rounded-[13px], bg-surface-2). */
export function InitialsAvatar({ nome, className }: { nome?: string | null; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-surface-2 font-heading text-[13px] font-semibold text-foreground',
        className,
      )}
    >
      {iniciais(nome)}
    </span>
  );
}

/** Aviso inline com tom (selos do tema). */
export function InlineNotice({ tone = 'warning', icon, children, className }: { tone?: 'warning' | 'danger' | 'info' | 'neutral'; icon?: ReactNode; children: ReactNode; className?: string }) {
  const toneCls = {
    warning: 'bg-warning-bg text-warning-fg',
    danger: 'bg-danger-bg text-danger-fg',
    info: 'bg-info-bg text-info-fg',
    neutral: 'bg-surface-2 text-foreground',
  }[tone];
  return (
    <div className={cn('flex items-start gap-2 rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-snug', toneCls, className)}>
      {icon && <span className="mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
