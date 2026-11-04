import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { OlhoValores } from './OlhoValores';

interface MobilePageHeaderProps {
  /** Linha pequena acima do título (data, seção, "Boa tarde,") */
  eyebrow?: string;
  title: ReactNode;
  /** Slot à direita do título (ex.: seletor de mês + botão "+") */
  actions?: ReactNode;
  className?: string;
}

/**
 * Cabeçalho de página BALANX (mobile e desktop): linha de contexto em cinza +
 * título grande em Inter Tight. Para destacar uma palavra em serifa itálica,
 * passe `<span className="font-serif italic font-normal tracking-normal">…</span>` no title.
 */
export function MobilePageHeader({ eyebrow, title, actions, className }: MobilePageHeaderProps) {
  return (
    <header className={cn('mb-5 flex flex-wrap items-end justify-between gap-x-3 gap-y-3 md:mb-7', className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-0.5 text-[13px] text-foreground-muted md:text-sm">{eyebrow}</p>
        )}
        <div className="flex items-center gap-2.5">
          <h1 className="min-w-0 truncate text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground md:text-[38px]">
            {title}
          </h1>
          {/* No desktop o olhinho fica no Header; o Header não aparece no mobile */}
          <OlhoValores className="no-touch-min h-8 w-8 shrink-0 rounded-lg md:hidden [&_svg]:h-4 [&_svg]:w-4" />
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
