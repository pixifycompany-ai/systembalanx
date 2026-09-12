import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { HealthScore } from '@/hooks/useAnalises';

interface FinancialHealthScoreProps {
  healthScore: HealthScore;
}

export function FinancialHealthScore({ healthScore }: FinancialHealthScoreProps) {
  const { score, categoria, fatores } = healthScore;

  const categoriaConfig = {
    critico: { label: 'Crítico', color: 'text-red-500', bgColor: 'bg-red-500' },
    atencao: { label: 'Atenção', color: 'text-yellow-500', bgColor: 'bg-yellow-500' },
    bom: { label: 'Bom', color: 'text-blue-500', bgColor: 'bg-blue-500' },
    excelente: { label: 'Excelente', color: 'text-green-500', bgColor: 'bg-green-500' },
  };

  const config = categoriaConfig[categoria];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">Score de Saúde Financeira</CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs text-xs">
                <p className="font-semibold mb-1">Como é calculado:</p>
                <ul className="space-y-0.5 list-disc pl-3">
                  <li><strong>Margem Líquida (25%)</strong> — receita menos despesas do mês</li>
                  <li><strong>Inadimplência (20%)</strong> — receitas vencidas vs total já vencido</li>
                  <li><strong>Crescimento MRR (20%)</strong> — variação da receita recorrente</li>
                  <li><strong>Retenção (15%)</strong> — clientes mantidos no mês</li>
                  <li><strong>Liquidez (20%)</strong> — dias de caixa disponíveis</li>
                </ul>
                <p className="mt-1 text-muted-foreground">Apenas títulos vencidos penalizam o score. Títulos futuros não afetam a inadimplência.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center mb-6">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                className="text-muted"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                className={config.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${score * 2.51} 251`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-semibold", config.color)}>{score}</span>
              <span className="text-xs text-muted-foreground">de 100</span>
            </div>
          </div>
          <span className={cn("text-lg font-semibold mt-2", config.color)}>
            {config.label}
          </span>
        </div>

        <div className="space-y-3">
          {fatores.map((fator) => {
            const displayValue = fator.nome === 'Liquidez' 
              ? `${Math.round(fator.valor)} dias`
              : `${fator.valor.toFixed(1)}%`;
            return (
              <div key={fator.nome} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{fator.nome}</span>
                  <span className="font-medium">{displayValue} <span className="text-muted-foreground text-xs">(peso {fator.peso}%)</span></span>
                </div>
                <Progress 
                  value={Math.min(100, Math.max(0, fator.contribuicao / fator.peso * 100))} 
                  className="h-2"
                />
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-muted-foreground mt-4 leading-tight">
          Score baseado em margem, MRR, retenção, liquidez e atrasos reais. Somente títulos já vencidos penalizam — títulos futuros a receber/pagar não afetam.
        </p>
      </CardContent>
    </Card>
  );
}
