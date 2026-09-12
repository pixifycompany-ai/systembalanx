// Renders each advanced report tab. Kept presentation-only and minimal —
// all heavy calculation lives in useAdvancedReports.

import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { AdvancedReports } from '@/hooks/useAdvancedReports';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const KPI = ({ label, value, hint }: { label: string; value: string; hint?: string }) => (
  <Card>
    <CardHeader className="pb-2"><CardDescription className="text-xs">{label}</CardDescription></CardHeader>
    <CardContent>
      <p className="text-2xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </CardContent>
  </Card>
);

export function MRRTab({ data }: { data: AdvancedReports['mrr'] }) {
  const lastMRR = data[data.length - 1]?.mrr ?? 0;
  const prevMRR = data[data.length - 2]?.mrr ?? 0;
  const growth = prevMRR ? (lastMRR - prevMRR) / prevMRR : 0;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="MRR atual" value={brl(lastMRR)} />
        <KPI label="ARR" value={brl(lastMRR * 12)} />
        <KPI label="Crescimento M/M" value={pct(growth)} />
        <KPI label="Net New (mês)" value={brl((data[data.length - 1]?.newMRR ?? 0) - (data[data.length - 1]?.churnMRR ?? 0))} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Evolução do MRR (12 meses)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={brl} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Area type="monotone" dataKey="mrr" stroke="hsl(var(--foreground))" fill="hsl(var(--foreground)/0.15)" />
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
      <CardHeader>
        <CardTitle className="text-base">Concentração de Receita (Curva ABC)</CardTitle>
        <CardDescription>Top 80% = classe A · 80-95% = B · 95-100% = C</CardDescription>
      </CardHeader>
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
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
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
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>Total em aberto: {brl(total)}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={brl} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Bar dataKey="total" fill="hsl(var(--foreground))" />
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
        <KPI label="Burn médio (3m)" value={brl(data.burnAvg)} />
        <KPI label="Caixa estimado" value={brl(data.cashOnHand)} hint="Soma do saldo inicial das contas ativas" />
        <KPI label="Runway" value={`${data.runwayMonths.toFixed(1)} meses`} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Burn Rate mensal (6 meses)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" fontSize={11} />
              <YAxis fontSize={11} tickFormatter={brl} />
              <Tooltip formatter={(v: number) => brl(v)} />
              <Bar dataKey="burn" fill="hsl(var(--foreground))" />
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
      <CardHeader>
        <CardTitle className="text-base">Margem por Cliente</CardTitle>
        <CardDescription>Receita − despesas vinculadas (custo direto)</CardDescription>
      </CardHeader>
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPI label="LTV" value={brl(data.ltv)} hint="Ticket médio × lifetime médio" />
      <KPI label="CAC" value={brl(data.cac)} hint="Marketing/Comercial ÷ novos clientes" />
      <KPI label="Payback" value={`${data.payback.toFixed(1)} meses`} />
      <KPI label="LTV / CAC" value={`${data.ratio.toFixed(2)}x`} hint=">3x é saudável" />
    </div>
  );
}

export function CardsSummaryTab({ data }: { data: AdvancedReports['cards'] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Cartões de Crédito</CardTitle></CardHeader>
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
      <CardHeader>
        <CardTitle className="text-base">Conciliação por Conta</CardTitle>
        <CardDescription>Saldo inicial + entradas confirmadas − saídas confirmadas</CardDescription>
      </CardHeader>
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
      <KPI label="Ticket médio" value={brl(data.ticketMedio)} />
      <KPI label="Clientes ativos" value={String(data.clientesAtivos)} />
      <KPI label="Contratos ativos" value={String(data.contratosAtivos)} />
      <KPI label="Receita por cliente" value={brl(data.receitaPorCliente)} />
    </div>
  );
}

export function ProjectionTab({ data }: { data: AdvancedReports['projection'] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Projeção 12 meses</CardTitle>
        <CardDescription>Baseada no MRR atual e burn médio dos últimos 3 meses</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" fontSize={11} />
            <YAxis fontSize={11} tickFormatter={brl} />
            <Tooltip formatter={(v: number) => brl(v)} />
            <Legend />
            <Line type="monotone" dataKey="entradas" stroke="hsl(var(--foreground))" />
            <Line type="monotone" dataKey="saidas" stroke="hsl(var(--destructive))" />
            <Line type="monotone" dataKey="saldoAcum" stroke="#10B981" />
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
        <KPI label="Receita bruta (12m)" value={brl(totalRec)} />
        <KPI label="Impostos (12m)" value={brl(totalDed)} />
        <KPI label="Carga tributária" value={pct(carga)} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Receita × Impostos por mês</CardTitle></CardHeader>
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
