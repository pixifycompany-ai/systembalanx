import { RevenueAreaChart } from '@/components/dashboard/RevenueAreaChart';
import { MRRChart } from '@/components/dashboard/MRRChart';
import { ExpensesByCategoryChart } from '@/components/dashboard/ExpensesByCategoryChart';
import { ContractsWidget } from '@/components/dashboard/ContractsWidget';
import { CreditCardsWidget } from '@/components/dashboard/CreditCardsWidget';
import { ConsolidatedBalanceCard } from '@/components/dashboard/ConsolidatedBalanceCard';
import { AIAdvisorWidget } from '@/components/dashboard/AIAdvisorWidget';
import { BrandRevenueWidget } from '@/components/dashboard/BrandRevenueWidget';
import { KpiStatCard } from '@/components/dashboard/KpiStatCard';
import type { LTVData } from '@/components/dashboard/LTVWidget';
import { HeroStatCard } from '@/components/shared/HeroStatCard';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { SectionCard } from '@/components/shared/SectionCard';
import { SkeletonCard, SkeletonChart } from '@/components/shared/LoadingSpinner';
import { EmptyNote, InfoHint, KpiStrip, RangeChips } from '@/components/relatorios/ReportKit';
import { CHART, axisProps, tooltipProps } from '@/components/relatorios/chartTheme';
import { useDashboard } from '@/hooks/useDashboard';
import { formatCurrency } from '@/utils/formatters';
import type { TopCliente } from '@/types/finance';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { TagIcon } from '@heroicons/react/24/outline';
import { CalendarClock, Gem, Repeat } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';

type Range = 'semana' | 'mes' | 'ano';
// Mesmas séries de antes (3m / 6m / 12m); só o rótulo segue o padrão dos chips.
const RANGES: readonly { value: Range; label: string }[] = [
  { value: 'semana', label: '3M' },
  { value: 'mes', label: '6M' },
  { value: 'ano', label: '12M' },
];

const formatMeses = (meses: number) => {
  if (meses < 1) return 'Menos de 1 mês';
  if (meses === 1) return '1 mês';
  if (meses < 12) return `${Math.round(meses)} meses`;
  const anos = Math.floor(meses / 12);
  const mesesRestantes = Math.round(meses % 12);
  if (mesesRestantes === 0) return `${anos} ano${anos > 1 ? 's' : ''}`;
  return `${anos} ano${anos > 1 ? 's' : ''} e ${mesesRestantes} mês${mesesRestantes > 1 ? 'es' : ''}`;
};

/** LTV em SectionCard (mesmos números do LTVWidget). */
function LTVSection({ data, className }: { data: LTVData; className?: string }) {
  const { ltvMedio, ticketMedio, tempoMedioMeses, totalClientes, receitaTotal, clientesComReceita } = data;
  return (
    <SectionCard
      className={cn('animate-fade-in', className)}
      title={
        <span className="inline-flex items-center gap-1.5">
          Lifetime Value (LTV)
          <InfoHint text="LTV = Valor Mensal Contratado × Meses de Relacionamento" />
        </span>
      }
    >
      <p className="font-heading text-[30px] font-semibold leading-tight tabular-nums tracking-[-0.03em] text-foreground">
        {formatCurrency(ltvMedio)}
      </p>
      <p className="mb-4 text-[12px] text-foreground-muted">Ticket mensal contratado × tempo de relacionamento</p>
      <KpiStrip
        className="md:grid-cols-2 [&_span.font-heading]:text-[16px] md:[&_span.font-heading]:text-[18px]"
        items={[
          { label: 'Ticket Mensal', value: formatCurrency(ticketMedio) },
          { label: 'Tempo Médio', value: formatMeses(tempoMedioMeses) },
          { label: 'Clientes Ativos', value: `${clientesComReceita} / ${totalClientes}` },
          { label: 'Valor Total Contratado', value: formatCurrency(receitaTotal) },
        ]}
      />
    </SectionCard>
  );
}

