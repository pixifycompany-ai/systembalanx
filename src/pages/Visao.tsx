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
import { formatCurrency } from '@/utils/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { TagIcon } from '@heroicons/react/24/outline';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

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
  const semestreBadge = new Date().getMonth() >= 6 ? '2º SEM' : '1º SEM';
  const [range, setRange] = useState<'semana' | 'mes' | 'ano'>('mes');
  const serieMRR = useMemo(() => {
    const src = range === 'ano' ? revenueData12m : range === 'semana' ? revenueData3m : revenueData6m;
    return (src || []).map((d) => ({ mes: d.mes, valor: d.receita }));
  }, [range, revenueData3m, revenueData6m, revenueData12m]);
  const deltaPct = useMemo(() => {
    if (serieMRR.length < 2) return null;
    const a = serieMRR[serieMRR.length - 2].valor;
    const b = serieMRR[serieMRR.length - 1].valor;
    if (!a) return null;
    return ((b - a) / a) * 100;
  }, [serieMRR]);

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
  const totalDespCat = expensesByCategory.reduce((s, c) => s + c.valor, 0);

  return (
    <main className="container py-4 md:py-6 space-y-6">
      <MobilePageHeader
        eyebrow="Deep-dive"
        title="Visão"
        actions={
          <span className="text-[10px] font-semibold uppercase tracking-widest text-foreground-muted px-3 py-1.5 rounded-full border border-border/60 bg-surface/70 backdrop-blur-xl">
            {semestreBadge}
          </span>
        }
      />

      {/* Segmented Semana | Mês | Ano (igual mockup) */}
      <div className="md:hidden grid grid-cols-3 gap-[3px] rounded-[14px] border border-border/60 bg-surface/70 backdrop-blur-xl p-1">
        {([['semana', 'Semana'], ['mes', 'Mês'], ['ano', 'Ano']] as const).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setRange(v)}
            className={cn(
              'rounded-[10px] py-[9px] text-[12.5px] font-semibold transition-colors',
              range === v ? 'bg-primary text-white' : 'text-foreground-muted',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* MRR em destaque com gráfico de área (igual mockup) */}
      <div className="md:hidden auro-card rounded-[24px] border border-border/60 bg-surface/55 backdrop-blur-xl px-4 pt-4 pb-2 overflow-hidden">
        <div className="text-[11.5px] text-foreground-muted">Receita recorrente (MRR)</div>
        <div className="mt-1 flex items-baseline gap-2.5">
          <span className="text-[30px] font-semibold tracking-[-0.03em] tabular-nums text-foreground">{formatCurrency(contractsData.mrrTotal)}</span>
          {deltaPct !== null && (
            <span className={cn('text-[13px] font-semibold', deltaPct >= 0 ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]')}>
              {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1).replace('.', ',')}%
            </span>
          )}
        </div>
        <div className="mt-2 h-[140px] -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serieMRR} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38 82% 55%)" stopOpacity={0.32} />
                  <stop offset="60%" stopColor="hsl(var(--primary))" stopOpacity={0.16} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['dataMin', 'dataMax']} />
              <XAxis
                dataKey="mes"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                interval="preserveStartEnd"
                minTickGap={12}
              />
              <Area type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#mrrFill)" dot={false} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Despesas por categoria — ícones em tile (igual mockup) */}
      {expensesByCategory.length > 0 && (
        <section className="md:hidden">
          <div className="flex items-end justify-between mb-2 px-1">
            <h2 className="text-base font-semibold text-foreground">Despesas por categoria</h2>
            <span className="text-xs text-foreground-muted capitalize">{format(new Date(), 'MMMM', { locale: ptBR })}</span>
          </div>
          <div className="auro-card rounded-2xl border border-border/60 bg-surface/55 backdrop-blur-xl divide-y divide-border/50 overflow-hidden">
            {expensesByCategory.slice(0, 6).map((c) => {
              const pct = totalDespCat > 0 ? Math.round((c.valor / totalDespCat) * 100) : 0;
              return (
                <div key={c.categoria} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-xl" style={{ background: `color-mix(in srgb, ${c.cor} 18%, transparent)`, color: c.cor }}>
                    <TagIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{c.categoria}</div>
                    <div className="text-[11px] text-foreground-muted">{pct}%</div>
                  </div>
                  <div className="text-sm font-semibold tabular-nums text-[hsl(var(--danger))]">−{formatCurrency(c.valor)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Desktop: dashboard completo (mobile mostra só o layout do mockup acima) */}
      <div className="hidden md:block space-y-6">
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
      </div>
    </main>
  );
}
