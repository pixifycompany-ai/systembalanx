import { SectionCard } from '@/components/shared/SectionCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyNote } from '@/components/relatorios/ReportKit';
import { cn } from '@/lib/utils';
import type { CohortData } from '@/hooks/useAnalises';

interface ClientCohortTableProps {
  cohorts: CohortData[];
}

export function ClientCohortTable({ cohorts }: ClientCohortTableProps) {
  // Selos tonais do tema (contraste ok no claro e no escuro).
  const getRetentionColor = (value: number | null) => {
    if (value === null) return 'text-foreground-subtle';
    if (value >= 90) return 'bg-success-bg text-success-fg';
    if (value >= 70) return 'bg-success-bg/60 text-success-fg';
    if (value >= 50) return 'bg-warning-bg text-warning-fg';
    if (value >= 30) return 'bg-danger-bg/60 text-danger-fg';
    return 'bg-danger-bg text-danger-fg';
  };

  const monthLabels = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'];

  if (cohorts.length === 0) {
    return (
      <SectionCard title="Cohorts de Clientes">
        <EmptyNote>Dados insuficientes para análise de cohorts</EmptyNote>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      flush
      className="overflow-hidden animate-fade-in"
      title="Cohorts de Clientes - Retenção por Mês"
      action={
        <div className="flex items-center gap-2 text-[11px] text-foreground-muted">
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-success-bg ring-1 ring-inset ring-border" />≥90%</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-warning-bg ring-1 ring-inset ring-border" />50-89%</span>
          <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-danger-bg ring-1 ring-inset ring-border" />&lt;50%</span>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow className="border-t border-border hover:bg-transparent">
            <TableHead className="w-28 pl-4 md:pl-6">Cohort</TableHead>
            <TableHead className="w-16 text-center">Clientes</TableHead>
            {monthLabels.map((label) => (
              <TableHead key={label} className="w-14 px-1 text-center last:pr-4 md:last:pr-6">{label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {cohorts.map((cohort) => (
            <TableRow key={cohort.mesEntrada} className="border-border">
              <TableCell className="whitespace-nowrap pl-4 font-medium md:pl-6">{cohort.mesEntrada}</TableCell>
              <TableCell className="text-center tabular-nums text-foreground-muted">{cohort.clientesIniciais}</TableCell>
              {cohort.retencaoMeses.map((valor, index) => (
                <TableCell key={index} className="px-1 py-2.5 text-center last:pr-4 md:last:pr-6">
                  <span
                    className={cn(
                      'inline-flex min-w-[46px] justify-center rounded-full px-2 py-1 text-[12px] font-semibold tabular-nums',
                      getRetentionColor(valor),
                    )}
                  >
                    {valor !== null ? `${valor}%` : '-'}
                  </span>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
