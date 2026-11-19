import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  BookOpen, CalendarClock, ChevronDown, ChevronRight, CreditCard, FileSpreadsheet, FileText, Printer, Search,
  TrendingUp, Users, Wallet,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { SkeletonChart } from '@/components/shared/LoadingSpinner';
import { Sparkle } from '@/components/shared/Sparkle';
import { Card, ModalHeader, ModalShell, PageHeader, Segmented } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';
import { DRETable } from '@/components/relatorios/DRETable';
import { ReceitasDespesasTab } from '@/components/relatorios/ReceitasDespesasTab';
import { FluxoCaixaTab } from '@/components/relatorios/FluxoCaixaTab';
import { DFCTab } from '@/components/relatorios/DFCTab';
import { ComparativoTab } from '@/components/relatorios/ComparativoTab';
import {
  MRRTab, TopClientsTab, CategoryTab, AgingTab, BurnRunwayTab,
  ClientMarginTab, LTVCACTab, CardsSummaryTab, ReconciliationTab,
  OpKPIsTab, ProjectionTab, TaxesTab,
} from '@/components/relatorios/AdvancedReportTabs';
import { useRelatorios, type PeriodFilter, type ComparativoFilter, type DRERow } from '@/hooks/useRelatorios';
import { useAdvancedReports, periodWindow } from '@/hooks/useAdvancedReports';
import { useDFC } from '@/hooks/useDFC';
import { exportToCSV } from '@/utils/exportCSV';
import { cn } from '@/lib/utils';

type Regime = 'competência' | 'caixa';
type Rel = { id: string; nome: string; desc: string; regime?: Regime };
const BIBLIOTECA: { grupo: string; icon: React.ComponentType<{ className?: string }>; itens: Rel[] }[] = [
  { grupo: 'Resultado', icon: FileText, itens: [
    { id: 'dre', nome: 'DRE', desc: 'Lucro ou prejuízo de cada mês, pelo mês a que a receita e a despesa pertencem. Toque numa linha com seta para ver as categorias.', regime: 'competência' },
    { id: 'dfc', nome: 'DFC', desc: 'De onde veio e para onde foi o dinheiro que passou pelas contas bancárias.', regime: 'caixa' },
    { id: 'recdep', nome: 'Receitas × despesas', desc: 'Receitas e despesas lado a lado, mês a mês.', regime: 'competência' },
    { id: 'comp', nome: 'Comparativo', desc: 'Um período comparado com o anterior, linha a linha do resultado.', regime: 'competência' },
  ] },
  { grupo: 'Caixa', icon: Wallet, itens: [
    { id: 'fluxo', nome: 'Fluxo de caixa', desc: 'O que entrou e saiu das contas em cada mês, com o saldo.', regime: 'caixa' },
    { id: 'burn', nome: 'Burn e runway', desc: 'Quanto sai do caixa por mês e quantos meses o dinheiro dura.', regime: 'caixa' },
    { id: 'proj', nome: 'Projeção 12 meses', desc: 'Saldo previsto com o que está a receber e a pagar nos próximos meses.', regime: 'caixa' },
    { id: 'conc', nome: 'Conciliação', desc: 'Saldo calculado de cada conta (inicial + entradas − saídas) para conferir com o banco.' },
  ] },
  { grupo: 'Clientes e receita', icon: Users, itens: [
    { id: 'mrr', nome: 'MRR e ARR', desc: 'Receita recorrente mensal e anual dos contratos, com novos e cancelados.' },
    { id: 'abc', nome: 'Curva ABC de clientes', desc: 'Quais clientes fazem 80% da receita (classes A, B e C). Toque num cliente para ver os lançamentos.', regime: 'competência' },
    { id: 'rec-cat', nome: 'Receita por categoria', desc: 'De quais serviços vem a receita. Toque numa categoria para ver os lançamentos.', regime: 'competência' },
    { id: 'margem', nome: 'Margem por cliente', desc: 'Receita menos os custos vinculados a cada cliente.', regime: 'competência' },
    { id: 'ltv', nome: 'LTV e CAC', desc: 'Quanto vale um cliente e quanto custa trazer um novo.' },
  ] },
  { grupo: 'Despesas', icon: CreditCard, itens: [
    { id: 'desp-cat', nome: 'Despesas por categoria', desc: 'Onde o dinheiro está sendo gasto. Toque numa categoria para ver os lançamentos.', regime: 'competência' },
    { id: 'cards', nome: 'Cartões', desc: 'Limite, valor usado e disponível de cada cartão.' },
    { id: 'fiscal', nome: 'Impostos', desc: 'Receita e impostos (deduções) mês a mês.', regime: 'competência' },
  ] },
  { grupo: 'Contas a receber e a pagar', icon: CalendarClock, itens: [
    { id: 'aging-rec', nome: 'Aging a receber', desc: 'O que está para receber, separado por quanto tempo está em atraso.' },
    { id: 'aging-pag', nome: 'Aging a pagar', desc: 'O que está para pagar, por faixa de vencimento.' },
  ] },
  { grupo: 'Operação', icon: TrendingUp, itens: [
    { id: 'kpis', nome: 'Indicadores operacionais', desc: 'Ticket médio, clientes ativos, contratos ativos e receita por cliente.' },
  ] },
];
const TODOS = BIBLIOTECA.flatMap((g) => g.itens.map((r) => ({ ...r, grupo: g.grupo })));

