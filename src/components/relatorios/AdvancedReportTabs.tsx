// Renders each advanced report tab. Kept presentation-only and minimal —
// all heavy calculation lives in useAdvancedReports.

import { useState, type ReactNode } from 'react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatCurrency, formatCurrencyShort } from '@/utils/formatters';
import { Segmented } from '@/components/reskin/kit';
import type { AdvancedReports } from '@/hooks/useAdvancedReports';
import { ChartLegend, EmptyNote, KpiStrip, RelCard } from './ReportKit';
import { CHART, axisProps, barCursor, gridProps, tooltipProps } from './chartTheme';

const brl = (n: number) => formatCurrency(n);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const DANGER_TEXT = 'text-[hsl(var(--danger-fg))]';
const SUCCESS_TEXT = 'text-[hsl(var(--success-fg))]';
const VALUE = 'font-heading font-semibold tabular-nums text-foreground';

/** Eixo Y em moeda: largura fixa para não espremer o gráfico no mobile. */
const yMoney = { ...axisProps, width: 60, tickFormatter: formatCurrencyShort };

/** Bloco-tabela: cartão do reskin sem recuo + lista no celular + tabela no desktop. */
function TableCard({
  title, info, description, action, mobile, desktop, empty, children,
}: {
  title?: string;
  info?: string;
  description?: string;
  action?: ReactNode;
  mobile: ReactNode;
  desktop: ReactNode;
  empty?: string | false;
  children?: ReactNode;
}) {
  return (
    <RelCard flush className="animate-fade-in" title={title} sub={description} info={info} action={action}>
      {children}
      {empty ? (
        <EmptyNote className="border-t border-border">{empty}</EmptyNote>
      ) : (
        <>
          <div className="md:hidden">{mobile}</div>
          <div className="hidden md:block">{desktop}</div>
        </>
      )}
    </RelCard>
  );
}

/** Linha da lista mobile: título/subtítulo à esquerda, valor/selo à direita. */
function Row({ title, subtitle, value, aside, lead, onClick }: {
  title: ReactNode; subtitle?: ReactNode; value: ReactNode; aside?: ReactNode; lead?: ReactNode; onClick?: () => void;
}) {
  return (
    <div
      className={cn('flex items-center gap-3 border-t border-border px-4 py-3', onClick && 'cursor-pointer active:bg-surface-2')}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {lead}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-foreground">{title}</p>
        {subtitle && <p className="mt-0.5 truncate text-[12px] text-foreground-muted">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={cn('text-sm', VALUE)}>{value}</span>
        {aside}
      </div>
    </div>
  );
}

/** Cabeçalho de tabela com recuo lateral alinhado ao título do card. */
const HeadRow = ({ children }: { children: ReactNode }) => (
  <TableRow className="border-t border-border hover:bg-transparent [&>th:first-child]:pl-5 [&>th:last-child]:pr-5 [&>th]:h-10 [&>th]:text-[12px] [&>th]:font-normal [&>th]:text-foreground-muted">{children}</TableRow>
);
const BodyRow = ({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) => (
  <TableRow
    className={cn('border-border text-[13px] [&>td:first-child]:pl-5 [&>td:last-child]:pr-5 [&>td]:py-3 [&>td]:text-[13px]', onClick && 'cursor-pointer hover:bg-surface-2/50', className)}
    onClick={onClick}
    title={onClick ? 'Ver lançamentos' : undefined}
  >{children}</TableRow>
);

type RangeValue = '3' | '6' | '12';
const RANGES: [RangeValue, string][] = [['3', '3M'], ['6', '6M'], ['12', '12M']];

export function MRRTab({ data }: { data: AdvancedReports['mrr'] }) {
  const [range, setRange] = useState<RangeValue>('12');
  const lastMRR = data[data.length - 1]?.mrr ?? 0;
  const prevMRR = data[data.length - 2]?.mrr ?? 0;
  const growth = prevMRR ? (lastMRR - prevMRR) / prevMRR : 0;
  const serie = data.slice(-Number(range));
  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'MRR atual', value: brl(lastMRR), highlight: true, info: 'Receita recorrente mensal: soma do valor mensal equivalente de todos os contratos recorrentes ativos no mês. Contratos quinzenais/semanais são convertidos para o equivalente mensal. Contratos de cobrança única não entram.' },
          { label: 'ARR', value: brl(lastMRR * 12), info: 'Receita recorrente anual = MRR × 12.' },
          { label: 'Crescimento M/M', value: pct(growth), tone: growth < 0 ? 'danger' : 'success', info: 'Variação do MRR deste mês em relação ao mês anterior.' },
          { label: 'Net New (mês)', value: brl((data[data.length - 1]?.newMRR ?? 0) - (data[data.length - 1]?.churnMRR ?? 0)), info: 'MRR novo (contratos que entraram no mês) menos MRR perdido (contratos encerrados no mês).' },
        ]}
      />
      <RelCard
        className="animate-fade-in"
        title="Evolução do MRR"
        info="Série dos últimos 12 meses — não muda com o filtro de período."
        action={<Segmented<RangeValue> size="sm" className="max-sm:w-full" value={range} onChange={setRange} opts={RANGES} />}
      >
        <div className="h-[240px] md:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={serie} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rep-mrr-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.primary} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...yMoney} />
              <Tooltip formatter={(v: number) => brl(v)} {...tooltipProps} />
              <Area type="monotone" dataKey="mrr" name="MRR" stroke={CHART.primary} fill="url(#rep-mrr-fill)" strokeWidth={2.5} activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </RelCard>
    </div>
  );
}

