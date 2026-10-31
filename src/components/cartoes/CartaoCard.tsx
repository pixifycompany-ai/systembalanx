import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreVertical, Pencil, Trash2, Sparkles } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { BrandMark, brandByName } from '@/lib/cardBrands';
import { formatCurrency } from '@/utils/formatters';
import { cn } from '@/lib/utils';
import type { ContaDB } from '@/hooks/useContas';
import type { FaturaDB } from '@/hooks/useFaturas';

interface CartaoCardProps {
  cartao: ContaDB;
  faturaAtual?: FaturaDB | null;
  /** Limite usado = soma do que está em aberto em TODAS as faturas não pagas.
   *  Derivado das faturas na página (fresco/consistente). Fallback: saldo_atual. */
  usado?: number;
  onEdit: () => void;
  onDelete: () => void;
  onPagar: () => void;
  onLancamentos: () => void;
  onNovoLancamento: () => void;
  onImportCsv?: () => void;
}

export function CartaoCard({ cartao, faturaAtual, usado: usadoProp, onEdit, onDelete, onPagar, onLancamentos, onImportCsv }: CartaoCardProps) {
  const limite = Number(cartao.limite || 0);
  // Valor da fatura ATUAL (para o bloco "Fatura atual" e o botão Pagar).
  const faturaAtualValor = faturaAtual ? Math.max(Number(faturaAtual.valor_total) - Number(faturaAtual.valor_pago), 0) : 0;
  // Limite USADO = TODAS as faturas em aberto (parcelas futuras também ocupam o
  // limite). Pagar uma fatura reduz esse total → libera o limite. Usa o valor
  // vindo das faturas (fresco); se ausente, cai no saldo_atual do cartão.
  const usado = Math.max(usadoProp ?? -Number(cartao.saldo_atual ?? 0), 0);
  const disponivel = Math.max(limite - usado, 0);
  const pct = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0;
  const cor = cartao.cor || '#7a2ea8';
  const brand = brandByName(cartao.bandeira);

  // Arte do cartão físico: degradê da cor do cartão, sem glow (só um contorno interno sutil).
  const cardFace = {
    background: `linear-gradient(135deg, ${cor} 0%, color-mix(in srgb, ${cor} 44%, #0b0712) 100%)`,
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)',
  } as const;

  return (
    <div className="flex flex-col rounded-[20px] border border-border bg-surface p-2 md:rounded-3xl">
      {/* Arte do cartão — tocável abre o detalhe/lançamentos */}
      <div className="relative isolate overflow-hidden rounded-[16px] text-white md:rounded-[18px]" style={cardFace}>
        {/* Menu (editar / excluir) — fora do botão da arte pra não aninhar <button> */}
        <div className="absolute right-2.5 top-2.5 z-20">
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="Opções do cartão"
                className="no-touch-min grid h-8 w-8 place-items-center rounded-full bg-black/20 text-white transition-colors hover:bg-black/30"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-44 rounded-2xl border border-border bg-surface p-1.5">
              <button onClick={onEdit} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-2">
                <Pencil className="h-4 w-4 text-foreground-muted" /> Editar cartão
              </button>
              <button onClick={onDelete} className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm text-[hsl(var(--danger-fg))] transition-colors hover:bg-danger-bg">
                <Trash2 className="h-4 w-4" /> Excluir cartão
              </button>
            </PopoverContent>
          </Popover>
        </div>

        <button onClick={onLancamentos} className="relative flex w-full flex-col px-4 pb-4 pt-4 text-left" aria-label={`Ver faturas de ${cartao.nome}`}>
          <div className="min-w-0 pr-10">
            <div className="truncate text-[15px] font-semibold">{cartao.nome}</div>
            <div className="truncate text-[12px] text-white/75">
              {[cartao.bandeira, cartao.banco].filter(Boolean).join(' • ') || 'Cartão de crédito'}
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between gap-3">
            <span className="font-mono text-[13px] tracking-[0.18em] text-white/80">•••• ••••</span>
            {brand && <BrandMark brand={brand} bg={cor} height={18} />}
          </div>

          {/* Barra de limite */}
          {limite > 0 && (
            <div className="mt-4 w-full">
              <div className="flex justify-between text-[11px] text-white/75">
                <span>Utilizado <b className="font-semibold tabular-nums text-white">{formatCurrency(usado)}</b></span>
                <span>Disponível <b className="font-semibold tabular-nums text-white">{formatCurrency(disponivel)}</b></span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/25">
                <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-1.5 text-right text-[11px] text-white/75">Limite {formatCurrency(limite)}</div>
            </div>
          )}
        </button>
      </div>

      {/* Fatura atual — sobre a superfície lisa */}
      <div className="flex flex-1 flex-col px-2.5 pb-2 pt-4 md:px-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-foreground-muted">Fatura atual</span>
          {faturaAtual && (
            <span
              className={cn(
                'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                faturaAtualValor > 0 ? 'bg-warning-bg text-warning-fg' : 'bg-success-bg text-success-fg',
              )}
            >
              {faturaAtualValor > 0 ? 'Em aberto' : 'Quitada'}
            </span>
          )}
        </div>
        <div className="mt-1.5 font-heading text-[26px] font-semibold leading-none tabular-nums tracking-[-0.02em] text-foreground">
          {formatCurrency(faturaAtualValor)}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[12px] text-foreground-muted">
          <span className="truncate">
            {faturaAtual
              ? `Vence em ${format(parseISO(faturaAtual.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}`
              : 'Sem lançamentos no ciclo atual'}
          </span>
          <button onClick={onLancamentos} className="no-touch-min shrink-0 text-[13px] font-medium text-foreground-muted transition-colors hover:text-foreground">
            Ver fatura
          </button>
        </div>

        {/* Ações */}
        <div className="mt-4 flex gap-2">
          <Button
            onClick={onPagar}
            disabled={!faturaAtual || faturaAtualValor <= 0}
            className="flex-1 px-3 text-[13px]"
          >
            Pagar fatura
          </Button>
          <Button variant="outline" onClick={onImportCsv} className="flex-1 px-3 text-[13px]">
            <Sparkles className="hidden h-4 w-4 2xl:block" />Importar CSV · IA
          </Button>
        </div>
      </div>
    </div>
  );
}