const PERIODOS: [PeriodFilter, string][] = [['month', 'Mês'], ['quarter', 'Trimestre'], ['year', 'Ano'], ['custom', 'Período']];
const COMPARATIVOS: [ComparativoFilter, string][] = [['mes_atual_anterior', 'Mês atual × anterior'], ['60dias', 'Últimos 60 dias'], ['90dias', 'Últimos 90 dias']];

type Linha = Record<string, string | number>;
const n2 = (v: number) => Math.round(v * 100) / 100;

/** Linhas do DRE/DFC "achatadas" (categoria abaixo do grupo) para exportar/explicar. */
function linhasDRE(rows: DRERow[], months: string[]): Linha[] {
  const out: Linha[] = [];
  // Mesmo total da tabela: saldo inicial = 1º mês, saldo final = último mês, o resto soma.
  const total = (values: Record<string, number>, label: string) => {
    const up = label.toUpperCase();
    if (up.includes('SALDO INICIAL')) return n2(values[months[0]] ?? 0);
    if (up.includes('SALDO')) return n2(values[months[months.length - 1]] ?? 0);
    return n2(months.reduce((s, m) => s + (values[m] ?? 0), 0));
  };
  for (const r of rows) {
    out.push({ Linha: r.label, ...Object.fromEntries(months.map((m) => [m, n2(r.values[m] ?? 0)])), Total: total(r.values, r.label) });
    for (const c of r.children ?? []) {
      out.push({ Linha: `   ${c.label}`, ...Object.fromEntries(months.map((m) => [m, n2(c.values[m] ?? 0)])), Total: total(c.values, c.label) });
    }
  }
  return out;
}

