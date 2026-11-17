// Cancelar uma cobrança com a escolha certa: só esta cobrança (a assinatura
// continua) ou encerrar a assinatura inteira — e, se quiser, tirar do histórico.
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/utils/formatters';
import type { Cobranca } from '@/hooks/useCobrancas';

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
  if (!cobranca) return null;

  const deAssinatura = !!cobranca.asaas_subscription_id;
  const paga = cobranca.status === 'pago';
  const aberta = cobranca.status === 'pendente' || cobranca.status === 'vencido';
  // "Só esta" só faz sentido em aberto; paga só sai do histórico.
  const efetiva: Opcao = deAssinatura && aberta ? opcao : 'encerrar';

  const confirmar = async () => {
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

  const Escolha = ({ valor, titulo, texto }: { valor: Opcao; titulo: string; texto: string }) => (
    <button
      type="button"
      onClick={() => setOpcao(valor)}
      className={cn('w-full rounded-2xl border p-3.5 text-left transition-colors',
        opcao === valor ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-2')}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn('grid h-5 w-5 shrink-0 place-items-center rounded-full border-2', opcao === valor ? 'border-primary' : 'border-border-strong')}>
          {opcao === valor && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
        </span>
        <span className="text-[14px] font-semibold text-foreground">{titulo}</span>
      </div>
      <p className="mt-1 pl-[30px] text-[12.5px] leading-snug text-foreground-muted">{texto}</p>
    </button>
  );

  return (
    <Dialog open={!!cobranca} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md rounded-[24px]">
        <DialogHeader>
          <DialogTitle>{paga ? 'Remover cobrança paga' : 'Cancelar cobrança'}</DialogTitle>
          <DialogDescription>
            {[clienteNome, cobranca.descricao].filter(Boolean).join(' · ')} — {formatCurrency(Number(cobranca.valor))}, vence {formatDate(cobranca.vencimento)}
          </DialogDescription>
        </DialogHeader>

        {paga ? (
          <p className="rounded-2xl bg-warning-bg px-3.5 py-3 text-[13px] text-warning-fg">
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
          <p className="text-[13px] text-foreground-muted">
            A cobrança some do Asaas e o lançamento a receber criado por ela sai do financeiro.
          </p>
        )}

        {efetiva === 'encerrar' && !paga && (
          <label className="flex items-start gap-2.5 px-1 text-[13px] text-foreground">
            <input type="checkbox" className="mt-0.5" checked={apagar} onChange={(e) => setApagar(e.target.checked)} />
            <span>Apagar também do histórico do BALANX <span className="text-foreground-muted">(senão ela fica como "Cancelada")</span></span>
          </label>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={busy}>Voltar</Button>
          <Button
            className={cn('flex-1', efetiva === 'encerrar' && 'bg-danger-fg text-white hover:bg-danger-fg/90')}
            onClick={confirmar}
            disabled={busy}
          >
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {paga ? 'Remover' : efetiva === 'so-esta' ? 'Cancelar esta' : deAssinatura ? 'Encerrar assinatura' : 'Cancelar cobrança'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
