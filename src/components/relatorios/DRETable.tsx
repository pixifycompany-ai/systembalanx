import { useState, useEffect, Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { DRERow } from '@/hooks/useRelatorios';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';
import { SectionCard } from '@/components/shared/SectionCard';
import { EmptyNote } from './ReportKit';

interface DRETableProps {
  rows: DRERow[];
  months: string[];
  /** Reuso pelo DFC (caixa): título, subtítulo e regras de linha próprias. */
  title?: string;
  description?: string;
  /** Linha mostrada entre parênteses (saída/dedução). Padrão: regras do DRE. */
  isNegativeRow?: (label: string) => boolean;
  /** Linha final com destaque. Padrão: "LUCRO / PREJUÍZO LÍQUIDO". */
  bottomLineLabel?: string;
}

const DRE_NEGATIVE = (label: string) =>
  label.includes('DEDUÇ') || label.includes('CUSTO') || label.includes('DESPESA') || label.includes('DISTRIBUIÇÃO');

export function DRETable({
  rows, months,
  title = 'DRE – Demonstrativo de Resultado',
  description = 'Toque numa linha com seta para ver as categorias que a compõem',
  isNegativeRow = DRE_NEGATIVE,
  bottomLineLabel = 'LÍQUIDO',
}: DRETableProps) {
  // Linha final (resultado do período) ganha destaque próprio.
  const isBottomLine = (row: DRERow) => row.type === 'result' && row.label.includes(bottomLineLabel);
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
      <SectionCard title={title}>
        <EmptyNote>Sem dados para o período selecionado</EmptyNote>
      </SectionCard>
    );
  }

  const isDeductionRow = isNegativeRow;

  const fmt = (val: number, label: string) => {
    const showAsNegative = isDeductionRow(label) && val > 0;
    return val === 0 ? '-' : showAsNegative ? `(${formatCurrency(val)})` : formatCurrency(val);
  };

  /** Cor do valor de uma linha de resultado (positivo verde, negativo vermelho). */
  const resultTone = (val: number) =>
    val > 0 ? 'text-[hsl(var(--success-fg))]' : val < 0 ? 'text-[hsl(var(--danger-fg))]' : 'text-foreground-muted';

  return (
    <SectionCard
      flush
      className="animate-fade-in overflow-hidden"
      title={title}
      description={description}
    >
      {/* Mobile: seletor de mês + coluna única */}
      <div className="md:hidden">
        <ScrollPills className="mx-0 px-4 pb-3">
          {months.map((m) => (
            <Pill key={m} active={m === selectedMonth} onClick={() => setSelectedMonth(m)}>
              {m}
            </Pill>
          ))}
        </ScrollPills>

        <div className="border-t border-border [&>div:last-child>div:last-child]:border-b-0">
          {rows.map((row, idx) => {
            const isGroup = row.type === 'group';
            const isResult = row.type === 'result';
            const isItem = row.type === 'item';
            const bottom = isBottomLine(row);
            const val = row.values[selectedMonth] || 0;
            const showAsNegative = isDeductionRow(row.label) && val > 0;
            const hasChildren = !!row.children?.length;
            const isOpen = expanded[row.label];

            return (
              <div key={idx}>
                <div
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-3 border-b border-border px-4',
                    isItem ? 'py-2.5' : 'py-3',
                    isResult && !bottom && 'bg-surface-2',
                    bottom && 'bg-foreground/[0.06]',
                    hasChildren && 'cursor-pointer active:bg-foreground/[0.04]',
                  )}
                  onClick={hasChildren ? () => toggle(row.label) : undefined}
                >
                  <span
                    className={cn(
                      'flex min-w-0 items-center gap-1.5 truncate',
                      isGroup && 'text-[13px] font-semibold text-foreground',
                      isResult && 'text-[14px] font-semibold text-foreground',
                      bottom && 'font-heading text-[15px]',
                      isItem && 'pl-3 text-[13px] text-foreground-muted',
                    )}
                  >
                    {hasChildren && (
                      <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-foreground-muted transition-transform', isOpen && 'rotate-90')} />
                    )}
                    {row.icon && <span className="text-foreground-muted">{row.icon}</span>}
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 text-right tabular-nums',
                      isItem && 'text-[13px] text-foreground-muted',
                      isGroup && 'font-heading text-[13px] font-semibold text-foreground',
                      isResult && cn('font-heading text-[14px] font-semibold', resultTone(val)),
                      bottom && 'text-[16px]',
                      showAsNegative && !isResult && 'text-foreground-muted',
                    )}
                  >
                    {fmt(val, row.label)}
                  </span>
                </div>
                {hasChildren && isOpen && row.children!.map((c) => {
                  const cv = c.values[selectedMonth] || 0;
                  return (
                    <div key={c.label} className="flex min-w-0 items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-2">
                      <span className="flex min-w-0 items-center gap-1.5 truncate pl-7 text-[12px] text-foreground-muted">
                        <span className="inline-block h-1 w-1 shrink-0 rounded-full bg-foreground-muted" />
                        <span className="truncate">{c.label}</span>
                      </span>
                      <span className="shrink-0 text-right text-[12px] tabular-nums text-foreground-muted">
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

      {/* Desktop: tabela horizontal completa */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[500px] text-sm">
          <thead>
            <tr className="border-y border-border">
              <th className="min-w-[240px] px-6 py-3 text-left text-xs font-medium text-foreground-muted">
                Conta
              </th>
              {months.map((m) => (
                <th
                  key={m}
                  className={cn(
                    'min-w-[110px] px-4 py-3 text-right text-xs font-medium text-foreground-muted last:pr-6',
                    m === currentMonthLabel && 'bg-foreground/[0.04] text-foreground',
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
              const bottom = isBottomLine(row);
              const hasChildren = !!row.children?.length;
              const isOpen = expanded[row.label];

              return (
                <Fragment key={idx}>
                  <tr
                    className={cn(
                      'border-b border-border transition-colors last:border-b-0',
                      isResult && !bottom && 'bg-surface-2',
                      bottom && 'bg-foreground/[0.06]',
                      hasChildren && 'cursor-pointer hover:bg-foreground/[0.03]',
                    )}
                    onClick={hasChildren ? () => toggle(row.label) : undefined}
                  >
                    <td
                      className={cn(
                        'px-6',
                        isItem ? 'py-2.5 pl-10 text-sm text-foreground-muted' : 'py-3',
                        isGroup && 'text-[13px] font-semibold text-foreground',
                        isResult && 'text-sm font-semibold text-foreground',
                        bottom && 'font-heading text-[15px]',
                      )}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {hasChildren && (
                          <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-foreground-muted transition-transform', isOpen && 'rotate-90')} />
                        )}
                        {row.icon && <span className="text-foreground-muted">{row.icon}</span>}
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
                            'px-4 text-right tabular-nums last:pr-6',
                            isItem ? 'py-2.5 text-sm' : 'py-3',
                            m === currentMonthLabel && 'bg-foreground/[0.04]',
                            isItem && 'text-foreground-muted',
                            isGroup && 'font-heading font-semibold text-foreground',
                            (isNegative || showAsNegative) && !isResult && 'text-foreground-muted',
                            isResult && cn('font-heading font-semibold', resultTone(val)),
                            bottom && 'text-[15px]',
                          )}
                        >
                          {fmt(val, row.label)}
                        </td>
                      );
                    })}
                  </tr>
                  {hasChildren && isOpen && row.children!.map((c) => (
                    <tr key={`${idx}-${c.label}`} className="border-b border-border bg-surface-2/60">
                      <td className="px-6 py-2 pl-14 text-xs text-foreground-muted">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-1 w-1 rounded-full bg-foreground-muted" />
                          {c.label}
                        </span>
                      </td>
                      {months.map((m) => {
                        const cv = c.values[m] || 0;
                        return (
                          <td
                            key={m}
                            className={cn(
                              'px-4 py-2 text-right text-xs tabular-nums text-foreground-muted last:pr-6',
                              m === currentMonthLabel && 'bg-foreground/[0.04]',
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
    </SectionCard>
  );
}