function Biblioteca({ atual, onPick, busca, setBusca }: { atual: string; onPick: (id: string) => void; busca: string; setBusca: (s: string) => void }) {
  const q = busca.trim().toLowerCase();
  return (
    <div className="space-y-4">
      <label className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-3.5">
        <Search className="h-4 w-4 shrink-0 text-foreground-muted" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar relatório" className="min-w-0 flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-foreground-muted" />
      </label>
      {BIBLIOTECA.map((g) => {
        const itens = g.itens.filter((r) => !q || `${r.nome} ${r.desc} ${g.grupo}`.toLowerCase().includes(q));
        if (!itens.length) return null;
        return (
          <div key={g.grupo}>
            <p className="mb-1 flex items-center gap-1.5 px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-foreground-subtle"><g.icon className="h-3.5 w-3.5" />{g.grupo}</p>
            {itens.map((r) => (
              <button key={r.id} type="button" onClick={() => onPick(r.id)} aria-current={atual === r.id ? 'page' : undefined}
                className={cn('flex h-9 w-full items-center rounded-xl px-3 text-left text-[13.5px] transition-colors', atual === r.id ? 'bg-foreground font-medium text-background' : 'text-foreground-muted hover:bg-surface-2 hover:text-foreground')}>
                {r.nome}
              </button>
            ))}
          </div>
        );
      })}
      {q && BIBLIOTECA.every((g) => !g.itens.some((r) => `${r.nome} ${r.desc} ${g.grupo}`.toLowerCase().includes(q))) && (
        <p className="px-3 text-[13px] text-foreground-muted">Nenhum relatório com “{busca}”.</p>
      )}
    </div>
  );
}

