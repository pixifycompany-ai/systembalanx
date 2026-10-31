import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/utils/formatters';
import { EmpresaFonteBadge } from '@/components/shared/EmpresaFonteBadge';
import { SectionCard } from '@/components/shared/SectionCard';
import { KpiTriple } from '@/components/shared/KpiTriple';
import { cn } from '@/lib/utils';
import { CalNav } from './CalNav';
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
    <SectionCard
      flush
      className="overflow-hidden animate-fade-in"
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{label}</span>
          {isToday && (
            <span className="shrink-0 rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info-fg">Hoje</span>
          )}
        </span>
      }
      action={<CalNav onPrev={onPrev} onNext={onNext} />}
    >
      {/* Totais do dia */}
      <div className="px-4 pb-4 md:px-6">
        <KpiTriple
          className="mb-0"
          items={[
            { label: 'Entradas', value: receitas, tone: 'green' },
            { label: 'Saídas', value: despesas, tone: 'red' },
            { label: 'Saldo', value: saldo, tone: 'steel' },
          ]}
        />
      </div>

      {/* Lançamentos do dia */}
      {items.length === 0 ? (
        <div className="flex min-h-[120px] items-center justify-center border-t border-border text-sm text-foreground-muted">
          Sem lançamentos neste dia
        </div>
      ) : (
        <ul>
          {items.map((it) => {
            const isRec = it.tipo === 'receita';
            const Icon = isRec ? ArrowUpRight : ArrowDownRight;
            return (
              <li key={`${it.tipo}-${it.id}`} className="flex items-center gap-3 border-t border-border px-4 py-3 md:px-6">
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-[13px]',
                    isRec ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg',
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{it.descricao}</p>
                    {it.empresaFonte && <EmpresaFonteBadge empresa={it.empresaFonte} size="xs" />}
                  </div>
                  {(it.clienteOuFornecedor || it.categoriaCor) && (
                    <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] text-foreground-muted">
                      {it.categoriaCor && (
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: it.categoriaCor }} />
                      )}
                      <span className="truncate">{it.clienteOuFornecedor}</span>
                    </p>
                  )}
                </div>
                <span
                  className={cn(
                    'shrink-0 font-heading text-sm font-semibold tabular-nums',
                    isRec ? 'text-[hsl(var(--success-fg))]' : 'text-[hsl(var(--danger-fg))]',
                  )}
                >
                  {isRec ? '+' : '−'} {formatCurrency(it.valor)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
