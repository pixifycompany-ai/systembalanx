import { forwardRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterPillProps {
  /** Icon (lucide) shown on the left */
  icon?: ReactNode;
  /** Short legend ("Mês", "Status", "Categoria") */
  label: string;
  /** Selected value to show after the label (e.g. "Abril 2026") */
  value?: string | null;
  /** Active = at least one value is selected */
  active?: boolean;
  /** Clear handler — when set, shows X on hover */
  onClear?: () => void;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

/**
 * Compact pill-style filter trigger. Mobile-friendly, fits in horizontal scroll lists.
 * Renders: [icon] Label · Value [×]
 */
export const FilterPill = forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ icon, label, value, active, onClear, onClick, className, children }, ref) => {
    const isActive = active ?? Boolean(value);
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        className={cn(
          'group inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium whitespace-nowrap transition-colors shrink-0',
          isActive
            ? 'border-foreground bg-foreground text-background hover:bg-foreground/90'
            : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground',
          className,
        )}
      >
        {icon && <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        <span>{label}</span>
        {value && (
          <>
            <span className="opacity-50">·</span>
            <span className="font-semibold">{value}</span>
          </>
        )}
        {children}
        {isActive && onClear && (
          <span
            role="button"
            aria-label={`Limpar ${label}`}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-background/20"
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>
    );
  },
);
FilterPill.displayName = 'FilterPill';
