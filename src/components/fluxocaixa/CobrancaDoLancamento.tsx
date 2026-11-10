import { useEffect, useState } from 'react';
import { Link2, Loader2, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { COBRANCA_STATUS_LABEL } from '@/hooks/useCobrancas';
import { VinculoPickerSheet } from '@/components/cobrancas/VinculoPickerSheet';
import {
  cobrancaDaReceita, desvincularCobranca, opcoesCobrancas, vincularCobrancaReceita, type CobrancaVinculada,
} from '@/lib/vinculoCobranca';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';

interface Props {
  receita: TransacaoUnificada;
  /** Mudou o vínculo (recarrega a lista; valor/vencimento podem ter mudado). */
  onChange?: () => void;
  /** Avisa se há cobrança ligada (o detalhe esconde "Gerar cobrança"). */
  onVinculo?: (temCobranca: boolean) => void;
}

/** No detalhe do lançamento: mostra a cobrança ligada e permite vincular, trocar ou desfazer. */
export function CobrancaDoLancamento({ receita, onChange, onVinculo }: Props) {
  const [cob, setCob] = useState<CobrancaVinculada | null | undefined>(undefined);
  const [picker, setPicker] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [busy, setBusy] = useState(false);

  const carregar = async () => {
    const c = await cobrancaDaReceita(receita.id);
    setCob(c);
    onVinculo?.(!!c);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregar(); }, [receita.id]);

  const desvincular = async () => {
    if (!cob) return;
    if (!confirmar) { setConfirmar(true); return; }
    setConfirmar(false);
    setBusy(true);
    try {
      await desvincularCobranca(cob.id);
      toast.success('Cobrança desvinculada. O lançamento continua no fluxo de caixa.');
      await carregar();
      onChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desvincular');
    } finally {
      setBusy(false);
    }
  };

  if (cob === undefined) return null;
  const st = cob ? COBRANCA_STATUS_LABEL[cob.status] : null;

  return (
    <>
      <div className="overflow-hidden rounded-[20px] border border-border bg-surface px-4 py-3">
        <div className="text-[12px] text-foreground-muted">Cobrança</div>
        {cob ? (
          <>
            <div className="mt-0.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-foreground">{cob.descricao || 'Cobrança'}</div>
                <div className="text-[12px] text-foreground-muted">
                  {formatCurrency(cob.valor)} · vence {formatDate(cob.vencimento)}{st ? ` · ${st.label}` : ''}
                </div>
              </div>
            </div>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => setPicker(true)}
                className="h-9 flex-1 rounded-full border border-border text-[12.5px] font-semibold text-foreground transition-colors hover:bg-surface-2"
              >
                Trocar cobrança
              </button>
              <button
                onClick={desvincular}
                onBlur={() => setConfirmar(false)}
                disabled={busy}
                className={cn(
                  'inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[12.5px] font-semibold transition-colors',
                  confirmar ? 'bg-danger-bg text-danger-fg' : 'border border-border text-foreground-muted hover:bg-danger-bg hover:text-danger-fg',
                )}
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                {confirmar ? 'Confirmar?' : 'Desvincular'}
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setPicker(true)}
            className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-dashed border-border-strong text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-2"
          >
            <Link2 className="h-4 w-4" /> Vincular a uma cobrança
          </button>
        )}
      </div>

      <VinculoPickerSheet
        open={picker}
        onOpenChange={setPicker}
        title={cob ? 'Trocar cobrança' : 'Vincular a uma cobrança'}
        subtitle={`Escolha a cobrança deste lançamento (${formatCurrency(receita.valor)}, vence ${formatDate(receita.data_vencimento)}).`}
        tipoItem="cobrança"
        carregar={() => opcoesCobrancas({ id: receita.id, cliente_id: receita.cliente_id, valor: receita.valor, data_vencimento: receita.data_vencimento })}
        onEscolher={async (op) => {
          try {
            const r = await vincularCobrancaReceita(op.id, receita.id);
            toast.success('Cobrança vinculada.', {
              description: r.outrasSoltas ? 'A cobrança saiu do lançamento anterior.' : undefined,
            });
            await carregar();
            onChange?.();
            return true;
          } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Erro ao vincular');
            return false;
          }
        }}
      />
    </>
  );
}
