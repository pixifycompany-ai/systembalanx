import { forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface IconButtonProps extends Omit<ButtonProps, 'size'> {
  /** Tooltip label / aria-label */
  label: string;
  /** Tooltip side */
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  /** Highlight (e.g. primary action) */
  emphasis?: 'default' | 'primary' | 'destructive';
}

/**
 * Compact icon button with tooltip legend.
 * Usage: <IconButton label="Nova Entrada" onClick={...}><Plus className="h-4 w-4" /></IconButton>
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ label, tooltipSide = 'bottom', emphasis = 'default', className, children, variant, ...props }, ref) => {
    const computedVariant: ButtonProps['variant'] =
      variant ?? (emphasis === 'primary' ? 'default' : 'ghost');

    return (
      <Tooltip delayDuration={250}>
        <TooltipTrigger asChild>
          <Button
            ref={ref}
            type="button"
            variant={computedVariant}
            size="icon"
            aria-label={label}
            className={cn(
              // Botão redondo liso (padrão BALANX): borda + surface; hover suave.
              'h-10 w-10 shrink-0 rounded-full transition-colors',
              emphasis === 'primary'
                ? 'shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.6)] hover:bg-primary/90'
                : emphasis === 'destructive'
                  ? 'border border-border bg-surface text-destructive hover:bg-[hsl(var(--danger))]/12 hover:text-destructive'
                  : 'border border-border bg-surface text-foreground hover:bg-surface-2 hover:text-foreground',
              className,
            )}
            {...props}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side={tooltipSide} className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  },
);
IconButton.displayName = 'IconButton';