/** Top clientes em SectionCard: lista agrupada com barra de participação. */
function TopClientesSection({ clients, className }: { clients: TopCliente[]; className?: string }) {
  const maxValue = Math.max(...clients.map((c) => c.receita_total));
  return (
    <SectionCard flush className={cn('overflow-hidden animate-fade-in', className)} title="Top 5 Clientes">
      {clients.length === 0 ? (
        <EmptyNote className="border-t border-border">Sem clientes no período</EmptyNote>
      ) : (
        <div>
          {clients.map((client, index) => {
            const percentage = (client.receita_total / maxValue) * 100;
            return (
              <div key={client.cliente_id} className="flex items-center gap-3 border-t border-border px-4 py-3 md:px-6">
                <span
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-[13px] font-heading text-[15px] font-semibold tabular-nums',
                    index === 0 ? 'bg-info-bg text-info-fg' : 'bg-surface-2 text-foreground-muted',
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{client.cliente}</p>
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${percentage}%` }} />
                  </div>
                </div>
                <span className="ml-2 shrink-0 font-heading text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(client.receita_total)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

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
  const [range, setRange] = useState<Range>('mes');
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
      <main className="container py-3 md:py-6">
        <div className="mb-6 h-10 w-40 rounded-full bg-surface-2 animate-pulse" />
        <div className="mb-6 grid gap-4 md:grid-cols-3">
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
        <p className="text-foreground-muted">{error}</p>
      </main>
    );
  }

  const { resumo, mrr, top_clientes } = dashboardData;
  const totalBalance = accountBalances.reduce((s, a) => s + a.saldo, 0);
  const totalDespCat = expensesByCategory.reduce((s, c) => s + c.valor, 0);

  const kpis = [
    {
      label: 'MRR (Receita Recorrente)',
      value: contractsData.mrrTotal,
      hint: `${contractsData.contratosAtivos} contratos · ${contractsData.clientesAtivos} clientes`,
      icon: Repeat,
    },
    { label: 'Receita Anual Projetada', value: resumo.receita_anual_projetada, hint: 'MRR × 12', icon: CalendarClock },
    { label: 'LTV Médio', value: ltvData.ltvMedio, hint: `Tempo médio ${ltvData.tempoMedioMeses.toFixed(0)} meses`, icon: Gem },
  ];

  return (
    <main className="container py-3 md:py-6">
      <MobilePageHeader
        eyebrow="Análise"
        title="Visão"
        actions={
          <span className="inline-flex h-9 items-center rounded-full border border-border bg-surface px-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">
            {semestreBadge}
          </span>
        }
      />

      <div className="space-y-4 md:space-y-6">
        {/* Destaque (navy) + KPIs executivos */}
        <div className="grid gap-4 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
          <HeroStatCard
            className="md:col-span-3 xl:col-span-1"
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
          {/* Desktop: cartões de KPI */}
          {kpis.map((k) => (
            <div key={k.label} className="hidden md:block">
              <KpiStatCard label={k.label} value={k.value} icon={k.icon} hint={k.hint} />
            </div>
          ))}
          {/* Mobile: lista agrupada (mais compacta) */}
          <div className="rounded-[20px] border border-border bg-surface px-3.5 md:hidden">
            {kpis.map((k) => (
              <div key={k.label} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-surface-2 text-foreground">
                  <k.icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{k.label}</p>
                  <p className="truncate text-[12px] text-foreground-muted">{k.hint}</p>
                </div>
                <span className="shrink-0 font-heading text-[15px] font-semibold tabular-nums tracking-[-0.02em] text-foreground">
                  {formatCurrency(k.value)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* MRR + LTV */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
          <SectionCard
            className="animate-fade-in lg:col-span-3"
            title="Receita recorrente (MRR)"
            action={<RangeChips<Range> value={range} onChange={setRange} options={RANGES} />}
          >
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-heading text-[30px] font-semibold leading-tight tabular-nums tracking-[-0.03em] text-foreground">
                {formatCurrency(contractsData.mrrTotal)}
              </span>
              {deltaPct !== null && (
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[12px] font-semibold tabular-nums',
                    deltaPct >= 0 ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg',
                  )}
                >
                  {deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1).replace('.', ',')}%
                </span>
              )}
            </div>
            <div className="-mx-1 mt-3 h-[160px] md:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serieMRR} margin={{ top: 8, right: 6, left: 6, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <YAxis hide domain={['dataMin', 'dataMax']} />
                  <XAxis dataKey="mes" {...axisProps} interval="preserveStartEnd" minTickGap={12} />
                  <Tooltip {...tooltipProps} formatter={(v: number) => [formatCurrency(v), 'Receita']} />
                  <Area type="monotone" dataKey="valor" stroke={CHART.primary} strokeWidth={2.5} fill="url(#mrrFill)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <LTVSection className="lg:col-span-2" data={ltvData} />
        </div>

        {/* Receita vs Despesas (desktop) */}
        <div className="hidden md:block">
          <RevenueAreaChart data3m={revenueData3m} data6m={revenueData6m} data12m={revenueData12m} />
        </div>

        {/* Top clientes + Despesas por categoria */}
        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          <TopClientesSection clients={top_clientes} />

          {/* Mobile: lista com tiles de categoria */}
          {expensesByCategory.length > 0 && (
            <SectionCard
              flush
              className="overflow-hidden md:hidden"
              title="Despesas por categoria"
              action={<span className="text-[13px] font-medium capitalize text-foreground-muted">{format(new Date(), 'MMMM', { locale: ptBR })}</span>}
            >
              {expensesByCategory.slice(0, 6).map((c) => {
                const pct = totalDespCat > 0 ? Math.round((c.valor / totalDespCat) * 100) : 0;
                return (
                  <div key={c.categoria} className="flex items-center gap-3 border-t border-border px-4 py-3">
                    <span
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px]"
                      style={{ background: `color-mix(in srgb, ${c.cor} 16%, transparent)`, color: c.cor }}
                    >
                      <TagIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">{c.categoria}</div>
                      <div className="text-[12px] text-foreground-muted">{pct}%</div>
                    </div>
                    <div className="shrink-0 font-heading text-sm font-semibold tabular-nums text-[hsl(var(--danger-fg))]">
                      −{formatCurrency(c.valor)}
                    </div>
                  </div>
                );
              })}
            </SectionCard>
          )}
          {/* Desktop: gráfico */}
          <div className="hidden md:block">
            <ExpensesByCategoryChart data={expensesByCategory} />
          </div>
        </div>

        {/* Desktop: blocos complementares */}
        <div className="hidden space-y-6 md:block">
          <BrandRevenueWidget data={receitaPorEmpresa} />

          <div className="grid gap-6 lg:grid-cols-2">
            <MRRChart historico={mrr.historico} projecao={mrr.projecao} />
            <CreditCardsWidget cards={creditCardsData} />
          </div>

          <ConsolidatedBalanceCard accounts={accountBalances} total={totalBalance} history={consolidatedHistory} />

          <ContractsWidget data={contractsData} />

          <AIAdvisorWidget />
        </div>
      </div>
    </main>
  );
}
