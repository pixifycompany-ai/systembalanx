import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import type { FluxoCaixaData } from '@/hooks/useRelatorios';

interface FluxoCaixaTabProps {
  data: FluxoCaixaData;
}

export function FluxoCaixaTab({ data }: FluxoCaixaTabProps) {
  return (
    <div className="metric-card h-[420px] animate-fade-in">
      <div className="mb-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Fluxo de Caixa realizado — resultado acumulado no período
        </h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Entradas recebidas × saídas pagas em cada mês (o que de fato entrou e saiu do banco, inclusive distribuição de lucros). Mesmo critério dos cards da Início.
        </p>
      </div>
      <ResponsiveContainer width="100%" height="85%">
        <LineChart data={data.chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = { entradas: 'Entradas', saidas: 'Saídas', saldo: 'Acumulado no período' };
              return [formatCurrency(value), labels[name] || name];
            }}
          />
          <Legend formatter={(v) => {
            const labels: Record<string, string> = { entradas: 'Entradas', saidas: 'Saídas', saldo: 'Acumulado no período' };
            return labels[v] || v;
          }} wrapperStyle={{ fontSize: '12px' }} />
          <Line type="monotone" dataKey="entradas" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="saidas" stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
          <Line type="monotone" dataKey="saldo" stroke="hsl(var(--chart-2))" strokeWidth={2.5} dot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
