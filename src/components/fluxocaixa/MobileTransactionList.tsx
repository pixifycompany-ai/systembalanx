import { useMemo, useRef } from 'react';
import { CabecalhoDiaFixo } from './CabecalhoDiaFixo';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SwipeableTransactionCard } from './SwipeableTransactionCard';
import { SkeletonTable } from '@/components/shared/LoadingSpinner';
import { formatCurrency } from '@/utils/formatters';
import { Plus, TrendingDown } from 'lucide-react';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';
import { btn } from '@/components/reskin/estilos';

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
  /** Dia em que cada lançamento aparece (padrão: vencimento). */
  dataDe?: (t: TransacaoUnificada) => string;
}

function formatDateHeader(dateStr: string): string {
  const s = format(parseISO(dateStr), "EEEE, dd 'de' MMMM", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  dataDe,
}: MobileTransactionListProps) {
  const listaRef = useRef<HTMLElement>(null);
  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, TransacaoUnificada[]>();
    for (const t of transactions) {
      const key = dataDe ? dataDe(t) : t.data_vencimento;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.entries());
  }, [transactions, dataDe]);

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
    return <div className="overflow-hidden rounded-[24px] border border-border bg-surface"><SkeletonTable rows={5} /></div>;
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-[24px] border border-border bg-surface px-6 py-12 text-center">
        <p className="text-[15px] text-foreground">Nada por aqui com esses filtros.</p>
        <p className="mt-1 text-[13px] text-foreground-muted">Limpe os filtros ou lance uma entrada ou saída.</p>
        <div className="mt-4 flex justify-center gap-2">
          <button type="button" onClick={onNewSaida} className={btn.outline}><TrendingDown className="h-4 w-4 text-danger-fg" />Saída</button>
          <button type="button" onClick={onNewEntrada} className={btn.primary}><Plus className="h-4 w-4" />Entrada</button>
        </div>
      </div>
    );
  }

  return (
    <section ref={listaRef} className="overflow-hidden rounded-[24px] border border-border bg-surface">
      <CabecalhoDiaFixo alvo={listaRef} />
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="text-[15px] font-semibold text-foreground">Movimentações <span className="font-normal text-foreground-muted">· {transactions.length}</span></p>
        <span className={cn('text-[12.5px] font-medium tabular-nums', totals.saldo >= 0 ? 'text-foreground' : 'text-danger-fg')}>{totals.saldo < 0 ? '−' : ''}{formatCurrency(Math.abs(totals.saldo))}</span>
      </div>
      {grouped.map(([date, items]) => {
        const hoje = isToday(parseISO(date));
        return (
          <div key={date}>
            <div data-dia-header className={cn('flex items-center justify-between gap-3 border-b border-border px-4 py-2', hoje ? 'bg-primary/[0.06]' : 'bg-surface-2/70')}>
              <span className="flex min-w-0 items-center gap-2 text-[12.5px] text-foreground">
                <span className="truncate">{formatDateHeader(date)}</span>
                {hoje && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-primary-foreground">Hoje</span>}
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-foreground-muted">{formatDayTotal(items)}</span>
            </div>
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
        );
      })}
    </section>
  );
}
