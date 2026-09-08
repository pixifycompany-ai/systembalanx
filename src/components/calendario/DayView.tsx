import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/formatters';
import { EmpresaFonteBadge } from '@/components/shared/EmpresaFonteBadge';
import type { DayTransactions } from '@/hooks/useCalendario';

interface DayViewProps {
  refDate: Date;
  day: DayTransactions | null;
  onPrev: () => void;
  onNext: () => void;
}

export function DayView({ refDate, day, onPrev, onNext }: DayViewProps) {
  const fullLabel = format(refDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  const label = fullLabel.charAt(0).toUpperCase() + fullLabel.slice(1);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isToday = format(refDate, 'yyyy-MM-dd') === todayStr;

  const receitas = day?.receitas ?? 0;
  const despesas = day?.despesas ?? 0;
  const saldo = receitas - despesas;

  // Sort items by tipo (receitas first), then by valor desc
  const items = [...(day?.items ?? [])].sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === 'receita' ? -1 : 1;
    return b.valor - a.valor;
  });

  return (
    <div className="metric-card animate-fade-in overflow-hidden">
      <div className="flex items-center justify-between mb-4 gap-2">
        <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8 shrink-0">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0 text-center">
          <h3 className="text-sm font-semibold text-foreground truncate">{label}</h3>
          {isToday && (
            <span className="text-[10px] text-primary font-medium uppercase tracking-wide">
              Hoje
            </span>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8 shrink-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Day totals */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg border border-border p-3 bg-emerald-50/50 dark:bg-emerald-900/10">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Entradas</p>
          <p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 truncate">
            {formatCurrency(receitas)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-red-50/50 dark:bg-red-900/10">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Saídas</p>
          <p className="text-sm font-semibold tabular-nums text-red-700 dark:text-red-400 truncate">
            {formatCurrency(despesas)}
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-surface-2/50">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Saldo</p>
          <p
            className={`text-sm font-semibold tabular-nums truncate ${saldo >= 0 ? 'text-foreground' : 'text-red-700 dark:text-red-400'}`}
          >
            {formatCurrency(saldo)}
          </p>
        </div>
      </div>

      {/* Transactions timeline */}
      {items.length === 0 ? (
        <div className="flex items-center justify-center min-h-[120px] text-sm text-muted-foreground">
          Sem lançamentos neste dia
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={`${it.tipo}-${it.id}`}
              className="flex items-center gap-3 rounded-lg border border-border p-3 bg-card"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    it.categoriaCor ||
                    (it.tipo === 'receita' ? 'hsl(var(--success))' : 'hsl(var(--danger))'),
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-foreground truncate">{it.descricao}</p>
                  {it.empresaFonte && <EmpresaFonteBadge empresa={it.empresaFonte} size="xs" />}
                </div>
                {it.clienteOuFornecedor && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    {it.clienteOuFornecedor}
                  </p>
                )}
              </div>
              <span
                className={`text-sm font-semibold tabular-nums shrink-0 ${
                  it.tipo === 'receita'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {it.tipo === 'receita' ? '+' : '−'} {formatCurrency(it.valor)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
