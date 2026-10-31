import { useState, useEffect, Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!months.includes(selectedMonth) && months.length > 0) {
      setSelectedMonth(defaultMonth);
    }
  }, [months, selectedMonth, defaultMonth]);

  const toggle = (label: string) => setExpanded((e) => ({ ...e, [label]: !e[label] }));

  if (rows.length === 0) {
    return (
      <div className="metric-card flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-muted-foreground">Sem dados para o período selecionado</p>
      </div>
    );
  }

  const isDeductionRow = (label: string) =>
    label.includes('DEDUÇ') || label.includes('CUSTO') || label.includes('DESPESA') || label.includes('DISTRIBUIÇÃO');

  return (
    <div className="metric-card animate-fade-in overflow-hidden">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">DRE – Demonstrativo de Resultado</h3>
        <p className="text-xs text-muted-foreground">Toque numa linha com seta para ver as categorias que a compõem</p>
      </div>

      {/* Mobile: month selector + single-column view */}
      <div className="md:hidden">
        <ScrollPills className="mb-3">
          {months.map((m) => (
            <Pill key={m} active={m === selectedMonth} onClick={() => setSelectedMonth(m)}>
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
            const showAsNegative = isDeductionRow(row.label) && val > 0;
            const hasChildren = !!row.children?.length;
            const isOpen = expanded[row.label];

            return (
              <div key={idx}>
                <div
                  className={cn(
                    'flex items-center justify-between gap-3 px-3 py-2 border-b border-border/40 min-w-0',
                    isGroup && 'bg-secondary/50',
                    isResult && 'bg-accent/30',
                    hasChildren && 'cursor-pointer active:bg-accent/40',
                  )}
                  onClick={hasChildren ? () => toggle(row.label) : undefined}
                >
                  <span
                    className={cn(
                      'min-w-0 truncate flex items-center gap-1',
                      isGroup && 'text-[11px] font-semibold uppercase tracking-wide text-foreground',
                      isResult && 'text-sm font-semibold text-foreground',
                      isItem && 'pl-3 text-xs text-muted-foreground',
                    )}
                  >
                    {hasChildren && (
                      <ChevronRight className={cn('h-3 w-3 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                    )}
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
                {hasChildren && isOpen && row.children!.map((c) => {
                  const cv = c.values[selectedMonth] || 0;
                  return (
                    <div key={c.label} className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-border/40 bg-background/40 min-w-0">
                      <span className="min-w-0 truncate pl-7 text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/50" />
                        {c.label}
                      </span>
                      <span className="text-right tabular-nums shrink-0 text-[11px] text-muted-foreground">
                        {cv === 0 ? '-' : formatCurrency(cv)}
                      </span>
                    </div>
                  );
                })}
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
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2 min-w-[220px]">
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
              const hasChildren = !!row.children?.length;
              const isOpen = expanded[row.label];

              return (
                <Fragment key={idx}>
                  <tr
                    className={cn(
                      'border-b border-border/30 transition-colors',
                      isGroup && 'bg-secondary/50',
                      isResult && 'bg-accent/30 font-semibold',
                      hasChildren && 'cursor-pointer hover:bg-accent/40',
                    )}
                    onClick={hasChildren ? () => toggle(row.label) : undefined}
                  >
                    <td
                      className={cn(
                        'px-3 py-2',
                        isGroup && 'text-xs font-semibold uppercase tracking-wide text-foreground',
                        isResult && 'text-sm font-semibold text-foreground',
                        isItem && 'pl-7 text-sm text-muted-foreground',
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {hasChildren && (
                          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-90')} />
                        )}
                        {row.icon && <span className="mr-0.5">{row.icon}</span>}
                        {row.label}
                      </span>
                    </td>
                    {months.map((m) => {
                      const val = row.values[m] || 0;
                      const isNegative = val < 0;
                      const showAsNegative = isDeductionRow(row.label) && val > 0;
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
                  {hasChildren && isOpen && row.children!.map((c) => (
                    <tr key={`${idx}-${c.label}`} className="border-b border-border/20 bg-background/40">
                      <td className="px-3 py-1.5 pl-12 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block w-1 h-1 rounded-full bg-muted-foreground/50" />
                          {c.label}
                        </span>
                      </td>
                      {months.map((m) => {
                        const cv = c.values[m] || 0;
                        return (
                          <td
                            key={m}
                            className={cn(
                              'text-right px-3 py-1.5 tabular-nums text-xs text-muted-foreground',
                              m === currentMonthLabel && 'bg-accent/30',
                            )}
                          >
                            {cv === 0 ? '-' : formatCurrency(cv)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
