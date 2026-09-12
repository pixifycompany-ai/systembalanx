import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingDown, TrendingUp, Users } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { ChurnData } from '@/hooks/useAnalises';

interface ChurnRateChartProps {
  churnData: ChurnData;
}

export function ChurnRateChart({ churnData }: ChurnRateChartProps) {
  const { taxaChurnMensal, clientesPerdidos, clientesNovos, clientesAtivos, historicoChurn } = churnData;

  // Calculate variation vs previous month
  const variacao = historicoChurn.length >= 2 
    ? taxaChurnMensal - historicoChurn[historicoChurn.length - 2].taxa 
    : 0;

  const isPositive = variacao <= 0; // Lower churn is better

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Taxa de Churn</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-3xl font-semibold">{taxaChurnMensal.toFixed(1)}%</div>
            <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
              {variacao >= 0 ? '+' : ''}{variacao.toFixed(1)}% vs mês anterior
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Dados do último mês completo
            </div>
          </div>
        </div>

        <div className="h-16 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicoChurn}>
              <XAxis dataKey="mes" tick={false} axisLine={false} />
              <Tooltip 
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Taxa']}
                labelFormatter={(label) => `Mês: ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="taxa" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted">
            <div className="text-lg font-semibold text-green-500">+{clientesNovos}</div>
            <div className="text-xs text-muted-foreground">Novos</div>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <div className="text-lg font-semibold text-red-500">-{clientesPerdidos}</div>
            <div className="text-xs text-muted-foreground">Perdidos</div>
          </div>
          <div className="p-2 rounded-lg bg-muted">
            <div className="flex items-center justify-center gap-1">
              <Users className="h-4 w-4" />
              <span className="text-lg font-semibold">{clientesAtivos}</span>
            </div>
            <div className="text-xs text-muted-foreground">Ativos</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
