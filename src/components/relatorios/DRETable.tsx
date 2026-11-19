import { useState, useEffect, Fragment } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { DRERow } from '@/hooks/useRelatorios';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmptyNote, PillStrip, RelCard } from './ReportKit';

interface DRETableProps {
  rows: DRERow[];
  months: string[];
  /** Título/subtítulo opcionais (o cabeçalho da página já mostra nome e descrição). */
  title?: string;
  description?: string;
  /** Linha mostrada entre parênteses (saída/dedução). Padrão: regras do DRE. */
  isNegativeRow?: (label: string) => boolean;
  /** Linha final com destaque. Padrão: "LUCRO / PREJUÍZO LÍQUIDO". */
  bottomLineLabel?: string;
}

const DRE_NEGATIVE = (label: string) =>
  label.includes('DEDUÇ') || label.includes('CUSTO') || label.includes('DESPESA') || label.includes('DISTRIBUIÇÃO');

const TOTAL = '__total__';

/**
 * Total da linha no período. Linhas de saldo não se somam: saldo inicial = o do
 * 1º mês, saldo final/de fechamento = o do último mês (usado pelo DFC).
 */
function totalDe(values: Record<string, number>, label: string, months: string[]) {
  const up = label.toUpperCase();
  if (up.includes('SALDO INICIAL')) return values[months[0]] ?? 0;
  if (up.includes('SALDO')) return values[months[months.length - 1]] ?? 0;
  return months.reduce((s, m) => s + (values[m] ?? 0), 0);
}

