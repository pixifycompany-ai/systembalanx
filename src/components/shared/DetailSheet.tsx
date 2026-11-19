import { ReactNode } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: string;
  title: ReactNode;
  /** Conteúdo do corpo */
  children: ReactNode;
  /** Variante visual — dark imita o app iOS de referência */
  variant?: 'dark' | 'light';
  /** Altura máxima como fração do viewport */
  maxHeight?: string;
  className?: string;
}

/**
 * Bottom sheet padrão estilo iOS: handle bar, header com eyebrow + título grande,
 * botão de fechar circular. Sobe de baixo para cima com a animação nativa do Radix.
 *
 * No desktop vira janela centralizada (o SheetContent cuida disso para side="bottom").
 */
export function DetailSheet({
  open,
  onOpenChange,
  eyebrow,
  title,
  children,
  variant = 'light',
  maxHeight = '88dvh',
  className,
}: DetailSheetProps) {
  const isDark = variant === 'dark';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showHandle={false}
        showClose={false}
        className={cn(
          'rounded-t-3xl border-t-0 p-0 pb-safe overflow-hidden flex flex-col',
          isDark
            ? 'bg-[hsl(var(--navy-card))] text-white border-white/10'
            : 'bg-surface text-foreground',
          'md:max-w-lg md:pt-3',
          className,
        )}
        style={{ maxHeight }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1 shrink-0 md:hidden">
          <div className={cn('h-1 w-10 rounded-full', isDark ? 'bg-white/20' : 'bg-foreground/15')} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-3 pb-4 shrink-0">
          <div className="min-w-0">
            {eyebrow && (
              <p
                className={cn(
                  'text-xs mb-0.5 font-medium',
                  isDark ? 'text-white/70' : 'text-foreground-muted',
                )}
              >
                {eyebrow}
              </p>
            )}
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">{title}</h2>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label="Fechar"
            className={cn(
              'no-touch-min flex h-8 w-8 items-center justify-center rounded-full shrink-0',
              isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-secondary hover:bg-muted text-foreground',
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body scroll */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
