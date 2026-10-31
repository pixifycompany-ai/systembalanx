import { useState } from 'react';
import { getMonthNameFull, formatCurrencyShort } from '@/utils/formatters';
import { SectionCard } from '@/components/shared/SectionCard';
import { cn } from '@/lib/utils';
import { DayDetailDialog } from './DayDetailDialog';
import { CalNav } from './CalNav';
import type { DayTransactions } from '@/hooks/useCalendario';

interface CalendarGridProps {
  year: number;
  month: number;
  days: Record<string, DayTransactions>;
  onPrev: () => void;
  onNext: () => void;
}

export function CalendarGrid({ year, month, days, onPrev, onNext }: CalendarGridProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const prevMonthLast = new Date(year, month, 0).getDate();

  const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const cells: { day: number; currentMonth: boolean; dateStr: string }[] = [];

  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthLast - i;
    const m = month === 0 ? 12 : month;
    const y = month === 0 ? year - 1 : year;
    cells.push({ day: d, currentMonth: false, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, currentMonth: true, dateStr: `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
  }

  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      cells.push({ day: d, currentMonth: false, dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` });
    }
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <>
      <SectionCard
        className="animate-fade-in"
        title={<span className="capitalize">{getMonthNameFull(month)} {year}</span>}
        action={<CalNav onPrev={onPrev} onNext={onNext} />}
      >
        <div className="mb-1 grid grid-cols-7 gap-1">
          {weekDays.map((wd, i) => (
            <div key={i} className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, idx) => {
            const dayData = days[cell.dateStr];
            const isToday = cell.dateStr === todayStr;
            const hasData = !!dayData && cell.currentMonth && dayData.items.length > 0;
            const showMarks = !!dayData && cell.currentMonth && (dayData.receitas > 0 || dayData.despesas > 0);

            return (
              <button
                key={idx}
                type="button"
                disabled={!hasData}
                onClick={() => hasData && setSelectedDate(cell.dateStr)}
                aria-label={hasData ? `Ver lançamentos do dia ${cell.day}` : undefined}
                className={cn(
                  'no-touch-min flex min-h-[52px] flex-col items-center gap-1 rounded-[12px] p-1 text-left transition-colors md:min-h-[88px] md:items-stretch md:p-2',
                  hasData ? 'cursor-pointer hover:bg-surface-2' : 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold tabular-nums md:text-[13px]',
                    isToday
                      ? 'bg-foreground text-background'
                      : cell.currentMonth ? 'text-foreground' : 'text-foreground-subtle',
                  )}
                >
                  {cell.day}
                </span>
                {showMarks && (
                  <>
                    {/* Mobile: pontos */}
                    <span className="flex items-center gap-1 md:hidden">
                      {dayData.receitas > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />}
                      {dayData.despesas > 0 && <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--danger))]" />}
                    </span>
                    {/* Desktop: selos tonais com o total do dia */}
                    <span className="hidden flex-col gap-1 md:flex">
                      {dayData.receitas > 0 && (
                        <span className="truncate rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-semibold tabular-nums text-success-fg">
                          +{formatCurrencyShort(dayData.receitas)}
                        </span>
                      )}
                      {dayData.despesas > 0 && (
                        <span className="truncate rounded-full bg-danger-bg px-2 py-0.5 text-[11px] font-semibold tabular-nums text-danger-fg">
                          −{formatCurrencyShort(dayData.despesas)}
                        </span>
                      )}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-4 border-t border-border pt-3 text-[12px] text-foreground-muted">
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--success))]" />Receitas</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[hsl(var(--danger))]" />Despesas</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-foreground" />Hoje</span>
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
