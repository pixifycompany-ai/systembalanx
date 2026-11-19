import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, endOfMonth, format, isWithinInterval, parseISO, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, CheckCircle2, CreditCard, Gem, PieChart, Repeat,
  TrendingDown, TrendingUp, Users,
} from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RevenueAreaChart } from '@/components/dashboard/RevenueAreaChart';
import { SkeletonCard, SkeletonChart } from '@/components/shared/LoadingSpinner';
import { Sparkle } from '@/components/shared/Sparkle';
import { NAVY_TONE } from '@/components/shared/navyTokens';
import { Card, NavyCard, PageHeader, Segmented } from '@/components/reskin/kit';
import { btn } from '@/components/reskin/estilos';
import { InfoHint } from '@/components/relatorios/ReportKit';
import { CHART, axisProps, gridProps, tooltipProps } from '@/components/relatorios/chartTheme';
import { useDashboard } from '@/hooks/useDashboard';
import { useContratos } from '@/hooks/useContratos';
import { useAdvancedReports } from '@/hooks/useAdvancedReports';
import { getDataFimEfetiva, getValorMensalEquivalente, isContratoAtivoHoje } from '@/utils/contractUtils';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

const pct = (v: number, d = 1) => `${v.toFixed(d).replace('.', ',')}%`;
const kFmt = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1).replace('.', ',')}k` : `${Math.round(v)}`);
const BRAND: Record<string, string> = {
  PIXIFY: 'hsl(var(--brand-pixify))', REVVUE: 'hsl(var(--brand-revvue))', CLARIO: 'hsl(var(--brand-clario))', TABELIO: 'hsl(var(--brand-tabelio))',
};
const SECOES = [['resumo', 'Resumo'], ['recorrencia', 'Recorrência'], ['resultado', 'Resultado'], ['clientes', 'Clientes'], ['caixa', 'Caixa']] as const;

const formatMeses = (meses: number) => {
  if (meses < 1) return 'menos de 1 mês';
  if (meses < 12) return `${Math.round(meses)} ${Math.round(meses) === 1 ? 'mês' : 'meses'}`;
  const anos = Math.floor(meses / 12);
  const resto = Math.round(meses % 12);
  return resto === 0 ? `${anos} ano${anos > 1 ? 's' : ''}` : `${anos} ano${anos > 1 ? 's' : ''} e ${resto} ${resto === 1 ? 'mês' : 'meses'}`;
};

function Delta({ v, escuro }: { v: number; escuro?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium',
      escuro ? 'bg-white/[0.12] text-white' : v >= 0 ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')}>
      {v >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{pct(Math.abs(v))}
    </span>
  );
}

function Kpi({ rot, valor, sub, icon: Icon, delta, info }: { rot: string; valor: string; sub: string; icon: React.ComponentType<{ className?: string }>; delta?: number | null; info?: string }) {
  return (
    <div className="flex flex-col rounded-[24px] border border-border bg-surface p-4 md:p-5">
      <p className="flex items-center justify-between gap-2 text-[13px] text-foreground-muted"><span className="inline-flex items-center gap-1">{rot}{info && <InfoHint text={info} />}</span><Icon className="h-4 w-4 shrink-0" /></p>
      <p className="mt-1 font-heading text-[22px] font-semibold tabular-nums tracking-[-0.03em] text-foreground md:text-[26px]">{valor}</p>
      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-foreground-muted">{delta !== undefined && delta !== null && <Delta v={delta} />}{sub}</p>
    </div>
  );
}

function Barras({ itens, onClick }: { itens: { nome: string; valor: number; cor: string; extra?: React.ReactNode }[]; onClick?: (i: number) => void }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  const total = itens.reduce((s, i) => s + i.valor, 0) || 1;
  return (
    <div className="space-y-3">
      {itens.map((it, i) => (
        <button key={it.nome} type="button" disabled={!onClick} onClick={() => onClick?.(i)} className={cn('block w-full text-left', onClick && 'rounded-lg hover:opacity-80')}>
          <span className="flex items-baseline justify-between gap-2 text-[13px]">
            <span className="flex min-w-0 items-center gap-1.5 text-foreground"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: it.cor }} /><span className="truncate">{it.nome}</span></span>
            <span className="shrink-0 tabular-nums text-foreground">{formatCurrency(it.valor)} <span className="text-[12px] text-foreground-muted">{it.extra ?? `${Math.round((it.valor / total) * 100)}%`}</span></span>
          </span>
          <span className="mt-1 block h-1.5 rounded-full bg-surface-2"><span className="block h-full rounded-full" style={{ width: `${(it.valor / max) * 100}%`, background: it.cor }} /></span>
        </button>
      ))}
    </div>
  );
}

const ehDistribuicao = (nome: string) => /distribui[cç][aã]o de lucro/i.test(nome);

export default function Visao() {
  const navigate = useNavigate();
  const {
    dashboardData, contractsData, expensesByCategory, ltvData, accountBalances, consolidatedHistory,
    revenueData3m, revenueData6m, revenueData12m, receitaPorEmpresa, creditCardsData, isLoading, error,
  } = useDashboard();
  const { contratos } = useContratos();
  // Ranking de clientes com participação: mesma janela do "Top clientes" (12 meses, competência).
  const [ini12, fim12] = useMemo(() => { const h = new Date(); return [startOfMonth(subMonths(h, 11)), endOfMonth(h)]; }, []);
  const { reports } = useAdvancedReports('custom', ini12, fim12);
  const [mrrModo, setMrrModo] = useState<'hist' | 'proj'>('hist');
  const [secao, setSecao] = useState<string>('resumo');

  // Destaca a seção visível na barra de navegação.
  useEffect(() => {
    if (isLoading) return;
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setSecao(vis.target.id);
    }, { rootMargin: '-90px 0px -60% 0px' });
    SECOES.forEach(([id]) => { const el = document.getElementById(id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, [isLoading]);

  const hoje = useMemo(() => new Date(), []);
  const contratosStats = useMemo(() => {
    const mIni = startOfMonth(hoje); const mFim = endOfMonth(hoje);
    const noMes = (iso?: string | null) => !!iso && isWithinInterval(parseISO(iso), { start: mIni, end: mFim });
    const novos = contratos.filter((c) => c.recorrencia !== 'unico' && noMes(c.data_inicio));
    const encerrados = contratos.filter((c) => {
      if (c.recorrencia === 'unico') return false;
      // Só datas registradas (sem o "hoje" que getDataFimEfetiva usa como fallback).
      if (!c.data_inativacao && !c.data_fim) return false;
      const fim = getDataFimEfetiva(c as never);
      return !!fim && fim >= mIni && fim <= hoje;
    });
    const limite = addDays(hoje, 30);
    const vencendo = contratos
      .filter((c) => isContratoAtivoHoje(c as never) && c.data_fim && parseISO(c.data_fim) >= hoje && parseISO(c.data_fim) <= limite)
      .sort((a, b) => (a.data_fim ?? '').localeCompare(b.data_fim ?? ''));
    return { novos, encerrados, vencendo };
  }, [contratos, hoje]);

  if (isLoading) {
    return (
      <main className="container py-6">
        <div className="mb-6 h-10 w-40 animate-pulse rounded-full bg-surface-2" />
        <div className="mb-6 grid gap-4 md:grid-cols-3"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
        <SkeletonChart />
      </main>
    );
  }
  if (error) {
    return <main className="container py-6"><p className="text-foreground-muted">{error}</p></main>;
  }

  const { resumo, mrr } = dashboardData;
  const mesNome = format(hoje, 'MMMM', { locale: ptBR });
  const totalSaldo = accountBalances.reduce((s, a) => s + a.saldo, 0);
  const totalDesp = expensesByCategory.reduce((s, c) => s + c.valor, 0);
  const histMrr = mrr.historico;
  const mrrAnterior = histMrr.length >= 2 ? histMrr[histMrr.length - 2].valor : null;
  const deltaMrr = mrrAnterior ? ((contractsData.mrrTotal - mrrAnterior) / mrrAnterior) * 100 : null;
  const deltaLucro = resumo.lucro_mensal_anterior ? ((resumo.lucro_mensal - resumo.lucro_mensal_anterior) / Math.abs(resumo.lucro_mensal_anterior)) * 100 : null;
  const top = reports.topClients.slice(0, 5);
  const top2 = reports.topClients.slice(0, 2).reduce((s, c) => s + c.share, 0);
  const projUltimo = mrr.projecao[mrr.projecao.length - 1];
  const serieMrr = mrrModo === 'hist'
    ? histMrr.map((p) => ({ m: p.mes, v: p.valor }))
    : [...histMrr.slice(-1).map((p) => ({ m: p.mes, v: p.valor, p: p.valor })), ...mrr.projecao.map((p) => ({ m: p.mes, p: p.valor }))];

  // ---- Leitura da IARA (regras sobre os dados reais, sem chamar IA) ----
  const leituras: [React.ReactNode, string][] = [];
  if (contractsData.mrrTotal > 0 && deltaMrr !== null) {
    const n = contratosStats.novos.length; const e = contratosStats.encerrados.length;
    const motivo = n || e ? ` (${n ? `${n} contrato${n > 1 ? 's' : ''} novo${n > 1 ? 's' : ''}` : ''}${n && e ? ', ' : ''}${e ? `${e} encerrado${e > 1 ? 's' : ''}` : ''})` : '';
    leituras.push(deltaMrr >= 0
      ? [<TrendingUp key="m" className="h-4 w-4 text-success-fg" />, `O MRR ${deltaMrr > 0.05 ? `subiu ${pct(deltaMrr)}` : 'ficou estável'} no mês, em ${formatCurrency(contractsData.mrrTotal)}${motivo}.`]
      : [<TrendingDown key="m" className="h-4 w-4 text-danger-fg" />, `O MRR caiu ${pct(Math.abs(deltaMrr))} no mês, para ${formatCurrency(contractsData.mrrTotal)}${motivo}.`]);
  } else if (contractsData.mrrTotal === 0) {
    leituras.push([<Repeat key="m" className="h-4 w-4 text-foreground-muted" />, 'Ainda não há contratos recorrentes ativos: o MRR começa a contar quando você cadastrar contratos.']);
  }
  if (resumo.lucro_mensal < 0) {
    leituras.push([<AlertTriangle key="l" className="h-4 w-4 text-danger-fg" />, `O mês está no negativo até agora: saíram ${formatCurrency(Math.abs(resumo.lucro_mensal))} a mais do que entrou.`]);
  } else if (expensesByCategory.some((c) => !ehDistribuicao(c.categoria))) {
    // Distribuição de lucros é retirada dos sócios, não despesa da operação.
    const operacionais = expensesByCategory.filter((c) => !ehDistribuicao(c.categoria));
    const totalOp = operacionais.reduce((s, c) => s + c.valor, 0);
    const maior = [...operacionais].sort((a, b) => b.valor - a.valor)[0];
    const sh = totalOp > 0 ? (maior.valor / totalOp) * 100 : 0;
    leituras.push(sh >= 30
      ? [<AlertTriangle key="c" className="h-4 w-4 text-warning-fg" />, `${maior.categoria} concentra ${pct(sh, 0)} das despesas da operação em ${mesNome} (${formatCurrency(maior.valor)}).`]
      : [<PieChart key="c" className="h-4 w-4 text-primary" />, `As despesas de ${mesNome} estão espalhadas: a maior categoria (${maior.categoria}) é ${pct(sh, 0)} do total.`]);
  }
  if (reports.topClients.length) {
    const t = reports.topClients[0];
    leituras.push(t.share >= 0.2
      ? [<Users key="t" className="h-4 w-4 text-warning-fg" />, `${t.nome} sozinho é ${pct(t.share * 100, 0)} da receita dos últimos 12 meses. Vale reduzir essa dependência.`]
      : [<CheckCircle2 key="t" className="h-4 w-4 text-success-fg" />, `Receita bem distribuída: o maior cliente (${t.nome}) é ${pct(t.share * 100, 0)} dos últimos 12 meses.`]);
  }

  const conversar = () => navigate('/iara', {
    state: {
      pergunta: 'Me explica a visão do meu negócio: como estão o lucro do mês, o MRR, o LTV e a concentração de clientes? Está bom? Por quê? O que eu deveria fazer?',
      contextoTela: {
        tela: 'visao',
        titulo: 'Visão do negócio',
        periodo: `${mesNome} (até hoje) · ranking de clientes: últimos 12 meses`,
        dados: {
          lucro_mes: resumo.lucro_mensal, receitas_mes: resumo.faturamento_mes, despesas_mes: resumo.despesas_mes, margem_pct: Number(resumo.lucro_mensal_percentual),
          lucro_mes_anterior_mesmo_periodo: resumo.lucro_mensal_anterior ?? null,
          mrr: contractsData.mrrTotal, mrr_mes_anterior: mrrAnterior, receita_anual_projetada: resumo.receita_anual_projetada,
          contratos_ativos: contractsData.contratosAtivos, contratos_novos_mes: contratosStats.novos.length, contratos_encerrados_mes: contratosStats.encerrados.length,
          ltv_medio: ltvData.ltvMedio, ticket_medio: ltvData.ticketMedio, tempo_medio_meses: Number(ltvData.tempoMedioMeses.toFixed(1)),
          top_clientes: top.map((c) => ({ cliente: c.nome, receita: c.total, participacao_pct: Number((c.share * 100).toFixed(1)) })),
          despesas_por_categoria_mes: expensesByCategory.map((c) => ({ categoria: c.categoria, valor: c.valor })),
          saldo_contas: totalSaldo,
          leitura: leituras.map(([, t]) => t),
        },
      },
    },
  });

  return (
    <main className="container py-3 md:py-6">
      <div className="space-y-5">
        <PageHeader eyebrow="Análise" title="Visão do negócio" />

        {/* navegação entre blocos */}
        <nav className="sticky top-0 z-20 -mx-3 flex gap-1.5 overflow-x-auto bg-background/85 px-3 py-2 backdrop-blur scrollbar-hide md:mx-0 md:px-0">
          {SECOES.map(([id, r]) => (
            <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setSecao(id); }}
              className={cn('h-8 shrink-0 rounded-full border px-3.5 text-[13px] leading-[30px] transition-colors', secao === id ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface text-foreground-muted hover:text-foreground')}>{r}</a>
          ))}
        </nav>

        {/* Resumo */}
        <div id="resumo" className="grid scroll-mt-20 grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <NavyCard className="sm:col-span-3 lg:col-span-1">
            <p className="flex items-center justify-between text-[13px] text-white/70">Lucro do mês<span className="text-[12px]">{mesNome}</span></p>
            <p className="mt-1 font-heading text-[28px] font-semibold tabular-nums tracking-[-0.03em]">{formatCurrency(resumo.lucro_mensal)}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12px] text-white/70">{deltaLucro !== null && <Delta v={deltaLucro} escuro />}margem {pct(Number(resumo.lucro_mensal_percentual))}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/10 pt-3 text-[12px]">
              <span><span className="block text-white/60">Receitas</span><span className="tabular-nums" style={{ color: NAVY_TONE.success }}>{formatCurrency(resumo.faturamento_mes)}</span></span>
              <span className="text-right"><span className="block text-white/60">Despesas</span><span className="tabular-nums" style={{ color: NAVY_TONE.danger }}>{formatCurrency(resumo.despesas_mes)}</span></span>
            </div>
          </NavyCard>
          <Kpi rot="Receita recorrente (MRR)" valor={formatCurrency(contractsData.mrrTotal)} delta={deltaMrr} sub={`${contractsData.contratosAtivos} contrato${contractsData.contratosAtivos === 1 ? '' : 's'} · ${contractsData.clientesAtivos} cliente${contractsData.clientesAtivos === 1 ? '' : 's'}`} icon={Repeat} info="Soma do valor mensal dos contratos ativos hoje (quinzenal ×2, trimestral ÷3…)." />
          <Kpi rot="Receita anual projetada" valor={formatCurrency(resumo.receita_anual_projetada)} sub="MRR × 12" icon={CalendarClock} />
          <Kpi rot="LTV médio por cliente" valor={formatCurrency(ltvData.ltvMedio)} sub={`fica ${formatMeses(ltvData.tempoMedioMeses)} em média`} icon={Gem} info="Valor mensal contratado × meses de relacionamento, na média dos clientes." />
        </div>

        {/* Leitura da IARA */}
        {leituras.length > 0 && (
          <section className="relative isolate overflow-hidden rounded-[24px] border border-border bg-surface p-4 md:p-5">
            <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60%_120%_at_0%_0%,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(50%_120%_at_100%_100%,rgba(167,139,250,0.10),transparent_60%)]" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><span className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background"><Sparkle className="h-3.5 w-3.5" /></span>Leitura da IARA</p>
              <button type="button" onClick={conversar} className="h-9 rounded-full border border-border bg-surface px-3.5 text-[13px] text-foreground hover:bg-surface-2">Conversar sobre isso</button>
            </div>
            <div className={cn('mt-3 grid grid-cols-1 gap-2', leituras.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
              {leituras.map(([ic, t]) => <div key={t} className="flex gap-2.5 rounded-2xl bg-surface-2/60 p-3 text-[13px] leading-snug text-foreground"><span className="mt-0.5 shrink-0">{ic}</span>{t}</div>)}
            </div>
          </section>
        )}

        {/* Recorrência */}
        <div id="recorrencia" className="grid scroll-mt-20 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card title="Receita recorrente (MRR)" sub={mrrModo === 'hist' ? 'Contratos ativos, mês a mês (últimos 6 meses)' : 'Próximos 6 meses no ritmo de +5% ao mês'}
            action={<Segmented<'hist' | 'proj'> size="sm" value={mrrModo} onChange={setMrrModo} opts={[['hist', 'Histórico'], ['proj', 'Projeção']]} />}>
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{formatCurrency(mrrModo === 'hist' ? contractsData.mrrTotal : (projUltimo?.valor ?? 0))}</span>
              {mrrModo === 'hist' ? (deltaMrr !== null && <Delta v={deltaMrr} />) : projUltimo && <span className="text-[12.5px] text-foreground-muted">em {projUltimo.mes.toLowerCase()}</span>}
            </div>
            <p className="text-[12px] text-foreground-muted">{mrrModo === 'hist' ? 'vs mês anterior' : 'se nenhum contrato for encerrado'}</p>
            <div className="mt-3 h-[220px]">
              {serieMrr.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={serieMrr} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                    <defs><linearGradient id="visaoMrr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.primary} stopOpacity={0.3} /><stop offset="100%" stopColor={CHART.primary} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid {...gridProps} />
                    <XAxis dataKey="m" {...axisProps} dy={6} />
                    <YAxis {...axisProps} width={44} tickFormatter={kFmt} />
                    <Tooltip {...tooltipProps} formatter={(v: number, n) => [formatCurrency(v), n === 'p' ? 'Projeção' : 'MRR']} />
                    <Area type="monotone" dataKey="v" stroke={CHART.primary} strokeWidth={2.5} fill="url(#visaoMrr)" dot={false} />
                    {mrrModo === 'proj' && <Area type="monotone" dataKey="p" stroke={CHART.primary} strokeWidth={2} strokeDasharray="5 5" fill="transparent" dot={false} />}
                  </AreaChart>
                </ResponsiveContainer>
              ) : <p className="grid h-full place-items-center text-[13px] text-foreground-muted">Sem contratos recorrentes no período.</p>}
            </div>
          </Card>
          <Card title="Contratos" sub={`${mesNome[0].toUpperCase()}${mesNome.slice(1)}`} action={<button type="button" onClick={() => navigate('/contratos')} className="text-[12.5px] text-primary hover:underline">Ver contratos</button>}>
            <div className="grid grid-cols-3 gap-2">
              {([['Ativos', String(contractsData.contratosAtivos), 'text-foreground'], ['Novos', `+${contratosStats.novos.length}`, 'text-success-fg'], ['Encerrados', `−${contratosStats.encerrados.length}`, 'text-danger-fg']] as const).map(([r, v, c]) => (
                <div key={r} className="rounded-2xl bg-surface-2/60 p-3"><p className="text-[12px] text-foreground-muted">{r}</p><p className={cn('font-heading text-[22px] font-semibold tabular-nums', c)}>{v}</p></div>
              ))}
            </div>
            <p className="mb-2 mt-4 text-[11.5px] font-semibold uppercase tracking-[0.07em] text-foreground-muted">Vencem em 30 dias</p>
            {contratosStats.vencendo.length ? (
              <div className="divide-y divide-border">
                {contratosStats.vencendo.slice(0, 5).map((c) => (
                  <button key={c.id} type="button" onClick={() => navigate('/contratos')} className="flex w-full items-center justify-between gap-3 py-2.5 text-left">
                    <span className="min-w-0"><span className="block truncate text-[13.5px] text-foreground">{c.cliente?.nome ?? 'Cliente'}</span><span className="block truncate text-[12px] text-foreground-muted">{c.descricao} · vence {format(parseISO(c.data_fim!), 'dd/MM')}</span></span>
                    <span className="shrink-0 text-[13px] tabular-nums text-foreground">{formatCurrency(getValorMensalEquivalente(Number(c.valor), c.recorrencia))}<span className="text-foreground-muted">/mês</span></span>
                  </button>
                ))}
              </div>
            ) : <p className="text-[13px] text-foreground-muted">Nenhum contrato termina nos próximos 30 dias.</p>}
          </Card>
        </div>

        {/* Resultado */}
        <div id="resultado" className="grid scroll-mt-20 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <RevenueAreaChart data3m={revenueData3m} data6m={revenueData6m} data12m={revenueData12m}
            onMesClick={(mes) => navigate(`/fluxo-caixa?mes=${mes}&status=recebido,pago&base=efetivacao`)} />
          <Card title="Para onde foi o dinheiro" sub={`Despesas pagas em ${mesNome}`} action={<span className="text-[12.5px] text-foreground-muted">Total <b className="font-semibold text-foreground">{formatCurrency(totalDesp)}</b></span>}>
            {expensesByCategory.length ? (
              <Barras itens={[...expensesByCategory].sort((a, b) => b.valor - a.valor).slice(0, 7).map((c) => ({ nome: c.categoria, valor: c.valor, cor: c.cor }))}
                onClick={(i) => { const c = [...expensesByCategory].sort((a, b) => b.valor - a.valor)[i]; navigate(`/fluxo-caixa?tipo=saida&status=pago&base=efetivacao&categoria=${c.categoria_id || '__sem_categoria__'}`); }} />
            ) : <p className="py-8 text-center text-[13px] text-foreground-muted">Nenhuma despesa paga neste mês.</p>}
          </Card>
        </div>

        {/* Clientes */}
        <div id="clientes" className="grid scroll-mt-20 grid-cols-1 gap-4 lg:grid-cols-3">
          <Card title="Quem mais pagou" sub="Últimos 12 meses · competência" className="lg:col-span-2">
            {top.length ? (<>
              <div className="space-y-2.5">
                {top.map((c, i) => (
                  <div key={c.id} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3">
                    <span className={cn('grid h-7 w-7 place-items-center rounded-full text-[12px]', i === 0 ? 'bg-foreground text-background' : 'bg-surface-2 text-foreground-muted')}>{i + 1}</span>
                    <span className="min-w-0">
                      <span className="flex justify-between gap-2 text-[13.5px] text-foreground"><span className="truncate">{c.nome}</span><span className="shrink-0 text-[12px] text-foreground-muted">{pct(c.share * 100, 0)} da receita</span></span>
                      <span className="mt-1 block h-1.5 rounded-full bg-surface-2"><span className="block h-full rounded-full bg-primary" style={{ width: `${(c.total / top[0].total) * 100}%` }} /></span>
                    </span>
                    <span className="text-right font-heading text-[14px] font-semibold tabular-nums text-foreground sm:w-32">{formatCurrency(c.total)}</span>
                  </div>
                ))}
              </div>
              {(top[0].share >= 0.2 || top2 >= 0.35) && (
                <p className="mt-4 flex items-center gap-2 rounded-2xl bg-warning-bg px-3.5 py-2.5 text-[12.5px] text-warning-fg">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {top[0].share >= 0.2 ? `${top[0].nome} sozinho é ${pct(top[0].share * 100, 0)} da receita.` : `Os 2 maiores clientes somam ${pct(top2 * 100, 0)} da receita.`}
                </p>
              )}
            </>) : <p className="py-8 text-center text-[13px] text-foreground-muted">Sem receita de clientes nos últimos 12 meses.</p>}
          </Card>
          <Card title="Receita por marca" sub="Recebido no mês vs mês anterior">
            {receitaPorEmpresa.some((r) => r.valor_mes > 0 || r.valor_anterior > 0) ? (
              <Barras itens={receitaPorEmpresa.filter((r) => r.valor_mes > 0 || r.valor_anterior > 0).map((r) => ({
                nome: r.empresa[0] + r.empresa.slice(1).toLowerCase(), valor: r.valor_mes, cor: BRAND[r.empresa] ?? 'hsl(var(--primary))',
                extra: <span className={r.delta_percent >= 0 ? 'text-success-fg' : 'text-danger-fg'}>{r.delta_percent >= 0 ? '+' : '−'}{pct(Math.abs(r.delta_percent), 0)}</span>,
              }))} />
            ) : <p className="py-4 text-[13px] text-foreground-muted">Nenhuma receita recebida por marca neste mês.</p>}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[12.5px]">
              <span><span className="block text-foreground-muted">Ticket mensal</span><span className="font-medium tabular-nums text-foreground">{formatCurrency(ltvData.ticketMedio)}</span></span>
              <span><span className="block text-foreground-muted">Clientes ativos</span><span className="font-medium tabular-nums text-foreground">{ltvData.clientesComReceita} / {ltvData.totalClientes}</span></span>
            </div>
          </Card>
        </div>

        {/* Caixa */}
        <div id="caixa" className="grid scroll-mt-20 grid-cols-1 gap-4 lg:grid-cols-2">
          <Card title="Saldo consolidado" sub="Contas bancárias, hoje" action={<span className="font-heading text-[20px] font-semibold tabular-nums text-foreground">{formatCurrency(totalSaldo)}</span>}>
            {consolidatedHistory.length > 1 && (
              <div className="h-[90px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={consolidatedHistory} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="visaoSaldo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CHART.primary} stopOpacity={0.25} /><stop offset="100%" stopColor={CHART.primary} stopOpacity={0} /></linearGradient></defs>
                    <XAxis dataKey="mes" hide />
                    <Tooltip {...tooltipProps} formatter={(v: number) => [formatCurrency(v), 'Saldo no fim do mês']} />
                    <Area type="monotone" dataKey="valor" stroke={CHART.primary} strokeWidth={2} fill="url(#visaoSaldo)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="mt-3 divide-y divide-border">
              {accountBalances.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2.5 text-[13.5px]"><span className="flex min-w-0 items-center gap-2 text-foreground"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.cor }} /><span className="truncate">{a.nome}</span></span><span className={cn('tabular-nums', a.saldo < 0 ? 'text-danger-fg' : 'text-foreground')}>{formatCurrency(a.saldo)}</span></div>
              ))}
              {!accountBalances.length && <p className="py-3 text-[13px] text-foreground-muted">Nenhuma conta bancária ativa.</p>}
            </div>
          </Card>
          <Card title="Cartões de crédito" sub="Fatura atual e limite" action={<button type="button" onClick={() => navigate('/contas')} className="text-[12.5px] text-primary hover:underline">Ver cartões</button>}>
            {creditCardsData.length ? creditCardsData.map((c) => {
              const uso = c.limite > 0 ? c.usado / c.limite : 0;
              return (
                <div key={c.id} className="border-t border-border py-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2"><span className="flex min-w-0 items-center gap-2 text-[13.5px] text-foreground"><CreditCard className="h-4 w-4 shrink-0 text-foreground-muted" /><span className="truncate">{c.nome}</span></span><span className="font-heading text-[15px] font-semibold tabular-nums text-foreground">{formatCurrency(c.usado)}</span></div>
                  {c.limite > 0 && (<>
                    <div className="mt-2 h-1.5 rounded-full bg-surface-2"><div className={cn('h-full rounded-full', uso > 0.7 ? 'bg-warning-fg' : 'bg-foreground')} style={{ width: `${Math.min(100, uso * 100)}%` }} /></div>
                    <p className="mt-1 text-right text-[12px] text-foreground-muted">{Math.round(uso * 100)}% de {formatCurrency(c.limite)}</p>
                  </>)}
                </div>
              );
            }) : <p className="text-[13px] text-foreground-muted">Nenhum cartão de crédito cadastrado.</p>}
          </Card>
        </div>
      </div>
    </main>
  );
}
