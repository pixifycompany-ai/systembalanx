import { useMemo } from 'react';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { SectionCard } from '@/components/shared/SectionCard';
import type { DayTransactions, DayItem } from '@/hooks/useCalendario';

export type CalFiltro = 'a_pagar' | 'a_receber' | 'pago' | 'recebido';

export function itemMatches(item: DayItem, filtros: Set<CalFiltro>): boolean {
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
    <SectionCard flush className="overflow-hidden animate-fade-in" title="Resumo por semana" description="Previsão de caixa">
      <div>
        {weeks.map((w) => (
          <div
            key={w.key}
            className={cn('flex items-center gap-3 border-t border-border px-4 py-3 md:px-6', w.isCurrent && 'bg-foreground/[0.03]')}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-foreground">{w.label}</span>
                {w.isCurrent && (
                  <span className="rounded-full bg-info-bg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-info-fg">Atual</span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] tabular-nums text-foreground-muted">
                <span className="text-[hsl(var(--success-fg))]">↑ {formatCurrency(w.entradas)}</span>
                <span>·</span>
                <span className="text-[hsl(var(--danger-fg))]">↓ {formatCurrency(w.saidas)}</span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span
                className={cn(
                  'block font-heading text-sm font-semibold tabular-nums',
                  w.saldo >= 0 ? 'text-[hsl(var(--success-fg))]' : 'text-[hsl(var(--danger-fg))]',
                )}
              >
                {w.saldo >= 0 ? '+' : '−'}{formatCurrency(Math.abs(w.saldo))}
              </span>
              <span className="mt-0.5 block text-[12px] tabular-nums text-foreground-muted">
                acum. {w.acumulado >= 0 ? '' : '−'}{formatCurrency(Math.abs(w.acumulado))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
