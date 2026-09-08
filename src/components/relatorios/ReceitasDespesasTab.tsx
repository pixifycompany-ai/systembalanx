import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatCurrency } from '@/utils/formatters';
import { MetricCard } from '@/components/dashboard/MetricCard';
import type { RecDespResumo } from '@/hooks/useRelatorios';

interface ReceitasDespesasTabProps {
  data: RecDespResumo;
}

const BRAND_TOKEN: Record<string, string> = {
  PIXIFY: 'var(--brand-pixify)',
  REVVUE: 'var(--brand-revvue)',
  CLARIO: 'var(--brand-clario)',
  TABELIO: 'var(--brand-tabelio)',
};

export function ReceitasDespesasTab({ data }: ReceitasDespesasTabProps) {
  const totalEmpresas = data.receitaPorEmpresa.reduce((s, e) => s + e.valor, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard title="Total Receitas" value={data.totalReceitas} variant="positive" />
        <MetricCard title="Total Despesas" value={data.totalDespesas} variant="negative" />
        <MetricCard title="Resultado" value={data.resultado} variant={data.resultado >= 0 ? 'positive' : 'negative'} />
        <MetricCard title="Margem" value={data.margem} isCurrency={false} subtitle="%" variant="info" />
      </div>

      {/* Receita por empresa-fonte */}
      <div className="metric-card">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Receita por Empresa
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {data.receitaPorEmpresa.map((item) => {
            const color = BRAND_TOKEN[item.empresa];
            const percent = totalEmpresas > 0 ? (item.valor / totalEmpresas) * 100 : 0;
            return (
              <div
                key={item.empresa}
                className="rounded-lg border p-3"
                style={{
                  borderColor: `hsl(${color} / 0.2)`,
                  backgroundColor: `hsl(${color} / 0.04)`,
                }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `hsl(${color})` }} />
                  <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: `hsl(${color})` }}>
                    {item.empresa}
                  </span>
                </div>
                <p className="text-base md:text-lg font-semibold tabular-nums text-foreground">
                  {formatCurrency(item.valor)}
                </p>
                <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  {percent.toFixed(1)}% do total
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="metric-card h-[360px]">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">
          Receitas vs Despesas por Mês
        </h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={data.barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="mes" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
              formatter={(value: number, name: string) => [formatCurrency(value), name === 'receitas' ? 'Receitas' : 'Despesas']}
            />
            <Legend formatter={(v) => v === 'receitas' ? 'Receitas' : 'Despesas'} wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="receitas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="despesas" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
