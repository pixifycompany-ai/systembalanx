import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, ExternalLink, RefreshCw, XCircle, Trash2, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COBRANCA_STATUS_LABEL, type Cobranca } from '@/hooks/useCobrancas';

const FORMAS: { value: string; label: string }[] = [
  { value: 'UNDEFINED', label: 'Cliente escolhe' },
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
];

const toneCls: Record<string, string> = {
  success: 'bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]',
  warning: 'bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))]',
  danger: 'bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]',
  muted: 'bg-white/8 text-foreground-muted',
};

interface Props {
  contratoId: string;
  cobranca?: Cobranca;
  busy?: boolean;
  onCobrar: (forma: string) => void;
  onCancelar: () => void;
  onExcluir: () => void;
  onSincronizar: () => void;
}

export function ContratoCobrancaCell({ contratoId, cobranca, busy, onCobrar, onCancelar, onExcluir, onSincronizar }: Props) {
  if (busy) {
    return <span className="inline-flex items-center gap-1.5 text-xs text-foreground-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> …</span>;
  }

  // Sem cobrança → botão "Cobrar" que abre as formas de pagamento
  if (!cobranca) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-surface/60 px-2.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur-xl transition-colors hover:bg-surface-2">
            <Zap className="h-3.5 w-3.5 text-primary" /> Cobrar via Asaas
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-52 p-1.5 rounded-xl border border-border/60 bg-surface/95 backdrop-blur-2xl">
          <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">Forma de pagamento</p>
          {FORMAS.map((f) => (
            <button
              key={f.value}
              onClick={() => onCobrar(f.value)}
              className="flex w-full items-center rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5"
            >
              {f.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    );
  }

  const meta = COBRANCA_STATUS_LABEL[cobranca.status] ?? { label: cobranca.status, tone: 'muted' as const };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-opacity hover:opacity-80', toneCls[meta.tone])}>
          {meta.label}
          {cobranca.tipo === 'recorrente' && <RefreshCw className="h-3 w-3 opacity-70" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1.5 rounded-xl border border-border/60 bg-surface/95 backdrop-blur-2xl">
        {cobranca.invoice_url && (
          <a
            href={cobranca.invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-white/5"
          >
            <ExternalLink className="h-4 w-4 text-foreground-muted" /> Abrir link de pagamento
          </a>
        )}
        <button onClick={onSincronizar} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
          <RefreshCw className="h-4 w-4 text-foreground-muted" /> Sincronizar status
        </button>
        <button onClick={onCancelar} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-white/5">
          <XCircle className="h-4 w-4 text-foreground-muted" /> Cancelar cobrança
        </button>
        <button onClick={onExcluir} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-[hsl(var(--danger))] transition-colors hover:bg-[hsl(var(--danger))]/10">
          <Trash2 className="h-4 w-4" /> Excluir cobrança
        </button>
      </PopoverContent>
    </Popover>
  );
}
