import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowRight,
  ArrowDownUp,
  ArrowLeftRight,
  ChevronRight,
  Minus,
  Plus,
  TrendingUp,
  TrendingDown,
  Upload,
} from 'lucide-react';
import { Sparkle } from '@/components/shared/Sparkle';
import promoBanner from '@/assets/brand/home-personagem.webp';

import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { HexWatermark } from '@/components/shared/NavySurface';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW } from '@/components/shared/navyTokens';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { DetailSheet } from '@/components/shared/DetailSheet';
import { ProgressGoal } from '@/components/dashboard/ProgressGoal';
import { AlertsWidget } from '@/components/dashboard/AlertsWidget';
import { KpiStatCard, variacaoPct, formatDelta } from '@/components/dashboard/KpiStatCard';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RevenueAreaChart } from '@/components/dashboard/RevenueAreaChart';
import { ExpensesByCategoryChart } from '@/components/dashboard/ExpensesByCategoryChart';
import { TopClientsTable } from '@/components/dashboard/TopClientsTable';
import { UpcomingDueWidget } from '@/components/dashboard/UpcomingDueWidget';
import { AIAdvisorWidget } from '@/components/dashboard/AIAdvisorWidget';
import { SkeletonCard } from '@/components/shared/LoadingSpinner';

import { useDashboard } from '@/hooks/useDashboard';
import { useMetas } from '@/hooks/useMetas';
import { useProfile } from '@/hooks/useProfile';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

import type { UpcomingItem } from '@/components/dashboard/UpcomingDueWidget';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function diasParaVencer(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  // "2026-11-10" sozinho é lido como meia-noite UTC (= dia 09 à noite no Brasil);
  // com o horário explícito vira meia-noite local, igual ao widget do desktop.
  const d = new Date(dateStr.split('T')[0] + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Atrasado';
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  return `em ${diff} dias`;
}

/** Até 2 iniciais do nome (avatar das listas). */
function iniciais(nome: string) {
  const palavras = nome.trim().split(/\s+/).filter((p) => p.length > 2 || /^[A-Z0-9]/.test(p));
  const base = palavras.length ? palavras : nome.trim().split(/\s+/);
  return base.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join('') || '•';
}

/** Valor sem centavos para os cartões compactos do mobile. */
const formatCurrencyInteiro = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

/** Cartão compacto do mês (mobile): rótulo, valor e selo de variação. */
function MonthStatCard({
  label,
  value,
  delta,
  invertDelta,
  hint,
  onClick,
}: {
  label: string;
  value: number;
  delta: number | null;
  invertDelta?: boolean;
  hint?: string;
  onClick: () => void;
}) {
  const temDelta = typeof delta === 'number' && Number.isFinite(delta);
  const bom = temDelta && (invertDelta ? delta! <= 0 : delta! >= 0);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-col items-start gap-2 rounded-[20px] border border-border bg-surface p-4 text-left transition-colors active:scale-[0.99] hover:border-border-strong"
    >
      <span className="text-[12px] text-foreground-muted">{label}</span>
      <span className="max-w-full truncate font-heading text-[19px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-foreground">
        {formatCurrencyInteiro(value)}
      </span>
      {temDelta && (
        <span
          title={hint}
          className={cn(
            'rounded-full px-2 py-[3px] text-[11px] font-semibold tabular-nums',
            bom ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg',
          )}
        >
          {formatDelta(delta!)}
        </span>
      )}
    </button>
  );
}

