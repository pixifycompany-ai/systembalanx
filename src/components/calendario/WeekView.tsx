import { useState } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrencyShort } from '@/utils/formatters';
import { SectionCard } from '@/components/shared/SectionCard';
import { DayDetailDialog } from './DayDetailDialog';
import { CalNav } from './CalNav';
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
      <SectionCard
        flush
        className="overflow-hidden animate-fade-in"
        title={rangeLabel}
        action={<CalNav onPrev={onPrev} onNext={onNext} />}
      >
        {/* Lista agrupada: uma linha por dia */}
        <div>
          {week.map((d) => {
            const ds = format(d, 'yyyy-MM-dd');
            const dayData = days[ds];
            const isToday = ds === todayStr;
            const dayName = format(d, 'EEEE', { locale: ptBR });
            const dayNum = format(d, 'd');
            const monthShort = format(d, 'MMM', { locale: ptBR });
            const clickable = !!dayData?.items.length;

            return (
              <button
                key={ds}
                type="button"
                onClick={() => dayData?.items.length && setSelectedDate(ds)}
                className={cn(
                  'flex w-full items-start gap-3 border-t border-border px-4 py-3 text-left transition-colors md:px-6',
                  isToday && 'bg-foreground/[0.03]',
                  clickable ? 'cursor-pointer hover:bg-surface-2' : 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-[13px] font-heading text-[15px] font-semibold tabular-nums',
                    isToday ? 'bg-foreground text-background' : 'bg-surface-2 text-foreground',
                  )}
                >
                  {dayNum}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold capitalize text-foreground">
                      {dayName} <span className="font-normal text-foreground-muted">· {monthShort}</span>
                    </span>
                    {dayData && (dayData.receitas > 0 || dayData.despesas > 0) && (
                      <span className="flex shrink-0 items-center gap-1.5 text-[12px] font-semibold tabular-nums">
                        {dayData.receitas > 0 && (
                          <span className="rounded-full bg-success-bg px-2 py-0.5 text-success-fg">+{formatCurrencyShort(dayData.receitas)}</span>
                        )}
                        {dayData.despesas > 0 && (
                          <span className="rounded-full bg-danger-bg px-2 py-0.5 text-danger-fg">−{formatCurrencyShort(dayData.despesas)}</span>
                        )}
                      </span>
                    )}
                  </div>

                  {dayData?.items.length ? (
                    <div className="mt-1.5 space-y-1">
                      {dayData.items.slice(0, 4).map((it) => (
                        <div key={it.id} className="flex min-w-0 items-center gap-2 text-[12px] text-foreground-muted">
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              it.tipo === 'receita' ? 'bg-[hsl(var(--success))]' : 'bg-[hsl(var(--danger))]',
                            )}
                          />
                          <span className="truncate">{it.descricao}</span>
                        </div>
                      ))}
                      {dayData.items.length > 4 && (
                        <div className="pl-3.5 text-[12px] font-medium text-foreground-muted">
                          +{dayData.items.length - 4} lançamentos
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="mt-0.5 block text-[12px] text-foreground-subtle">Sem lançamentos</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </SectionCard>

      <DayDetailDialog
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
        day={selectedDate ? days[selectedDate] || null : null}
      />
    </>
  );
}
