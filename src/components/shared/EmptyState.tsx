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
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-border/60 bg-surface/60 text-muted-foreground backdrop-blur-sm">
        {icon ?? <Inbox className="h-6 w-6" strokeWidth={1.6} />}
      </div>

      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      
      {action}
    </div>
  );
}
