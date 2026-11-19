import { ArrowLeftRight, CreditCard, TrendingDown, TrendingUp } from 'lucide-react';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';
import { ehFatura } from './lancamento';

/** Ícone do tipo do lançamento (entrada, saída, transferência ou fatura de cartão). */
export function TipoIcone({ t, className }: { t: TransacaoUnificada; className?: string }) {
  const transf = t.tabela_origem === 'transferencia';
  const fatura = !transf && ehFatura(t);
  return (
    <span
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-[13px]',
        transf ? 'bg-info-bg text-info-fg' : fatura ? 'bg-foreground text-background' : t.tipo === 'entrada' ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg',
        className,
      )}
      title={transf ? 'Transferência' : fatura ? 'Fatura do cartão' : t.tipo === 'entrada' ? 'Entrada' : 'Saída'}
    >
      {transf ? <ArrowLeftRight className="h-4 w-4" /> : fatura ? <CreditCard className="h-4 w-4" /> : t.tipo === 'entrada' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
    </span>
  );
}
