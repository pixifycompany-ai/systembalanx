import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { DRERow } from '@/hooks/useRelatorios';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';

interface DRETableProps {
  rows: DRERow[];
  months: string[];
}

export function DRETable({ rows, months }: DRETableProps) {
  const currentMonthLabel = (() => {
    const now = new Date();
    const label = format(now, 'MMM yyyy', { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  // Mobile: select one month at a time. Default to current month if available, else last month.
  const defaultMonth = months.includes(currentMonthLabel) ? currentMonthLabel : months[months.length - 1];
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);

  useEffect(() => {
    if (!months.includes(selectedMonth) && months.length > 0) {
      setSelectedMonth(defaultMonth);
    }
  }, [months, selectedMonth, defaultMonth]);

  if (rows.length === 0) {
    return (
      <div className="metric-card flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-muted-foreground">Sem dados para o período selecionado</p>
      </div>
    );
  }

  return (
    <div className="metric-card animate-fade-in overflow-hidden">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">DRE – Demonstrativo de Resultado</h3>
        <p className="text-xs text-muted-foreground">Visão comparativa por período</p>
      </div>

      {/* Mobile: month selector + single-column view */}
      <div className="md:hidden">
        <ScrollPills className="mb-3">
          {months.map((m) => (
            <Pill
              key={m}
              active={m === selectedMonth}
              onClick={() => setSelectedMonth(m)}
            >
              {m}
            </Pill>
          ))}
        </ScrollPills>

        <div className="rounded-lg border border-border overflow-hidden">
          {rows.map((row, idx) => {
            const isGroup = row.type === 'group';
            const isResult = row.type === 'result';
            const isItem = row.type === 'item';
            const val = row.values[selectedMonth] || 0;
            const isDeduction =
              row.label.includes('DEDUÇ') || row.label.includes('CUSTO') || row.label.includes('DESPESA');
            const showAsNegative = isDeduction && val > 0;

            return (
              <div
                key={idx}
                className={cn(
                  'flex items-center justify-between gap-3 px-3 py-2 border-b border-border/40 last:border-b-0 min-w-0',
                  isGroup && 'bg-secondary/50',
                  isResult && 'bg-accent/30',
                )}
              >
                <span
                  className={cn(
                    'min-w-0 truncate',
                    isGroup && 'text-[11px] font-bold uppercase tracking-wide text-foreground',
                    isResult && 'text-sm font-semibold text-foreground',
                    isItem && 'pl-3 text-xs text-muted-foreground',
                  )}
                >
                  {row.icon && <span className="mr-1">{row.icon}</span>}
                  {row.label}
                </span>
                <span
                  className={cn(
                    'text-right tabular-nums shrink-0 text-xs',
                    isResult && 'text-sm font-semibold',
                    showAsNegative && 'text-muted-foreground',
                  )}
                >
                  {val === 0 ? '-' : showAsNegative ? `(${formatCurrency(val)})` : formatCurrency(val)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: full horizontal table */}
      <div className="hidden md:block overflow-x-auto -mx-4 px-4">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[200px]">
                Conta
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={cn(
                    'text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[100px]',
                    m === currentMonthLabel && 'bg-accent/50',
                  )}
                >
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const isGroup = row.type === 'group';
              const isResult = row.type === 'result';
              const isItem = row.type === 'item';

              return (
                <tr
                  key={idx}
                  className={cn(
                    'border-b border-border/30 transition-colors',
                    isGroup && 'bg-secondary/50',
                    isResult && 'bg-accent/30 font-semibold',
                  )}
                >
                  <td
                    className={cn(
                      'px-3 py-2',
                      isGroup && 'text-xs font-bold uppercase tracking-wide text-foreground',
                      isResult && 'text-sm font-semibold text-foreground',
                      isItem && 'pl-7 text-sm text-muted-foreground',
                    )}
                  >
                    {row.icon && <span className="mr-1.5">{row.icon}</span>}
                    {row.label}
                  </td>
                  {months.map((m) => {
                    const val = row.values[m] || 0;
                    const isNegative = val < 0;
                    const isDeduction =
                      row.label.includes('DEDUÇ') || row.label.includes('CUSTO') || row.label.includes('DESPESA');
                    const showAsNegative = isDeduction && val > 0;

                    return (
                      <td
                        key={m}
                        className={cn(
                          'text-right px-3 py-2 tabular-nums text-sm',
                          m === currentMonthLabel && 'bg-accent/50',
                          isNegative && 'text-muted-foreground',
                          showAsNegative && 'text-muted-foreground',
                          isResult && val > 0 && 'text-foreground',
                          isResult && val < 0 && 'text-muted-foreground',
                        )}
                      >
                        {val === 0 ? '-' : showAsNegative ? `(${formatCurrency(val)})` : formatCurrency(val)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
