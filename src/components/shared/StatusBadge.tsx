import { cn } from '@/lib/utils';

type StatusType = 
  | 'recebido' 
  | 'pago' 
  | 'ativo' 
  | 'pendente' 
  | 'atrasado' 
  | 'cancelado' 
  | 'inativo'
  | 'suspenso'
  | 'concluido'
  | 'recorrente'
  | 'projeto'
  | 'avulso'
  | 'fixa'
  | 'variavel'
  | 'investimento';

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Financial Status
  recebido: { label: 'Recebido', className: 'status-recebido' },
  pago: { label: 'Pago', className: 'status-pago' },
  pendente: { label: 'Pendente', className: 'status-pendente' },
  atrasado: { label: 'Atrasado', className: 'status-atrasado' },
  cancelado: { label: 'Cancelado', className: 'status-cancelado' },
  vence_hoje: { label: 'Vence Hoje', className: 'bg-amber-500/30 text-amber-400 animate-pulse' },
  
  // Entity Status
  ativo: { label: 'Ativo', className: 'status-ativo' },
  inativo: { label: 'Inativo', className: 'status-inativo' },
  suspenso: { label: 'Suspenso', className: 'bg-amber-500/20 text-amber-400' },
  concluido: { label: 'Concluído', className: 'bg-blue-500/20 text-blue-400' },
  
  // Contract Types
  recorrente: { label: 'Recorrente', className: 'bg-primary/20 text-primary' },
  projeto: { label: 'Projeto', className: 'bg-blue-500/20 text-blue-400' },
  avulso: { label: 'Avulso', className: 'bg-purple-500/20 text-purple-400' },
  
  // Expense Types
  fixa: { label: 'Fixa', className: 'bg-blue-500/20 text-blue-400' },
  variavel: { label: 'Variável', className: 'bg-orange-500/20 text-orange-400' },
  investimento: { label: 'Investimento', className: 'bg-purple-500/20 text-purple-400' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    className: 'bg-muted text-muted-foreground',
  };

  return (
    <span className={cn('status-badge', config.className, className)}>
      {config.label}
    </span>
  );
}

interface CategoryBadgeProps {
  name: string;
  color?: string;
  className?: string;
}

export function CategoryBadge({ name, color, className }: CategoryBadgeProps) {
  return (
    <span 
      className={cn('status-badge', className)}
      style={{
        backgroundColor: color ? `${color}20` : undefined,
        color: color || undefined,
      }}
    >
      {name}
    </span>
  );
}
