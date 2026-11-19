// Blocos da tela Análises (reskin). Só apresentação: os números vêm de useAnalises
// (mesmas fórmulas que a IARA usa) — nada é recalculado aqui além de médias de exibição.
import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/formatters';
import { Card, NavyCard, Segmented } from '@/components/reskin/kit';
import { NAVY_TONE } from '@/components/shared/navyTokens';
import { InfoHint } from '@/components/relatorios/ReportKit';
import { CHART, axisProps, barCursor, gridProps, tooltipProps } from '@/components/relatorios/chartTheme';
import type {
  ChurnData, ClientProfitability, CohortData, HealthScore, HealthScoreFator, LTVEvolutionData, RevenueProjection,
} from '@/hooks/useAnalises';

const pct = (v: number, d = 1) => `${v.toFixed(d).replace('.', ',')}%`;
const k = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1).replace('.', ',')}k` : `${Math.round(v)}`);
const SEGUNDA = '#A78BFA';

/* ============================ Saúde financeira ============================ */
const CATEGORIA = {
  critico: 'Crítico', atencao: 'Atenção', bom: 'Bom', excelente: 'Excelente',
} as const;

/** Nota 0–100 de cada fator (contribuição ÷ peso). */
const notaFator = (f: HealthScoreFator) => Math.min(100, Math.max(0, (f.contribuicao / f.peso) * 100));

function detalheFator(f: HealthScoreFator) {
  switch (f.nome) {
    case 'Margem Líquida': return `${pct(f.valor)} no mês`;
    case 'Inadimplência': return `${pct(f.valor)} em atraso (3 meses)`;
    case 'Crescimento MRR': return `MRR ${f.valor >= 0 ? '+' : ''}${pct(f.valor)} vs mês anterior`;
    case 'Retenção': return `churn de ${pct(100 - f.valor)} ao mês`;
    case 'Liquidez': return `${Math.round(f.valor)} dias de caixa`;
    default: return pct(f.valor);
  }
}
const DICAS: Record<string, string> = {
  'Margem Líquida': 'Reveja preços e corte custos variáveis que mais cresceram.',
  'Inadimplência': 'Ligue os lembretes automáticos de atraso nas cobranças.',
  'Crescimento MRR': 'Feche contratos recorrentes e aplique os reajustes previstos.',
  'Retenção': 'Converse com os clientes antes da renovação para evitar cancelamentos.',
  'Liquidez': 'Monte reserva de caixa antes de novas retiradas de lucro.',
};

export function SaudeFinanceira({ health }: { health: HealthScore }) {
  const { score, categoria, fatores } = health;
  const C = 2 * Math.PI * 52;
  const corAnel = categoria === 'excelente' ? NAVY_TONE.success : categoria === 'bom' ? '#fff' : categoria === 'atencao' ? NAVY_TONE.warning : NAVY_TONE.danger;
  const fracos = fatores.filter((f) => notaFator(f) < 65).sort((a, b) => notaFator(a) - notaFator(b)).slice(0, 3);
  return (
    <NavyCard className="h-full">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center">
          <p className="mb-2 flex items-center gap-1 self-start text-[13px] text-white/70 sm:self-center">
            Saúde financeira
            <InfoHint onNavy text={<>Nota de 0 a 100: margem líquida (25%), inadimplência (20%), crescimento do MRR (20%), retenção (15%) e liquidez em dias de caixa (20%). Só títulos já vencidos penalizam.</>} />
          </p>
          <div className="relative h-36 w-36">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
              <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="10" />
              <circle cx="60" cy="60" r="52" fill="none" stroke={corAnel} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(score / 100) * C} ${C}`} />
            </svg>
            <div className="absolute inset-0 grid place-items-center text-center">
              <div><p className="font-heading text-[40px] font-semibold leading-none tabular-nums">{score}</p><p className="text-[12px] text-white/70">de 100 · {CATEGORIA[categoria]}</p></div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          {fatores.map((f) => {
            const n = notaFator(f);
            return (
              <div key={f.nome}>
                <div className="flex items-baseline justify-between gap-2 text-[13px]"><span>{f.nome} <span className="text-[11px] text-white/50">peso {f.peso}%</span></span><span className="text-right text-[12px] text-white/60">{detalheFator(f)}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${n}%`, background: n >= 80 ? NAVY_TONE.success : n >= 65 ? '#fff' : NAVY_TONE.warning }} /></div>
              </div>
            );
          })}
          {!fatores.length && <p className="text-[13px] text-white/70">Ainda não há dados suficientes para calcular a nota.</p>}
        </div>
      </div>
      {fracos.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="mb-2 text-[12px] text-white/60">Para subir a nota</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {fracos.map((f) => <div key={f.nome} className="rounded-2xl bg-white/[0.08] p-2.5 text-[12.5px] leading-snug"><span className="block text-white/60">{f.nome}</span>{DICAS[f.nome] ?? 'Acompanhe este fator de perto.'}</div>)}
          </div>
        </div>
      )}
    </NavyCard>
  );
}

/* ================================== Churn ================================== */
export function ChurnBloco({ churn }: { churn: ChurnData }) {
  const hist = churn.historicoChurn;
  const anterior = hist.length >= 2 ? hist[hist.length - 2].taxa : null;
  const delta = anterior !== null ? churn.taxaChurnMensal - anterior : null;
  return (
    <Card title="Entrada e saída de clientes" sub="Churn do último mês completo" className="h-full">
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">{pct(churn.taxaChurnMensal)}</span>
        {delta !== null && (
          <span className={cn('inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11.5px] font-medium', delta <= 0 ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')}>
            {delta <= 0 ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}{pct(Math.abs(delta))}
          </span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {([['Ativos', String(churn.clientesAtivos), 'text-foreground'], ['Novos', `+${churn.clientesNovos}`, 'text-success-fg'], ['Perdidos', `−${churn.clientesPerdidos}`, 'text-danger-fg']] as const).map(([r, v, c]) => (
          <div key={r} className="rounded-2xl bg-surface-2/60 p-2.5"><p className="text-[12px] text-foreground-muted">{r}</p><p className={cn('font-heading text-[20px] font-semibold tabular-nums', c)}>{v}</p></div>
        ))}
      </div>
      {hist.length > 0 && (
        <div className="mt-3 h-[120px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hist} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="mes" {...axisProps} />
              <YAxis hide />
              <Tooltip {...tooltipProps} cursor={barCursor} formatter={(v: number, _n, p) => [`${pct(v)} · ${(p?.payload as { perdidos?: number })?.perdidos ?? 0} perdido(s)`, 'Churn']} />
              <Bar dataKey="taxa" radius={[6, 6, 0, 0]} maxBarSize={22}>
                {hist.map((_, i) => <Cell key={i} fill={i === hist.length - 1 ? 'hsl(var(--foreground))' : 'hsl(var(--primary) / 0.22)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

/* =============================== LTV / ticket =============================== */
export function LTVBloco({ data }: { data: LTVEvolutionData[] }) {
  const dom = (vals: number[]) => {
    if (!vals.length) return [0, 1] as [number, number];
    const min = Math.min(...vals); const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.15, max * 0.05, 1);
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)] as [number, number];
  };
  const ultimo = data[data.length - 1];
  return (
    <Card title="Valor de cada cliente (LTV)" sub="LTV médio e ticket médio por mês"
      action={ultimo ? <span className="text-right text-[12.5px] text-foreground-muted">LTV atual <b className="font-semibold text-foreground">{formatCurrency(ultimo.ltv)}</b></span> : undefined}>
      <div className="mb-2 flex gap-3 text-[12px] text-foreground-muted"><span className="flex items-center gap-1.5"><i className="h-0.5 w-3 bg-primary" />LTV</span><span className="flex items-center gap-1.5"><i className="h-0.5 w-3" style={{ background: SEGUNDA }} />Ticket médio</span></div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="mes" {...axisProps} dy={6} />
            <YAxis yAxisId="l" {...axisProps} width={44} tickFormatter={k} domain={dom(data.map((d) => d.ltv))} />
            <YAxis yAxisId="t" orientation="right" {...axisProps} width={40} tickFormatter={k} domain={dom(data.map((d) => d.ticketMedio))} />
            <Tooltip {...tooltipProps} formatter={(v: number, n) => [formatCurrency(v), n === 'ltv' ? 'LTV' : 'Ticket médio']} />
            <Line yAxisId="l" type="monotone" dataKey="ltv" stroke={CHART.primary} strokeWidth={2.5} dot={false} />
            <Line yAxisId="t" type="monotone" dataKey="ticketMedio" stroke={SEGUNDA} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ============================ Projeção 6 meses ============================ */
type Cenario = 'pess' | 'base' | 'oti';
const CENARIO: Record<Cenario, { rec: number; vari: number; txt: string }> = {
  pess: { rec: -0.03, vari: -0.2, txt: 'Pessimista: recorrente cai 3% ao mês e variável 20% abaixo da média' },
  base: { rec: 0, vari: 0, txt: 'Base: contratos ativos + média variável dos últimos 3 meses' },
  oti: { rec: 0.03, vari: 0.2, txt: 'Otimista: recorrente sobe 3% ao mês e variável 20% acima da média' },
};
export function ProjecaoBloco({ data }: { data: RevenueProjection[] }) {
  const [cen, setCen] = useState<Cenario>('base');
  const dados = useMemo(() => data.map((d, i) => {
    const c = CENARIO[cen];
    return { mes: d.mes, rec: Math.round(d.receitaRecorrente * (1 + c.rec) ** (i + 1)), vari: Math.round(d.receitaVariavel * (1 + c.vari)) };
  }), [data, cen]);
  const total = dados.reduce((s, d) => s + d.rec + d.vari, 0);
  return (
    <Card title="Receita dos próximos 6 meses" sub={CENARIO[cen].txt}
      action={<Segmented<Cenario> size="sm" value={cen} onChange={setCen} opts={[['pess', 'Pessimista'], ['base', 'Base'], ['oti', 'Otimista']]} />}>
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-foreground-muted"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" />Recorrente</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: SEGUNDA }} />Variável</span><span className="ml-auto">Total no período <b className="font-semibold text-foreground">{formatCurrency(total)}</b></span></div>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="mes" {...axisProps} dy={6} />
            <YAxis {...axisProps} width={44} tickFormatter={k} />
            <Tooltip {...tooltipProps} cursor={barCursor} formatter={(v: number, n) => [formatCurrency(v), n === 'rec' ? 'Recorrente' : 'Variável']} />
            <Bar dataKey="rec" stackId="a" fill={CHART.primary} maxBarSize={36} />
            <Bar dataKey="vari" stackId="a" fill={SEGUNDA} radius={[6, 6, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ================================= Coortes ================================= */
export function CoortesBloco({ cohorts, clientesPerdidos }: { cohorts: CohortData[]; clientesPerdidos: number }) {
  const cols = Math.max(1, ...cohorts.map((c) => c.retencaoMeses.length));
  const idx = Array.from({ length: cols }, (_, i) => i);
  const media = idx.map((i) => {
    const vs = cohorts.map((c) => c.retencaoMeses[i]).filter((x): x is number => x !== null && x !== undefined);
    return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
  });
  const tom = (v: number) => 0.07 + (v / 100) ** 2 * 0.8;
  // melhor turma = maior retenção no último mês medido (com pelo menos 2 meses de vida)
  const melhor = cohorts
    .map((c) => { const vs = c.retencaoMeses.filter((x): x is number => x !== null); return { c, v: vs.length >= 2 ? vs[vs.length - 1] : -1 }; })
    .sort((a, b) => b.v - a.v)[0];
  const m3 = media[3] ?? media.filter((x) => x !== null).slice(-1)[0] ?? null;
  return (
    <Card title="Quanto tempo os clientes ficam" sub="Cada linha é a turma que entrou no mês; as colunas mostram quantos seguem ativos depois de 1, 2, 3… meses">
      {!cohorts.length ? (
        <p className="py-10 text-center text-[13.5px] text-foreground-muted">Ainda não há turmas de clientes com contrato para comparar.</p>
      ) : (<>
        <div className="mb-4 grid grid-cols-3 gap-2">
          {[
            [media[3] !== null && media[3] !== undefined ? 'Ficam 3 meses ou mais' : 'Retenção média', m3 !== null ? `${m3}%` : '—'],
            ['Melhor turma', melhor && melhor.v >= 0 ? melhor.c.mesEntrada : '—'],
            ['Saíram no último mês', `${clientesPerdidos} cliente${clientesPerdidos === 1 ? '' : 's'}`],
          ].map(([r, v]) => <div key={r} className="rounded-2xl bg-surface-2/60 p-3"><p className="text-[12px] text-foreground-muted">{r}</p><p className="font-heading text-[16px] font-semibold tabular-nums text-foreground md:text-[18px]">{v}</p></div>)}
        </div>
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <div className="grid gap-1.5 text-[12px]" style={{ gridTemplateColumns: `110px repeat(${cols}, minmax(64px, 1fr))`, minWidth: 110 + cols * 72 }}>
            <span className="pb-1 text-foreground-muted">Turma</span>
            {idx.map((m) => <span key={m} className="pb-1 text-center text-foreground-muted">{m === 0 ? 'Entrada' : `${m} ${m === 1 ? 'mês' : 'meses'}`}</span>)}
            {cohorts.map((c) => (
              <div key={c.mesEntrada} className="contents">
                <span className="flex flex-col justify-center"><span className="text-[13px] text-foreground">{c.mesEntrada}</span><span className="text-[11.5px] text-foreground-muted">{c.clientesIniciais} cliente{c.clientesIniciais === 1 ? '' : 's'}</span></span>
                {idx.map((i) => {
                  const v = c.retencaoMeses[i];
                  if (v === null || v === undefined) return <span key={i} className="h-11 rounded-[10px] border border-dashed border-border" />;
                  const t = tom(v);
                  return (
                    <span key={i} className="flex h-11 flex-col items-center justify-center rounded-[10px] leading-tight tabular-nums" style={{ background: `hsl(var(--foreground) / ${t})`, color: t > 0.5 ? 'hsl(var(--background))' : 'hsl(var(--foreground))' }}>
                      <span className="text-[13px] font-medium">{v}%</span>
                      <span className="text-[10.5px] opacity-70">{Math.round((v / 100) * c.clientesIniciais)} de {c.clientesIniciais}</span>
                    </span>
                  );
                })}
              </div>
            ))}
            <span className="border-t border-border pt-2 text-[12.5px] font-medium text-foreground">Média</span>
            {media.map((x, i) => <span key={i} className="border-t border-border pt-2 text-center text-[12.5px] font-medium tabular-nums text-foreground">{x !== null ? `${x}%` : '—'}</span>)}
          </div>
        </div>
        <p className="mt-3 text-[12px] text-foreground-muted">Quanto mais escuro, mais clientes daquela turma continuam. Tracejado = mês que ainda não chegou.</p>
      </>)}
    </Card>
  );
}

/* ========================= Rentabilidade por cliente ========================= */
type Ordem = 'lucro' | 'margem' | 'receita' | 'ltv';
export function RentabilidadeBloco({ clients }: { clients: ClientProfitability[] }) {
  const [ord, setOrd] = useState<Ordem>('lucro');
  const lista = useMemo(() => [...clients].sort((a, b) =>
    ord === 'receita' ? b.receitaTotal - a.receitaTotal
      : ord === 'margem' ? b.margemPercentual - a.margemPercentual
      : ord === 'ltv' ? b.ltvCliente - a.ltvCliente
      : b.lucroEstimado - a.lucroEstimado), [clients, ord]);
  const piores = clients.filter((c) => c.receitaTotal > 0 && c.margemPercentual < 30).sort((a, b) => a.margemPercentual - b.margemPercentual);
  return (
    <Card title="Rentabilidade por cliente" sub="Receita menos os custos vinculados a cada cliente"
      action={<Segmented<Ordem> size="sm" value={ord} onChange={setOrd} opts={[['lucro', 'Lucro'], ['margem', 'Margem'], ['receita', 'Receita'], ['ltv', 'LTV']]} />}>
      {!lista.length ? (
        <p className="py-10 text-center text-[13.5px] text-foreground-muted">Sem clientes com receita para analisar.</p>
      ) : (
        <div className="-mx-4 md:-mx-5">
          <div className="hidden grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)_88px] gap-4 border-b border-border px-5 pb-2 text-[12px] text-foreground-muted md:grid"><span>Cliente</span><span className="text-right">Receita</span><span className="text-right">Custos</span><span className="text-right">Lucro</span><span>Margem</span><span className="text-right">Cliente há</span></div>
          {lista.map((c) => {
            const m = Math.max(0, Math.min(100, c.margemPercentual));
            return (
              <div key={c.clienteId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-border px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))_minmax(0,1.3fr)_88px] md:px-5">
                <span className="min-w-0"><span className="block truncate text-[14px] text-foreground">{c.clienteNome}</span><span className="block text-[12px] text-foreground-muted">LTV {formatCurrency(c.ltvCliente)}</span></span>
                <span className="hidden text-right text-[13px] tabular-nums text-foreground md:block">{formatCurrency(c.receitaTotal)}</span>
                <span className="hidden text-right text-[13px] tabular-nums text-foreground-muted md:block">{formatCurrency(c.custoAtribuido)}</span>
                <span className={cn('text-right font-heading text-[14px] font-semibold tabular-nums', c.lucroEstimado < 0 ? 'text-danger-fg' : 'text-foreground')}>{formatCurrency(c.lucroEstimado)}</span>
                <span className="col-span-2 flex items-center gap-2 md:col-span-1">
                  <span className="h-1.5 flex-1 rounded-full bg-surface-2"><span className={cn('block h-full rounded-full', c.margemPercentual < 30 ? 'bg-danger-fg' : c.margemPercentual < 60 ? 'bg-warning-fg' : 'bg-success-fg')} style={{ width: `${m}%` }} /></span>
                  <span className={cn('w-12 text-right text-[12.5px] tabular-nums', c.margemPercentual < 30 ? 'text-danger-fg' : 'text-foreground')}>{pct(c.margemPercentual, 0)}</span>
                </span>
                <span className="hidden text-right text-[12.5px] text-foreground-muted md:block">{Math.round(c.tempoRelacionamento)} {Math.round(c.tempoRelacionamento) === 1 ? 'mês' : 'meses'}</span>
              </div>
            );
          })}
        </div>
      )}
      {piores.length > 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-danger-bg px-3.5 py-2.5 text-[12.5px] text-danger-fg">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {piores.length === 1
            ? <>{piores[0].clienteNome} tem margem de {pct(piores[0].margemPercentual, 0)}: os custos quase empatam com o que ele paga. Vale rever preço ou escopo.</>
            : <>{piores.length} clientes com margem abaixo de 30% ({piores.slice(0, 3).map((c) => c.clienteNome).join(', ')}{piores.length > 3 ? '…' : ''}). Vale rever preço ou escopo.</>}
        </p>
      )}
    </Card>
  );
}
