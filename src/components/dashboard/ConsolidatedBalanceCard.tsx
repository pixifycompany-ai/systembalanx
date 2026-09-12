import { formatCurrency } from '@/utils/formatters';
import { Separator } from '@/components/ui/separator';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

export interface AccountBalance {
  id: string;
  nome: string;
  saldo: number;
  cor: string;
}

interface ConsolidatedBalanceCardProps {
  accounts: AccountBalance[];
  total: number;
  history: { mes: string; valor: number }[];
}

export function ConsolidatedBalanceCard({ accounts, total, history }: ConsolidatedBalanceCardProps) {
  return (
    <div className="metric-card animate-fade-in">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
        Saldo Consolidado
      </h3>

      <div className="space-y-3 mb-4">
        {accounts.map((acc) => (
          <div key={acc.id} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: acc.cor }}
              />
              <span className="text-sm text-foreground">{acc.nome}</span>
            </div>
            <span className="text-sm tabular-nums text-foreground font-medium">
              {formatCurrency(acc.saldo)}
            </span>
          </div>
        ))}
      </div>

      {accounts.length > 0 && <Separator className="mb-4" />}

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold text-foreground">Total</span>
        <span className="text-lg font-semibold tabular-nums text-foreground">
          {formatCurrency(total)}
        </span>
      </div>

      {history.length > 1 && (
        <div className="h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line
                type="monotone"
                dataKey="valor"
                stroke="hsl(var(--chart-1))"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
