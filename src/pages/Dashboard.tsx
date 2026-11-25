import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle, ArrowLeftRight, ArrowUp, Bell, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, CreditCard, ListChecks, Mic,
  Plus, Receipt, TrendingDown, TrendingUp, Upload,
} from 'lucide-react';
import { Sparkle } from '@/components/shared/Sparkle';
import { OlhoValores } from '@/components/shared/OlhoValores';
import { NotificationBell } from '@/components/layout/NotificationBell';
import { DetailSheet } from '@/components/shared/DetailSheet';
import { MetaInline } from '@/components/dashboard/ProgressGoal';
import { KpiStatCard, variacaoPct } from '@/components/dashboard/KpiStatCard';
import { HeroMobile } from '@/components/dashboard/HeroMobile';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RevenueAreaChart } from '@/components/dashboard/RevenueAreaChart';
import { SkeletonCard } from '@/components/shared/LoadingSpinner';
import { Card } from '@/components/reskin/kit';
import type { Alert } from '@/components/dashboard/AlertsWidget';
import type { UpcomingItem } from '@/components/dashboard/UpcomingDueWidget';

import { useDashboard } from '@/hooks/useDashboard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useMetas } from '@/hooks/useMetas';
import { useProfile } from '@/hooks/useProfile';
import { usePendencias } from '@/hooks/usePendencias';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Data local (meia-noite) a partir de "yyyy-MM-dd" — sem o deslize de fuso do parse UTC. */
const dataLocal = (iso: string) => new Date(iso.split('T')[0] + 'T00:00:00');

function quandoVence(iso: string): { rot: string; dia: string } {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const d = dataLocal(iso);
  const diff = Math.round((d.getTime() - hoje.getTime()) / 86400000);
  const dia = format(d, 'dd/MM');
  if (diff < 0) return { rot: 'Atrasado', dia };
  if (diff === 0) return { rot: 'Hoje', dia };
  if (diff === 1) return { rot: 'Amanhã', dia };
  const sem = format(d, 'EEE', { locale: ptBR }).replace('.', '');
  return { rot: sem.charAt(0).toUpperCase() + sem.slice(1), dia };
}

const CHIPS_IARA = ['Analise meu fluxo de caixa', 'Quanto posso retirar de lucro?', 'Despesas acima da média', 'Quem está me devendo?'];

const TOM_ALERTA: Record<Alert['type'], { cls: string; icon: React.ReactNode }> = {
  overdue: { cls: 'bg-danger-bg text-danger-fg', icon: <AlertTriangle className="h-4 w-4" /> },
  due_soon: { cls: 'bg-warning-bg text-warning-fg', icon: <CalendarClock className="h-4 w-4" /> },
  warning: { cls: 'bg-info-bg text-info-fg', icon: <Bell className="h-4 w-4" /> },
};

