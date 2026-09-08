import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

export function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  return (
    <div 
      className={cn(
        'animate-spin rounded-full border-2 border-muted border-t-primary',
        sizeClasses[size],
        className
      )} 
    />
  );
}

interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message = 'Carregando...' }: LoadingPageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="metric-card animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-8 w-8 bg-muted rounded-lg" />
      </div>
      <div className="h-8 w-32 bg-muted rounded mb-2" />
      <div className="h-3 w-20 bg-muted rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 animate-pulse">
      {/* Header */}
      <div className="flex gap-4 pb-3 border-b border-border">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="h-4 w-24 bg-muted rounded" />
        <div className="h-4 w-20 bg-muted rounded" />
        <div className="h-4 w-16 bg-muted rounded" />
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-2">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-5 w-24 bg-muted rounded" />
          <div className="h-5 w-20 bg-muted rounded" />
          <div className="h-5 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="metric-card h-[400px] animate-pulse">
      <div className="h-4 w-40 bg-muted rounded mb-4" />
      <div className="h-full w-full bg-muted/50 rounded-lg flex items-end justify-center gap-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div 
            key={i} 
            className="bg-muted rounded-t"
            style={{ 
              width: '40px', 
              height: `${30 + Math.random() * 60}%` 
            }} 
          />
        ))}
      </div>
    </div>
  );
}
