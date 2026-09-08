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
 * Em desktop continua sendo sheet, mas centralizado e com largura limitada.
 */
export function DetailSheet({
  open,
  onOpenChange,
  eyebrow,
  title,
  children,
  variant = 'dark',
  maxHeight = '88dvh',
  className,
}: DetailSheetProps) {
  const isDark = variant === 'dark';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showClose={false}
        className={cn(
          'rounded-t-3xl border-t-0 p-0 pb-safe overflow-hidden flex flex-col',
          isDark
            ? 'bg-[hsl(240_10%_8%)] text-white border-[hsl(240_8%_12%)]'
            : 'bg-surface text-foreground',
          'md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:rounded-3xl md:bottom-4',
          className,
        )}
        style={{ maxHeight }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className={cn('h-1 w-10 rounded-full', isDark ? 'bg-white/20' : 'bg-foreground/15')} />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-3 pb-4 shrink-0">
          <div className="min-w-0">
            {eyebrow && (
              <p
                className={cn(
                  'text-xs mb-0.5 font-medium',
                  isDark ? 'text-white/55' : 'text-foreground-muted',
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
