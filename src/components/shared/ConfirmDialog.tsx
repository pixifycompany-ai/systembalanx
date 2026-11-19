import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { btn } from '@/components/reskin/estilos';
import { cn } from '@/lib/utils';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  isLoading?: boolean;
  onConfirm: () => void;
}

/**
 * Confirmação no padrão do reskin: ícone redondo, título leve, texto e dois
 * botões lado a lado. Centralizado no desktop, de baixo no celular.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  isLoading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const destrutivo = variant === 'destructive';
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!isLoading) onOpenChange(o); }}>
      <SheetContent side="bottom" showHandle showClose={false} className="rounded-t-[26px] bg-surface p-0 sm:max-w-[440px]">
        <div className="p-5 pb-safe">
          <span className={cn('grid h-11 w-11 place-items-center rounded-full', destrutivo ? 'bg-danger-bg text-danger-fg' : 'bg-surface-2 text-foreground')}>
            {destrutivo ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
          </span>
          <SheetTitle className="mt-3 font-heading text-[22px] font-light tracking-[-0.02em] text-foreground">{title}</SheetTitle>
          <SheetDescription className="mt-1 whitespace-pre-line text-[13.5px] text-foreground-muted">{description}</SheetDescription>
          <div className="mt-5 flex gap-2">
            <button type="button" onClick={() => onOpenChange(false)} disabled={isLoading} className={cn(btn.outline, 'h-11 flex-1')}>
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isLoading}
              className={cn(destrutivo
                ? 'inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-danger px-5 text-[13.5px] font-medium text-white hover:opacity-90 disabled:opacity-40'
                : cn(btn.primary, 'h-11 flex-1'))}
            >
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Aguarde…</> : confirmLabel}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
