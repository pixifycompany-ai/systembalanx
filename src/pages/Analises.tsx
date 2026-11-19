import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { Sparkle } from '@/components/shared/Sparkle';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/reskin/kit';
import { btn } from '@/components/reskin/estilos';
import { useAnalises } from '@/hooks/useAnalises';
import {
  ChurnBloco, CoortesBloco, LTVBloco, ProjecaoBloco, RentabilidadeBloco, SaudeFinanceira,
} from '@/components/analises/AnalisesBlocos';

export default function Analises() {
  const navigate = useNavigate();
  const {
    ltvEvolution, churnData, cohorts, revenueProjection, clientProfitability, healthScore, isLoading, error,
  } = useAnalises();

  if (isLoading) {
    return <main className="container py-6"><LoadingSpinner /></main>;
  }

  if (error) {
    return (
      <main className="container py-6">
        <div className="rounded-[20px] border border-border bg-surface p-6 text-center text-sm text-[hsl(var(--danger-fg))]">
          Erro ao carregar dados: {error}
        </div>
      </main>
    );
  }

  // Abre a IARA já sabendo os números desta tela (ela explica com os mesmos valores).
  const explicar = () => navigate('/iara', {
    state: {
      pergunta: 'Me explica as minhas análises: a nota de saúde financeira, o churn, o LTV e a rentabilidade dos clientes. Está bom? Por quê? O que eu faço para melhorar?',
      contextoTela: {
        tela: 'analises',
        titulo: 'Análises',
        periodo: 'últimos meses (até hoje)',
        dados: {
          saude: { nota: healthScore.score, categoria: healthScore.categoria, fatores: healthScore.fatores.map((f) => ({ nome: f.nome, valor: Number(f.valor.toFixed(2)), peso: f.peso, nota: Math.round((f.contribuicao / f.peso) * 100) })) },
          churn: { taxa_mensal: churnData.taxaChurnMensal, ativos: churnData.clientesAtivos, novos: churnData.clientesNovos, perdidos: churnData.clientesPerdidos },
          ltv_atual: ltvEvolution[ltvEvolution.length - 1] ?? null,
          rentabilidade_top: clientProfitability.slice(0, 10).map((c) => ({ cliente: c.clienteNome, receita: c.receitaTotal, custo: c.custoAtribuido, lucro: c.lucroEstimado, margem_pct: Number(c.margemPercentual.toFixed(1)) })),
        },
      },
    },
  });

  return (
    <main className="container overflow-hidden py-3 md:py-6">
      <div className="space-y-5">
        <PageHeader eyebrow="Análise" title="Análises" mobileAction={<button type="button" onClick={explicar} aria-label="Explicar com a IARA" title="Explicar com a IARA" className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background"><Sparkle className="h-4 w-4" /></button>}>
          <button type="button" onClick={explicar} className={cn(btn.outline, 'max-sm:hidden')}><Sparkle className="h-3.5 w-3.5" />Explicar com a IARA</button>
        </PageHeader>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <SaudeFinanceira health={healthScore} />
          <ChurnBloco churn={churnData} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <LTVBloco data={ltvEvolution} />
          <ProjecaoBloco data={revenueProjection} />
        </div>

        <CoortesBloco cohorts={cohorts} clientesPerdidos={churnData.clientesPerdidos} />

        <RentabilidadeBloco clients={clientProfitability} />
      </div>
    </main>
  );
}
