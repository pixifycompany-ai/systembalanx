import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { useAnalises } from '@/hooks/useAnalises';
import { FinancialHealthScore } from '@/components/analises/FinancialHealthScore';
import { ChurnRateChart } from '@/components/analises/ChurnRateChart';
import { LTVEvolutionChart } from '@/components/analises/LTVEvolutionChart';
import { RevenueProjectionChart } from '@/components/analises/RevenueProjectionChart';
import { ClientCohortTable } from '@/components/analises/ClientCohortTable';
import { ClientProfitabilityTable } from '@/components/analises/ClientProfitabilityTable';

export default function Analises() {
  const {
    ltvEvolution,
    churnData,
    cohorts,
    revenueProjection,
    clientProfitability,
    healthScore,
    isLoading,
    error
  } = useAnalises();

  if (isLoading) {
    return (
      <main className="container py-6">
        <LoadingSpinner />
      </main>
    );
  }

  if (error) {
    return (
      <main className="container py-6">
        <div className="rounded-[20px] border border-border bg-surface p-6 text-center text-sm text-[hsl(var(--danger-fg))]">
          Erro ao carregar dados: {error}
        </div>
      </main>
    );
  }

  return (
    <main className="container overflow-hidden py-3 md:py-6">
      <MobilePageHeader eyebrow="Análise" title="Análises" />

      <div className="space-y-4 md:space-y-6">
        {/* Saúde financeira (destaque) + churn */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <FinancialHealthScore healthScore={healthScore} />
          </div>
          <div className="lg:col-span-2">
            <ChurnRateChart churnData={churnData} />
          </div>
        </div>

        {/* Tendências */}
        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          <LTVEvolutionChart data={ltvEvolution} />
          <RevenueProjectionChart data={revenueProjection} />
        </div>

        <ClientCohortTable cohorts={cohorts} />

        <ClientProfitabilityTable clients={clientProfitability} />
      </div>
    </main>
  );
}
