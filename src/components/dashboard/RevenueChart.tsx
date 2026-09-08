import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import type { FaturamentoVsDespesas } from '@/types/finance';

interface RevenueChartProps {
  data: FaturamentoVsDespesas[];
  title?: string;
}

export function RevenueChart({ data, title = 'Faturamento vs Despesas' }: RevenueChartProps) {
  return (
    <div className="metric-card h-[360px] animate-fade-in">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">{title}</h3>
      
      <ResponsiveContainer width="100%" height="90%">
        <LineChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="hsl(var(--border))" 
            vertical={false}
          />
          <XAxis 
            dataKey="mes" 
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '6px',
              fontSize: '12px',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, name: string) => [
              formatCurrency(value),
              name === 'receita' ? 'Receitas' : 'Despesas'
            ]}
          />
          <Legend 
            formatter={(value) => value === 'receita' ? 'Receitas' : 'Despesas'}
            wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="receita"
            stroke="hsl(var(--foreground))"
            strokeWidth={2}
            dot={{ fill: 'hsl(var(--foreground))', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="despesa"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={{ fill: 'hsl(var(--muted-foreground))', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
