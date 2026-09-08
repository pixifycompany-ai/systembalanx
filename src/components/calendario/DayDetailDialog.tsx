import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/utils/formatters';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { DayTransactions } from '@/hooks/useCalendario';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: DayTransactions | null;
}

export function DayDetailDialog({ open, onOpenChange, day }: DayDetailDialogProps) {
  if (!day) return null;

  const receitaItems = day.items.filter((i) => i.tipo === 'receita');
  const despesaItems = day.items.filter((i) => i.tipo === 'despesa');
  const saldo = day.receitas - day.despesas;
  const dateFormatted = format(parseISO(day.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="capitalize">{dateFormatted}</DialogTitle>
          <p className={`text-sm font-medium ${saldo >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            Saldo do dia: {formatCurrency(saldo)}
          </p>
        </DialogHeader>

        {receitaItems.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Receitas ({receitaItems.length})
            </h4>
            <div className="space-y-2">
              {receitaItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.descricao}</p>
                    {item.clienteOuFornecedor && (
                      <p className="text-xs text-muted-foreground truncate">{item.clienteOuFornecedor}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{formatCurrency(item.valor)}</p>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {despesaItems.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ArrowDownRight className="h-3.5 w-3.5" />
              Despesas ({despesaItems.length})
            </h4>
            <div className="space-y-2">
              {despesaItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 p-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{item.descricao}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {item.categoria && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: item.categoriaCor || '#6B7280' }} />
                          {item.categoria}
                        </span>
                      )}
                      {item.clienteOuFornecedor && (
                        <span className="text-xs text-muted-foreground">· {item.clienteOuFornecedor}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">{formatCurrency(item.valor)}</p>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {day.items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum lançamento neste dia.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
