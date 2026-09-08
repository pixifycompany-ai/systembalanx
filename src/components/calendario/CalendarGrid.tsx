import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getMonthNameFull } from '@/utils/formatters';
import { DayDetailDialog } from './DayDetailDialog';
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

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

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
      <div className="metric-card animate-fade-in">
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={onPrev} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold text-foreground">
            {getMonthNameFull(month)} {year}
          </h3>
          <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-px mb-1">
          {weekDays.map((wd) => (
            <div key={wd} className="text-center text-[10px] font-medium text-muted-foreground py-1">
              {wd}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px">
          {cells.map((cell, idx) => {
            const dayData = days[cell.dateStr];
            const isToday = cell.dateStr === todayStr;
            const hasData = dayData && cell.currentMonth && dayData.items.length > 0;

            return (
              <div
                key={idx}
                onClick={() => hasData && setSelectedDate(cell.dateStr)}
                className={`min-h-[60px] md:min-h-[80px] p-1 rounded-md border border-transparent transition-colors ${
                  cell.currentMonth ? 'bg-card' : 'bg-card/40'
                } ${isToday ? 'ring-1 ring-primary' : ''} ${
                  hasData ? 'cursor-pointer hover:bg-accent/50 hover:border-border' : ''
                }`}
              >
                <span
                  className={`text-[11px] font-medium ${
                    cell.currentMonth ? 'text-foreground' : 'text-muted-foreground/50'
                  } ${isToday ? 'text-primary font-bold' : ''}`}
                >
                  {cell.day}
                </span>
                {dayData && cell.currentMonth && (dayData.receitas > 0 || dayData.despesas > 0) && (
                  <div className="mt-1 flex items-center gap-1">
                    {dayData.receitas > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
                    )}
                    {dayData.despesas > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--danger))]" />
                    )}
                  </div>
                )}
              </div>
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
