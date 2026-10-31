import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionCardProps {
  title?: ReactNode;
  /** Texto/ícone pequeno ao lado do título */
  description?: ReactNode;
  /** Slot à direita do título (link "Ver todos", chips de período…) */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Sem padding interno no corpo (tabelas/listas que encostam nas bordas) */
  flush?: boolean;
}

/** Bloco de conteúdo BALANX: superfície lisa, raio 24px, cabeçalho com título 17px. */
export function SectionCard({ title, description, action, children, className, flush }: SectionCardProps) {
  return (
    <section className={cn('rounded-[20px] border border-border bg-surface md:rounded-3xl', !flush && 'p-4 md:p-6', className)}>
      {(title || action) && (
        <div className={cn('mb-4 flex flex-wrap items-center justify-between gap-3', flush && 'px-4 pt-4 md:px-6 md:pt-5')}>
          <div className="min-w-0">
            {title && <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-foreground md:text-[17px]">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-foreground-muted">{description}</p>}
          </div>
          {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
