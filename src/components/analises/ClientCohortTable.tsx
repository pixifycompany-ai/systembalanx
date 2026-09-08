import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { CohortData } from '@/hooks/useAnalises';

interface ClientCohortTableProps {
  cohorts: CohortData[];
}

export function ClientCohortTable({ cohorts }: ClientCohortTableProps) {
  const getRetentionColor = (value: number | null) => {
    if (value === null) return 'bg-muted text-muted-foreground';
    if (value >= 90) return 'bg-green-500/20 text-green-600 dark:text-green-400';
    if (value >= 70) return 'bg-green-500/10 text-green-500';
    if (value >= 50) return 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400';
    if (value >= 30) return 'bg-orange-500/20 text-orange-600 dark:text-orange-400';
    return 'bg-red-500/20 text-red-600 dark:text-red-400';
  };

  const monthLabels = ['M0', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6'];

  if (cohorts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Cohorts de Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Dados insuficientes para análise de cohorts
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Cohorts de Clientes - Retenção por Mês</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">Cohort</TableHead>
                <TableHead className="w-16 text-center">Clientes</TableHead>
                {monthLabels.map((label) => (
                  <TableHead key={label} className="w-14 text-center">{label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {cohorts.map((cohort) => (
                <TableRow key={cohort.mesEntrada}>
                  <TableCell className="font-medium">{cohort.mesEntrada}</TableCell>
                  <TableCell className="text-center">{cohort.clientesIniciais}</TableCell>
                  {cohort.retencaoMeses.map((valor, index) => (
                    <TableCell 
                      key={index} 
                      className={cn(
                        "text-center font-medium text-sm",
                        getRetentionColor(valor)
                      )}
                    >
                      {valor !== null ? `${valor}%` : '-'}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
          <span>Legenda:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-500/20" />
            <span>≥90%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-yellow-500/20" />
            <span>50-89%</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-500/20" />
            <span>&lt;50%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
