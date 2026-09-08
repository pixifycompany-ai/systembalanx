import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { RevenueProjection } from '@/hooks/useAnalises';

interface RevenueProjectionChartProps {
  data: RevenueProjection[];
}

export function RevenueProjectionChart({ data }: RevenueProjectionChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Projeção de Receitas - Próximos 6 Meses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mes" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'receitaRecorrente' ? 'Recorrente' : 'Variável'
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend 
                formatter={(value) => value === 'receitaRecorrente' ? 'Recorrente' : 'Variável'}
              />
              <Bar 
                dataKey="receitaRecorrente" 
                stackId="a"
                fill="hsl(var(--primary))" 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="receitaVariavel" 
                stackId="a"
                fill="hsl(var(--muted-foreground))" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
