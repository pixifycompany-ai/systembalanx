import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  emoji,
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
      {emoji ? (
        <span className="text-5xl mb-4">{emoji}</span>
      ) : icon ? (
        <div className="mb-4 text-muted-foreground">{icon}</div>
      ) : null}
      
      <h3 className="text-lg font-medium text-foreground mb-1">{title}</h3>
      
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      )}
      
      {action}
    </div>
  );
}
