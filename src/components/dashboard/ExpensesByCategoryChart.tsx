import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '@/utils/formatters';

export interface CategoryExpense {
  categoria: string;
  valor: number;
  cor: string;
}

interface ExpensesByCategoryChartProps {
  data: CategoryExpense[];
  title?: string;
}

export function ExpensesByCategoryChart({ 
  data, 
  title = 'Despesas por Categoria' 
}: ExpensesByCategoryChartProps) {
  const total = data.reduce((sum, item) => sum + item.valor, 0);

  // Custom label renderer
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
    cx: number;
    cy: number;
    midAngle: number;
    innerRadius: number;
    outerRadius: number;
    percent: number;
  }) => {
    if (percent < 0.05) return null; // Don't show label for slices < 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={12}
        fontWeight={500}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: CategoryExpense }> }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const percentage = ((item.valor / total) * 100).toFixed(1);
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{item.categoria}</p>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(item.valor)} ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom legend
  const renderLegend = (props: unknown) => {
    const { payload } = props as { payload?: Array<{ value: string; color?: string; payload: { valor: number } }> };
    if (!payload) return null;

    return (
      <div className="flex flex-wrap gap-2 justify-center mt-4">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-1.5 text-xs">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color || '#6B7280' }}
            />
            <span className="text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (data.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
        <div className="flex items-center justify-center h-[200px] text-muted-foreground">
          Nenhuma despesa registrada
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 md:p-6 overflow-hidden">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h3 className="text-sm font-medium text-muted-foreground truncate">{title}</h3>
        <span className="text-sm font-medium text-foreground tabular-nums shrink-0">
          Total: {formatCurrency(total)}
        </span>
      </div>
      
      <div className="h-[200px] md:h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderLabel}
              outerRadius={80}
              innerRadius={40}
              dataKey="valor"
              nameKey="categoria"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.cor} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={renderLegend} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

// Mock data for development
export const MOCK_EXPENSES_BY_CATEGORY: CategoryExpense[] = [
  { categoria: 'Ferramentas e Software', valor: 2500, cor: '#3B82F6' },
  { categoria: 'Marketing', valor: 1800, cor: '#EC4899' },
  { categoria: 'Infraestrutura', valor: 1200, cor: '#10B981' },
  { categoria: 'Pessoal', valor: 3200, cor: '#8B5CF6' },
  { categoria: 'Impostos', valor: 950, cor: '#EF4444' },
  { categoria: 'Outros', valor: 508, cor: '#6B7280' },
];
