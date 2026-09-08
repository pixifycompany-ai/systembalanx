import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { formatCurrencyShort } from '@/utils/formatters';
import { DayDetailDialog } from './DayDetailDialog';
import type { DayTransactions } from '@/hooks/useCalendario';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  refDate: Date;
  days: Record<string, DayTransactions>;
  onPrev: () => void;
  onNext: () => void;
}

export function WeekView({ refDate, days, onPrev, onNext }: WeekViewProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const monday = startOfWeek(refDate, { weekStartsOn: 1 });
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const rangeLabel = `${format(week[0], 'd MMM', { locale: ptBR })} – ${format(week[6], 'd MMM yyyy', { locale: ptBR })}`;

  return (
    <>
      <div className="metric-card animate-fade-in">
        <div className="flex items-center justify-between mb-4 gap-2">
          <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8 shrink-0">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold text-foreground truncate text-center">
            {rangeLabel}
          </h3>
          <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8 shrink-0">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Vertical stack of day cards */}
        <div className="flex flex-col gap-2">
          {week.map((d) => {
            const ds = format(d, 'yyyy-MM-dd');
            const dayData = days[ds];
            const isToday = ds === todayStr;
            const dayName = format(d, 'EEEE', { locale: ptBR });
            const dayNum = format(d, 'd');
            const monthShort = format(d, 'MMM', { locale: ptBR });

            return (
              <button
                key={ds}
                type="button"
                onClick={() => dayData?.items.length && setSelectedDate(ds)}
                className={cn(
                  'flex flex-col text-left rounded-lg border p-3 bg-card transition-all w-full',
                  isToday ? 'ring-1 ring-primary border-primary/40' : 'border-border',
                  dayData?.items.length ? 'hover:bg-accent/40 cursor-pointer' : 'cursor-default'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-baseline gap-2">
                    <span className={cn('text-xl font-semibold tabular-nums', isToday ? 'text-primary' : 'text-foreground')}>
                      {dayNum}
                    </span>
                    <span className="text-[11px] font-medium uppercase text-muted-foreground">
                      {dayName} · {monthShort}
                    </span>
                  </div>
                  {dayData && (dayData.receitas > 0 || dayData.despesas > 0) && (
                    <div className="flex items-center gap-2 text-[11px] tabular-nums">
                      {dayData.receitas > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">+ {formatCurrencyShort(dayData.receitas)}</span>
                      )}
                      {dayData.despesas > 0 && (
                        <span className="text-red-600 dark:text-red-400">− {formatCurrencyShort(dayData.despesas)}</span>
                      )}
                    </div>
                  )}
                </div>

                {dayData?.items.length ? (
                  <div className="space-y-1">
                    {dayData.items.slice(0, 4).map((it) => (
                      <div
                        key={it.id}
                        className={cn(
                          'text-[11px] rounded px-2 py-1 truncate',
                          it.tipo === 'receita'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                        )}
                      >
                        {it.tipo === 'receita' ? '+' : '-'} {it.descricao}
                      </div>
                    ))}
                    {dayData.items.length > 4 && (
                      <div className="text-[11px] text-muted-foreground px-2">
                        +{dayData.items.length - 4} lançamentos
                      </div>
                    )}
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground/60">Sem lançamentos</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <DayDetailDialog
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
        day={selectedDate ? days[selectedDate] || null : null}
      />
    </>
  );
}
