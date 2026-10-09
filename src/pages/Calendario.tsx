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

const FILTROS: { value: CalFiltro; label: string }[] = [
  { value: 'a_receber', label: 'A receber' },
  { value: 'recebido', label: 'Recebido' },
  { value: 'a_pagar', label: 'A pagar' },
  { value: 'pago', label: 'Pago' },
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

  return (
    <main className="container py-3 md:py-6 max-w-full">
      <MobilePageHeader eyebrow="Financeiro" title="Calendário" />


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

      {/* Filtro de previsão de caixa (multi-seleção) */}
      <div className="mb-4">
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
        <div className="space-y-4 md:space-y-6">
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

          {(modo === 'mes' || modo === 'semana') && <WeeklyForecast days={days} filtros={filtros} />}

          {modo === 'mes' && <TopDespesasChart data={topDespesas} total={totalDespesas} />}
        </div>
      )}
    </main>
  );
}