export default function Relatorios() {
  const [params, setParams] = useSearchParams();
  const relParam = params.get('r');
  const rel = TODOS.some((r) => r.id === relParam) ? relParam! : 'dre';
  const setRel = (id: string) => { const p = new URLSearchParams(params); p.set('r', id); setParams(p, { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const [period, setPeriod] = useState<PeriodFilter>('year');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [compFilter, setCompFilter] = useState<ComparativoFilter>('mes_atual_anterior');
  const [busca, setBusca] = useState('');
  const [lista, setLista] = useState(false);

  // Só aplica o range quando for 'custom' e ambas as datas estiverem preenchidas.
  const cStart = period === 'custom' ? customStart : undefined;
  const cEnd = period === 'custom' ? customEnd : undefined;

  const { dreRows, months, recDespResumo, fluxoData, comparativo, isLoading } = useRelatorios(period, cStart, cEnd, compFilter);
  const { reports, isLoading: loadingAdv } = useAdvancedReports(period, cStart, cEnd);
  const { data: dfc } = useDFC(period, cStart, cEnd);

  const navigate = useNavigate();
  const janela = periodWindow(period, cStart, cEnd);
  const periodoTxt = `${format(janela.start, 'dd/MM/yyyy')} a ${format(janela.end, 'dd/MM/yyyy')}`;
  // Clique numa linha: abre no fluxo de caixa os lançamentos que formam o número
  // (mesmo período e mesma data dos relatórios: competência).
  const verLancamentos = (extra: Record<string, string>) => {
    const q = new URLSearchParams({ base: 'competencia', de: format(janela.start, 'yyyy-MM-dd'), ate: format(janela.end, 'yyyy-MM-dd'), ...extra });
    navigate(`/fluxo-caixa?${q.toString()}`);
  };
  const SEM_CAT = '__sem_categoria__';

  const r = TODOS.find((x) => x.id === rel)!;
  const idx = TODOS.findIndex((x) => x.id === rel);
  const prox = TODOS[(idx + 1) % TODOS.length];

  // Dados do relatório aberto em linhas simples (planilha e contexto da IARA).
  const linhas = useMemo<Linha[]>(() => {
    switch (rel) {
      case 'dre': return linhasDRE(dreRows, months);
      case 'dfc': return dfc ? linhasDRE(dfc.rows, dfc.months) : [];
      case 'recdep': return recDespResumo.barData.map((d) => ({ Mês: d.mes, Receitas: n2(d.receitas), Despesas: n2(d.despesas), Resultado: n2(d.receitas - d.despesas) }));
      case 'fluxo': return fluxoData.chartData.map((d) => ({ Mês: d.mes, Entradas: n2(d.entradas), Saídas: n2(d.saidas), Saldo: n2(d.saldo) }));
      case 'comp': return comparativo.rows.map((d) => ({ Linha: d.label, [comparativo.periodo1Label]: n2(d.periodo1), [comparativo.periodo2Label]: n2(d.periodo2), Variação: n2(d.variacao), 'Variação %': n2(d.variacaoPercent) }));
      case 'mrr': return reports.mrr.map((d) => ({ Mês: d.month, MRR: n2(d.mrr), ARR: n2(d.arr), 'MRR novo': n2(d.newMRR), 'MRR perdido': n2(d.churnMRR) }));
      case 'abc': return reports.topClients.map((d) => ({ Cliente: d.nome, Receita: n2(d.total), 'Participação %': n2(d.share * 100), 'Acumulado %': n2(d.cumulative * 100), Classe: d.classe }));
      case 'rec-cat': return reports.receitaPorCategoria.map((d) => ({ Categoria: d.nome, Total: n2(d.total), 'Participação %': n2(d.share * 100) }));
      case 'desp-cat': return reports.despesaPorCategoria.map((d) => ({ Categoria: d.nome, Total: n2(d.total), 'Participação %': n2(d.share * 100) }));
      case 'aging-rec': return reports.agingRecebiveis.map((d) => ({ Faixa: d.label, Lançamentos: d.count, Total: n2(d.total), Situação: d.vencido ? 'Em atraso' : 'A vencer' }));
      case 'aging-pag': return reports.agingPagar.map((d) => ({ Faixa: d.label, Lançamentos: d.count, Total: n2(d.total), Situação: d.vencido ? 'Em atraso' : 'A vencer' }));
      case 'burn': return [
        ...reports.burnRunway.series.map((d) => ({ Item: d.month, Valor: n2(d.burn) })),
        { Item: 'Burn médio mensal', Valor: n2(reports.burnRunway.burnAvg) },
        { Item: 'Caixa disponível', Valor: n2(reports.burnRunway.cashOnHand) },
        { Item: 'Runway (meses)', Valor: n2(reports.burnRunway.runwayMonths) },
      ];
      case 'margem': return reports.clientMargins.map((d) => ({ Cliente: d.nome, Receita: n2(d.receita), 'Custo direto': n2(d.custoDireto), Margem: n2(d.margem), 'Margem %': n2(d.margemPct) }));
      case 'ltv': { const l = reports.ltvCac; return [
        { Indicador: 'LTV', Valor: n2(l.ltv) }, { Indicador: 'CAC', Valor: n2(l.cac) }, { Indicador: 'LTV / CAC', Valor: n2(l.ratio) },
        { Indicador: 'Payback (meses)', Valor: n2(l.payback) }, { Indicador: 'Ticket médio', Valor: n2(l.avgTicket) }, { Indicador: 'Tempo médio (meses)', Valor: n2(l.avgLifetime) },
        { Indicador: 'Clientes novos', Valor: l.novosClientes }, { Indicador: 'Gasto comercial', Valor: n2(l.gastoComercial) },
      ]; }
      case 'cards': return reports.cards.map((d) => ({ Cartão: d.nome, Bandeira: d.bandeira ?? '', Limite: n2(d.limite), Usado: n2(d.usado), Disponível: n2(d.disponivel), 'Uso %': n2(d.usoPct) }));
      case 'conc': return reports.reconciliation.map((d) => ({ Conta: d.conta, 'Saldo inicial': n2(d.saldoInicial), Entradas: n2(d.entradas), Saídas: n2(d.saidas), 'Saldo calculado': n2(d.saldoCalculado) }));
      case 'kpis': { const o = reports.opKPIs; return [
        { Indicador: 'Ticket médio', Valor: n2(o.ticketMedio) }, { Indicador: 'Clientes ativos', Valor: o.clientesAtivos },
        { Indicador: 'Contratos ativos', Valor: o.contratosAtivos }, { Indicador: 'Receita por cliente', Valor: n2(o.receitaPorCliente) },
      ]; }
      case 'proj': return reports.projection.map((d) => ({ Mês: d.month, Entradas: n2(d.entradas), Saídas: n2(d.saidas), 'Saldo acumulado': n2(d.saldoAcum) }));
      case 'fiscal': return reports.taxes.map((d) => ({ Mês: d.mes, Receita: n2(d.receita), Impostos: n2(d.deducoes), 'Receita líquida': n2(d.receitaLiquida) }));
      default: return [];
    }
  }, [rel, dreRows, months, dfc, recDespResumo, fluxoData, comparativo, reports]);

  const exportarExcel = () => {
    if (!linhas.length) return;
    const cols = Object.keys(linhas[0]).map((key) => ({ key, label: key }));
    exportToCSV(linhas, `relatorio-${r.id}`, cols);
  };
  const explicar = () => navigate('/iara', {
    state: {
      pergunta: `Me explica o relatório ${r.nome}: o que mostra, se está bom e por quê.`,
      contextoTela: {
        tela: 'relatorios',
        titulo: r.nome,
        periodo: periodoTxt,
        dados: { regime: r.regime ?? null, descricao: r.desc, linhas: linhas.slice(0, 40), total_linhas: linhas.length },
      },
    },
  });

  const conteudo = () => {
    switch (rel) {
      case 'dre': return <DRETable rows={dreRows} months={months} description="Compras no cartão contam na categoria de cada compra." />;
      case 'dfc': return <DFCTab period={period} customStart={cStart} customEnd={cEnd} />;
      case 'recdep': return <ReceitasDespesasTab data={recDespResumo} />;
      case 'fluxo': return <FluxoCaixaTab data={fluxoData} />;
      case 'comp': return <ComparativoTab data={comparativo} toolbar={<Segmented<ComparativoFilter> size="sm" className="w-fit max-w-full overflow-x-auto max-sm:w-full" value={compFilter} onChange={setCompFilter} opts={COMPARATIVOS} />} />;
      case 'mrr': return <MRRTab data={reports.mrr} />;
      case 'abc': return <TopClientsTab data={reports.topClients} onRowClick={(c) => verLancamentos({ tipo: 'entrada', search: c.nome })} />;
      case 'rec-cat': return <CategoryTab data={reports.receitaPorCategoria} title="Receita por categoria" onRowClick={(c) => verLancamentos({ tipo: 'entrada', categoria: c.id === 'sem' ? SEM_CAT : c.id })} />;
      case 'desp-cat': return <CategoryTab data={reports.despesaPorCategoria} title="Despesas por categoria" onRowClick={(c) => verLancamentos({ tipo: 'saida', categoria: c.id === 'sem' ? SEM_CAT : c.id })} />;
      case 'aging-rec': return <AgingTab data={reports.agingRecebiveis} title="Aging — contas a receber" />;
      case 'aging-pag': return <AgingTab data={reports.agingPagar} title="Aging — contas a pagar" />;
      case 'burn': return <BurnRunwayTab data={reports.burnRunway} />;
      case 'margem': return <ClientMarginTab data={reports.clientMargins} />;
      case 'ltv': return <LTVCACTab data={reports.ltvCac} />;
      case 'cards': return <CardsSummaryTab data={reports.cards} />;
      case 'conc': return <ReconciliationTab data={reports.reconciliation} />;
      case 'kpis': return <OpKPIsTab data={reports.opKPIs} />;
      case 'proj': return <ProjectionTab data={reports.projection} />;
      case 'fiscal': return <TaxesTab data={reports.taxes} />;
      default: return null;
    }
  };

  const grupo = BIBLIOTECA.find((g) => g.grupo === r.grupo)!;

  return (
    <main className="container max-w-full py-3 md:py-6">
      {/* PDF: imprime só o relatório aberto */}
      <style>{`@media print {
        body * { visibility: hidden !important; }
        #relatorio-print, #relatorio-print * { visibility: visible !important; }
        #relatorio-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0 12px; }
        #relatorio-print [data-no-print] { display: none !important; }
        @page { margin: 14mm; }
      }`}</style>

      <div className="space-y-5">
        <PageHeader eyebrow="Análise" title="Relatórios">
          <Segmented<PeriodFilter> size="sm" className="max-sm:w-full" value={period} onChange={setPeriod} opts={PERIODOS} />
        </PageHeader>

        {period === 'custom' && (
          <div className="rounded-[20px] border border-border bg-surface p-3.5 md:inline-block md:p-5">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Intervalo personalizado</p>
            <DateRangePicker from={customStart} to={customEnd} onApply={(de, ate) => { setCustomStart(de); setCustomEnd(ate); }} />
          </div>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="sticky top-6 hidden max-h-[calc(100dvh-3rem)] overflow-y-auto pb-4 lg:block">
            <Biblioteca atual={rel} onPick={setRel} busca={busca} setBusca={setBusca} />
          </aside>

          <div className="min-w-0 space-y-4">
            {/* seletor no celular/tablet */}
            <button type="button" onClick={() => setLista(true)} className="flex w-full items-center gap-3 rounded-[20px] border border-border bg-surface p-3.5 text-left lg:hidden">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-foreground"><BookOpen className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[12px] text-foreground-muted">{r.grupo}</span><span className="block truncate text-[15px] font-medium text-foreground">{r.nome}</span></span>
              <span className="hidden text-[12.5px] text-foreground-muted sm:inline">{TODOS.length} relatórios</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-foreground-muted" />
            </button>

            <div id="relatorio-print" className="space-y-4">
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 max-w-xl">
                    <p className="flex flex-wrap items-center gap-2 text-[12px] text-foreground-muted">
                      <grupo.icon className="h-3.5 w-3.5" />{r.grupo}
                      {r.regime && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-foreground">regime de {r.regime}</span>}
                      <span className="text-foreground-subtle">· {periodoTxt}</span>
                    </p>
                    <h2 className="font-heading text-[26px] font-light tracking-[-0.03em] text-foreground">{r.nome}</h2>
                    <p className="text-[13px] text-foreground-muted">{r.desc}</p>
                  </div>
                  <div data-no-print className="flex flex-wrap gap-2">
                    <button type="button" onClick={explicar} className={cn(btn.outline, 'h-9 px-3 text-[13px]')}><Sparkle className="h-3.5 w-3.5" />Explicar</button>
                    <button type="button" onClick={exportarExcel} disabled={!linhas.length} className={cn(btn.outline, 'h-9 px-3 text-[13px]')} title="Baixa uma planilha (CSV) que abre no Excel"><FileSpreadsheet className="h-4 w-4" />Excel</button>
                    <button type="button" onClick={() => window.print()} className={cn(btn.primary, 'h-9 px-3.5 text-[13px]')}><Printer className="h-4 w-4" />PDF</button>
                  </div>
                </div>
              </Card>

              {isLoading || loadingAdv ? (
                <div className="space-y-4"><SkeletonChart /></div>
              ) : conteudo()}
            </div>

            <div className="flex items-center justify-end gap-3 text-[12.5px] text-foreground-muted">
              <button type="button" onClick={() => setRel(prox.id)} className="inline-flex items-center gap-1 text-foreground hover:underline">Próximo: {prox.nome}<ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        </div>
      </div>

      <Sheet open={lista} onOpenChange={setLista}>
        <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
          <ModalShell>
            <ModalHeader title="Relatórios" eyebrow={`${TODOS.length} relatórios`} onClose={() => setLista(false)} />
            <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-safe">
              <Biblioteca atual={rel} onPick={(id) => { setRel(id); setLista(false); }} busca={busca} setBusca={setBusca} />
            </div>
          </ModalShell>
        </SheetContent>
      </Sheet>
    </main>
  );
}
