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
      variant ?? (emphasis === 'primary' ? 'default' : emphasis === 'destructive' ? 'ghost' : 'outline');

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
              'h-9 w-9 shrink-0',
              emphasis === 'destructive' && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
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
