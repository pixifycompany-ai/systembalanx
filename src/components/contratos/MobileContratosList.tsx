import { useMemo } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonTable } from '@/components/shared/LoadingSpinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Plus, Pencil, Trash2, RefreshCw, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Contrato {
  id: string;
  descricao: string;
  valor: number;
  data_inicio: string;
  data_fim?: string | null;
  recorrencia: string;
  status: 'ativo' | 'cancelado' | 'encerrado';
  cliente?: { nome: string } | null;
}

interface MobileContratosListProps {
  contratos: Contrato[];
  isLoading: boolean;
  onEdit: (c: Contrato) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

const recorrenciaLabels: Record<string, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  unico: 'Único',
};

export function MobileContratosList({ contratos, isLoading, onEdit, onDelete, onNew }: MobileContratosListProps) {
  if (isLoading) return <SkeletonTable rows={5} />;

  if (contratos.length === 0) {
    return (
      <EmptyState title="Nenhum contrato encontrado" description="Crie seu primeiro contrato."
        action={<Button onClick={onNew} className="gap-2"><Plus className="h-4 w-4" />Novo Contrato</Button>}
      />
    );
  }

  return (
    <div className="space-y-2">
      {contratos.map((c) => (
        <div
          key={c.id}
          className={cn(
            "bg-card border border-border/50 rounded-lg p-3",
            c.recorrencia === 'mensal' && c.status === 'ativo' && 'border-l-[3px] border-l-[hsl(var(--warning))]'
          )}
          onClick={() => onEdit(c)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{c.cliente?.nome || '-'}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{c.descricao}</p>
            </div>
            <span className="text-[15px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 shrink-0">
              {formatCurrency(Number(c.valor))}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {recorrenciaLabels[c.recorrencia] || c.recorrencia}
            </span>
            <StatusBadge status={c.status} />
            <span className="text-[11px] text-muted-foreground ml-auto flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(c.data_inicio)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
