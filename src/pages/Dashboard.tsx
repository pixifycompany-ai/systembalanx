import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight } from 'lucide-react';

import { HeroStatCard } from '@/components/shared/HeroStatCard';
import { ListRowCard } from '@/components/shared/ListRowCard';
import { MobilePageHeader } from '@/components/shared/MobilePageHeader';
import { DetailSheet } from '@/components/shared/DetailSheet';
import { ProgressGoal } from '@/components/dashboard/ProgressGoal';
import { AlertsWidget } from '@/components/dashboard/AlertsWidget';
import { SkeletonCard } from '@/components/shared/LoadingSpinner';

import { useDashboard } from '@/hooks/useDashboard';
import { useMetas } from '@/hooks/useMetas';
import { useProfile } from '@/hooks/useProfile';
import { formatCurrency } from '@/utils/formatters';

import type { UpcomingItem } from '@/components/dashboard/UpcomingDueWidget';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function diasParaVencer(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return 'Atrasado';
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Amanhã';
  return `em ${diff}d`;
}

export default function Dashboard() {
  const {
    dashboardData,
    accountBalances,
    consolidatedHistory,
    upcomingItems,
    alerts,
    isLoading,
    error,
  } = useDashboard();
  const { getMetaValor, upsertMeta } = useMetas();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const [saldoSheetOpen, setSaldoSheetOpen] = useState(false);

  const mesAtual = format(new Date(), 'MMM', { locale: ptBR }).toUpperCase();
  const currentPeriodo = format(new Date(), 'yyyy-MM');
  const mesNome = format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
  const primeiroNome = profile?.nome?.split(' ')[0] ?? 'por aqui';

  if (isLoading) {
    return (
      <main className="container py-4 md:py-6">
        <div className="mb-5 h-12 w-48 bg-muted rounded animate-pulse" />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </main>
    );
  }
  if (error) {
    return <main className="container py-6"><p className="text-muted-foreground">{error}</p></main>;
  }

  const { resumo, meta_faturamento } = dashboardData;
  const totalBalance = accountBalances.reduce((s, a) => s + a.saldo, 0);
  const proximos = upcomingItems.slice(0, 5);
  const metaValor = getMetaValor('faturamento', currentPeriodo, 15000);

  // Fluxo dia (já é hook que carrega tudo — usa só pra "últimas transações")
  return (
    <main className="container py-4 md:py-6">
      <MobilePageHeader
        eyebrow={`${greeting()},`}
        title={primeiroNome}
        actions={
          <span className="text-xs font-semibold uppercase tracking-widest text-foreground-muted px-3 py-1.5 rounded-full border border-border bg-surface">
            {mesAtual}
          </span>
        }
      />

      {/* Hero — Saldo Consolidado */}
      <div className="mb-10">
        <HeroStatCard
          eyebrow="Saldo Consolidado"
          context={mesAtual}
          value={totalBalance}
          subtitle={`${accountBalances.length} ${accountBalances.length === 1 ? 'conta' : 'contas'} ativas`}
          footer={[
            { label: 'Receitas do mês', value: resumo.faturamento_mes, valueClassName: 'text-[hsl(var(--success))]' },
            { label: 'Despesas do mês', value: resumo.despesas_mes, align: 'right', valueClassName: 'text-[hsl(var(--danger))]' },
          ]}
          action={{ label: 'Ver detalhes', onClick: () => setSaldoSheetOpen(true) }}
        />
      </div>

      {/* Meta do mês */}
      <section className="mb-6">
        <ProgressGoal
          title="Meta de Faturamento"
          current={meta_faturamento.valor_realizado}
          target={metaValor}
          subtitle={mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}
          editable
          onEditTarget={(v) => upsertMeta.mutate({ tipo: 'faturamento', periodo: currentPeriodo, valor_meta: v })}
        />
      </section>

      {/* Próximos vencimentos (7 dias) */}
      <section className="mb-6">
        <div className="flex items-end justify-between mb-3 px-1">
          <div>
            <h2 className="text-base font-semibold text-foreground">Próximos vencimentos</h2>
            <p className="text-xs text-foreground-muted">Próximos 7 dias</p>
          </div>
          <button
            onClick={() => navigate('/fluxo-caixa?status=pendente,atrasado')}
            className="text-xs font-medium text-foreground-muted hover:text-foreground no-touch-min"
          >
            Ver todos
          </button>
        </div>

        {proximos.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-4 py-6 text-center text-sm text-foreground-muted">
            Nada vencendo nos próximos 7 dias 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {proximos.map((item: UpcomingItem) => {
              const isReceita = item.tipo === 'receita';
              const tipo = isReceita ? 'entrada' : 'saida';
              return (
                <ListRowCard
                  key={item.id}
                  initial={item.cliente_ou_fornecedor || item.descricao}
                  avatarTone={isReceita ? 'success' : 'danger'}
                  title={item.cliente_ou_fornecedor || item.descricao}
                  subtitle={item.descricao}
                  value={`${isReceita ? '+ ' : '- '}${formatCurrency(item.valor)}`}
                  meta={diasParaVencer(item.data_vencimento)}
                  onClick={() =>
                    navigate(`/fluxo-caixa?tipo=${tipo}&search=${encodeURIComponent(item.descricao)}`)
                  }
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Alertas (só renderiza se houver) */}
      {alerts.length > 0 && (
        <section className="mb-6">
          <AlertsWidget alerts={alerts} />
        </section>
      )}

      {/* Atalho — Análise completa */}
      <button
        onClick={() => navigate('/visao')}
        className="w-full rounded-2xl border border-border bg-surface px-4 py-4 flex items-center justify-between hover:bg-surface-2 transition-colors no-touch-min"
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-foreground">Visão completa do negócio</p>
          <p className="text-xs text-foreground-muted">MRR, top clientes, projeções, IA</p>
        </div>
        <ArrowRight className="h-4 w-4 text-foreground-muted" />
      </button>

      {/* Bottom sheet — Saldo detalhado */}
      <DetailSheet
        open={saldoSheetOpen}
        onOpenChange={setSaldoSheetOpen}
        eyebrow={mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}
        title="Detalhe do saldo"
      >
        {/* Card resumo */}
        <div className="rounded-2xl bg-white/5 px-4 py-4 mb-5">
          <p className="text-[11px] uppercase tracking-wider text-white/55 mb-1">Total disponível</p>
          <p className="text-3xl font-semibold tabular-nums">{formatCurrency(totalBalance)}</p>
          <p className="text-xs text-white/60 mt-1">
            Receitas {formatCurrency(resumo.faturamento_mes)} · Despesas {formatCurrency(resumo.despesas_mes)}
          </p>
        </div>

        <p className="text-[11px] uppercase tracking-wider text-white/55 mb-2">Por conta</p>
        <div className="space-y-2 mb-5">
          {accountBalances.map((acc) => (
            <button
              key={acc.id}
              onClick={() => {
                setSaldoSheetOpen(false);
                navigate(`/fluxo-caixa?conta=${acc.id}`);
              }}
              className="w-full flex items-center justify-between rounded-xl bg-white/5 hover:bg-white/10 px-4 py-3 transition-colors no-touch-min text-left"
            >
              <div className="flex items-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: acc.cor }} />
                <span className="text-sm font-medium">{acc.nome}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(acc.saldo)}</span>
            </button>
          ))}
        </div>

        {consolidatedHistory.length > 1 && (
          <>
            <p className="text-[11px] uppercase tracking-wider text-white/55 mb-2">Evolução</p>
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <div className="flex justify-between text-xs">
                {consolidatedHistory.map((h) => (
                  <div key={h.mes} className="flex flex-col items-center gap-1">
                    <span className="text-white/60">{h.mes}</span>
                    <span className="font-medium tabular-nums text-white">
                      {h.valor >= 1000 ? `${(h.valor / 1000).toFixed(1)}k` : formatCurrency(h.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <button
          onClick={() => {
            setSaldoSheetOpen(false);
            navigate('/contas');
          }}
          className="mt-5 w-full rounded-xl bg-white text-[hsl(240_10%_8%)] py-3 text-sm font-semibold no-touch-min"
        >
          Gerenciar contas
        </button>
      </DetailSheet>
    </main>
  );
}
