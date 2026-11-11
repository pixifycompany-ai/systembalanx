import { ReactNode } from 'react';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonTable } from '@/components/shared/LoadingSpinner';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { Plus, Calendar } from 'lucide-react';
import { InitialsAvatar, SECTION_LABEL_CLS } from '@/components/cobrancas/formParts';
import { estadoPausa } from '@/lib/pausaContrato';

interface Contrato {
  id: string;
  descricao: string;
  valor: number;
  data_inicio: string;
  data_fim?: string | null;
  recorrencia: string;
  status: 'ativo' | 'cancelado' | 'encerrado';
  pausado_desde?: string | null;
  pausado_ate?: string | null;
  cliente?: { nome: string } | null;
}

interface MobileContratosListProps {
  contratos: Contrato[];
  isLoading: boolean;
  onEdit: (c: Contrato) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  renderCobranca?: (c: Contrato) => ReactNode;
}

const recorrenciaLabels: Record<string, string> = {
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual',
  unico: 'Único',
};

export function MobileContratosList({ contratos, isLoading, onEdit, onNew, renderCobranca }: MobileContratosListProps) {
  if (isLoading) return <SkeletonTable rows={5} />;

  if (contratos.length === 0) {
    return (
      <div className="rounded-[20px] border border-border bg-surface">
        <EmptyState title="Nenhum contrato encontrado" description="Crie seu primeiro contrato."
          action={<Button onClick={onNew} className="gap-2"><Plus className="h-4 w-4" />Novo Contrato</Button>}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between px-0.5 pb-1.5 pt-1">
        <span className={SECTION_LABEL_CLS}>
          {contratos.length} {contratos.length === 1 ? 'contrato' : 'contratos'}
        </span>
      </div>
      <div className="rounded-[20px] border border-border bg-surface px-3.5">
        {contratos.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            className="cursor-pointer border-b border-border py-3 last:border-b-0"
            onClick={() => onEdit(c)}
            onKeyDown={(e) => { if (e.key === 'Enter') onEdit(c); }}
          >
            <div className="flex items-center gap-3">
              <InitialsAvatar nome={c.cliente?.nome} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="truncate text-[14px] font-semibold text-foreground">{c.cliente?.nome || '-'}</p>
                <p className="truncate text-[12px] text-foreground-muted">
                  {recorrenciaLabels[c.recorrencia] || c.recorrencia} · {c.descricao}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-heading text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-[hsl(var(--success-fg))]">
                  {formatCurrency(Number(c.valor))}
                </span>
                <StatusBadge status={c.status === 'ativo' && estadoPausa(c) === 'pausado' ? 'pausado' : c.status} />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 pl-[52px]">
              {renderCobranca && (
                <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{renderCobranca(c)}</span>
              )}
              <span className="ml-auto flex items-center gap-1 text-[11px] text-foreground-muted">
                <Calendar className="h-3 w-3" />
                {formatDate(c.data_inicio)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
