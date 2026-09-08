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
        <div className="text-center text-destructive">
          Erro ao carregar dados: {error}
        </div>
      </main>
    );
  }

  return (
    <main className="container py-4 md:py-6 overflow-hidden">
      {/* Header mobile estilo iOS */}
      <div className="md:hidden">
        <MobilePageHeader eyebrow="Insights profundos" title="Análises" />
      </div>
      <div className="hidden md:block mb-6">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">Análises Avançadas</h1>
        <p className="text-sm text-muted-foreground">
          Métricas detalhadas e insights sobre seu negócio
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mb-4">
        <FinancialHealthScore healthScore={healthScore} />
        <ChurnRateChart churnData={churnData} />
      </div>

      <div className="mb-4">
        <LTVEvolutionChart data={ltvEvolution} />
      </div>

      <div className="mb-4">
        <RevenueProjectionChart data={revenueProjection} />
      </div>

      <div className="mb-4">
        <ClientCohortTable cohorts={cohorts} />
      </div>

      <div className="mb-4">
        <ClientProfitabilityTable clients={clientProfitability} />
      </div>
    </main>
  );
}
