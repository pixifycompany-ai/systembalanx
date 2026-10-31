import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HexWatermark } from '@/components/shared/NavySurface';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW, NAVY_TONE } from '@/components/shared/navyTokens';
import type { HealthScore } from '@/hooks/useAnalises';

interface FinancialHealthScoreProps {
  healthScore: HealthScore;
}

// Sobre o navy: cores claras fixas (independem do tema).
const categoriaConfig = {
  critico: { label: 'Crítico', color: NAVY_TONE.danger },
  atencao: { label: 'Atenção', color: NAVY_TONE.warning },
  bom: { label: 'Bom', color: 'rgba(255,255,255,0.92)' },
  excelente: { label: 'Excelente', color: NAVY_TONE.success },
};

export function FinancialHealthScore({ healthScore }: FinancialHealthScoreProps) {
  const { score, categoria, fatores } = healthScore;
  const config = categoriaConfig[categoria];

  return (
    <section
      className="relative isolate h-full overflow-hidden rounded-[20px] p-5 text-white animate-fade-in md:rounded-3xl md:p-6"
      style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}
    >
      <HexWatermark className="h-52 -right-10 -bottom-12" />

      <div className="mb-5 flex items-center gap-2">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em] md:text-[17px]">Score de Saúde Financeira</h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger aria-label="Como é calculado" className="text-white/75 transition-colors hover:text-white">
              <Info className="h-3.5 w-3.5" />
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
              <p className="mt-1 text-foreground-muted">Apenas títulos vencidos penalizam o score. Títulos futuros não afetam a inadimplência.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        {/* Medidor */}
        <div className="flex shrink-0 flex-col items-center sm:w-40">
          <div className="relative h-32 w-32">
            <svg className="h-32 w-32 -rotate-90" viewBox="0 0 100 100" aria-hidden>
              <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="8" />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={config.color}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${score * 2.51} 251`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-heading text-[34px] font-semibold leading-none tabular-nums tracking-[-0.03em]">{score}</span>
              <span className="mt-1 text-[11px] text-white/70">de 100</span>
            </div>
          </div>
          <span
            className="mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.10)', color: config.color }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: config.color }} />
            {config.label}
          </span>
        </div>

        {/* Fatores */}
        <div className="min-w-0 flex-1 space-y-3.5">
          {fatores.map((fator) => {
            const displayValue = fator.nome === 'Liquidez'
              ? `${Math.round(fator.valor)} dias`
              : `${fator.valor.toFixed(1)}%`;
            const fill = Math.min(100, Math.max(0, fator.contribuicao / fator.peso * 100));
            return (
              <div key={fator.nome} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-white/80">{fator.nome}</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {displayValue} <span className="text-[11px] font-normal text-white/70">(peso {fator.peso}%)</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${fill}%`, background: 'rgba(255,255,255,0.85)' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-5 text-[11px] leading-snug text-white/70">
        Score baseado em margem, MRR, retenção, liquidez e atrasos reais. Somente títulos já vencidos penalizam — títulos futuros a receber/pagar não afetam.
      </p>
    </section>
  );
}
