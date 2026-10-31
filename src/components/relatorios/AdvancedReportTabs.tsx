// Renders each advanced report tab. Kept presentation-only and minimal —
// all heavy calculation lives in useAdvancedReports.

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { HelpCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { AdvancedReports } from '@/hooks/useAdvancedReports';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// Themed Recharts tooltip (fixes white-on-white text) + bar hover cursor.
const ttProps = {
  contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--popover-foreground))', boxShadow: '0 4px 12px hsl(var(--foreground)/0.08)' },
  labelStyle: { color: 'hsl(var(--popover-foreground))', fontWeight: 600, marginBottom: 2 },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
};
const barCursor = { fill: 'hsl(var(--muted))', opacity: 0.3 };
const BRAND = 'hsl(var(--primary))';

const InfoHint = ({ text }: { text: string }) => (
  <Popover>
    <PopoverTrigger asChild>
      <button type="button" aria-label="Como é calculado" className="text-muted-foreground/70 hover:text-foreground transition-colors shrink-0">
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" className="w-72 text-xs leading-relaxed text-muted-foreground">{text}</PopoverContent>
  </Popover>
);

const KPI = ({ label, value, hint, info }: { label: string; value: string; hint?: string; info?: string }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardDescription className="text-xs flex items-center gap-1.5">
        <span>{label}</span>
        {info && <InfoHint text={info} />}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent>
  </Card>
);

const SectionTitle = ({ title, info, description }: { title: string; info?: string; description?: string }) => (
  <CardHeader>
    <CardTitle className="text-base flex items-center gap-1.5">
      <span>{title}</span>
      {info && <InfoHint text={info} />}
    </CardTitle>
    {description && <CardDescription>{description}</CardDescription>}
  </CardHeader>
);