const ClasseBadge = ({ classe }: { classe: string }) => (
  <span
    className={cn(
      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
      classe === 'A' ? 'bg-foreground text-background' : classe === 'B' ? 'bg-surface-2 text-foreground' : 'border border-border text-foreground-muted',
    )}
  >
    {classe}
  </span>
);

export function TopClientsTab({ data, onRowClick }: { data: AdvancedReports['topClients']; onRowClick?: (c: AdvancedReports['topClients'][number]) => void }) {
  const rows = data.slice(0, 20);
  return (
    <TableCard
      description="Até 80% da receita = classe A · 80–95% = B · 95–100% = C"
      info="Ordena os clientes pela receita no período selecionado. Classe A = clientes que somam até 80% da receita, B = de 80% a 95%, C = de 95% a 100%. Serve pra ver o quanto a receita depende de poucos clientes."
      empty={data.length === 0 && 'Sem dados'}
      mobile={rows.map((c) => (
        <Row
          key={c.id}
          lead={<ClasseBadge classe={c.classe} />}
          title={c.nome}
          subtitle={`${pct(c.share)} do total · ${pct(c.cumulative)} acum.`}
          value={brl(c.total)}
          onClick={onRowClick && (() => onRowClick(c))}
        />
      ))}
      desktop={
        <Table>
          <TableHeader>
            <HeadRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">% Total</TableHead>
              <TableHead className="text-right">% Acum.</TableHead>
              <TableHead className="text-center">Classe</TableHead>
            </HeadRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <BodyRow key={c.id} onClick={onRowClick && (() => onRowClick(c))}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className={cn('text-right', VALUE)}>{brl(c.total)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground-muted">{pct(c.share)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground-muted">{pct(c.cumulative)}</TableCell>
                <TableCell className="text-center"><ClasseBadge classe={c.classe} /></TableCell>
              </BodyRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}

export function CategoryTab({ data, title, onRowClick }: { data: AdvancedReports['receitaPorCategoria']; title: string; onRowClick?: (c: AdvancedReports['receitaPorCategoria'][number]) => void }) {
  const info = title.toLowerCase().includes('receita')
    ? 'Soma das receitas por categoria no período selecionado. % = participação no total de receitas.'
    : 'Soma das despesas por categoria no período selecionado (exclui faturas de cartão espelhadas). % = participação no total de despesas.';
  const Dot = ({ cor }: { cor?: string | null }) => (
    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor || 'hsl(var(--foreground-muted))' }} />
  );
  const totalCat = data.reduce((s, c) => s + c.total, 0);
  return (
    <TableCard
      description={`${data.length} ${data.length === 1 ? 'categoria' : 'categorias'} · total ${brl(totalCat)}`}
      info={info}
      empty={data.length === 0 && 'Sem dados'}
      mobile={data.map((c) => (
        <div key={c.id} className={cn('border-t border-border px-4 py-3', onRowClick && 'cursor-pointer active:bg-surface-2')} onClick={onRowClick && (() => onRowClick(c))} role={onRowClick ? 'button' : undefined}>
          <div className="flex items-center gap-2.5">
            <Dot cor={c.cor} />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{c.nome}</span>
            <span className={cn('shrink-0 text-sm', VALUE)}>{brl(c.total)}</span>
          </div>
          <div className="mt-2 flex items-center gap-2.5 pl-5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.share * 100)}%`, backgroundColor: c.cor || 'hsl(var(--foreground-muted))' }} />
            </div>
            <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-foreground-muted">{pct(c.share)}</span>
          </div>
        </div>
      ))}
      desktop={
        <Table>
          <TableHeader>
            <HeadRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-[38%] text-right">% Participação</TableHead>
            </HeadRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <BodyRow key={c.id} onClick={onRowClick && (() => onRowClick(c))}>
                <TableCell className="font-medium">
                  <span className="inline-flex items-center gap-2.5"><Dot cor={c.cor} />{c.nome}</span>
                </TableCell>
                <TableCell className={cn('text-right', VALUE)}>{brl(c.total)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-3">
                    <div className="h-1 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, c.share * 100)}%`, backgroundColor: c.cor || 'hsl(var(--foreground-muted))' }} />
                    </div>
                    <span className="w-14 tabular-nums text-foreground-muted">{pct(c.share)}</span>
                  </div>
                </TableCell>
              </BodyRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}

/** Cor de cada faixa: a vencer em azul (mais claro = mais longe); atraso do amarelo ao vermelho escuro. */
const COR_ATRASO = ['#F59E0B', '#F97316', '#EF4444', '#991B1B'];
const corFaixa = (b: { vencido: boolean }, iAtraso: number, iVencer: number, nVencer: number) =>
  b.vencido ? COR_ATRASO[Math.min(iAtraso, COR_ATRASO.length - 1)] : `hsl(var(--primary) / ${1 - (iVencer / Math.max(1, nVencer)) * 0.6})`;

export function AgingTab({ data }: { data: AdvancedReports['agingRecebiveis']; title?: string }) {
  const total = data.reduce((s, b) => s + b.total, 0);
  const vencido = data.filter((b) => b.vencido).reduce((s, b) => s + b.total, 0);
  const qtdVencido = data.filter((b) => b.vencido).reduce((s, b) => s + b.count, 0);
  const vencer = data.filter((b) => !b.vencido);
  // Ordem visual: a vencer (mais perto → mais longe) e depois atraso (menor → maior).
  let iA = 0; let iV = 0;
  const faixas = [...vencer, ...data.filter((b) => b.vencido)].map((b) => ({ ...b, cor: corFaixa(b, b.vencido ? iA++ : 0, b.vencido ? 0 : iV++, vencer.length) }));
  return (
    <div className="animate-fade-in space-y-4">
      <KpiStrip
        items={[
          { label: 'Em aberto', value: brl(total), highlight: true, info: 'Tudo o que está EM ABERTO (não recebido / não pago), de qualquer data. Independe do filtro de período.' },
          { label: 'Em atraso', value: brl(vencido), tone: vencido > 0 ? 'danger' : 'default', hint: `${qtdVencido} ${qtdVencido === 1 ? 'lançamento' : 'lançamentos'}` },
          { label: 'A vencer', value: brl(total - vencido) },
        ]}
      />
      <RelCard sub="Por faixa: dias até o vencimento (a vencer) ou desde o vencimento (atraso)">
        {total > 0 ? (
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-2">
            {faixas.filter((f) => f.total > 0).map((f) => (
              <div key={f.label} title={`${f.label}: ${brl(f.total)}`} style={{ width: `${(f.total / total) * 100}%`, background: f.cor }} />
            ))}
          </div>
        ) : (
          <EmptyNote className="min-h-[80px]">Nada em aberto.</EmptyNote>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
          {faixas.map((f) => (
            <div key={f.label} className={cn('rounded-2xl border p-3', f.vencido && f.total > 0 ? 'border-danger-bg bg-danger-bg/40' : 'border-border')}>
              <p className="flex items-center gap-1.5 text-[12px] text-foreground-muted"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: f.cor }} /><span className="truncate">{f.label}</span></p>
              <p className={cn('mt-0.5 font-heading text-[16px] font-semibold tabular-nums', f.total === 0 ? 'text-foreground-subtle' : f.vencido ? 'text-danger-fg' : 'text-foreground')}>{brl(f.total)}</p>
              <p className="text-[11.5px] text-foreground-muted">{f.count} {f.count === 1 ? 'lançamento' : 'lançamentos'}</p>
            </div>
          ))}
        </div>
      </RelCard>
    </div>
  );
}

export function BurnRunwayTab({ data }: { data: AdvancedReports['burnRunway'] }) {
  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'Runway', value: `${data.runwayMonths.toFixed(1)} meses`, highlight: true, info: 'Por quantos meses o caixa atual dura mantendo o burn médio. = Caixa ÷ Burn médio (3m).' },
          { label: 'Burn médio (3m)', value: brl(data.burnAvg), tone: 'danger', info: 'Média do que SAIU das contas bancárias nos últimos 3 meses (regime de caixa: pela data de pagamento; o cartão entra quando a fatura é paga; inclui retiradas). Mesmo regime do caixa usado no Runway.' },
          { label: 'Caixa estimado', value: brl(data.cashOnHand), hint: 'Saldo real conciliado das contas', info: 'Saldo real das contas (não-cartão): saldo inicial + entradas recebidas − saídas pagas, considerando todo o histórico. É o mesmo cálculo da aba Conciliação.' },
        ]}
      />
      <RelCard
        className="animate-fade-in"
        title="Saída de caixa por mês"
        info="Quanto saiu das contas bancárias em cada um dos últimos 6 meses (regime de caixa, pela data de pagamento)."
      >
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.series} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="month" {...axisProps} />
              <YAxis {...yMoney} />
              <Tooltip formatter={(v: number) => brl(v)} cursor={barCursor} {...tooltipProps} />
              <Bar dataKey="burn" name="Saída" fill={CHART.danger} fillOpacity={0.85} radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </RelCard>
    </div>
  );
}

