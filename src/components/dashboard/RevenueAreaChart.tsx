import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FaturamentoVsDespesas } from '@/types/finance';

interface RevenueAreaChartProps {
  data3m: FaturamentoVsDespesas[];
  data6m: FaturamentoVsDespesas[];
  data12m: FaturamentoVsDespesas[];
}

export function RevenueAreaChart({ data3m, data6m, data12m }: RevenueAreaChartProps) {
  const [period, setPeriod] = useState<'3' | '6' | '12'>('6');

  const dataMap = { '3': data3m, '6': data6m, '12': data12m };
  const data = dataMap[period];

  return (
    <div className="metric-card h-[320px] md:h-[400px] animate-fade-in overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Receitas x Despesas
        </h3>
        <Select value={period} onValueChange={(v) => setPeriod(v as '3' | '6' | '12')}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Últimos 3 meses</SelectItem>
            <SelectItem value="6">Últimos 6 meses</SelectItem>
            <SelectItem value="12">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ResponsiveContainer width="100%" height="85%">
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradDespesa" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
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
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
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
              name === 'receita' ? 'Receitas' : 'Despesas',
            ]}
          />
          <Legend
            formatter={(value) => (value === 'receita' ? 'Receitas' : 'Despesas')}
            wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
          />
          <Area
            type="monotone"
            dataKey="receita"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            fill="url(#gradReceita)"
            dot={{ fill: 'hsl(var(--chart-1))', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
          />
          <Area
            type="monotone"
            dataKey="despesa"
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            fill="url(#gradDespesa)"
            dot={{ fill: 'hsl(var(--chart-3))', strokeWidth: 0, r: 3 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
