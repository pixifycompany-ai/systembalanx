import { NavyCard } from '@/components/reskin/kit';
import { NAVY_TONE } from '@/components/shared/navyTokens';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';

interface ResumoPeriodoProps {
  /** Entradas já recebidas / total de entradas do período (realizado × previsto). */
  entradasOk: number;
  entradasTotal: number;
  /** Saídas já pagas / total de saídas do período. */
  saidasOk: number;
  saidasTotal: number;
  /** Entradas em atraso (a receber vencido). */
  atrasoReceber: number;
  /** Rótulo do período no card navy ("Saldo do mês" / "Saldo do período"). */
  saldoLabel?: string;
  className?: string;
}

function CardMovimento({ rotulo, ok, total, verbo, barra, cor }: { rotulo: string; ok: number; total: number; verbo: string; barra: string; cor: string }) {
  const pct = total > 0 ? Math.min(100, (ok / total) * 100) : 0;
  return (
    <div className="rounded-[24px] border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 text-[13px] text-foreground-muted">
        {rotulo}
        <span className="hidden text-[12px] tabular-nums lg:inline">previsto {formatCurrency(total)}</span>
      </div>
      <p className={cn('mt-1 font-heading text-[20px] font-semibold tabular-nums tracking-[-0.03em] sm:text-[28px]', cor)}>{formatCurrency(ok)}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className={cn('h-full rounded-full', barra)} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1.5 text-[12px] text-foreground-muted">
        {Math.round(pct)}% {verbo}
        <span className="hidden sm:inline"> · faltam {formatCurrency(Math.max(0, total - ok))}</span>
      </p>
    </div>
  );
}

/** Números do período: realizado × previsto (entradas, saídas) + saldo navy. */
export function ResumoPeriodo({ entradasOk, entradasTotal, saidasOk, saidasTotal, atrasoReceber, saldoLabel = 'Saldo do mês', className }: ResumoPeriodoProps) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:grid-cols-3', className)}>
      <CardMovimento rotulo="Entradas" ok={entradasOk} total={entradasTotal} verbo="recebido" barra="bg-success-fg" cor="text-success-fg" />
      <CardMovimento rotulo="Saídas" ok={saidasOk} total={saidasTotal} verbo="pago" barra="bg-danger-fg" cor="text-danger-fg" />
      <NavyCard className="order-first col-span-2 sm:order-none sm:col-span-1">
        <div className="flex items-center justify-between gap-2 text-[13px] text-white/70">
          {saldoLabel}
          <span className="text-[12px] tabular-nums">previsto {formatCurrency(entradasTotal - saidasTotal)}</span>
        </div>
        <p className="mt-1 font-heading text-[28px] font-semibold tabular-nums tracking-[-0.03em]">{formatCurrency(entradasOk - saidasOk)}</p>
        <p className="mt-3.5 flex items-center gap-1.5 text-[12px] text-white/70">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: atrasoReceber > 0 ? NAVY_TONE.danger : NAVY_TONE.success }} />
          {atrasoReceber > 0 ? `${formatCurrency(atrasoReceber)} em atraso para receber` : 'Nada em atraso para receber'}
        </p>
      </NavyCard>
    </div>
  );
}