export default function Dashboard() {
  // Mês escolhido ("yyyy-MM"). O mês atual mantém o comportamento de sempre.
  const mesAtual = format(new Date(), 'yyyy-MM');
  const [periodo, setPeriodo] = useState(mesAtual);
  const ehAtual = periodo === mesAtual;
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
    monthItems,
    isLoading,
    error,
  } = useDashboard(periodo);
  const { getMetaValor, upsertMeta } = useMetas();
  const { profile } = useProfile();
  const { pendencias, total: totalPendencias } = usePendencias();
  const navigate = useNavigate();
  const mobile = useIsMobile();

  const [saldoSheetOpen, setSaldoSheetOpen] = useState(false);
  const [pergunta, setPergunta] = useState('');

  const currentPeriodo = periodo;
  const dataMes = parseISO(`${periodo}-01`);
  const mesNome = format(dataMes, "MMMM 'de' yyyy", { locale: ptBR });
  const mesCurto = format(dataMes, 'MMMM', { locale: ptBR });
  const mudarMes = (n: number) => setPeriodo(format(addMonths(dataMes, n), 'yyyy-MM'));
  const passado = periodo < mesAtual;
  // Leva o mês escolhido para o Fluxo de caixa (no mês atual, a URL de sempre).
  const comMes = (url: string) => (ehAtual ? url : `${url}&mes=${periodo}`);
  const dataExtenso = format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR });
  const primeiroNome = profile?.nome?.split(' ')[0] ?? 'por aqui';

  if (isLoading) {
    return (
      <main className="mx-auto max-w-[1180px] py-4 md:py-6">
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
    return <main className="mx-auto max-w-[1180px] py-6"><p className="text-foreground-muted">{error}</p></main>;
  }

  const { resumo, meta_faturamento, top_clientes } = dashboardData;
  const totalBalance = accountBalances.reduce((s, a) => s + a.saldo, 0);
  const metaValor = getMetaValor('faturamento', currentPeriodo, 15000);
  const metaSubtitle = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
  // Comparações: mesmo período do mês anterior (KPIs de caixa) e fechamento do mês anterior (saldo)
  const mesAnteriorCurto = format(subMonths(dataMes, 1), 'MMM', { locale: ptBR });
  const hintComparacao = ehAtual
    ? `vs 1–${format(new Date(), 'd')} de ${mesAnteriorCurto}`
    : `vs ${format(subMonths(dataMes, 1), 'MMMM', { locale: ptBR })} inteiro`;
  const saldoAnterior = consolidatedHistory.length >= 2 ? consolidatedHistory[consolidatedHistory.length - 2].valor : null;
  const saldoAtualHist = consolidatedHistory.length >= 1 ? consolidatedHistory[consolidatedHistory.length - 1].valor : null;
  // Saldo: hoje (mês atual ou futuro) ou o fechamento do mês passado escolhido.
  const saldoKpi = passado && saldoAtualHist != null ? saldoAtualHist : totalBalance;

  const perguntar = (texto: string) => {
    const q = texto.trim();
    if (!q) { navigate('/iara'); return; }
    navigate('/iara', { state: { pergunta: q } });
  };

  // "Precisa de você": alertas do mês + pendências num bloco só
  const risco = pendencias.filter((p) => p.bloco === 'risco').length;
  const precisa: { id: string; titulo: string; detalhe: string; to: string; cls: string; icon: React.ReactNode }[] = [
    ...alerts.map((a) => ({ id: a.id, titulo: a.title, detalhe: a.description, to: a.link ?? '/fluxo-caixa', cls: TOM_ALERTA[a.type].cls, icon: TOM_ALERTA[a.type].icon })),
    ...(totalPendencias > 0 ? [{
      id: 'pendencias',
      titulo: `${totalPendencias} ${totalPendencias === 1 ? 'pendência' : 'pendências'}`,
      detalhe: risco > 0 ? `${risco} com dinheiro em risco` : 'Ajustes para os números ficarem certos',
      to: '/pendencias',
      cls: 'bg-surface-2 text-foreground-muted',
      icon: <ListChecks className="h-4 w-4" />,
    }] : []),
  ];

  // Próximos 7 dias (mês atual) ou vencimentos do mês escolhido
  const listaVenc = ehAtual ? upcomingItems : monthItems;
  const proximos = listaVenc.slice(0, ehAtual ? 6 : 8);
  const entra = listaVenc.filter((i) => i.tipo === 'receita').reduce((s, i) => s + i.valor, 0);
  const sai = listaVenc.filter((i) => i.tipo === 'despesa').reduce((s, i) => s + i.valor, 0);
  const quitado = (i: UpcomingItem) => i.status === 'pago' || i.status === 'recebido';
  const abrirItem = (item: UpcomingItem) => {
    const tipo = item.tipo === 'receita' ? 'entrada' : 'saida';
    navigate(item.href ?? `/fluxo-caixa?tipo=${tipo}&search=${encodeURIComponent(item.descricao)}`);
  };

  // Para onde foi o dinheiro
  const totalCat = expensesByCategory.reduce((s, c) => s + c.valor, 0);
  const maxCat = expensesByCategory[0]?.valor || 1;
  const catsVisiveis = expensesByCategory.slice(0, 5);
  const maxCliente = top_clientes[0]?.receita_total || 1;

  return (
    <main className="mx-auto max-w-[1180px] space-y-5 py-4 max-md:pt-0 md:py-2">
      {/* Celular: topo com fundo em degradê, saldo e os 3 números do mês */}
      <HeroMobile
        dataExtenso={dataExtenso} saudacao={greeting()} nome={primeiroNome}
        mesRotulo={metaSubtitle} ehAtual={ehAtual} onMes={mudarMes} onMesAtual={() => setPeriodo(mesAtual)}
        saldoRotulo={passado ? `Saldo no fim de ${mesCurto}` : 'Saldo em contas'} saldo={saldoKpi}
        saldoDelta={saldoAnterior != null ? variacaoPct(saldoAtualHist ?? totalBalance, saldoAnterior) : null}
        saldoHint={`${accountBalances.length} ${accountBalances.length === 1 ? 'conta' : 'contas'} · vs fim de ${mesAnteriorCurto}`}
        onSaldo={() => setSaldoSheetOpen(true)}
        minis={[
          { rotulo: 'Recebido', valor: resumo.faturamento_mes, delta: variacaoPct(resumo.faturamento_mes, resumo.faturamento_mes_anterior),
            onClick: () => navigate(comMes('/fluxo-caixa?tipo=entrada&status=recebido&base=efetivacao')),
            extra: metaValor > 0 ? (
              <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-surface-2" title={`Meta ${formatCurrency(metaValor)}`}>
                <span className="block h-full rounded-full bg-success-fg" style={{ width: `${Math.min(100, (meta_faturamento.valor_realizado / metaValor) * 100)}%` }} />
              </span>
            ) : null },
          { rotulo: 'Pago', valor: resumo.despesas_mes, delta: variacaoPct(resumo.despesas_mes, resumo.despesas_mes_anterior), inverter: true,
            onClick: () => navigate(comMes('/fluxo-caixa?tipo=saida&status=pago&base=efetivacao')) },
          { rotulo: 'Lucro', valor: resumo.lucro_mensal, delta: variacaoPct(resumo.lucro_mensal, resumo.lucro_mensal_anterior),
            onClick: () => navigate(comMes('/fluxo-caixa?status=recebido,pago&base=efetivacao')) },
        ]}
      />

      {/* Saudação + ações (no celular fica no topo novo) */}
      <div className="flex flex-wrap items-end justify-between gap-4 max-md:hidden">
        <div className="min-w-0">
          <p className="text-[13px] text-foreground-muted">{dataExtenso}</p>
          <div className="flex items-center gap-2">
            <h1 className="font-heading text-[38px] font-light leading-none tracking-[-0.04em] text-foreground md:text-[46px]">
            {greeting()}, <span className="font-serif italic tracking-normal">{primeiroNome}</span>
          </h1>
            <OlhoValores className="no-touch-min h-8 w-8 shrink-0 rounded-full border-0 bg-transparent text-foreground-muted hover:bg-surface-2 md:hidden [&_svg]:h-[18px] [&_svg]:w-[18px]" />
          </div>
        </div>
        <div className="flex items-center gap-2 max-sm:w-full">
          {/* Sino só no celular — no desktop o topo já tem um */}
          <span className="md:hidden"><NotificationBell /></span>
          <div className="flex h-10 items-center justify-between gap-0.5 rounded-full border border-border bg-surface p-1 max-sm:flex-1">
            <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><ChevronLeft className="h-4 w-4" /></button>
            <button
              type="button"
              onClick={() => setPeriodo(mesAtual)}
              disabled={ehAtual}
              title={ehAtual ? undefined : 'Voltar para o mês atual'}
              className="whitespace-nowrap px-1.5 text-[13px] text-foreground disabled:cursor-default"
            >
              {metaSubtitle}
            </button>
            <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês" className="grid h-8 w-8 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex h-10 items-center gap-1.5 rounded-full bg-foreground px-4 text-[14px] font-medium text-background hover:opacity-90 max-sm:hidden">
                <Plus className="h-4 w-4" />Novo<ChevronDown className="h-3.5 w-3.5 opacity-70" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-2xl p-1.5">
              <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5" onClick={() => navigate('/fluxo-caixa?action=nova-saida')}><TrendingDown className="h-4 w-4 text-danger-fg" />Despesa</DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5" onClick={() => navigate('/fluxo-caixa?action=nova-entrada')}><TrendingUp className="h-4 w-4 text-success-fg" />Receita</DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5" onClick={() => navigate('/fluxo-caixa?action=nova-saida')}><CreditCard className="h-4 w-4" />Compra no cartão</DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5" onClick={() => navigate('/fluxo-caixa?action=nova-transferencia')}><ArrowLeftRight className="h-4 w-4" />Transferência</DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5" onClick={() => navigate('/cobrancas?action=novo')}><Receipt className="h-4 w-4 text-primary" />Cobrança para cliente</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5" onClick={() => navigate('/lancar-voz')}><Mic className="h-4 w-4" />Lançar por voz</DropdownMenuItem>
              <DropdownMenuItem className="gap-2.5 rounded-xl py-2.5" onClick={() => navigate('/fluxo-caixa?action=importar')}><Upload className="h-4 w-4" />Importar extrato</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* IARA: pergunta direto da Início */}
      <form
        onSubmit={(e) => { e.preventDefault(); perguntar(pergunta); }}
        className="relative isolate overflow-hidden rounded-[26px] border border-border bg-surface p-3 md:p-4"
      >
        <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_0%_0%,hsl(var(--primary)/0.10),transparent_60%),radial-gradient(50%_120%_at_100%_100%,rgba(167,139,250,0.12),transparent_60%)]" />
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background"><Sparkle className="h-4 w-4" /></span>
          <input
            value={pergunta}
            onChange={(e) => setPergunta(e.target.value)}
            placeholder={mobile ? 'Pergunte à IARA' : 'Pergunte à IARA: quanto entra essa semana? posso retirar lucro?'}
            aria-label="Pergunte à IARA"
            className="h-11 min-w-0 flex-1 bg-transparent px-1 text-[15px] text-foreground outline-none placeholder:text-foreground-muted"
          />
          <button type="button" onClick={() => navigate('/iara', { state: { voz: true } })} aria-label="Falar com a IARA" className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-foreground-muted hover:bg-surface-2"><Mic className="h-[18px] w-[18px]" /></button>
          <button type="submit" aria-label="Perguntar" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-foreground text-background"><ArrowUp className="h-[18px] w-[18px]" /></button>
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pl-12 scrollbar-hide">
          {CHIPS_IARA.map((c) => (
            <button key={c} type="button" onClick={() => perguntar(c)} className="h-7 shrink-0 rounded-full border border-border bg-surface px-2.5 text-[11.5px] text-foreground-muted hover:text-foreground md:h-8 md:px-3 md:text-[12.5px]">{c}</button>
          ))}
        </div>
      </form>

      {/* Números do mês (no celular ficam no topo novo) */}
      <div className="grid grid-cols-1 gap-3 max-md:hidden sm:grid-cols-2 xl:grid-cols-4">
        <KpiStatCard
          highlight
          label={passado ? `Saldo no fim de ${mesCurto}` : 'Saldo em contas'}
          value={saldoKpi}
          delta={saldoAnterior != null ? variacaoPct(saldoAtualHist ?? totalBalance, saldoAnterior) : null}
          hint={`${accountBalances.length} ${accountBalances.length === 1 ? 'conta' : 'contas'} · vs fim de ${mesAnteriorCurto}`}
          onClick={() => setSaldoSheetOpen(true)}
        />
        <KpiStatCard
          label="Recebido no mês"
          value={resumo.faturamento_mes}
          delta={variacaoPct(resumo.faturamento_mes, resumo.faturamento_mes_anterior)}
          hint={hintComparacao}
          onClick={() => navigate(comMes('/fluxo-caixa?tipo=entrada&status=recebido&base=efetivacao'))}
        >
          <MetaInline
            current={meta_faturamento.valor_realizado}
            target={metaValor}
            subtitle={metaSubtitle}
            onEditTarget={(v) => upsertMeta.mutate({ tipo: 'faturamento', periodo: currentPeriodo, valor_meta: v })}
          />
        </KpiStatCard>
        <KpiStatCard
          label="Pago no mês"
          value={resumo.despesas_mes}
          invertDelta
          delta={variacaoPct(resumo.despesas_mes, resumo.despesas_mes_anterior)}
          hint={hintComparacao}
          onClick={() => navigate(comMes('/fluxo-caixa?tipo=saida&status=pago&base=efetivacao'))}
        />
        <KpiStatCard
          label="Lucro do mês"
          value={resumo.lucro_mensal}
          delta={variacaoPct(resumo.lucro_mensal, resumo.lucro_mensal_anterior)}
          hint={`margem ${String(resumo.lucro_mensal_percentual).replace('.', ',')}%`}
          onClick={() => navigate(comMes('/fluxo-caixa?status=recebido,pago&base=efetivacao'))}
        />
      </div>

      {/* Precisa de você */}
      <section className="rounded-[24px] border border-border bg-surface p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[15px] font-semibold text-foreground">Precisa de você</p>
          {precisa.length > 0 && (
            <span className="rounded-full bg-danger-bg px-2 py-0.5 text-[11.5px] text-danger-fg">{precisa.length} {precisa.length === 1 ? 'item' : 'itens'}</span>
          )}
        </div>
        {precisa.length === 0 ? (
          <p className="flex items-center gap-2 rounded-2xl bg-success-bg px-3.5 py-3 text-[13px] text-success-fg"><span className="h-2 w-2 rounded-full bg-success-fg" />Tudo em dia: nada atrasado nem vencendo hoje.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
            {precisa.map((p) => (
              <Link key={p.id} to={p.to} className="flex items-center gap-3 rounded-2xl border border-border p-3 text-left hover:bg-surface-2/50">
                <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-xl', p.cls)}>{p.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-foreground">{p.titulo}</span>
                  <span className="block truncate text-[12px] text-foreground-muted">{p.detalhe}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-foreground-subtle" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Gráfico + próximos 7 dias */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <RevenueAreaChart
          data3m={revenueData3m}
          data6m={revenueData6m}
          data12m={revenueData12m}
          onMesClick={(mes) => navigate(`/fluxo-caixa?mes=${mes}&status=recebido,pago&base=efetivacao`)}
        />

        <Card
          title={ehAtual ? 'Próximos 7 dias' : `Vencimentos de ${mesCurto}`}
          sub={ehAtual ? undefined : `${listaVenc.length} ${listaVenc.length === 1 ? 'lançamento' : 'lançamentos'} no mês`}
          action={<Link to="/calendario" className="text-[12.5px] text-primary hover:underline">Calendário</Link>}
        >
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-success-bg px-3 py-2.5"><p className="text-[11.5px] text-success-fg">Entra</p><p className="font-heading text-[17px] font-semibold tabular-nums text-success-fg">{formatCurrency(entra)}</p></div>
            <div className="rounded-2xl bg-danger-bg px-3 py-2.5"><p className="text-[11.5px] text-danger-fg">Sai</p><p className="font-heading text-[17px] font-semibold tabular-nums text-danger-fg">{formatCurrency(sai)}</p></div>
          </div>
          {proximos.length === 0 ? (
            <p className="rounded-2xl bg-surface-2/60 px-4 py-6 text-center text-[13px] text-foreground-muted">{ehAtual ? 'Nada vencendo nos próximos 7 dias' : `Nada vencendo em ${mesCurto}`}</p>
          ) : (
            <div className="divide-y divide-border">
              {proximos.map((item) => {
                const q = ehAtual ? quandoVence(item.data_vencimento) : (() => {
                  const d = dataLocal(item.data_vencimento);
                  const sem = format(d, 'EEE', { locale: ptBR }).replace('.', '');
                  return { rot: quitado(item) ? (item.tipo === 'receita' ? 'Recebido' : 'Pago') : sem.charAt(0).toUpperCase() + sem.slice(1), dia: format(d, 'dd/MM') };
                })();
                const receita = item.tipo === 'receita';
                const titulo = item.cliente_ou_fornecedor && !item.cliente_ou_fornecedor.startsWith('Sem ') ? item.cliente_ou_fornecedor : item.descricao;
                const sub = titulo === item.descricao ? null : item.descricao;
                return (
                  <button key={item.id} type="button" onClick={() => abrirItem(item)} className="grid w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 py-2.5 text-left hover:bg-surface-2/40">
                    <span className="text-center leading-tight">
                      <span className={cn('block text-[11.5px] font-medium', q.rot === 'Atrasado' ? 'text-danger-fg' : quitado(item) ? 'text-success-fg' : 'text-foreground')}>{q.rot}</span>
                      <span className="block text-[11px] tabular-nums text-foreground-muted">{q.dia}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] text-foreground">{titulo}</span>
                      {sub && <span className="block truncate text-[12px] text-foreground-muted">{sub}</span>}
                    </span>
                    <span className={cn('whitespace-nowrap font-heading text-[14px] font-semibold tabular-nums', receita ? 'text-success-fg' : 'text-foreground')}>
                      {receita ? '+' : '−'}{formatCurrency(item.valor)}
                    </span>
                  </button>
                );
              })}
              {listaVenc.length > proximos.length && (
                <button type="button" onClick={() => navigate(ehAtual ? '/fluxo-caixa?venc=prox7' : `/fluxo-caixa?mes=${periodo}`)} className="w-full pt-2.5 text-left text-[12.5px] text-primary hover:underline">
                  + {listaVenc.length - proximos.length} lançamentos · ver todos
                </button>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Para onde foi o dinheiro + clientes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Para onde foi o dinheiro"
          sub={`Pago em ${mesCurto}`}
          action={totalCat > 0 ? <span className="text-[12.5px] text-foreground-muted">Total <b className="font-semibold text-foreground">{formatCurrency(totalCat)}</b></span> : undefined}
        >
          {catsVisiveis.length === 0 ? (
            <p className="rounded-2xl bg-surface-2/60 px-4 py-6 text-center text-[13px] text-foreground-muted">Nenhuma despesa paga neste mês</p>
          ) : (
            <div className="space-y-3">
              {catsVisiveis.map((c) => (
                <button
                  key={c.categoria}
                  type="button"
                  onClick={() => navigate(comMes(`/fluxo-caixa?tipo=saida&status=pago&base=efetivacao&categoria=${c.categoria_id || '__sem_categoria__'}`))}
                  className="block w-full text-left"
                >
                  <span className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="flex min-w-0 items-center gap-1.5 text-foreground"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.cor }} /><span className="truncate">{c.categoria}</span></span>
                    <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(c.valor)} <span className="text-[12px] text-foreground-muted">{totalCat > 0 ? Math.round((c.valor / totalCat) * 100) : 0}%</span></span>
                  </span>
                  <span className="mt-1 block h-1.5 rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${(c.valor / maxCat) * 100}%`, background: c.cor }} /></span>
                </button>
              ))}
              {expensesByCategory.length > catsVisiveis.length && (
                <Link to="/relatorios" className="block text-[12.5px] text-primary hover:underline">
                  + {expensesByCategory.length - catsVisiveis.length} categorias · ver relatório
                </Link>
              )}
            </div>
          )}
        </Card>

        <Card title="Clientes que mais pagaram" action={<span className="text-[12.5px] text-foreground-muted">últimos 12 meses</span>}>
          {top_clientes.length === 0 ? (
            <p className="rounded-2xl bg-surface-2/60 px-4 py-6 text-center text-[13px] text-foreground-muted">Sem receitas de clientes nos últimos 12 meses</p>
          ) : (
            <div className="space-y-2.5">
              {top_clientes.map((c, i) => (
                <button
                  key={c.cliente_id}
                  type="button"
                  onClick={() => navigate(`/fluxo-caixa?tipo=entrada&mes=all&search=${encodeURIComponent(c.cliente)}`)}
                  className="grid w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-3 text-left"
                >
                  <span className={cn('grid h-7 w-7 place-items-center rounded-full text-[12px]', i === 0 ? 'bg-foreground text-background' : 'bg-surface-2 text-foreground-muted')}>{i + 1}</span>
                  <span className="min-w-0">
                    <span className="flex items-baseline justify-between gap-2 text-[13.5px]"><span className="truncate text-foreground">{c.cliente}</span><span className="shrink-0 font-heading font-semibold tabular-nums text-foreground">{formatCurrency(c.receita_total)}</span></span>
                    <span className="mt-1 block h-1.5 rounded-full bg-surface-2"><span className="block h-full rounded-full bg-primary" style={{ width: `${(c.receita_total / maxCliente) * 100}%` }} /></span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Saldo detalhado */}
      <DetailSheet
        open={saldoSheetOpen}
        onOpenChange={setSaldoSheetOpen}
        variant="light"
        eyebrow={metaSubtitle}
        title="Detalhe do saldo"
      >
        <div className="mb-5 rounded-[20px] bg-surface-2 px-4 py-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Total disponível</p>
          <p className="font-heading text-[30px] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-foreground">
            {formatCurrency(totalBalance)}
          </p>
          <p className="mt-1 text-[12px] text-foreground-muted">
            Recebido {formatCurrency(resumo.faturamento_mes)} · Pago {formatCurrency(resumo.despesas_mes)}
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
          className="mt-5 w-full rounded-full"
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
