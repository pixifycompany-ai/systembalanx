import { useMemo } from 'react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { DayTransactions, DayItem } from '@/hooks/useCalendario';

export type CalFiltro = 'a_pagar' | 'a_receber' | 'pago' | 'recebido';

function itemMatches(item: DayItem, filtros: Set<CalFiltro>): boolean {
  if (filtros.size === 0) return true; // "Tudo"
  const pend = item.status === 'pendente' || item.status === 'atrasado';
  if (filtros.has('a_pagar') && item.tipo === 'despesa' && pend) return true;
  if (filtros.has('a_receber') && item.tipo === 'receita' && pend) return true;
  if (filtros.has('pago') && item.tipo === 'despesa' && item.status === 'pago') return true;
  if (filtros.has('recebido') && item.tipo === 'receita' && item.status === 'recebido') return true;
  return false;
}

interface WeekRow {
  key: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
  acumulado: number;
  isCurrent: boolean;
}

export function WeeklyForecast({
  days,
  filtros,
}: {
  days: Record<string, DayTransactions>;
  filtros: Set<CalFiltro>;
}) {
  const weeks = useMemo<WeekRow[]>(() => {
    const map = new Map<string, { entradas: number; saidas: number; start: Date }>();
    for (const [dateStr, day] of Object.entries(days)) {
      const date = parseISO(dateStr);
      const wkStart = startOfWeek(date, { weekStartsOn: 1 });
      const key = format(wkStart, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, { entradas: 0, saidas: 0, start: wkStart });
      const acc = map.get(key)!;
      for (const it of day.items) {
        if (!itemMatches(it, filtros)) continue;
        if (it.tipo === 'receita') acc.entradas += Number(it.valor);
        else acc.saidas += Number(it.valor);
      }
    }
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const todayWk = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
    let acumulado = 0;
    return sorted.map(([key, v]) => {
      const saldo = v.entradas - v.saidas;
      acumulado += saldo;
      return {
        key,
        label: `${format(v.start, "dd/MM", { locale: ptBR })} – ${format(endOfWeek(v.start, { weekStartsOn: 1 }), 'dd/MM', { locale: ptBR })}`,
        entradas: v.entradas,
        saidas: v.saidas,
        saldo,
        acumulado,
        isCurrent: key === todayWk,
      };
    });
  }, [days, filtros]);

  if (weeks.length === 0) return null;

  return (
    <section className="auro-card rounded-2xl border border-border/60 bg-surface/55 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Resumo por semana</h3>
          <p className="text-[11px] text-foreground-muted">Previsão de caixa</p>
        </div>
      </div>
      <div className="divide-y divide-border/50">
        {weeks.map((w) => (
          <div key={w.key} className={cn('px-4 py-3', w.isCurrent && 'bg-primary/[0.06]')}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn('text-[13px] font-semibold', w.isCurrent ? 'text-primary' : 'text-foreground')}>
                  {w.label}
                </span>
                {w.isCurrent && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold text-primary">ATUAL</span>}
              </div>
              <span className={cn('text-sm font-semibold tabular-nums', w.saldo >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
                {w.saldo >= 0 ? '+' : '−'}{formatCurrency(Math.abs(w.saldo))}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-foreground-muted">
              <span>
                <span className="text-[hsl(var(--success))]">↑ {formatCurrency(w.entradas)}</span>
                <span className="mx-1.5">·</span>
                <span className="text-[hsl(var(--danger))]">↓ {formatCurrency(w.saidas)}</span>
              </span>
              <span className="tabular-nums">acum. {w.acumulado >= 0 ? '' : '−'}{formatCurrency(Math.abs(w.acumulado))}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