export function MRRTab({ data }: { data: AdvancedReports['mrr'] }) {
  const lastMRR = data[data.length - 1]?.mrr ?? 0;
  const prevMRR = data[data.length - 2]?.mrr ?? 0;
  const growth = prevMRR ? (lastMRR - prevMRR) / prevMRR : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="MRR atual" value={brl(lastMRR)} info="Receita recorrente mensal: soma do valor mensal equivalente de todos os contratos recorrentes ativos no mês. Contratos quinzenais/semanais são convertidos para o equivalente mensal. Contratos de cobrança única não entram." />
        <KPI label="ARR" value={brl(lastMRR * 12)} info="Receita recorrente anual = MRR × 12." />
        <KPI label="Crescimento M/M" value={pct(growth)} info="Variação do MRR deste mês em relação ao mês anterior." />
        <KPI label="Net New (mês)" value={brl((data[data.length - 1]?.newMRR ?? 0) - (data[data.length - 1]?.churnMRR ?? 0))} info="MRR novo (contratos que entraram no mês) menos MRR perdido (contratos encerrados no mês)." />
      </div>
      <Card>
        <SectionTitle title="Evolução do MRR (12 meses)" info="Série dos últimos 12 meses — não muda com o filtro de período." />
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} tickFormatter={brl} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => brl(v)} {...ttProps} />
              <Area type="monotone" dataKey="mrr" name="MRR" stroke={BRAND} fill={BRAND} fillOpacity={0.18} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export function TopClientsTab({ data }: { data: AdvancedReports['topClients'] }) {
  return (
    <Card>
      <SectionTitle
        title="Concentração de Receita (Curva ABC)"
        description="Top 80% = classe A · 80-95% = B · 95-100% = C"
        info="Ordena os clientes pela receita no período selecionado. Classe A = clientes que somam até 80% da receita, B = de 80% a 95%, C = de 95% a 100%. Serve pra ver o quanto a receita depende de poucos clientes."
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">% Total</TableHead>
              <TableHead className="text-right">% Acum.</TableHead>
              <TableHead className="text-center">Classe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 20).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-right">{brl(c.total)}</TableCell>
                <TableCell className="text-right">{pct(c.share)}</TableCell>
                <TableCell className="text-right">{pct(c.cumulative)}</TableCell>
                <TableCell className="text-center"><Badge variant={c.classe === 'A' ? 'default' : 'secondary'}>{c.classe}</Badge></TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function CategoryTab({ data, title }: { data: AdvancedReports['receitaPorCategoria']; title: string }) {
  const info = title.toLowerCase().includes('receita')
    ? 'Soma das receitas por categoria no período selecionado. % = participação no total de receitas.'
    : 'Soma das despesas por categoria no período selecionado (exclui faturas de cartão espelhadas). % = participação no total de despesas.';
  return (
    <Card>
      <SectionTitle title={title} info={info} />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoria</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">% Participação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <span className="inline-block w-2 h-2 rounded-full mr-2 align-middle" style={{ backgroundColor: c.cor || '#888' }} />
                  {c.nome}
                </TableCell>
                <TableCell className="text-right">{brl(c.total)}</TableCell>
                <TableCell className="text-right">{pct(c.share)}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (<TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function AgingTab({ data, title }: { data: AdvancedReports['agingRecebiveis']; title: string }) {
  const total = data.reduce((s, b) => s + b.total, 0);
  return (
    <Card>
      <SectionTitle
        title={title}
        description={`Total em aberto: ${brl(total)}`}
        info="Distribui tudo o que está EM ABERTO (não recebido / não pago) pelo tempo desde o vencimento. 'A vencer' = ainda não venceu; as demais faixas são dias de atraso. Independe do filtro de período."
      />
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={11} tickFormatter={brl} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => brl(v)} cursor={barCursor} {...ttProps} />
            <Bar dataKey="total" name="Valor" fill={BRAND} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        <Table className="mt-4">
          <TableHeader><TableRow><TableHead>Faixa</TableHead><TableHead className="text-right">Quantidade</TableHead><TableHead className="text-right">Valor</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.map((b) => (
              <TableRow key={b.label}>
                <TableCell>{b.label}</TableCell>
                <TableCell className="text-right">{b.count}</TableCell>
                <TableCell className="text-right">{brl(b.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function BurnRunwayTab({ data }: { data: AdvancedReports['burnRunway'] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPI label="Burn médio (3m)" value={brl(data.burnAvg)} info="Média das despesas operacionais dos últimos 3 meses (exclui faturas de cartão espelhadas). É quanto a operação consome por mês, em média." />
        <KPI label="Caixa estimado" value={brl(data.cashOnHand)} hint="Saldo real conciliado das contas" info="Saldo real das contas (não-cartão): saldo inicial + entradas recebidas − saídas pagas, considerando todo o histórico. É o mesmo cálculo da aba Conciliação." />
        <KPI label="Runway" value={`${data.runwayMonths.toFixed(1)} meses`} info="Por quantos meses o caixa atual dura mantendo o burn médio. = Caixa ÷ Burn médio (3m)." />
      </div>
      <Card>
        <SectionTitle title="Burn Rate mensal (6 meses)" info="Despesas operacionais mês a mês nos últimos 6 meses." />
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
              <YAxis fontSize={11} tickFormatter={brl} stroke="hsl(var(--muted-foreground))" />
              <Tooltip formatter={(v: number) => brl(v)} cursor={barCursor} {...ttProps} />
              <Bar dataKey="burn" name="Burn" fill={BRAND} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

export function ClientMarginTab({ data }: { data: AdvancedReports['clientMargins'] }) {
  return (
    <Card>
      <SectionTitle
        title="Margem por Cliente"
        description="Receita − despesas vinculadas (custo direto)"
        info="Para cada cliente, no período: receita − despesas lançadas com aquele cliente (custo direto). % Margem = margem ÷ receita. Só captura custos que você vinculou ao cliente no lançamento."
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Receita</TableHead>
              <TableHead className="text-right">Custo direto</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead className="text-right">% Margem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 30).map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell className="text-right">{brl(c.receita)}</TableCell>
                <TableCell className="text-right">{brl(c.custoDireto)}</TableCell>
                <TableCell className="text-right">{brl(c.margem)}</TableCell>
                <TableCell className={`text-right ${c.margemPct < 0 ? 'text-destructive' : ''}`}>{pct(c.margemPct)}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function LTVCACTab({ data }: { data: AdvancedReports['ltvCac'] }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="LTV" value={brl(data.ltv)} hint={`${brl(data.avgTicket)}/mês × ${data.avgLifetime.toFixed(1)} meses`}
          info="Valor do tempo de vida do cliente = ticket médio mensal (média do valor mensal equivalente dos contratos recorrentes ativos) × meses médios de permanência dos contratos recorrentes. NÃO usa gasto com anúncios — é o quanto um cliente rende enquanto fica." />
        <KPI label="CAC" value={brl(data.cac)} hint={`${brl(data.gastoComercial)} ÷ ${data.novosClientes} novos`}
          info="Custo de aquisição de cliente = despesas de marketing/comercial/tráfego/publicidade no período ÷ novos clientes cadastrados no período. Considera TODOS os novos clientes, inclusive indicações (por isso pode ficar baixo se a maioria vem de indicação)." />
        <KPI label="Payback" value={`${data.payback.toFixed(1)} meses`} info="Meses para o ticket médio pagar o CAC. = CAC ÷ ticket médio mensal." />
        <KPI label="LTV / CAC" value={`${data.ratio.toFixed(2)}x`} hint=">3x é saudável"
          info="Quantas vezes o LTV cobre o CAC. Acima de 3x é saudável. Valores muito altos (ex: 100x+) normalmente significam pouquíssimo gasto comercial registrado ou poucos novos clientes no período — vale conferir os lançamentos de marketing." />
      </div>
    </div>
  );
}

export function CardsSummaryTab({ data }: { data: AdvancedReports['cards'] }) {
  return (
    <Card>
      <SectionTitle title="Cartões de Crédito" info="Por cartão: limite, valor em aberto nas faturas (total − pago) e disponível (limite − em aberto). % Uso = em aberto ÷ limite." />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cartão</TableHead>
              <TableHead>Bandeira</TableHead>
              <TableHead className="text-right">Limite</TableHead>
              <TableHead className="text-right">Utilizado</TableHead>
              <TableHead className="text-right">Disponível</TableHead>
              <TableHead className="text-right">% Uso</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.bandeira ?? '—'}</TableCell>
                <TableCell className="text-right">{brl(c.limite)}</TableCell>
                <TableCell className="text-right">{brl(c.usado)}</TableCell>
                <TableCell className="text-right">{brl(c.disponivel)}</TableCell>
                <TableCell className={`text-right ${c.usoPct > 0.8 ? 'text-destructive' : ''}`}>{pct(c.usoPct)}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (<TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem cartões</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function ReconciliationTab({ data }: { data: AdvancedReports['reconciliation'] }) {
  return (
    <Card>
      <SectionTitle
        title="Conciliação por Conta"
        description="Saldo inicial + entradas confirmadas − saídas confirmadas"
        info="Para cada conta (não-cartão), somando TODO o histórico: saldo inicial + entradas com status 'recebido' − saídas com status 'pago'. O saldo calculado deve bater com o extrato real do banco. Não muda com o filtro de período."
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Conta</TableHead>
              <TableHead className="text-right">Saldo inicial</TableHead>
              <TableHead className="text-right">Entradas</TableHead>
              <TableHead className="text-right">Saídas</TableHead>
              <TableHead className="text-right">Saldo calculado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((r) => (
              <TableRow key={r.conta}>
                <TableCell className="font-medium">{r.conta}</TableCell>
                <TableCell className="text-right">{brl(r.saldoInicial)}</TableCell>
                <TableCell className="text-right text-emerald-600 dark:text-emerald-400">{brl(r.entradas)}</TableCell>
                <TableCell className="text-right text-destructive">{brl(r.saidas)}</TableCell>
                <TableCell className="text-right font-semibold">{brl(r.saldoCalculado)}</TableCell>
              </TableRow>
            ))}
            {data.length === 0 && (<TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem contas</TableCell></TableRow>)}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function OpKPIsTab({ data }: { data: AdvancedReports['opKPIs'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI label="Ticket médio" value={brl(data.ticketMedio)} info="Receita do período ÷ clientes ativos = quanto cada cliente rende, em média, no período selecionado." />
      <KPI label="Clientes ativos" value={String(data.clientesAtivos)} info="Clientes com status 'ativo'." />
      <KPI label="Contratos ativos" value={String(data.contratosAtivos)} info="Contratos com status 'ativo'." />
      <KPI label="Receita por cliente" value={brl(data.receitaPorCliente)} info="Receita total do período ÷ clientes ativos." />
    </div>
  );
}

export function ProjectionTab({ data }: { data: AdvancedReports['projection'] }) {
  return (
    <Card>
      <SectionTitle
        title="Projeção 12 meses"
        description="Baseada no MRR atual e burn médio dos últimos 3 meses"
        info="Projeção linear simples: mantém o MRR atual como entrada mensal e o burn médio (3m) como saída, acumulando sobre o caixa atual. É uma estimativa de tendência, não uma previsão — não considera sazonalidade nem novos contratos."
      />
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" fontSize={11} stroke="hsl(var(--muted-foreground))" />
            <YAxis fontSize={11} tickFormatter={brl} stroke="hsl(var(--muted-foreground))" />
            <Tooltip formatter={(v: number) => brl(v)} {...ttProps} />
            <Legend />
            <Line type="monotone" dataKey="entradas" name="Entradas" stroke={BRAND} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="saidas" name="Saídas" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="saldoAcum" name="Saldo acumulado" stroke="#10B981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TaxesTab({ data }: { data: AdvancedReports['taxes'] }) {
  const totalRec = data.reduce((s, r) => s + r.receita, 0);
  const totalDed = data.reduce((s, r) => s + r.deducoes, 0);
  const carga = totalRec ? totalDed / totalRec : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KPI label="Receita bruta (12m)" value={brl(totalRec)} info="Soma das receitas dos últimos 12 meses." />
        <KPI label="Impostos (12m)" value={brl(totalDed)} info="Despesas categorizadas como imposto/tributo/ISS/DAS/Simples nos últimos 12 meses." />
        <KPI label="Carga tributária" value={pct(carga)} info="Impostos ÷ receita bruta nos últimos 12 meses." />
      </div>
      <Card>
        <SectionTitle title="Receita × Impostos por mês" info="Série dos últimos 12 meses." />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-right">Impostos</TableHead>
                <TableHead className="text-right">Líquida</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((r) => (
                <TableRow key={r.mes}>
                  <TableCell>{r.mes}</TableCell>
                  <TableCell className="text-right">{brl(r.receita)}</TableCell>
                  <TableCell className="text-right text-destructive">{brl(r.deducoes)}</TableCell>
                  <TableCell className="text-right font-semibold">{brl(r.receitaLiquida)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
