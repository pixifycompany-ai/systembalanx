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
  saldoAtual: number;
  onConfirm: (t: TransacaoUnificada) => void;
  onDelete: (t: TransacaoUnificada) => void;
  onClick: (t: TransacaoUnificada) => void;
  onDuplicate?: (t: TransacaoUnificada) => void;
  onNewEntrada: () => void;
  onNewSaida: () => void;
}

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) {
    return `Hoje · ${format(date, 'd MMM', { locale: ptBR })}`;
  }
  return format(date, 'EEE · d MMM', { locale: ptBR });
}

/** Total líquido do dia (transferências são neutras), com sinal explícito. */
function formatDayTotal(items: TransacaoUnificada[]): string {
  const net = items.reduce((s, t) => {
    if (t.tabela_origem === 'transferencia') return s;
    return s + (t.tipo === 'entrada' ? Number(t.valor || 0) : -Number(t.valor || 0));
  }, 0);
  return `${net >= 0 ? '+' : '−'}${formatCurrency(Math.abs(net))}`;
}

export function MobileTransactionList({
  transactions,
  contas,
  isLoading,
  totals,
  saldoAtual,
  onConfirm,
  onDelete,
  onClick,
  onDuplicate,
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

  // Saldo corrente por lançamento — na MESMA ordem exibida, ancorando o último (mais recente) no saldo atual real.
  const saldoPorId = useMemo(() => {
    const effect = (t: TransacaoUnificada) => t.tabela_origem === 'transferencia' ? 0 : (t.tipo === 'entrada' ? Number(t.valor || 0) : -Number(t.valor || 0));
    const totalEffect = transactions.reduce((s, t) => s + effect(t), 0);
    const m = new Map<string, number>();
    let running = saldoAtual - totalEffect; // saldo de abertura (antes do primeiro exibido)
    for (const t of transactions) {
      running += effect(t);
      m.set(`${t.tabela_origem}-${t.id}`, running);
    }
    return m;
  }, [transactions, saldoAtual]);

  if (isLoading) {
    return <div className="overflow-hidden rounded-[20px] border border-border bg-surface"><SkeletonTable rows={5} /></div>;
  }

  return (
    <div>
      {/* Lista agrupada por dia */}
      {transactions.length === 0 ? (
        <EmptyState
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
        <div className="flex flex-col gap-1">
          {grouped.map(([date, items]) => (
            <section key={date} className="flex flex-col">
              <div className="flex items-baseline justify-between gap-3 px-0.5 pb-1.5 pt-2.5">
                <span className="truncate text-[12px] font-semibold uppercase tracking-[0.04em] text-foreground-muted">
                  {formatDateHeader(date)}
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">{formatDayTotal(items)}</span>
              </div>
              <div className="overflow-hidden rounded-[20px] border border-border bg-surface">
                {items.map((t) => {
                  const conta = t.conta_id ? contaMap.get(t.conta_id) : undefined;
                  return (
                    <SwipeableTransactionCard
                      key={`${t.tabela_origem}-${t.id}`}
                      transaction={t}
                      contaNome={conta?.nome}
                      contaCor={conta?.cor}
                      saldoCorrente={saldoPorId.get(`${t.tabela_origem}-${t.id}`)}
                      onConfirm={onConfirm}
                      onDelete={onDelete}
                      onClick={onClick}
                      onDuplicate={onDuplicate}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
