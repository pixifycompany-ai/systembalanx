import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { Link } from 'react-router-dom';

type MetricVariant = 'default' | 'positive' | 'negative' | 'warning' | 'info';

interface MetricCardProps {
  title: string;
  value: number;
  subtitle?: string;
  icon?: LucideIcon;
  emoji?: string;
  variant?: MetricVariant;
  change?: {
    value: number;
    isPositive: boolean;
  };
  isCurrency?: boolean;
  className?: string;
  onClick?: () => void;
  href?: string;
}

const variantStyles: Record<MetricVariant, string> = {
  default: '',
  positive: 'metric-card-positive',
  negative: 'metric-card-negative',
  warning: 'metric-card-warning',
  info: 'metric-card-info',
};

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  emoji,
  variant = 'default',
  change,
  isCurrency = true,
  className,
  onClick,
  href,
}: MetricCardProps) {
  const displayValue = isCurrency ? formatCurrency(value) : value.toLocaleString('pt-BR');
  const isClickable = Boolean(onClick || href);

  const content = (
    <div 
      className={cn(
        'metric-card group animate-fade-in',
        variantStyles[variant],
        isClickable && 'cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all',
        className
      )}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</span>
        {emoji ? (
          <span className="text-lg opacity-60">{emoji}</span>
        ) : Icon ? (
          <Icon className="h-4 w-4 text-muted-foreground" />
        ) : null}
      </div>

      {/* Value */}
      <div className="text-xl md:text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {displayValue}
      </div>

      {/* Subtitle or Change */}
      {(subtitle || change) && (
        <div className="mt-2 flex items-center gap-2">
          {change && (
            <span className={cn(
              'inline-flex items-center text-xs font-medium',
              change.isPositive ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {change.isPositive ? '↑' : '↓'} {Math.abs(change.value).toFixed(1)}%
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-muted-foreground">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link to={href}>{content}</Link>;
  }

  return content;
}
