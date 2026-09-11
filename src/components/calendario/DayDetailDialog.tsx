import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/utils/formatters';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ArrowUpRight, ArrowDownRight, Check, Loader2 } from 'lucide-react';
import type { DayTransactions, DayItem } from '@/hooks/useCalendario';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: DayTransactions | null;
}

// Caches derivados que dependem de receitas/despesas — invalidar após a baixa
// para saldo/calendário/relatórios atualizarem na hora.
const DERIVED_KEYS = ['calendario', 'dashboard', 'fluxo-caixa', 'contas', 'account-running-balance', 'analises', 'relatorios', 'cartao-faturas'];

export function DayDetailDialog({ open, onOpenChange, day }: DayDetailDialogProps) {
  const queryClient = useQueryClient();
  const [processando, setProcessando] = useState<Set<string>>(new Set());

  if (!day) return null;

  const receitaItems = day.items.filter((i) => i.tipo === 'receita');
  const despesaItems = day.items.filter((i) => i.tipo === 'despesa');
  const saldo = day.receitas - day.despesas;
  const dateFormatted = format(parseISO(day.date), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

  const isPendente = (status: string) => status === 'pendente' || status === 'atrasado';

  const darBaixa = async (item: DayItem) => {
    setProcessando((prev) => new Set(prev).add(item.id));
    try {
      const tabela = item.tipo === 'receita' ? 'receitas' : 'despesas';
      const novoStatus = item.tipo === 'receita' ? 'recebido' : 'pago';
      const dateField = item.tipo === 'receita' ? 'data_recebimento' : 'data_pagamento';
      // Data da baixa = o próprio dia do lançamento (o vencimento exibido no calendário).
      const { error } = await supabase
        .from(tabela)
        .update({ status: novoStatus, [dateField]: day.date })
        .eq('id', item.id);
      if (error) throw error;

      DERIVED_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast({ title: item.tipo === 'receita' ? 'Recebimento confirmado!' : 'Pagamento confirmado!' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao dar baixa';
      toast({ title: 'Erro', description: message, variant: 'destructive' });
    } finally {
      setProcessando((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const BaixaButton = ({ item }: { item: DayItem }) => {
    if (!isPendente(item.status)) return null;
    const loading = processando.has(item.id);
    return (
      <button
        onClick={() => darBaixa(item)}
        disabled={loading}
        className="mt-1.5 inline-flex items-center gap-1 rounded-lg border border-[hsl(var(--success))]/40 bg-[hsl(var(--success))]/12 px-2 py-1 text-[11px] font-semibold text-[hsl(var(--success))] transition-colors hover:bg-[hsl(var(--success))]/20 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        {item.tipo === 'receita' ? 'Dar baixa (receber)' : 'Dar baixa (pagar)'}
      </button>
    );
  };

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
                    <BaixaButton item={item} />
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
                    <BaixaButton item={item} />
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
