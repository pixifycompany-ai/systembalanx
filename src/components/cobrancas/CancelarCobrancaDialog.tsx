// Cancelar uma cobrança com a escolha certa: só esta cobrança (a assinatura
// continua) ou encerrar a assinatura inteira — e, se quiser, tirar do histórico.
import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { Cobranca } from '@/hooks/useCobrancas';
import { ModalFooter, ModalHeader, ModalShell } from '@/components/reskin/kit';
import { btn, modalCls } from '@/components/reskin/estilos';

type Opcao = 'so-esta' | 'encerrar';

interface Props {
  cobranca: Cobranca | null;
  clienteNome?: string;
  onOpenChange: (open: boolean) => void;
  /** Cancela só esta cobrança (assinatura continua). */
  onCancelarSoEsta: (id: string) => Promise<void>;
  /** Cancela no Asaas (de assinatura: remove a assinatura) e mantém no histórico. */
  onCancelar: (id: string) => Promise<void>;
  /** Igual ao cancelar, mas apaga o registro do BALANX. */
  onExcluir: (id: string) => Promise<void>;
  /** Cobrança paga: remove só da lista (não mexe no Asaas). */
  onRemoverDoHistorico: (id: string) => Promise<void>;
}

export function CancelarCobrancaDialog({ cobranca, clienteNome, onOpenChange, onCancelarSoEsta, onCancelar, onExcluir, onRemoverDoHistorico }: Props) {
  const [opcao, setOpcao] = useState<Opcao>('so-esta');
  const [apagar, setApagar] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setOpcao('so-esta'); setApagar(false); }, [cobranca?.id]);

  const deAssinatura = !!cobranca?.asaas_subscription_id;
  const paga = cobranca?.status === 'pago';
  const aberta = cobranca?.status === 'pendente' || cobranca?.status === 'vencido';
  // "Só esta" só faz sentido em aberto; paga só sai do histórico.
  const efetiva: Opcao = deAssinatura && aberta ? opcao : 'encerrar';

  const confirmar = async () => {
    if (!cobranca) return;
    setBusy(true);
    try {
      if (paga) await onRemoverDoHistorico(cobranca.id);
      else if (efetiva === 'so-esta') await onCancelarSoEsta(cobranca.id);
      else if (apagar) await onExcluir(cobranca.id);
      else await onCancelar(cobranca.id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const Escolha = ({ valor, titulo, texto }: { valor: Opcao; titulo: string; texto: string }) => {
    const ativo = opcao === valor;
    return (
      <button
        type="button"
        onClick={() => setOpcao(valor)}
        aria-pressed={ativo}
        className={cn('w-full rounded-[20px] border p-4 text-left transition-colors',
          ativo ? 'border-foreground bg-foreground text-background' : 'border-border bg-surface hover:bg-surface-2')}
      >
        <span className="block text-[14px] font-medium">{titulo}</span>
        <span className={cn('mt-0.5 block text-[12.5px] leading-snug', ativo ? 'text-background/70' : 'text-foreground-muted')}>{texto}</span>
      </button>
    );
  };

  const titulo = paga ? 'Remover cobrança paga' : 'Cancelar cobrança';

  return (
    <Sheet open={!!cobranca} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <SheetContent side="bottom" showHandle showClose={false} className={modalCls('sm:max-w-[480px]')}>
        <SheetTitle className="sr-only">{titulo}</SheetTitle>
        {cobranca && (
          <ModalShell>
            <ModalHeader
              eyebrow={`${[clienteNome, cobranca.descricao].filter(Boolean).join(' · ')} · ${formatCurrency(Number(cobranca.valor))} · vence ${formatDate(cobranca.vencimento)}`}
              title={titulo}
              onClose={() => !busy && onOpenChange(false)}
            />
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 md:p-5">
              {paga ? (
                <p className="flex gap-2 rounded-2xl bg-warning-bg px-3.5 py-3 text-[13px] leading-snug text-warning-fg">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Essa cobrança já foi paga: ela some só da lista de cobranças. O recebimento continua no financeiro.
                </p>
              ) : deAssinatura && aberta ? (
                <div className="space-y-2">
                  <Escolha valor="so-esta" titulo="Cancelar só esta cobrança"
                    texto={`A de ${formatDate(cobranca.vencimento)} some do Asaas. A assinatura continua cobrando os próximos meses.`} />
                  <Escolha valor="encerrar" titulo="Encerrar a assinatura inteira"
                    texto="Para de cobrar todo mês no Asaas. Para parar só por um tempo, use Pausar no contrato." />
                </div>
              ) : (
                <p className="rounded-2xl bg-surface-2/70 px-3.5 py-3 text-[13px] leading-snug text-foreground-muted">
                  A cobrança some do Asaas e o lançamento a receber criado por ela sai do financeiro.
                </p>
              )}

              {efetiva === 'encerrar' && !paga && (
                <label className="flex items-center justify-between gap-3 rounded-[20px] border border-border bg-surface px-4 py-3">
                  <span>
                    <span className="block text-[13.5px] text-foreground">Apagar também do histórico</span>
                    <span className="block text-[12px] text-foreground-muted">Senão ela continua na lista como "Cancelada"</span>
                  </span>
                  <Switch checked={apagar} onCheckedChange={setApagar} aria-label="Apagar também do histórico" />
                </label>
              )}
            </div>
            <ModalFooter>
              <button type="button" className={btn.outline} onClick={() => onOpenChange(false)} disabled={busy}>Voltar</button>
              <button
                type="button"
                className={cn(btn.primary, efetiva === 'encerrar' && !paga && 'bg-danger-fg text-white')}
                onClick={confirmar}
                disabled={busy}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {paga ? 'Remover' : efetiva === 'so-esta' ? 'Cancelar esta' : deAssinatura ? 'Encerrar assinatura' : 'Cancelar cobrança'}
              </button>
            </ModalFooter>
          </ModalShell>
        )}
      </SheetContent>
    </Sheet>
  );
}
