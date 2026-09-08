import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobilePageHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  /** Slot à direita do título (ex.: seletor de mês + botão "+") */
  actions?: ReactNode;
  className?: string;
}

/**
 * Header padrão estilo iOS para páginas mobile:
 * - eyebrow muted ("Bom dia", "Planejamento")
 * - H1 grande (nome do usuário, nome da seção)
 * - actions à direita
 *
 * Em desktop fica mais compacto e ocupa só a área da página.
 */
export function MobilePageHeader({ eyebrow, title, actions, className }: MobilePageHeaderProps) {
  return (
    <header className={cn('mb-5 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs text-foreground-muted mb-0.5 font-medium">{eyebrow}</p>
        )}
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground truncate">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 mt-1">{actions}</div>}
    </header>
  );
}
