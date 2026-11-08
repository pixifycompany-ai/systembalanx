import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { formatCurrency } from '@/utils/formatters';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';
import { NAVY_SURFACE_BG, NAVY_SURFACE_SHADOW, NAVY_TONE } from '@/components/shared/navyTokens';
import { HexWatermark } from '@/components/shared/NavySurface';
import { AnexosDespesa } from './AnexosDespesa';

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
  /** Quando presente, mostra "Gerar cobrança no Asaas" (receita em aberto). */
  onGerarCobranca?: (t: TransacaoUnificada) => void;
  /** Anexos da despesa mudaram (recarrega a lista). */
  onAnexosChange?: () => void;
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
  onGerarCobranca,
  onAnexosChange,
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
      <SheetContent side="bottom" showHandle className="p-0 max-h-[92dvh] overflow-y-auto rounded-t-[26px] border-t border-border bg-surface sm:max-w-[560px] sm:mx-auto">
        {/* Header */}
        <div className="px-5 pt-1 pb-3">
          <div className="text-[12px] font-medium text-foreground-muted">
            {statusLabel[t.status] || t.status} · {format(parseISO(t.data_vencimento), "dd MMM", { locale: ptBR })}
          </div>
          <h2 className="mt-0.5 truncate text-[22px] font-semibold tracking-[-0.02em] text-foreground">
            {clienteNome || t.descricao}
          </h2>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Card de valor (bloco navy de destaque) */}
          <div
            className="relative isolate overflow-hidden rounded-[20px] p-5 text-center text-white"
            style={{ background: NAVY_SURFACE_BG, boxShadow: NAVY_SURFACE_SHADOW }}
          >
            <HexWatermark />
            <div className="text-[12px] font-medium text-white/70">{isReceita ? 'Receita' : 'Despesa'}</div>
            <div
              className="mt-1 font-heading text-[30px] font-semibold tabular-nums tracking-[-0.02em]"
              style={{ color: isReceita ? NAVY_TONE.success : NAVY_TONE.danger }}
            >
              {isReceita ? '+' : '−'}{formatCurrency(t.valor)}
            </div>
            <span
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold text-white"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: settled ? NAVY_TONE.success : t.status === 'atrasado' ? NAVY_TONE.danger : NAVY_TONE.warning }}
                aria-hidden
              />
              {statusLabel[t.status] || t.status}
            </span>
          </div>

          {/* Linhas */}
          <div className="overflow-hidden rounded-[20px] border border-border bg-surface px-4">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
                <div className="min-w-0">
                  <div className="text-[12px] text-foreground-muted">{r.label}</div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{r.value}</div>
                </div>
                {r.dot && <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.dot }} />}
              </div>
            ))}
          </div>

          {/* Boleto/nota da despesa a pagar: some sozinho quando ela é paga */}
          {t.tabela_origem === 'despesas' && !settled && (
            <AnexosDespesa key={t.id} despesaId={t.id} inicial={t.anexos ?? []} onChange={onAnexosChange} />
          )}

          {onGerarCobranca && (
            <button
              onClick={() => { onOpenChange(false); onGerarCobranca(t); }}
              className="h-11 w-full rounded-full border border-border bg-surface text-[13px] font-semibold text-primary transition-colors hover:bg-surface-2"
            >
              Gerar cobrança no Asaas
            </button>
          )}

          {/* Footer */}
          <div className="flex gap-2.5 pt-1">
            <button
              onClick={() => { onOpenChange(false); onDelete(t); }}
              className="h-11 flex-[0_0_40%] rounded-full bg-danger-bg text-[13px] font-semibold text-danger-fg"
            >
              Excluir
            </button>
            <button
              onClick={() => { onOpenChange(false); onEdit(t); }}
              className={cn('h-11 flex-1 rounded-full bg-primary text-[13px] font-semibold text-primary-foreground')}
            >
              Editar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
