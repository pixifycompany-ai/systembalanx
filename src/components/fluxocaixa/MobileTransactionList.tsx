import { useMemo } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SwipeableTransactionCard } from './SwipeableTransactionCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonTable } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatters';
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';

interface Conta {
  id: string;
  nome: string;
  cor: string;
  ativa: boolean;
}

interface MobileTransactionListProps {
  transactions: TransacaoUnificada[];
  contas: Conta[];
  isLoading: boolean;
  totals: { entradas: number; saidas: number; saldo: number };
  onConfirm: (t: TransacaoUnificada) => void;
  onDelete: (t: TransacaoUnificada) => void;
  onClick: (t: TransacaoUnificada) => void;
  onNewEntrada: () => void;
  onNewSaida: () => void;
}

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return `Hoje, ${format(date, "d 'de' MMMM", { locale: ptBR })}`;
  }
  return format(date, "EEE., d 'de' MMMM", { locale: ptBR });
}

export function MobileTransactionList({
  transactions,
  contas,
  isLoading,
  totals,
  onConfirm,
  onDelete,
  onClick,
  onNewEntrada,
  onNewSaida,
}: MobileTransactionListProps) {
  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, TransacaoUnificada[]>();
    for (const t of transactions) {
      const key = t.data_vencimento;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [transactions]);

  const contaMap = useMemo(() => {
    const m = new Map<string, Conta>();
    for (const c of contas) m.set(c.id, c);
    return m;
  }, [contas]);

  if (isLoading) {
    return <div className="px-4"><SkeletonTable rows={5} /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Transaction list */}
      {transactions.length === 0 ? (
        <EmptyState
          emoji="📊"
          title="Nenhuma transação encontrada"
          description="Registre receitas ou despesas para visualizar o fluxo."
          action={
            <div className="flex gap-2">
              <Button variant="outline" onClick={onNewSaida}>Nova Saída</Button>
              <Button onClick={onNewEntrada}>Nova Entrada</Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-1">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="px-1 py-2">
                <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
                  {formatDateHeader(date)}
                </span>
              </div>
              <div className="space-y-1.5">
                {items.map((t) => {
                  const conta = t.conta_id ? contaMap.get(t.conta_id) : undefined;
                  return (
                    <SwipeableTransactionCard
                      key={`${t.tabela_origem}-${t.id}`}
                      transaction={t}
                      contaNome={conta?.nome}
                      contaCor={conta?.cor}
                      onConfirm={onConfirm}
                      onDelete={onDelete}
                      onClick={onClick}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
