import { cn } from '@/lib/utils';
import { forwardRef, type HTMLAttributes, type ButtonHTMLAttributes } from 'react';

/**
 * ScrollPills — horizontal scroll snap container for filters/tabs that
 * would overflow on mobile (iPhone 390px). Pills inside scroll horizontally
 * with snap, fade edges, and hidden scrollbar.
 *
 * Usage:
 *   <ScrollPills>
 *     <Pill active>Todas</Pill>
 *     <Pill>Entradas</Pill>
 *   </ScrollPills>
 */
export const ScrollPills = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={cn('scroll-pills -mx-3 px-3 md:mx-0 md:px-0', className)} {...props}>
      {children}
    </div>
  ),
);
ScrollPills.displayName = 'ScrollPills';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const Pill = forwardRef<HTMLButtonElement, PillProps>(
  ({ className, active, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        'inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-[13px] font-medium transition-all no-touch-min',
        active
          ? 'border-foreground bg-foreground font-semibold text-background'
          : 'border-border bg-surface text-foreground hover:border-border-strong',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Pill.displayName = 'Pill';