export function ClientMarginTab({ data }: { data: AdvancedReports['clientMargins'] }) {
  const rows = data.slice(0, 30);
  return (
    <TableCard
      description="Receita − despesas vinculadas ao cliente (custo direto)"
      info="Para cada cliente, no período: receita − despesas lançadas com aquele cliente (custo direto). % Margem = margem ÷ receita. Só captura custos que você vinculou ao cliente no lançamento."
      empty={data.length === 0 && 'Sem dados'}
      mobile={rows.map((c) => (
        <Row
          key={c.id}
          title={c.nome}
          subtitle={`Receita ${brl(c.receita)} · Custo ${brl(c.custoDireto)}`}
          value={brl(c.margem)}
          aside={<span className={cn('text-[12px] font-semibold tabular-nums', c.margemPct < 0 ? DANGER_TEXT : 'text-foreground-muted')}>{pct(c.margemPct)}</span>}
        />
      ))}
      desktop={
        <Table>
          <TableHeader>
            <HeadRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Custo direto</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead className="text-right">% Margem</TableHead>
            </HeadRow>
          </TableHeader>
          <TableBody>
            {rows.map((c) => (
              <BodyRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(c.receita)}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground-muted">{brl(c.custoDireto)}</TableCell>
                <TableCell className={cn('text-right', VALUE)}>{brl(c.margem)}</TableCell>
                <TableCell className={cn('text-right font-semibold tabular-nums', c.margemPct < 0 ? DANGER_TEXT : 'text-foreground-muted')}>{pct(c.margemPct)}</TableCell>
              </BodyRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}

export function LTVCACTab({ data }: { data: AdvancedReports['ltvCac'] }) {
  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'LTV / CAC', value: `${data.ratio.toFixed(2)}x`, hint: '>3x é saudável', highlight: true,
            info: 'Quantas vezes o LTV cobre o CAC. Acima de 3x é saudável. Valores muito altos (ex: 100x+) normalmente significam pouquíssimo gasto comercial registrado ou poucos novos clientes no período — vale conferir os lançamentos de marketing.' },
          { label: 'LTV', value: brl(data.ltv), hint: `${brl(data.avgTicket)}/mês × ${data.avgLifetime.toFixed(1)} meses`,
            info: 'Valor do tempo de vida do cliente = ticket médio mensal (média do valor mensal equivalente dos contratos recorrentes ativos) × meses médios de permanência dos contratos recorrentes. NÃO usa gasto com anúncios — é o quanto um cliente rende enquanto fica.' },
          { label: 'CAC', value: brl(data.cac), hint: `${brl(data.gastoComercial)} ÷ ${data.novosClientes} novos`,
            info: 'Custo de aquisição de cliente = despesas de marketing/comercial/tráfego/publicidade no período ÷ novos clientes cadastrados no período. Considera TODOS os novos clientes, inclusive indicações (por isso pode ficar baixo se a maioria vem de indicação).' },
          { label: 'Payback', value: `${data.payback.toFixed(1)} meses`, info: 'Meses para o ticket médio pagar o CAC. = CAC ÷ ticket médio mensal.' },
        ]}
      />
    </div>
  );
}

