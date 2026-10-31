import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DateRangePicker } from '@/components/shared/DateRangePicker';
import { DRETable } from '@/components/relatorios/DRETable';
import { ReceitasDespesasTab } from '@/components/relatorios/ReceitasDespesasTab';
import { FluxoCaixaTab } from '@/components/relatorios/FluxoCaixaTab';
import { ComparativoTab } from '@/components/relatorios/ComparativoTab';
import {
  MRRTab, TopClientsTab, CategoryTab, AgingTab, BurnRunwayTab,
  ClientMarginTab, LTVCACTab, CardsSummaryTab, ReconciliationTab,
  OpKPIsTab, ProjectionTab, TaxesTab,
} from '@/components/relatorios/AdvancedReportTabs';
import { useRelatorios, type PeriodFilter, type ComparativoFilter } from '@/hooks/useRelatorios';
import { useAdvancedReports } from '@/hooks/useAdvancedReports';
import { SkeletonChart } from '@/components/shared/LoadingSpinner';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { ScrollPills, Pill } from '@/components/shared/ScrollPills';
import { cn } from '@/lib/utils';


const PERIODOS: { value: PeriodFilter; label: string }[] = [
  { value: 'month', label: 'Este mês' },
  { value: 'quarter', label: 'Este trimestre' },
  { value: 'year', label: 'Este ano' },
  { value: 'custom', label: 'Personalizado' },
];

const COMPARATIVOS: { value: ComparativoFilter; label: string }[] = [
  { value: 'mes_atual_anterior', label: 'Mês atual vs anterior' },
  { value: '60dias', label: 'Últimos 60 dias' },
  { value: '90dias', label: 'Últimos 90 dias' },
];

const TABS: { value: string; label: string }[] = [
  { value: 'dre', label: 'DRE' },
  { value: 'recdep', label: 'Rec vs Desp' },
  { value: 'fluxo', label: 'Fluxo de Caixa' },
  { value: 'comp', label: 'Comparativo' },
  { value: 'mrr', label: 'MRR / ARR' },
  { value: 'abc', label: 'Top Clientes' },
  { value: 'rec-cat', label: 'Rec. p/ Categoria' },
  { value: 'desp-cat', label: 'Desp. p/ Categoria' },
  { value: 'aging-rec', label: 'Aging Receber' },
  { value: 'aging-pag', label: 'Aging Pagar' },
  { value: 'burn', label: 'Burn & Runway' },
  { value: 'margem', label: 'Margem Cliente' },
  { value: 'ltv', label: 'LTV / CAC' },
  { value: 'cards', label: 'Cartões' },
  { value: 'conc', label: 'Conciliação' },
  { value: 'kpis', label: 'KPIs Op.' },
  { value: 'proj', label: 'Projeção 12m' },
  { value: 'fiscal', label: 'Fiscal' },
];

