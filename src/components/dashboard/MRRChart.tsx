import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import type { MRRHistorico } from '@/types/finance';

interface MRRChartProps {
  historico: MRRHistorico[];
  projecao: MRRHistorico[];
  title?: string;
}

export function MRRChart({ historico, projecao, title = 'MRR - Receita Recorrente Mensal' }: MRRChartProps) {
  // Combine historical and projected data
  const data = [
    ...historico.map(item => ({ ...item, tipo: 'historico' })),
    ...projecao.map(item => ({ ...item, tipo: 'projecao' })),
  ];

  return (
    <div className="metric-card h-[300px] md:h-[360px] animate-fade-in overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</h3>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-foreground" />
            <span className="text-muted-foreground">Realizado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/40" />
            <span className="text-muted-foreground">Projeção</span>
          </div>
        </div>
      </div>
      
      <ResponsiveContainer width="100%" height="90%">
        <BarChart
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
            formatter={(value: number, _name: string, props: { payload?: { tipo?: string } }) => [
              formatCurrency(value),
              props.payload?.tipo === 'projecao' ? 'Projeção MRR' : 'MRR'
            ]}
          />
          <Bar 
            dataKey="valor" 
            radius={[3, 3, 0, 0]}
            maxBarSize={40}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.tipo === 'projecao' 
                  ? 'hsl(var(--muted-foreground) / 0.3)' 
                  : 'hsl(var(--foreground))'
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
