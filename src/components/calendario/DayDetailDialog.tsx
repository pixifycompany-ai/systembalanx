import { Check, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import { ModalHeader, ModalShell } from '@/components/reskin/kit';
import { modalCls } from '@/components/reskin/estilos';
import type { DayTransactions, DayItem } from '@/hooks/useCalendario';
import { isPendente, useDarBaixa } from './useDarBaixa';

interface DayDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: DayTransactions | null;
}

const ROTULO: Record<string, string> = { recebido: 'Recebido', pago: 'Pago', pendente: 'Em aberto', atrasado: 'Atrasado' };
const BADGE: Record<string, string> = {
  recebido: 'bg-success-bg text-success-fg', pago: 'bg-surface-2 text-foreground-muted',
  pendente: 'bg-info-bg text-info-fg', atrasado: 'bg-danger-bg text-danger-fg',
};

/** Lista de lançamentos de um dia (entradas e saídas) com baixa rápida. Usada no calendário e no modal do dia. */
export function LancamentosDoDia({ day, items }: { day: string; items: DayItem[] }) {
  const { darBaixa, processando } = useDarBaixa();
  return (
    <>
      {(['receita', 'despesa'] as const).map((t) => {
        const l = items.filter((x) => x.tipo === t);
        if (!l.length) return null;
        return (
          <div key={t}>
            <p className="mb-1 flex items-center justify-between text-[11.5px] uppercase tracking-[0.08em] text-foreground-muted">
              {t === 'receita' ? 'Entradas' : 'Saídas'}
              <span className={cn('font-heading text-[13px] normal-case tracking-normal tabular-nums', t === 'receita' ? 'text-success-fg' : 'text-danger-fg')}>
                {formatCurrency(l.reduce((s, x) => s + x.valor, 0))}
              </span>
            </p>
            {l.map((x) => {
              const loading = processando.has(x.id);
              return (
                <div key={`${x.tipo}-${x.id}`} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', t === 'receita' ? 'bg-success-fg' : 'bg-danger-fg')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] text-foreground">{x.clienteOuFornecedor || x.descricao}</span>
                    <span className="flex min-w-0 items-center gap-1.5 truncate text-[12px] text-foreground-muted">
                      {x.categoriaCor && <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: x.categoriaCor }} />}
                      <span className="truncate">{x.clienteOuFornecedor ? x.descricao : (x.categoria || '')}</span>
                      <span className={cn('sm:hidden', x.status === 'atrasado' && 'text-danger-fg')}>· {ROTULO[x.status] || x.status}</span>
                    </span>
                    {isPendente(x.status) && (
                      <button
                        type="button"
                        onClick={() => darBaixa(x, day)}
                        disabled={loading}
                        className="no-touch-min mt-1.5 inline-flex h-7 items-center gap-1 rounded-full bg-success-bg px-3 text-[11.5px] font-medium text-success-fg transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                        {x.tipo === 'receita' ? 'Dar baixa (receber)' : 'Dar baixa (pagar)'}
                      </button>
                    )}
                  </span>
                  <span className={cn('hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] sm:inline', BADGE[x.status] || 'bg-surface-2 text-foreground-muted')}>{ROTULO[x.status] || x.status}</span>
                  <span className={cn('shrink-0 text-right font-heading text-[16px] font-semibold tabular-nums sm:w-28', t === 'receita' ? 'text-success-fg' : 'text-foreground')}>
                    {t === 'receita' ? '+' : '−'}{formatCurrency(x.valor)}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

export function DayDetailDialog({ open, onOpenChange, day }: DayDetailDialogProps) {
  if (!day) return null;
  const saldo = day.receitas - day.despesas;
  const dateFormatted = format(parseISO(day.date), "EEEE, d 'de' MMMM", { locale: ptBR });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[560px]')}>
        <ModalShell>
          <ModalHeader eyebrow="Lançamentos do dia" title={<span className="first-letter:uppercase">{dateFormatted}</span>} onClose={() => onOpenChange(false)} />
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 pb-safe md:p-5">
            <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-[13px] font-medium tabular-nums', saldo >= 0 ? 'bg-success-bg text-success-fg' : 'bg-danger-bg text-danger-fg')}>
              Saldo do dia: {formatCurrency(saldo)}
            </span>
            {day.items.length === 0
              ? <p className="py-4 text-center text-sm text-foreground-muted">Nenhum lançamento neste dia.</p>
              : <LancamentosDoDia day={day.date} items={day.items} />}
          </div>
        </ModalShell>
      </SheetContent>
    </Sheet>
  );
}
