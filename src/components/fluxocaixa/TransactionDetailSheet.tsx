import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { formatCurrency } from '@/utils/formatters';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';

interface Row {
  label: string;
  value: string;
  dot?: string;
}

interface TransactionDetailSheetProps {
  transaction: TransacaoUnificada | null;
  contaNome?: string;
  categoriaNome?: string;
  categoriaCor?: string;
  clienteNome?: string;
  formaLabel?: string;
  onOpenChange: (o: boolean) => void;
  onEdit: (t: TransacaoUnificada) => void;
  onDelete: (t: TransacaoUnificada) => void;
}

const statusLabel: Record<string, string> = {
  recebido: 'Recebido', pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado',
};

export function TransactionDetailSheet({
  transaction: t,
  contaNome,
  categoriaNome,
  categoriaCor,
  clienteNome,
  formaLabel,
  onOpenChange,
  onEdit,
  onDelete,
}: TransactionDetailSheetProps) {
  if (!t) return null;
  const isReceita = t.tipo === 'entrada';
  const settled = t.status === 'recebido' || t.status === 'pago';

  const rows: Row[] = [
    { label: 'Descrição', value: t.descricao },
    { label: 'Categoria', value: categoriaNome || 'Sem categoria', dot: categoriaCor },
    { label: 'Conta', value: contaNome || '—' },
    ...(clienteNome ? [{ label: 'Cliente', value: clienteNome }] : []),
    ...(formaLabel ? [{ label: 'Forma de pagamento', value: formaLabel }] : []),
    { label: 'Vencimento', value: format(parseISO(t.data_vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) },
  ];

  return (
    <Sheet open={!!t} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showHandle className="p-0 max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border/60 bg-surface/[0.55] backdrop-blur-2xl backdrop-saturate-[1.8] sm:max-w-[560px] sm:mx-auto">
        {/* Header */}
        <div className="px-5 pt-1 pb-3">
          <div className="text-[11.5px] font-medium text-foreground-muted">
            {statusLabel[t.status] || t.status} · {format(parseISO(t.data_vencimento), "dd MMM", { locale: ptBR })}
          </div>
          <h2 className="mt-0.5 truncate text-[22px] font-[670] tracking-[-0.02em] text-foreground uppercase">
            {clienteNome || t.descricao}
          </h2>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Card de valor */}
          <div
            className="auro-card relative overflow-hidden rounded-[22px] border border-border/60 p-5 text-center"
            style={{
              background: isReceita
                ? 'linear-gradient(150deg, hsl(152 55% 32% / 0.9), hsl(152 45% 16% / 0.85))'
                : 'linear-gradient(150deg, hsl(4 70% 42% / 0.9), hsl(4 55% 20% / 0.85))',
            }}
          >
            <div className="text-[30px] font-[700] tabular-nums text-white">
              {isReceita ? '+' : '−'}{formatCurrency(t.valor)}
            </div>
            <span className="mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white">
              {statusLabel[t.status] || t.status}
            </span>
          </div>

          {/* Linhas */}
          <div className="auro-card overflow-hidden rounded-2xl border border-border/60 bg-surface/55 divide-y divide-border/50">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[11px] text-foreground-muted">{r.label}</div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{r.value}</div>
                </div>
                {r.dot && <span className="h-3.5 w-3.5 shrink-0 rounded-[5px]" style={{ background: r.dot }} />}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={() => { onOpenChange(false); onDelete(t); }}
              className="flex-[0_0_40%] rounded-[14px] bg-surface-2 py-3 text-[13px] font-semibold text-[hsl(var(--danger))]"
            >
              Excluir
            </button>
            <button
              onClick={() => { onOpenChange(false); onEdit(t); }}
              className={cn(
                'flex-1 rounded-[14px] py-3 text-[13px] font-semibold text-white',
                'bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))]',
              )}
            >
              Editar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
