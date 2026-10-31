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
import { cn } from '@/lib/utils';

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
        type="button"
        onClick={() => darBaixa(item)}
        disabled={loading}
        className="no-touch-min mt-2 inline-flex h-7 items-center gap-1 rounded-full bg-success-bg px-3 text-[11px] font-semibold text-success-fg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        {item.tipo === 'receita' ? 'Dar baixa (receber)' : 'Dar baixa (pagar)'}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Lançamentos do dia</p>
          <DialogTitle className="capitalize">{dateFormatted}</DialogTitle>
          <div className="pt-1">
            <span
              className={cn(
                'inline-flex items-center rounded-full px-3 py-1 text-[13px] font-semibold tabular-nums',
                saldo >= 0 ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg',
              )}
            >
              Saldo do dia: {formatCurrency(saldo)}
            </span>
          </div>
        </DialogHeader>

        {receitaItems.length > 0 && (
          <section>
            <h4 className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
              <span className="inline-flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
                Receitas ({receitaItems.length})
              </span>
              <span className="font-heading text-[13px] normal-case tracking-normal text-[hsl(var(--success-fg))]">{formatCurrency(day.receitas)}</span>
            </h4>
            <div className="rounded-[20px] border border-border bg-surface px-3.5">
              {receitaItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{item.descricao}</p>
                    {item.clienteOuFornecedor && (
                      <p className="truncate text-xs text-foreground-muted">{item.clienteOuFornecedor}</p>
                    )}
                    <BaixaButton item={item} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="font-heading text-sm font-semibold tabular-nums text-[hsl(var(--success-fg))]">{formatCurrency(item.valor)}</p>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {despesaItems.length > 0 && (
          <section>
            <h4 className="mb-2 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
              <span className="inline-flex items-center gap-1">
                <ArrowDownRight className="h-3.5 w-3.5 text-[hsl(var(--danger-fg))]" />
                Despesas ({despesaItems.length})
              </span>
              <span className="font-heading text-[13px] normal-case tracking-normal text-[hsl(var(--danger-fg))]">{formatCurrency(day.despesas)}</span>
            </h4>
            <div className="rounded-[20px] border border-border bg-surface px-3.5">
              {despesaItems.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 border-b border-border py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{item.descricao}</p>
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                      {item.categoria && (
                        <span className="inline-flex min-w-0 items-center gap-1 text-xs text-foreground-muted">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.categoriaCor || 'hsl(var(--foreground-muted))' }} />
                          <span className="truncate">{item.categoria}</span>
                        </span>
                      )}
                      {item.clienteOuFornecedor && (
                        <span className="truncate text-xs text-foreground-muted">· {item.clienteOuFornecedor}</span>
                      )}
                    </div>
                    <BaixaButton item={item} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <p className="font-heading text-sm font-semibold tabular-nums text-[hsl(var(--danger-fg))]">{formatCurrency(item.valor)}</p>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {day.items.length === 0 && (
          <p className="py-4 text-center text-sm text-foreground-muted">Nenhum lançamento neste dia.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
