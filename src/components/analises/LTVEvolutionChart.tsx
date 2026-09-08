import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { LTVEvolutionData } from '@/hooks/useAnalises';

interface LTVEvolutionChartProps {
  data: LTVEvolutionData[];
}

export function LTVEvolutionChart({ data }: LTVEvolutionChartProps) {
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
        <CardTitle className="text-sm font-medium">Evolução do LTV - Últimos 12 Meses</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="mes" 
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                yAxisId="left"
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis 
                yAxisId="right"
                orientation="right"
                tickFormatter={formatCurrency}
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  formatCurrency(value),
                  name === 'ltv' ? 'LTV Médio' : 'Ticket Médio'
                ]}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend 
                formatter={(value) => value === 'ltv' ? 'LTV Médio' : 'Ticket Médio'}
              />
              <Line 
                yAxisId="left"
                type="monotone" 
                dataKey="ltv" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line 
                yAxisId="right"
                type="monotone" 
                dataKey="ticketMedio" 
                stroke="hsl(var(--muted-foreground))" 
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
