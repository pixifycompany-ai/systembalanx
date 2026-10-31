import type { ReactNode } from 'react';
import { formatCurrency } from '@/utils/formatters';
import type { ComparativoData } from '@/hooks/useRelatorios';
import { SectionCard } from '@/components/shared/SectionCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyNote } from './ReportKit';

interface ComparativoTabProps {
  data: ComparativoData;
  /** Seletor do período de comparação (chips), exibido sob o título. */
  toolbar?: ReactNode;
}

const VarBadge = ({ pct }: { pct: number }) => (
  <span className="inline-flex items-center whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
    {pct >= 0 ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
  </span>
);

export function ComparativoTab({ data, toolbar }: ComparativoTabProps) {
  if (data.rows.length === 0) {
    return (
      <SectionCard title="Comparativo entre Períodos">
        {toolbar && <div className="mb-2">{toolbar}</div>}
        <EmptyNote>Sem dados para comparação</EmptyNote>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      flush
      className="animate-fade-in overflow-hidden"
      title="Comparativo entre Períodos"
      description={`${data.periodo1Label} vs ${data.periodo2Label}`}
    >
      {toolbar && <div className="px-4 pb-4 md:px-6">{toolbar}</div>}

      {/* Mobile: lista */}
      <div className="md:hidden">
        {data.rows.map((row) => (
          <div key={row.label} className="border-t border-border px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-semibold text-foreground">{row.label}</span>
              <span className="shrink-0 font-heading text-sm font-semibold tabular-nums text-foreground">
                {formatCurrency(row.periodo2)}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 text-[12px] text-foreground-muted">
              <span className="min-w-0 truncate tabular-nums">
                {data.periodo1Label}: {formatCurrency(row.periodo1)} · {row.variacao >= 0 ? '+' : ''}{formatCurrency(row.variacao)}
              </span>
              <VarBadge pct={row.variacaoPercent} />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: tabela */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-t border-border hover:bg-transparent">
              <TableHead className="pl-6">Conta</TableHead>
              <TableHead className="text-right">{data.periodo1Label}</TableHead>
              <TableHead className="text-right">{data.periodo2Label}</TableHead>
              <TableHead className="text-right">Variação</TableHead>
              <TableHead className="pr-6 text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.label} className="border-border">
                <TableCell className="pl-6 font-medium text-foreground">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground-muted">
                  {formatCurrency(row.periodo1)}
                </TableCell>
                <TableCell className="text-right font-heading font-semibold tabular-nums text-foreground">
                  {formatCurrency(row.periodo2)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-foreground-muted">
                  {row.variacao >= 0 ? '+' : ''}{formatCurrency(row.variacao)}
                </TableCell>
                <TableCell className="pr-6 text-right">
                  <VarBadge pct={row.variacaoPercent} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  );
}
