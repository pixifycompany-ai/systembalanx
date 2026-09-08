import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import type { ComparativoData } from '@/hooks/useRelatorios';

interface ComparativoTabProps {
  data: ComparativoData;
}

export function ComparativoTab({ data }: ComparativoTabProps) {
  if (data.rows.length === 0) {
    return (
      <div className="metric-card flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-muted-foreground">Sem dados para comparação</p>
      </div>
    );
  }

  return (
    <div className="metric-card animate-fade-in overflow-x-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Comparativo entre Períodos</h3>
        <p className="text-xs text-muted-foreground">
          {data.periodo1Label} vs {data.periodo2Label}
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">Conta</th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">{data.periodo1Label}</th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">{data.periodo2Label}</th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">Variação</th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-2">%</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row) => (
            <tr key={row.label} className="border-b border-border/30">
              <td className="px-3 py-2 font-medium text-foreground">{row.label}</td>
              <td className="text-right px-3 py-2 tabular-nums text-muted-foreground">
                {formatCurrency(row.periodo1)}
              </td>
              <td className="text-right px-3 py-2 tabular-nums text-foreground">
                {formatCurrency(row.periodo2)}
              </td>
              <td className={cn(
                'text-right px-3 py-2 tabular-nums',
                row.variacao >= 0 ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {row.variacao >= 0 ? '+' : ''}{formatCurrency(row.variacao)}
              </td>
              <td className={cn(
                'text-right px-3 py-2 tabular-nums font-medium',
                row.variacaoPercent >= 0 ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {row.variacaoPercent >= 0 ? '↑' : '↓'} {Math.abs(row.variacaoPercent).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
