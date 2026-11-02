import type { PeriodFilter } from '@/hooks/useRelatorios';
import { useDFC } from '@/hooks/useDFC';
import { formatCurrency } from '@/utils/formatters';
import { SkeletonChart } from '@/components/shared/LoadingSpinner';
import { DRETable } from './DRETable';

// Linhas de saída do DFC aparecem entre parênteses (como no DRE)
const SAIDAS = new Set([
  'SAÍDAS OPERACIONAIS', 'Impostos e deduções', 'Custos variáveis', 'Comerciais / Marketing',
  'Administrativas', 'Pessoal', 'Outras despesas operacionais', '(−) DISTRIBUIÇÃO DE LUCROS / RETIRADAS',
]);

interface DFCTabProps {
  period: PeriodFilter;
  customStart?: Date;
  customEnd?: Date;
}

/** DFC — Demonstrativo de Fluxo de Caixa (regime de caixa). */
export function DFCTab({ period, customStart, customEnd }: DFCTabProps) {
  const { data, isLoading } = useDFC(period, customStart, customEnd);
  if (isLoading || !data) return <SkeletonChart />;

  return (
    <div className="space-y-3">
      <DRETable
        rows={data.rows}
        months={data.months}
        title="DFC – Demonstrativo de Fluxo de Caixa"
        description="Regime de caixa: o que entrou e saiu das contas bancárias, pela data do recebimento/pagamento. A fatura do cartão entra quando é paga, rateada pelas categorias das compras. Toque numa linha com seta para ver as categorias."
        isNegativeRow={(label) => SAIDAS.has(label)}
        bottomLineLabel="SALDO FINAL"
      />
      <p className="px-1 text-[12px] leading-relaxed text-foreground-muted">
        Saldo real das contas hoje: <b className="font-semibold text-foreground">{formatCurrency(data.saldoAtualContas)}</b> — o saldo final do mês atual bate com ele.
        {data.semConta.quantidade > 0 && (
          <> {data.semConta.quantidade} lançamento(s) quitado(s) sem conta bancária ficam fora do caixa (líquido {formatCurrency(data.semConta.valor)}); defina a conta deles para entrarem.</>
        )}
      </p>
    </div>
  );
}
