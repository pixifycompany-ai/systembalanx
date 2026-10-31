import { KpiTriple } from '@/components/shared/KpiTriple';
import { cn } from '@/lib/utils';

interface FluxoCaixaKPIRowProps {
  entradas: number;
  saidas: number;
  saldo: number;
  /** Mantido por compatibilidade; a contagem aparece no cabeçalho da tabela. */
  itemCount?: number;
  className?: string;
}

/** Faixa Entradas / Saídas / Saldo (célula navy) do período filtrado. */
export function FluxoCaixaKPIRow({ entradas, saidas, saldo, className }: FluxoCaixaKPIRowProps) {
  return (
    <KpiTriple
      className={cn('mb-0', className)}
      items={[
        { label: 'Entradas', value: entradas, tone: 'green' },
        { label: 'Saídas', value: saidas, tone: 'red' },
        { label: 'Saldo', value: saldo, tone: 'steel' },
      ]}
    />
  );
}