export default function Dashboard() {
  const {
    dashboardData,
    accountBalances,
    consolidatedHistory,
    upcomingItems,
    alerts,
    expensesByCategory,
    revenueData3m,
    revenueData6m,
    revenueData12m,
    isLoading,
    error,
  } = useDashboard();
  const { getMetaValor, upsertMeta } = useMetas();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const [saldoSheetOpen, setSaldoSheetOpen] = useState(false);

  const currentPeriodo = format(new Date(), 'yyyy-MM');
  const mesNome = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
  const dataExtenso = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const primeiroNome = profile?.nome?.split(' ')[0] ?? 'por aqui';

  if (isLoading) {
    return (
      <main className="container py-4 md:py-6">
        <div className="mb-5 h-12 w-48 animate-pulse rounded-full bg-surface-2" />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    );
  }
  if (error) {
    return <main className="container py-6"><p className="text-foreground-muted">{error}</p></main>;
  }

  const { resumo, meta_faturamento, top_clientes } = dashboardData;
  const totalBalance = accountBalances.reduce((s, a) => s + a.saldo, 0);
  const proximos = upcomingItems.slice(0, 5);
  const metaValor = getMetaValor('faturamento', currentPeriodo, 15000);
  const metaSubtitle = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
  // Comparações: mesmo período do mês anterior (KPIs de caixa) e fechamento do mês anterior (saldo)
  const mesAnteriorCurto = format(subMonths(new Date(), 1), 'MMM', { locale: ptBR });
  const hintComparacao = `vs 1–${format(new Date(), 'd')} de ${mesAnteriorCurto}`;
  const saldoAnterior = consolidatedHistory.length >= 2 ? consolidatedHistory[consolidatedHistory.length - 2].valor : null;
  const saldoAtualHist = consolidatedHistory.length >= 1 ? consolidatedHistory[consolidatedHistory.length - 1].valor : null;
  const contasLabel = `${accountBalances.length} ${accountBalances.length === 1 ? 'conta' : 'contas'}`;
  const saldoTxt = formatCurrency(totalBalance);
  const saldoSize = saldoTxt.length > 14 ? 'text-[28px]' : saldoTxt.length > 12 ? 'text-[34px]' : 'text-[40px]';

  const novaReceita = () => navigate('/fluxo-caixa?action=nova-entrada');
  const novaDespesa = () => navigate('/fluxo-caixa?action=nova-saida');
  const novaTransferencia = () => navigate('/fluxo-caixa?action=nova-transferencia');

  return (
    <main className="container py-4 md:py-6">
      {/* Cabeçalho (mobile e desktop): data por extenso + saudação */}
      <MobilePageHeader
        eyebrow={dataExtenso}
        title={
          <>
            {greeting()}, <span className="font-serif italic font-normal tracking-normal">{primeiroNome}</span>
          </>
        }
        actions={
          <>
            {/* Sino só no mobile — no desktop o Header já tem um (evita 2 sinos) */}
            <span className="md:hidden">
              <NotificationBell />
            </span>
            <span className="hidden h-11 items-center rounded-full border border-border bg-surface px-5 text-sm font-semibold text-foreground md:inline-flex">
              {metaSubtitle}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="lg" className="hidden md:inline-flex">
                  <Plus /> Novo lançamento
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={novaReceita}>
                  <TrendingUp className="mr-2 h-4 w-4 text-[hsl(var(--success-fg))]" /> Nova receita
                </DropdownMenuItem>
                <DropdownMenuItem onClick={novaDespesa}>
                  <TrendingDown className="mr-2 h-4 w-4 text-[hsl(var(--danger-fg))]" /> Nova despesa
                </DropdownMenuItem>
                <DropdownMenuItem onClick={novaTransferencia}>
                  <ArrowLeftRight className="mr-2 h-4 w-4" /> Transferência
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/fluxo-caixa?action=importar')}>
                  <Upload className="mr-2 h-4 w-4" /> Importar extrato
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* ===== MOBILE ===== */}
      <div className="space-y-4 md:hidden">
        {/* Saldo consolidado — único bloco navy da tela; topo abre o detalhe */}
        <section
          className="relative isolate overflow-hidden rounded-[26px] p-5 text-white"
          style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}
        >
          <HexWatermark className="-right-14 -top-10 bottom-auto h-60" />
          <button
            type="button"
            onClick={() => setSaldoSheetOpen(true)}
            className="block w-full text-left transition-transform active:scale-[0.99]"
          >
            <span className="sr-only">Ver detalhe do saldo: </span>
            <span className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-medium text-white/70">Saldo consolidado</span>
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/[0.12] py-1 pl-2.5 pr-1.5 text-[12px] font-semibold">
                {contasLabel}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </span>
            </span>
            <span
              className={cn(
                'mt-4 block whitespace-nowrap font-heading font-semibold leading-none tracking-[-0.04em] tabular-nums',
                saldoSize,
              )}
            >
              {saldoTxt}
            </span>
          </button>

          {/* Atalhos — mesmos fluxos do FAB/menu */}
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={novaReceita}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-primary px-1.5 py-3 text-[12px] font-semibold text-primary-foreground transition-transform active:scale-[0.97]"
            >
              <Plus className="h-[18px] w-[18px]" aria-hidden />
              Receita
            </button>
            <button
              type="button"
              onClick={novaDespesa}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-1.5 py-3 text-[12px] font-semibold text-white transition-transform active:scale-[0.97]"
            >
              <Minus className="h-[18px] w-[18px]" aria-hidden />
              Despesa
            </button>
            <button
              type="button"
              onClick={novaTransferencia}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-1.5 py-3 text-[12px] font-semibold text-white transition-transform active:scale-[0.97]"
            >
              <ArrowDownUp className="h-[18px] w-[18px]" aria-hidden />
              Transferir
            </button>
          </div>
        </section>

        {/* Receitas / Despesas do mês */}
        <div className="grid grid-cols-2 gap-2.5">
          <MonthStatCard
            label="Receitas do mês"
            value={resumo.faturamento_mes}
            delta={variacaoPct(resumo.faturamento_mes, resumo.faturamento_mes_anterior)}
            hint={hintComparacao}
            onClick={() => navigate('/fluxo-caixa?tipo=entrada')}
          />
          <MonthStatCard
            label="Despesas do mês"
            value={resumo.despesas_mes}
            invertDelta
            delta={variacaoPct(resumo.despesas_mes, resumo.despesas_mes_anterior)}
            hint={hintComparacao}
            onClick={() => navigate('/fluxo-caixa?tipo=saida')}
          />
        </div>

        {/* Próximos vencimentos (7 dias) — lista agrupada */}
        <section>
          <div className="mb-2 flex items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-foreground">Próximos vencimentos</h2>
              <p className="text-[12px] text-foreground-muted">Próximos 7 dias</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/fluxo-caixa?venc=prox7')}
              className="no-touch-min shrink-0 py-1 text-[13px] font-medium text-foreground-muted hover:text-foreground"
            >
              Ver todos
            </button>
          </div>

          {proximos.length === 0 ? (
            <div className="rounded-[20px] border border-border bg-surface px-4 py-6 text-center text-sm text-foreground-muted">
              Nada vencendo nos próximos 7 dias
            </div>
          ) : (
            <div className="rounded-[20px] border border-border bg-surface px-3.5">
              {proximos.map((item: UpcomingItem) => {
                const isReceita = item.tipo === 'receita';
                const tipo = isReceita ? 'entrada' : 'saida';
                const quando = diasParaVencer(item.data_vencimento);
                const titulo = item.descricao || item.cliente_ou_fornecedor;
                const quem = item.cliente_ou_fornecedor && item.cliente_ou_fornecedor !== titulo ? item.cliente_ou_fornecedor : null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      navigate(item.href ?? `/fluxo-caixa?tipo=${tipo}&search=${encodeURIComponent(item.descricao)}`)
                    }
                    className="flex w-full items-center gap-3 border-b border-border py-3 text-left last:border-b-0"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-surface-2 text-[13px] font-bold text-foreground">
                      {iniciais(item.cliente_ou_fornecedor || item.descricao)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{titulo}</span>
                      <span className="block truncate text-[12px] text-foreground-muted">
                        <span className={cn(quando === 'Atrasado' && 'font-semibold text-[hsl(var(--danger-fg))]')}>{quando}</span>
                        {quem && ` · ${quem}`}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 whitespace-nowrap font-heading text-[15px] font-semibold tabular-nums',
                        isReceita ? 'text-[hsl(var(--success-fg))]' : 'text-foreground',
                      )}
                    >
                      {isReceita ? '+' : '−'}{formatCurrency(item.valor)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Alertas (só renderiza se houver) */}
        {alerts.length > 0 && <AlertsWidget alerts={alerts} />}

        {/* Banner do personagem — resumo do mês */}
        <button
          type="button"
          onClick={() => navigate('/fluxo-caixa')}
          className="group relative isolate block h-32 w-full overflow-hidden rounded-[20px] text-left"
          style={{ background: 'hsl(var(--navy-card))' }}
        >
          {/* Personagem à direita; o texto fica no navy da esquerda */}
          <img src={promoBanner} alt="" className="absolute inset-y-0 right-0 h-full w-[70%] object-cover object-[center_20%]" />
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg, hsl(var(--navy-card)) 32%, hsl(var(--navy-card) / 0.55) 50%, hsl(var(--navy-card) / 0) 72%)' }}
          />
          <div className="relative z-10 flex h-full flex-col justify-center px-5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">Resumo do mês</span>
            <span className="mt-1 text-[17px] font-semibold text-white">
              {resumo.lucro_mensal >= 0 ? `Fechando ${mesNome} no azul` : `Atenção com ${mesNome}`}
            </span>
            <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-white">
              Ver fluxo de caixa <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </button>

        {/* Meta do mês */}
        <ProgressGoal
          title="Meta de Faturamento"
          current={meta_faturamento.valor_realizado}
          target={metaValor}
          subtitle={metaSubtitle}
          editable
          onEditTarget={(v) => upsertMeta.mutate({ tipo: 'faturamento', periodo: currentPeriodo, valor_meta: v })}
        />

        {/* IARA — atalho pro assistente */}
        <button
          type="button"
          onClick={() => navigate('/iara')}
          className="flex w-full items-center gap-3 rounded-[20px] border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong active:scale-[0.99]"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-primary text-primary-foreground">
            <Sparkle className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">IARA · Assistente</span>
            <span className="block text-sm font-medium text-foreground">Tire dúvidas sobre suas finanças</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
        </button>

        {/* Atalho — Análise completa */}
        <button
          type="button"
          onClick={() => navigate('/visao')}
          className="flex w-full items-center justify-between gap-3 rounded-[20px] border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong"
        >
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Visão completa do negócio</span>
            <span className="block text-[12px] text-foreground-muted">MRR, top clientes, projeções, IA</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-foreground-muted" />
        </button>
      </div>

      {/* ===== DESKTOP ===== */}
      <div className="hidden space-y-6 md:block">
        {/* KPIs — saldo em destaque; os demais comparam com o mesmo período do mês anterior */}
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <KpiStatCard
            highlight
            label="Saldo consolidado"
            value={totalBalance}
            delta={saldoAnterior != null ? variacaoPct(saldoAtualHist ?? totalBalance, saldoAnterior) : null}
            hint={`${accountBalances.length} ${accountBalances.length === 1 ? 'conta ativa' : 'contas ativas'} · vs fim de ${mesAnteriorCurto}`}
            onClick={() => setSaldoSheetOpen(true)}
          />
          <KpiStatCard
            label="Receitas do mês"
            value={resumo.faturamento_mes}
            delta={variacaoPct(resumo.faturamento_mes, resumo.faturamento_mes_anterior)}
            hint={hintComparacao}
            onClick={() => navigate('/fluxo-caixa?tipo=entrada')}
          />
          <KpiStatCard
            label="Despesas do mês"
            value={resumo.despesas_mes}
            invertDelta
            delta={variacaoPct(resumo.despesas_mes, resumo.despesas_mes_anterior)}
            hint={hintComparacao}
            onClick={() => navigate('/fluxo-caixa?tipo=saida')}
          />
          <KpiStatCard
            label="Lucro do mês"
            value={resumo.lucro_mensal}
            delta={variacaoPct(resumo.lucro_mensal, resumo.lucro_mensal_anterior)}
            hint={`Margem ${String(resumo.lucro_mensal_percentual).replace('.', ',')}% · ${hintComparacao}`}
          />
        </div>

        {/* Gráfico + IARA lado a lado (primeira dobra) */}
        <div className="grid gap-6 xl:grid-cols-5">
          <RevenueAreaChart
            className="md:h-[420px] xl:col-span-3"
            data3m={revenueData3m}
            data6m={revenueData6m}
            data12m={revenueData12m}
          />
          <div className="h-[420px] xl:col-span-2">
            <AIAdvisorWidget fill variant="navy" />
          </div>
        </div>

        {/* Próximos vencimentos (tabela) + Meta/alertas */}
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <UpcomingDueWidget
              items={upcomingItems}
              title="Próximos vencimentos"
              onItemClick={(it) => navigate(it.href ?? '/fluxo-caixa?venc=prox7')}
            />
          </div>
          <div className="space-y-6">
            <ProgressGoal
              title="Meta de Faturamento"
              current={meta_faturamento.valor_realizado}
              target={metaValor}
              subtitle={metaSubtitle}
              editable
              onEditTarget={(v) => upsertMeta.mutate({ tipo: 'faturamento', periodo: currentPeriodo, valor_meta: v })}
            />
            {alerts.length > 0 && <AlertsWidget alerts={alerts} />}
          </div>
        </div>

        {/* Despesas por categoria + Ranking de clientes */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ExpensesByCategoryChart data={expensesByCategory} />
          <TopClientsTable clients={top_clientes} title="Ranking de clientes" />
        </div>
      </div>

      {/* Bottom sheet — Saldo detalhado */}
      <DetailSheet
        open={saldoSheetOpen}
        onOpenChange={setSaldoSheetOpen}
        variant="light"
        eyebrow={metaSubtitle}
        title="Detalhe do saldo"
      >
        {/* Resumo */}
        <div className="mb-5 rounded-[20px] bg-surface-2 px-4 py-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Total disponível</p>
          <p className="font-heading text-[30px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-foreground">
            {formatCurrency(totalBalance)}
          </p>
          <p className="mt-1 text-[12px] text-foreground-muted">
            Receitas {formatCurrency(resumo.faturamento_mes)} · Despesas {formatCurrency(resumo.despesas_mes)}
          </p>
        </div>

        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Por conta</p>
        <div className="mb-5 rounded-[20px] border border-border bg-surface px-3.5">
          {accountBalances.map((acc) => (
            <button
              key={acc.id}
              type="button"
              onClick={() => {
                setSaldoSheetOpen(false);
                navigate(`/fluxo-caixa?conta=${acc.id}`);
              }}
              className="flex w-full items-center justify-between gap-3 border-b border-border py-3 text-left last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: acc.cor }} />
                <span className="truncate text-sm font-medium text-foreground">{acc.nome}</span>
              </span>
              <span className="shrink-0 font-heading text-sm font-semibold tabular-nums text-foreground">{formatCurrency(acc.saldo)}</span>
            </button>
          ))}
        </div>

        {consolidatedHistory.length > 1 && (
          <>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Evolução</p>
            <div className="rounded-[20px] bg-surface-2 px-4 py-3">
              <div className="flex justify-between text-xs">
                {consolidatedHistory.map((h) => (
                  <div key={h.mes} className="flex flex-col items-center gap-1">
                    <span className="text-foreground-muted">{h.mes}</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {h.valor >= 1000 ? `${(h.valor / 1000).toFixed(1)}k` : formatCurrency(h.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Button
          size="lg"
          className="mt-5 w-full"
          onClick={() => {
            setSaldoSheetOpen(false);
            navigate('/contas');
          }}
        >
          Gerenciar contas
        </Button>
      </DetailSheet>
    </main>
  );
}