export function DRETable({
  rows, months, title, description,
  isNegativeRow = DRE_NEGATIVE,
  bottomLineLabel = 'LÍQUIDO',
}: DRETableProps) {
  // Linha final (resultado do período) ganha destaque próprio.
  const isBottomLine = (row: DRERow) => row.type === 'result' && row.label.includes(bottomLineLabel);
  const currentMonthLabel = (() => {
    const label = format(new Date(), 'MMM yyyy', { locale: ptBR });
    return label.charAt(0).toUpperCase() + label.slice(1);
  })();

  // Celular: um mês por vez (ou o total). Padrão: mês atual, senão o último.
  const defaultMonth = months.includes(currentMonthLabel) ? currentMonthLabel : months[months.length - 1];
  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (selectedMonth !== TOTAL && !months.includes(selectedMonth) && months.length > 0) setSelectedMonth(defaultMonth);
  }, [months, selectedMonth, defaultMonth]);

  const toggle = (label: string) => setExpanded((e) => ({ ...e, [label]: !e[label] }));

  if (rows.length === 0) {
    return (
      <RelCard title={title} sub={description}>
        <EmptyNote>Sem dados para o período selecionado</EmptyNote>
      </RelCard>
    );
  }

  /** Valor formatado: saídas/deduções entre parênteses; zero vira traço. */
  const fmt = (val: number, label: string) => {
    if (val === 0) return '–';
    if (isNegativeRow(label) && val > 0) return `(${formatCurrency(val)})`;
    if (val < 0) return `(${formatCurrency(Math.abs(val))})`;
    return formatCurrency(val);
  };
  /** Cor: saída/dedução e negativos em vermelho; resultado verde/vermelho. */
  const tom = (val: number, row: DRERow) => {
    if (val === 0) return 'text-foreground-subtle';
    if (row.type === 'result') return val > 0 ? 'text-success-fg' : 'text-danger-fg';
    if (val < 0 || (isNegativeRow(row.label) && val > 0)) return 'text-danger-fg';
    return row.type === 'item' ? 'text-foreground-muted' : 'text-foreground';
  };
  const valorMob = (values: Record<string, number>, label: string) =>
    selectedMonth === TOTAL ? totalDe(values, label, months) : (values[selectedMonth] || 0);

  return (
    <RelCard flush title={title} sub={description} className="animate-fade-in">
      {/* Celular: um mês por vez (ou o total do período) */}
      <div className="md:hidden">
        <PillStrip
          className={cn('px-4 pb-3', !(title || description) && 'pt-4')}
          value={selectedMonth}
          onChange={setSelectedMonth}
          options={[...months.map((m) => ({ value: m, label: m })), { value: TOTAL, label: 'Total' }]}
        />
        <div className="border-t border-border">
          {rows.map((row, idx) => {
            const isGroup = row.type === 'group';
            const isResult = row.type === 'result';
            const isItem = row.type === 'item';
            const bottom = isBottomLine(row);
            const val = valorMob(row.values, row.label);
            const hasChildren = !!row.children?.length;
            const isOpen = expanded[row.label];
            return (
              <div key={idx}>
                <div
                  className={cn(
                    'flex min-w-0 items-center justify-between gap-3 border-b border-border px-4',
                    isItem ? 'py-2.5' : 'py-3',
                    isResult && 'bg-primary/[0.05]',
                    bottom && 'bg-primary/[0.09]',
                    hasChildren && 'cursor-pointer active:bg-surface-2',
                  )}
                  onClick={hasChildren ? () => toggle(row.label) : undefined}
                >
                  <span
                    className={cn(
                      'flex min-w-0 items-center gap-1.5',
                      isGroup && 'text-[13px] font-medium text-foreground',
                      isResult && 'text-[13.5px] font-semibold text-foreground',
                      isItem && 'pl-3 text-[13px] text-foreground',
                    )}
                  >
                    {hasChildren ? <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-foreground-muted transition-transform', isOpen && 'rotate-90')} /> : <span className="w-3.5 shrink-0" />}
                    <span className="truncate">{row.label}</span>
                  </span>
                  <span className={cn('shrink-0 text-right text-[13.5px] tabular-nums', (isResult || isGroup) && 'font-heading font-semibold', bottom && 'text-[15px]', tom(val, row))}>
                    {fmt(val, row.label)}
                  </span>
                </div>
                {hasChildren && isOpen && row.children!.map((c) => {
                  const cv = valorMob(c.values, c.label);
                  return (
                    <div key={c.label} className="flex min-w-0 items-center justify-between gap-3 border-b border-border bg-surface-2/40 px-4 py-2">
                      <span className="min-w-0 truncate pl-9 text-[12.5px] text-foreground-muted">{c.label}</span>
                      <span className="shrink-0 text-right text-[12.5px] tabular-nums text-foreground-muted">{cv === 0 ? '–' : formatCurrency(cv)}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop: meses lado a lado; a coluna da conta fica fixa ao rolar */}
      <div className={cn('hidden overflow-x-auto md:block', !(title || description) && 'pt-1')}>
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-[13px]">
          <thead>
            <tr className="text-[12px] text-foreground-muted">
              <th className="sticky left-0 z-10 min-w-[230px] border-b border-border bg-surface px-5 py-3 text-left font-normal">Valores em R$</th>
              {months.map((m) => (
                <th key={m} className={cn('min-w-[112px] whitespace-nowrap border-b border-border px-3 py-3 text-right font-normal', m === currentMonthLabel && 'text-foreground')}>{m}</th>
              ))}
              <th className="min-w-[124px] border-b border-border bg-surface-2/60 px-4 py-3 pr-5 text-right font-medium text-foreground">Total</th>
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
              const tot = totalDe(row.values, row.label, months);
              // Destaque da linha também na célula fixa (que precisa de fundo opaco).
              const realce = bottom ? 'shadow-[inset_0_0_0_999px_hsl(var(--primary)/0.09)]' : isResult ? 'shadow-[inset_0_0_0_999px_hsl(var(--primary)/0.05)]' : '';
              return (
                <Fragment key={idx}>
                  <tr
                    className={cn('group', hasChildren && 'cursor-pointer')}
                    onClick={hasChildren ? () => toggle(row.label) : undefined}
                  >
                    <td className={cn('sticky left-0 z-10 border-b border-border bg-surface px-5', realce, isItem ? 'py-2.5' : 'py-3', hasChildren && 'group-hover:bg-surface-2')}>
                      <span className={cn(
                        'flex items-center gap-1.5 whitespace-nowrap',
                        isGroup && 'font-medium text-foreground',
                        isResult && 'font-semibold text-foreground',
                        isItem && 'pl-4 text-foreground',
                        bottom && 'font-heading text-[14px]',
                      )}>
                        {hasChildren ? <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-foreground-muted transition-transform', isOpen && 'rotate-90')} /> : <span className="w-3.5 shrink-0" />}
                        {row.label}
                      </span>
                    </td>
                    {months.map((m) => {
                      const val = row.values[m] || 0;
                      return (
                        <td key={m} className={cn('whitespace-nowrap border-b border-border px-3 text-right tabular-nums', realce, isItem ? 'py-2.5' : 'py-3', (isResult || isGroup) && 'font-heading font-semibold', tom(val, row))}>
                          {fmt(val, row.label)}
                        </td>
                      );
                    })}
                    <td className={cn('whitespace-nowrap border-b border-border bg-surface-2/60 px-4 pr-5 text-right font-heading font-semibold tabular-nums', realce, isItem ? 'py-2.5' : 'py-3', bottom && 'text-[14px]', tom(tot, row))}>
                      {fmt(tot, row.label)}
                    </td>
                  </tr>
                  {hasChildren && isOpen && row.children!.map((c) => {
                    const ct = totalDe(c.values, c.label, months);
                    return (
                      <tr key={`${idx}-${c.label}`} className="text-[12.5px] text-foreground-muted">
                        <td className="sticky left-0 z-10 whitespace-nowrap border-b border-border bg-surface px-5 py-2 pl-14 shadow-[inset_0_0_0_999px_hsl(var(--surface-2)/0.4)]">{c.label}</td>
                        {months.map((m) => {
                          const cv = c.values[m] || 0;
                          return <td key={m} className="whitespace-nowrap border-b border-border bg-surface-2/40 px-3 py-2 text-right tabular-nums">{cv === 0 ? '–' : formatCurrency(cv)}</td>;
                        })}
                        <td className="whitespace-nowrap border-b border-border bg-surface-2/60 px-4 py-2 pr-5 text-right tabular-nums">{ct === 0 ? '–' : formatCurrency(ct)}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </RelCard>
  );
}
