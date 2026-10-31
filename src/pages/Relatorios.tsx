import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const toDate = (s: string) => (s ? new Date(s + 'T00:00:00') : undefined);
const toInput = (d?: Date) => (d ? d.toISOString().slice(0, 10) : '');

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

  return (
    <main className="container py-3 md:py-6 max-w-full">
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-foreground-muted mb-0.5 font-medium">Demonstrativos</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">Relatórios</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[150px] md:w-[170px] h-9 text-sm"><SelectValue placeholder="Período" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="quarter">Este trimestre</SelectItem>
              <SelectItem value="year">Este ano</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date" lang="pt-BR" value={toInput(customStart)}
                max={toInput(customEnd) || undefined}
                onChange={(e) => setCustomStart(toDate(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                aria-label="Data inicial"
              />
              <span className="text-xs text-muted-foreground">até</span>
              <input
                type="date" lang="pt-BR" value={toInput(customEnd)}
                min={toInput(customStart) || undefined}
                onChange={(e) => setCustomEnd(toDate(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                aria-label="Data final"
              />
            </div>
          )}
        </div>
      </div>
      {period === 'custom' && (!customStart || !customEnd) && (
        <p className="-mt-2 mb-4 text-xs text-muted-foreground">Selecione a data inicial e final para aplicar o período personalizado.</p>
      )}

      {isLoading || loadingAdv ? (
        <div className="space-y-6"><SkeletonChart /><SkeletonChart /></div>
      ) : (
        <Tabs defaultValue="dre" className="space-y-4 md:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0 scrollbar-hide">
            <TabsList className="inline-flex flex-nowrap w-max">
              <TabsTrigger value="dre">DRE</TabsTrigger>
              <TabsTrigger value="recdep">Rec vs Desp</TabsTrigger>
              <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
              <TabsTrigger value="comp">Comparativo</TabsTrigger>
              <TabsTrigger value="mrr">MRR / ARR</TabsTrigger>
              <TabsTrigger value="abc">Top Clientes</TabsTrigger>
              <TabsTrigger value="rec-cat">Rec. p/ Categoria</TabsTrigger>
              <TabsTrigger value="desp-cat">Desp. p/ Categoria</TabsTrigger>
              <TabsTrigger value="aging-rec">Aging Receber</TabsTrigger>
              <TabsTrigger value="aging-pag">Aging Pagar</TabsTrigger>
              <TabsTrigger value="burn">Burn & Runway</TabsTrigger>
              <TabsTrigger value="margem">Margem Cliente</TabsTrigger>
              <TabsTrigger value="ltv">LTV / CAC</TabsTrigger>
              <TabsTrigger value="cards">Cartões</TabsTrigger>
              <TabsTrigger value="conc">Conciliação</TabsTrigger>
              <TabsTrigger value="kpis">KPIs Op.</TabsTrigger>
              <TabsTrigger value="proj">Projeção 12m</TabsTrigger>
              <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dre"><DRETable rows={dreRows} months={months} /></TabsContent>
          <TabsContent value="recdep"><ReceitasDespesasTab data={recDespResumo} /></TabsContent>
          <TabsContent value="fluxo"><FluxoCaixaTab data={fluxoData} /></TabsContent>
          <TabsContent value="comp">
            <div className="space-y-4">
              <Select value={compFilter} onValueChange={(v) => setCompFilter(v as ComparativoFilter)}>
                <SelectTrigger className="w-full md:w-[220px] h-9 text-sm"><SelectValue placeholder="Período de comparação" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mes_atual_anterior">Mês atual vs anterior</SelectItem>
                  <SelectItem value="60dias">Últimos 60 dias</SelectItem>
                  <SelectItem value="90dias">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
              <ComparativoTab data={comparativo} />
            </div>
          </TabsContent>

          <TabsContent value="mrr"><MRRTab data={reports.mrr} /></TabsContent>
          <TabsContent value="abc"><TopClientsTab data={reports.topClients} /></TabsContent>
          <TabsContent value="rec-cat"><CategoryTab data={reports.receitaPorCategoria} title="Receita por Categoria" /></TabsContent>
          <TabsContent value="desp-cat"><CategoryTab data={reports.despesaPorCategoria} title="Despesas por Categoria" /></TabsContent>
          <TabsContent value="aging-rec"><AgingTab data={reports.agingRecebiveis} title="Aging — Contas a Receber" /></TabsContent>
          <TabsContent value="aging-pag"><AgingTab data={reports.agingPagar} title="Aging — Contas a Pagar" /></TabsContent>
          <TabsContent value="burn"><BurnRunwayTab data={reports.burnRunway} /></TabsContent>
          <TabsContent value="margem"><ClientMarginTab data={reports.clientMargins} /></TabsContent>
          <TabsContent value="ltv"><LTVCACTab data={reports.ltvCac} /></TabsContent>
          <TabsContent value="cards"><CardsSummaryTab data={reports.cards} /></TabsContent>
          <TabsContent value="conc"><ReconciliationTab data={reports.reconciliation} /></TabsContent>
          <TabsContent value="kpis"><OpKPIsTab data={reports.opKPIs} /></TabsContent>
          <TabsContent value="proj"><ProjectionTab data={reports.projection} /></TabsContent>
          <TabsContent value="fiscal"><TaxesTab data={reports.taxes} /></TabsContent>
        </Tabs>
      )}
    </main>
  );
}
