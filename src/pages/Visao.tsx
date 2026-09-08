import { MetricCard } from '@/components/dashboard/MetricCard';
import { RevenueAreaChart } from '@/components/dashboard/RevenueAreaChart';
import { MRRChart } from '@/components/dashboard/MRRChart';
import { TopClientsTable } from '@/components/dashboard/TopClientsTable';
import { ExpensesByCategoryChart } from '@/components/dashboard/ExpensesByCategoryChart';
import { ContractsWidget } from '@/components/dashboard/ContractsWidget';
import { CreditCardsWidget } from '@/components/dashboard/CreditCardsWidget';
import { ConsolidatedBalanceCard } from '@/components/dashboard/ConsolidatedBalanceCard';
import { AIAdvisorWidget } from '@/components/dashboard/AIAdvisorWidget';
import { LTVWidget } from '@/components/dashboard/LTVWidget';
import { BrandRevenueWidget } from '@/components/dashboard/BrandRevenueWidget';
import { HeroStatCard } from '@/components/shared/HeroStatCard';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { SkeletonCard, SkeletonChart } from '@/components/shared/LoadingSpinner';
import { useDashboard } from '@/hooks/useDashboard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Visao() {
  const {
    dashboardData,
    contractsData,
    expensesByCategory,
    ltvData,
    accountBalances,
    consolidatedHistory,
    revenueData3m,
    revenueData6m,
    revenueData12m,
    receitaPorEmpresa,
    creditCardsData,
    isLoading,
    error,
  } = useDashboard();

  const mesAtual = format(new Date(), 'MMM', { locale: ptBR }).toUpperCase();

  if (isLoading) {
    return (
      <main className="container py-4 md:py-6">
        <div className="mb-6 h-10 w-40 bg-muted rounded animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <SkeletonChart />
      </main>
    );
  }

  if (error) {
    return (
      <main className="container py-6">
        <p className="text-muted-foreground">{error}</p>
      </main>
    );
  }

  const { resumo, mrr, top_clientes } = dashboardData;
  const totalBalance = accountBalances.reduce((s, a) => s + a.saldo, 0);

  return (
    <main className="container py-4 md:py-6 space-y-6">
      <MobilePageHeader eyebrow="Estratégia" title="Visão" />

      {/* Hero — Lucro do mês */}
      <HeroStatCard
        eyebrow="Lucro do mês"
        context={mesAtual}
        value={resumo.lucro_mensal}
        subtitle={`Margem ${resumo.lucro_mensal_percentual}%`}
        progress={Math.max(0, Math.min(resumo.lucro_mensal / Math.max(resumo.faturamento_mes, 1), 1))}
        progressTone={resumo.lucro_mensal >= 0 ? 'success' : 'danger'}
        footer={[
          { label: 'Receitas', value: resumo.faturamento_mes },
          { label: 'Despesas', value: resumo.despesas_mes, align: 'right' },
        ]}
      />

      {/* KPIs executivos */}
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          title="MRR (Receita Recorrente)"
          value={contractsData.mrrTotal}
          subtitle={`${contractsData.contratosAtivos} contratos · ${contractsData.clientesAtivos} clientes`}
          variant="info"
        />
        <MetricCard
          title="Receita Anual Projetada"
          value={resumo.receita_anual_projetada}
          subtitle="MRR × 12"
          variant="positive"
        />
        <MetricCard
          title="LTV Médio"
          value={ltvData.ltvMedio}
          subtitle={`Tempo médio ${ltvData.tempoMedioMeses.toFixed(0)} meses`}
        />
      </div>

      {/* Receita vs Despesas */}
      <RevenueAreaChart data3m={revenueData3m} data6m={revenueData6m} data12m={revenueData12m} />

      {/* Receita por marca */}
      <BrandRevenueWidget data={receitaPorEmpresa} />

      {/* MRR + Cartões */}
      <div className="grid gap-6 lg:grid-cols-2">
        <MRRChart historico={mrr.historico} projecao={mrr.projecao} />
        <CreditCardsWidget cards={creditCardsData} />
      </div>

      {/* Saldo Consolidado + Top Clientes */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <ConsolidatedBalanceCard accounts={accountBalances} total={totalBalance} history={consolidatedHistory} />
        </div>
        <div className="lg:col-span-2">
          <TopClientsTable clients={top_clientes} title="Top 5 Clientes" />
        </div>
      </div>

      {/* Despesas por categoria + LTV */}
      <div className="grid gap-6 lg:grid-cols-2">
        <ExpensesByCategoryChart data={expensesByCategory} />
        <LTVWidget data={ltvData} />
      </div>

      {/* Contratos */}
      <ContractsWidget data={contractsData} />

      {/* IA Advisor */}
      <AIAdvisorWidget />
    </main>
  );
}
