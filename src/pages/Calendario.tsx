import { useEffect, useState } from 'react';
import { addDays, addMonths, addWeeks, format } from 'date-fns';
import { CalendarGrid } from '@/components/calendario/CalendarGrid';
import { WeekView } from '@/components/calendario/WeekView';
import { DayView } from '@/components/calendario/DayView';
import { TopDespesasChart } from '@/components/calendario/TopDespesasChart';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';

import { useCalendario, type CalendarioModo } from '@/hooks/useCalendario';
import { SkeletonChart } from '@/components/shared/LoadingSpinner';

const STORAGE_KEY = 'calendario:modo';

export default function Calendario() {
  const [modo, setModo] = useState<CalendarioModo>(() => {
    if (typeof window === 'undefined') return 'mes';
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'semana' || stored === 'hoje' || stored === 'mes' ? stored : 'mes';
  });
  const [refDate, setRefDate] = useState<Date>(new Date());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, modo);
  }, [modo]);

  const { days, topDespesas, totalDespesas, isLoading } = useCalendario(modo, refDate);

  const handlePrev = () => {
    if (modo === 'mes') setRefDate((d) => addMonths(d, -1));
    else if (modo === 'semana') setRefDate((d) => addWeeks(d, -1));
    else setRefDate((d) => addDays(d, -1));
  };

  const handleNext = () => {
    if (modo === 'mes') setRefDate((d) => addMonths(d, 1));
    else if (modo === 'semana') setRefDate((d) => addWeeks(d, 1));
    else setRefDate((d) => addDays(d, 1));
  };

  const dayKey = format(refDate, 'yyyy-MM-dd');

  return (
    <main className="container py-3 md:py-6 max-w-full">
      <div className="mb-4 md:mb-6">
        <h1 className="text-h1 text-foreground">Calendário Financeiro</h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Visualize receitas e despesas por dia
        </p>
      </div>

      {/* Mode toggle */}
      <div className="mb-4">
        <ScrollPills>
          <Pill active={modo === 'mes'} onClick={() => { setModo('mes'); setRefDate(new Date()); }}>
            Mês
          </Pill>
          <Pill active={modo === 'semana'} onClick={() => { setModo('semana'); setRefDate(new Date()); }}>
            Semana
          </Pill>
          <Pill active={modo === 'hoje'} onClick={() => { setModo('hoje'); setRefDate(new Date()); }}>
            Hoje
          </Pill>
        </ScrollPills>
      </div>

      {isLoading ? (
        <SkeletonChart />
      ) : (
        <div className="space-y-4 md:space-y-6">
          {modo === 'mes' && (
            <CalendarGrid
              year={refDate.getFullYear()}
              month={refDate.getMonth()}
              days={days}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          )}
          {modo === 'semana' && (
            <WeekView
              refDate={refDate}
              days={days}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          )}
          {modo === 'hoje' && (
            <DayView
              refDate={refDate}
              day={days[dayKey] || null}
              onPrev={handlePrev}
              onNext={handleNext}
            />
          )}

          {modo === 'mes' && <TopDespesasChart data={topDespesas} total={totalDespesas} />}
        </div>
      )}
    </main>
  );
}
