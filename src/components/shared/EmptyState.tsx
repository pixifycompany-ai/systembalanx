import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-12 px-4 text-center',
      className
    )}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-[18px] bg-surface-2 text-foreground-muted">
        {icon ?? <Inbox className="h-6 w-6" strokeWidth={1.6} />}
      </div>

      <h3 className="mb-1 text-[17px] font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
      
      {description && (
        <p className="mb-4 max-w-sm text-sm text-foreground-muted">{description}</p>
      )}
      
      {action}
    </div>
  );
}
