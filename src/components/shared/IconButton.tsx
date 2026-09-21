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
              // Tile de vidro (combina com o tema azul): borda sutil + surface
              // translúcido + blur; hover suave.
              'h-9 w-9 shrink-0 rounded-xl transition-colors',
              emphasis === 'primary'
                ? 'shadow-[0_8px_22px_-8px_hsl(var(--primary)/0.6)] hover:bg-primary/90'
                : emphasis === 'destructive'
                  ? 'border border-border/60 bg-surface/55 backdrop-blur-xl text-destructive hover:bg-[hsl(var(--danger))]/12 hover:text-destructive'
                  : 'border border-border/60 bg-surface/55 backdrop-blur-xl text-foreground shadow-sm hover:bg-surface-2 hover:text-foreground',
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
