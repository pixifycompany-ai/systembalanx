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

export default function Relatorios() {
  const [period, setPeriod] = useState<PeriodFilter>('year');
  const [compFilter, setCompFilter] = useState<ComparativoFilter>('mes_atual_anterior');
  const { dreRows, months, recDespResumo, fluxoData, comparativo, isLoading } = useRelatorios(period, undefined, undefined, compFilter);
  const { reports, isLoading: loadingAdv } = useAdvancedReports();

  return (
    <main className="container py-3 md:py-6 max-w-full">
      <div className="mb-4 md:mb-6">
        <h1 className="text-h1 text-foreground">Relatórios</h1>
        <p className="text-xs md:text-sm text-muted-foreground">Análises detalhadas e demonstrativos financeiros</p>
      </div>

      <div className="flex items-center gap-3 mb-4 md:mb-6">
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-full md:w-[180px] h-9 text-sm"><SelectValue placeholder="Período" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Este mês</SelectItem>
            <SelectItem value="quarter">Este trimestre</SelectItem>
            <SelectItem value="year">Este ano</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
