import { useEffect, useMemo, useState } from 'react';
import { addDays, addMonths, addWeeks, format } from 'date-fns';
import { CalendarGrid } from '@/components/calendario/CalendarGrid';
import { WeekView } from '@/components/calendario/WeekView';
import { DayView } from '@/components/calendario/DayView';
import { TopDespesasChart } from '@/components/calendario/TopDespesasChart';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { WeeklyForecast, itemMatches, type CalFiltro } from '@/components/calendario/WeeklyForecast';

import { useCalendario, type CalendarioModo, type DayTransactions } from '@/hooks/useCalendario';
import { SkeletonChart } from '@/components/shared/LoadingSpinner';
import { cn } from '@/lib/utils';

const FILTROS: { value: CalFiltro; label: string }[] = [
  { value: 'a_receber', label: 'A receber' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'a_pagar', label: 'A pagar' },
  { value: 'pago', label: 'Pago' },
];

const MODOS: { value: CalendarioModo; label: string }[] = [
  { value: 'mes', label: 'Mês' },
  { value: 'semana', label: 'Semana' },
  { value: 'hoje', label: 'Hoje' },
];

const STORAGE_KEY = 'calendario:modo';

export default function Calendario() {
  const [modo, setModo] = useState<CalendarioModo>(() => {
    if (typeof window === 'undefined') return 'mes';
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'semana' || stored === 'hoje' || stored === 'mes' ? stored : 'mes';
  });
  const [refDate, setRefDate] = useState<Date>(new Date());
  const [filtros, setFiltros] = useState<Set<CalFiltro>>(new Set());
  const toggleFiltro = (f: CalFiltro) =>
    setFiltros((prev) => {
      const n = new Set(prev);
      if (n.has(f)) n.delete(f); else n.add(f);
      return n;
    });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, modo);
  }, [modo]);

  const { days, topDespesas, totalDespesas, isLoading } = useCalendario(modo, refDate);

  // Aplica os mesmos filtros (A receber/Recebido/A pagar/Pago) DENTRO do calendário:
  // pontinhos e detalhe do dia passam a bater com o "Resumo por semana".
  const filteredDays = useMemo<Record<string, DayTransactions>>(() => {
    if (filtros.size === 0) return days;
    const out: Record<string, DayTransactions> = {};
    for (const [date, day] of Object.entries(days)) {
      const items = day.items.filter((it) => itemMatches(it, filtros));
      if (items.length === 0) continue;
      const receitas = items.filter((i) => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0);
      const despesas = items.filter((i) => i.tipo === 'despesa').reduce((s, i) => s + i.valor, 0);
      out[date] = { date, receitas, despesas, items };
    }
    return out;
  }, [days, filtros]);

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

  const showSide = modo === 'mes' || modo === 'semana';

  return (
    <main className="container max-w-full py-3 md:py-6">
      <MobilePageHeader
        eyebrow="Análise"
        title="Calendário"
        actions={
          <div role="group" aria-label="Visualização" className="flex items-center gap-1 rounded-full border border-border bg-surface p-1">
            {MODOS.map((m) => (
              <button
                key={m.value}
                type="button"
                aria-pressed={modo === m.value}
                onClick={() => { setModo(m.value); setRefDate(new Date()); }}
                className={cn(
                  'no-touch-min h-8 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                  modo === m.value ? 'bg-foreground text-background' : 'text-foreground-muted hover:text-foreground',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Filtro de previsão de caixa (multi-seleção) */}
      <div className="mb-4 md:mb-6">
        <ScrollPills>
          <Pill active={filtros.size === 0} onClick={() => setFiltros(new Set())}>
            Tudo
          </Pill>
          {FILTROS.map((f) => (
            <Pill key={f.value} active={filtros.has(f.value)} onClick={() => toggleFiltro(f.value)}>
              {f.label}
            </Pill>
          ))}
        </ScrollPills>
      </div>

      {isLoading ? (
        <SkeletonChart />
      ) : (
        <div className={cn('grid gap-4 md:gap-6', showSide && 'xl:grid-cols-3')}>
          <div className={cn('min-w-0', showSide && 'xl:col-span-2')}>
            {modo === 'mes' && (
              <CalendarGrid
                year={refDate.getFullYear()}
                month={refDate.getMonth()}
                days={filteredDays}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            )}
            {modo === 'semana' && (
              <WeekView
                refDate={refDate}
                days={filteredDays}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            )}
            {modo === 'hoje' && (
              <DayView
                refDate={refDate}
                day={filteredDays[dayKey] || null}
                onPrev={handlePrev}
                onNext={handleNext}
              />
            )}
          </div>

          {showSide && (
            <div className="min-w-0 space-y-4 md:space-y-6">
              <WeeklyForecast days={days} filtros={filtros} />
              {modo === 'mes' && <TopDespesasChart data={topDespesas} total={totalDespesas} />}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
