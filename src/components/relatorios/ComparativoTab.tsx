import type { ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { ComparativoData } from '@/hooks/useRelatorios';
import { EmptyNote, RelCard } from './ReportKit';

interface ComparativoTabProps {
  data: ComparativoData;
  /** Seletor do período de comparação, exibido no topo do bloco. */
  toolbar?: ReactNode;
}

/** Linhas em que subir é ruim (custos, despesas, deduções). */
const ehCusto = (label: string) => /dedu|custo|despesa/i.test(label);

function VarBadge({ pct, custo }: { pct: number; custo: boolean }) {
  const bom = custo ? pct <= 0 : pct >= 0;
  return (
    <span className={cn('inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium tabular-nums',
      pct === 0 ? 'bg-surface-2 text-foreground-muted' : bom ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')}>
      {pct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
    </span>
  );
}

export function ComparativoTab({ data, toolbar }: ComparativoTabProps) {
  if (data.rows.length === 0) {
    return (
      <RelCard action={toolbar}>
        <EmptyNote>Sem dados para comparação</EmptyNote>
      </RelCard>
    );
  }

  return (
    <RelCard flush className="animate-fade-in" sub={`${data.periodo1Label} × ${data.periodo2Label}`} action={toolbar}>
      {/* Celular: lista */}
      <div className="md:hidden">
        {data.rows.map((row) => {
          const resultado = /resultado/i.test(row.label);
          return (
            <div key={row.label} className={cn('border-t border-border px-4 py-3', resultado && 'bg-primary/[0.05]')}>
              <div className="flex items-center justify-between gap-3">
                <span className={cn('min-w-0 truncate text-[13.5px] text-foreground', resultado && 'font-semibold')}>{row.label}</span>
                <span className="shrink-0 font-heading text-[14px] font-semibold tabular-nums text-foreground">{formatCurrency(row.periodo2)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between gap-3 text-[12px] text-foreground-muted">
                <span className="min-w-0 truncate tabular-nums">
                  {data.periodo1Label}: {formatCurrency(row.periodo1)} · {row.variacao >= 0 ? '+' : '−'}{formatCurrency(Math.abs(row.variacao))}
                </span>
                <VarBadge pct={row.variacaoPercent} custo={ehCusto(row.label)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[620px] text-[13px]">
          <thead>
            <tr className="border-y border-border text-[12px] text-foreground-muted">
              <th className="px-5 py-3 text-left font-normal">Linha</th>
              <th className="px-3 py-3 text-right font-normal">{data.periodo1Label}</th>
              <th className="bg-surface-2/60 px-3 py-3 text-right font-medium text-foreground">{data.periodo2Label}</th>
              <th className="px-3 py-3 text-right font-normal">Variação</th>
              <th className="px-5 py-3 text-right font-normal">%</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => {
              const resultado = /resultado/i.test(row.label);
              return (
                <tr key={row.label} className={cn('border-b border-border last:border-b-0', resultado && 'bg-primary/[0.05]')}>
                  <td className={cn('px-5 py-3 text-foreground', resultado && 'font-semibold')}>{row.label}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-foreground-muted">{formatCurrency(row.periodo1)}</td>
                  <td className="bg-surface-2/60 px-3 py-3 text-right font-heading font-semibold tabular-nums text-foreground">{formatCurrency(row.periodo2)}</td>
                  <td className={cn('px-3 py-3 text-right tabular-nums', row.variacao < 0 ? 'text-danger-fg' : 'text-foreground-muted')}>
                    {row.variacao < 0 ? `(${formatCurrency(Math.abs(row.variacao))})` : `+${formatCurrency(row.variacao)}`}
                  </td>
                  <td className="px-5 py-3 text-right"><VarBadge pct={row.variacaoPercent} custo={ehCusto(row.label)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </RelCard>
  );
}
