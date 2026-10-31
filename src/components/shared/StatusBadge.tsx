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

// Selos em tokens do tema (contraste ok no claro e no escuro).
const OK = 'bg-success-bg text-success-fg';
const BAD = 'bg-danger-bg text-danger-fg';
const WARN = 'bg-warning-bg text-warning-fg';
const INFO = 'bg-info-bg text-info-fg';
const NEUTRAL = 'bg-surface-2 text-foreground-muted';

const statusConfig: Record<string, { label: string; className: string }> = {
  // Financial Status
  recebido: { label: 'Recebido', className: OK },
  pago: { label: 'Pago', className: OK },
  pendente: { label: 'Pendente', className: WARN },
  atrasado: { label: 'Atrasado', className: BAD },
  cancelado: { label: 'Cancelado', className: NEUTRAL },
  vence_hoje: { label: 'Vence hoje', className: WARN },

  // Entity Status
  ativo: { label: 'Ativo', className: OK },
  inativo: { label: 'Inativo', className: NEUTRAL },
  suspenso: { label: 'Suspenso', className: WARN },
  concluido: { label: 'Concluído', className: INFO },

  // Contract Types
  recorrente: { label: 'Recorrente', className: INFO },
  projeto: { label: 'Projeto', className: NEUTRAL },
  avulso: { label: 'Avulso', className: NEUTRAL },

  // Expense Types
  fixa: { label: 'Fixa', className: NEUTRAL },
  variavel: { label: 'Variável', className: NEUTRAL },
  investimento: { label: 'Investimento', className: INFO },
};

const BASE = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold';

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] || {
    label: status,
    className: NEUTRAL,
  };

  return (
    <span className={cn(BASE, config.className, className)}>
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
  // Cor da categoria só no ponto: texto sempre no tom do tema (contraste garantido).
  return (
    <span className={cn(BASE, 'gap-1.5 bg-surface-2 text-foreground', className)}>
      {color && <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />}
      {name}
    </span>
  );
}