export default function Relatorios() {
  const [period, setPeriod] = useState<PeriodFilter>('year');
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [compFilter, setCompFilter] = useState<ComparativoFilter>('mes_atual_anterior');

  // Só aplica o range quando for 'custom' e ambas as datas estiverem preenchidas.
  const cStart = period === 'custom' ? customStart : undefined;
  const cEnd = period === 'custom' ? customEnd : undefined;

  const { dreRows, months, recDespResumo, fluxoData, comparativo, isLoading } = useRelatorios(period, cStart, cEnd, compFilter);
  const { reports, isLoading: loadingAdv } = useAdvancedReports(period, cStart, cEnd);

  const periodLabel = PERIODOS.find((p) => p.value === period)?.label ?? 'Período';

  return (
    <main className="container max-w-full py-3 md:py-6">
      <MobilePageHeader
        eyebrow="Análise"
        title="Relatórios"
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors',
                period !== 'year'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-surface text-foreground hover:border-border-strong',
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Período</span>
              <span className="opacity-50">·</span>
              <span className="font-semibold">{periodLabel}</span>
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {PERIODOS.map((p) => (
                <DropdownMenuItem key={p.value} onSelect={() => setPeriod(p.value)} className="justify-between">
                  {p.label}
                  {p.value === period && <Check className="h-4 w-4 text-foreground-muted" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {period === 'custom' && (
        <div className="-mt-1 mb-5 rounded-[20px] border border-border bg-surface p-3.5 md:mb-6 md:inline-block md:p-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Intervalo personalizado</p>
          <DateRangePicker
            from={customStart}
            to={customEnd}
            onApply={(de, ate) => { setCustomStart(de); setCustomEnd(ate); }}
          />
        </div>
      )}

      {isLoading || loadingAdv ? (
        <div className="space-y-4 md:space-y-6"><SkeletonChart /><SkeletonChart /></div>
      ) : (
        <Tabs defaultValue="dre">
          {/* Abas segmentadas: rolam na horizontal no mobile */}
          <div className="scrollbar-hide -mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
            <TabsList className="inline-flex w-max flex-nowrap">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="px-3.5 md:px-4">{t.label}</TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value="dre" className="mt-4 md:mt-6"><DRETable rows={dreRows} months={months} /></TabsContent>
          <TabsContent value="recdep" className="mt-4 md:mt-6"><ReceitasDespesasTab data={recDespResumo} /></TabsContent>
          <TabsContent value="fluxo" className="mt-4 md:mt-6"><FluxoCaixaTab data={fluxoData} /></TabsContent>
          <TabsContent value="comp" className="mt-4 md:mt-6">
            <ComparativoTab
              data={comparativo}
              toolbar={
                <ScrollPills>
                  {COMPARATIVOS.map((c) => (
                    <Pill key={c.value} active={compFilter === c.value} onClick={() => setCompFilter(c.value)}>
                      {c.label}
                    </Pill>
                  ))}
                </ScrollPills>
              }
            />
          </TabsContent>

          <TabsContent value="mrr" className="mt-4 md:mt-6"><MRRTab data={reports.mrr} /></TabsContent>
          <TabsContent value="abc" className="mt-4 md:mt-6"><TopClientsTab data={reports.topClients} /></TabsContent>
          <TabsContent value="rec-cat" className="mt-4 md:mt-6"><CategoryTab data={reports.receitaPorCategoria} title="Receita por Categoria" /></TabsContent>
          <TabsContent value="desp-cat" className="mt-4 md:mt-6"><CategoryTab data={reports.despesaPorCategoria} title="Despesas por Categoria" /></TabsContent>
          <TabsContent value="aging-rec" className="mt-4 md:mt-6"><AgingTab data={reports.agingRecebiveis} title="Aging — Contas a Receber" /></TabsContent>
          <TabsContent value="aging-pag" className="mt-4 md:mt-6"><AgingTab data={reports.agingPagar} title="Aging — Contas a Pagar" /></TabsContent>
          <TabsContent value="burn" className="mt-4 md:mt-6"><BurnRunwayTab data={reports.burnRunway} /></TabsContent>
          <TabsContent value="margem" className="mt-4 md:mt-6"><ClientMarginTab data={reports.clientMargins} /></TabsContent>
          <TabsContent value="ltv" className="mt-4 md:mt-6"><LTVCACTab data={reports.ltvCac} /></TabsContent>
          <TabsContent value="cards" className="mt-4 md:mt-6"><CardsSummaryTab data={reports.cards} /></TabsContent>
          <TabsContent value="conc" className="mt-4 md:mt-6"><ReconciliationTab data={reports.reconciliation} /></TabsContent>
          <TabsContent value="kpis" className="mt-4 md:mt-6"><OpKPIsTab data={reports.opKPIs} /></TabsContent>
          <TabsContent value="proj" className="mt-4 md:mt-6"><ProjectionTab data={reports.projection} /></TabsContent>
          <TabsContent value="fiscal" className="mt-4 md:mt-6"><TaxesTab data={reports.taxes} /></TabsContent>
        </Tabs>
      )}
    </main>
  );
}