export function CardsSummaryTab({ data }: { data: AdvancedReports['cards'] }) {
  return (
    <TableCard
      description={`${data.length} ${data.length === 1 ? 'cartão' : 'cartões'}`}
      info="Por cartão: limite, valor em aberto nas faturas (total − pago) e disponível (limite − em aberto). % Uso = em aberto ÷ limite."
      empty={data.length === 0 && 'Sem cartões'}
      mobile={data.map((c) => (
        <div key={c.id} className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{c.nome}</p>
              <p className="truncate text-[12px] text-foreground-muted">{c.bandeira ?? '—'} · Limite {brl(c.limite)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className={cn('text-sm', VALUE)}>{brl(c.usado)}</p>
              <p className="text-[12px] tabular-nums text-foreground-muted">disp. {brl(c.disponivel)}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className={cn('h-full rounded-full', c.usoPct > 0.8 ? 'bg-[hsl(var(--danger))]' : 'bg-primary')}
                style={{ width: `${Math.min(100, c.usoPct * 100)}%` }}
              />
            </div>
            <span className={cn('w-12 shrink-0 text-right text-[12px] font-semibold tabular-nums', c.usoPct > 0.8 ? DANGER_TEXT : 'text-foreground-muted')}>{pct(c.usoPct)}</span>
          </div>
        </div>
      ))}
      desktop={
        <Table>
          <TableHeader>
            <HeadRow>
              <TableHead>Cartão</TableHead>
              <TableHead>Bandeira</TableHead>
              <TableHead className="text-right">Limite</TableHead>
              <TableHead className="text-right">Utilizado</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead className="text-right">% Uso</TableHead>
            </HeadRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <BodyRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-foreground-muted">{c.bandeira ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground-muted">{brl(c.limite)}</TableCell>
                <TableCell className={cn('text-right', VALUE)}>{brl(c.usado)}</TableCell>
                <TableCell className="text-right tabular-nums">{brl(c.disponivel)}</TableCell>
                <TableCell className="text-right">
                  <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums', c.usoPct > 0.8 ? 'bg-danger-bg text-danger-fg' : 'bg-surface-2 text-foreground-muted')}>
                    {pct(c.usoPct)}
                  </span>
                </TableCell>
              </BodyRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}

export function ReconciliationTab({ data }: { data: AdvancedReports['reconciliation'] }) {
  return (
    <TableCard
      description="Saldo inicial + entradas recebidas − saídas pagas, de todo o histórico"
      info="Para cada conta (não-cartão), somando TODO o histórico: saldo inicial + entradas com status 'recebido' − saídas com status 'pago'. O saldo calculado deve bater com o extrato real do banco. Não muda com o filtro de período."
      empty={data.length === 0 && 'Sem contas'}
      mobile={data.map((r) => (
        <div key={r.conta} className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-sm font-semibold text-foreground">{r.conta}</span>
            <span className={cn('shrink-0 text-sm', VALUE)}>{brl(r.saldoCalculado)}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] tabular-nums text-foreground-muted">
            <span>Inicial {brl(r.saldoInicial)}</span>
            <span className={SUCCESS_TEXT}>+{brl(r.entradas)}</span>
            <span className={DANGER_TEXT}>−{brl(r.saidas)}</span>
          </div>
        </div>
      ))}
      desktop={
        <Table>
          <TableHeader>
            <HeadRow>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Saldo inicial</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead>
              <TableHead className="text-right">Saldo calculado</TableHead>
            </HeadRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <BodyRow key={r.conta}>
                <TableCell className="font-medium">{r.conta}</TableCell>
                <TableCell className="text-right tabular-nums text-foreground-muted">{brl(r.saldoInicial)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', SUCCESS_TEXT)}>{brl(r.entradas)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', DANGER_TEXT)}>{brl(r.saidas)}</TableCell>
                <TableCell className={cn('text-right', VALUE)}>{brl(r.saldoCalculado)}</TableCell>
              </BodyRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}

export function OpKPIsTab({ data }: { data: AdvancedReports['opKPIs'] }) {
  return (
    <KpiStrip
      items={[
        { label: 'Ticket médio', value: brl(data.ticketMedio), highlight: true, info: 'Receita do período ÷ clientes ativos = quanto cada cliente rende, em média, no período selecionado.' },
        { label: 'Clientes ativos', value: String(data.clientesAtivos), info: "Clientes com status 'ativo'." },
        { label: 'Contratos ativos', value: String(data.contratosAtivos), info: "Contratos com status 'ativo'." },
        { label: 'Receita por cliente', value: brl(data.receitaPorCliente), info: 'Receita total do período ÷ clientes ativos.' },
      ]}
    />
  );
}

export function ProjectionTab({ data }: { data: AdvancedReports['projection'] }) {
  return (
    <RelCard
      className="animate-fade-in"
      sub="Baseada no MRR atual e na saída média de caixa dos últimos 3 meses"
      info="Projeção linear simples: mantém o MRR atual como entrada mensal e o burn médio (3m) como saída, acumulando sobre o caixa atual. É uma estimativa de tendência, não uma previsão — não considera sazonalidade nem novos contratos."
    >
      <ChartLegend
        className="mb-3"
        items={[
          { label: 'Entradas', color: CHART.primary },
          { label: 'Saídas', color: CHART.danger, dashed: true },
          { label: 'Saldo acumulado', color: CHART.ink },
        ]}
      />
      <div className="h-[260px] md:h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="month" {...axisProps} />
            <YAxis {...yMoney} />
            <Tooltip formatter={(v: number) => brl(v)} {...tooltipProps} />
            <Line type="monotone" dataKey="entradas" name="Entradas" stroke={CHART.primary} strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="saidas" name="Saídas" stroke={CHART.danger} strokeWidth={2} strokeDasharray="5 6" dot={false} />
            <Line type="monotone" dataKey="saldoAcum" name="Saldo acumulado" stroke={CHART.ink} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </RelCard>
  );
}

export function TaxesTab({ data }: { data: AdvancedReports['taxes'] }) {
  const totalRec = data.reduce((s, r) => s + r.receita, 0);
  const totalDed = data.reduce((s, r) => s + r.deducoes, 0);
  const carga = totalRec ? totalDed / totalRec : 0;
  return (
    <div className="space-y-4">
      <KpiStrip
        items={[
          { label: 'Carga tributária', value: pct(carga), highlight: true, info: 'Impostos ÷ receita bruta nos últimos 12 meses.' },
          { label: 'Receita bruta (12m)', value: brl(totalRec), info: 'Soma das receitas dos últimos 12 meses.' },
          { label: 'Impostos e deduções (12m)', value: brl(totalDed), tone: 'danger', info: "Despesas das categorias classificadas no DRE como 'Deduções da Receita (Impostos)' — ex.: Impostos e Descontos Concedidos — nos últimos 12 meses. A classificação é feita em Categorias." },
        ]}
      />
      <TableCard
        title="Mês a mês"
        info="Série dos últimos 12 meses."
        mobile={data.map((r) => (
          <Row
            key={r.mes}
            title={r.mes}
            subtitle={<>Receita {brl(r.receita)} · <span className={DANGER_TEXT}>Impostos {brl(r.deducoes)}</span></>}
            value={brl(r.receitaLiquida)}
          />
        ))}
        desktop={
          <Table>
            <TableHeader>
              <HeadRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Impostos</TableHead>
                <TableHead className="text-right">Líquida</TableHead>
              </HeadRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <BodyRow key={r.mes}>
                  <TableCell className="font-medium">{r.mes}</TableCell>
                  <TableCell className="text-right tabular-nums">{brl(r.receita)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', DANGER_TEXT)}>{brl(r.deducoes)}</TableCell>
                  <TableCell className={cn('text-right', VALUE)}>{brl(r.receitaLiquida)}</TableCell>
                </BodyRow>
              ))}
            </TableBody>
          </Table>
        }
      />
    </div>
  );
}
