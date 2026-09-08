import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCard, Pencil, Plus, Receipt, Sparkles, Trash2, Wallet } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import { melhorDiaDeCompra } from '@/utils/faturaCalculator';
import type { ContaDB } from '@/hooks/useContas';
import type { FaturaDB } from '@/hooks/useFaturas';

interface CartaoCardProps {
  cartao: ContaDB;
  faturaAtual?: FaturaDB | null;
  onEdit: () => void;
  onDelete: () => void;
  onPagar: () => void;
  onLancamentos: () => void;
  onNovoLancamento: () => void;
  onImportCsv?: () => void;
}

export function CartaoCard({ cartao, faturaAtual, onEdit, onDelete, onPagar, onLancamentos, onNovoLancamento, onImportCsv }: CartaoCardProps) {
  const limite = Number(cartao.limite || 0);
  const usado = faturaAtual ? Math.max(Number(faturaAtual.valor_total) - Number(faturaAtual.valor_pago), 0) : 0;
  const disponivel = Math.max(limite - usado, 0);
  const pct = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0;
  const cor = cartao.cor || '#3a78cd';

  // Face de cartão real: cor da marca (topo-esq) esvaindo para quase-preto — igual ccard do mockup.
  const cardFace = {
    background: `linear-gradient(140deg, color-mix(in srgb, ${cor} 82%, #06070d) 0%, color-mix(in srgb, ${cor} 30%, #06070d) 48%, #080a12 100%)`,
    boxShadow: '0 14px 30px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.14)',
  } as const;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-4 sm:p-5 text-white" style={cardFace}>
      {/* Brilho superior sutil */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{ background: 'radial-gradient(120% 80% at 85% 0%, rgba(255,255,255,0.10), transparent 55%)' }}
      />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="grid place-items-center w-9 h-9 rounded-xl flex-shrink-0 bg-white/12 backdrop-blur-sm">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate text-white">{cartao.nome}</h3>
              <p className="text-xs text-white/60 truncate">
                {[cartao.bandeira, cartao.banco].filter(Boolean).join(' • ') || 'Cartão de crédito'}
              </p>
            </div>
          </div>
          <div className="flex gap-0.5 flex-shrink-0">
            <button
              aria-label="Editar cartão"
              onClick={onEdit}
              className="grid place-items-center h-7 w-7 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              aria-label="Excluir cartão"
              onClick={onDelete}
              className="grid place-items-center h-7 w-7 rounded-lg text-white/70 hover:text-[#ff6b6b] hover:bg-white/10 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Valor */}
        <div className="mb-3">
          <p className="text-[10px] uppercase tracking-wide text-white/55">Fatura atual</p>
          <p className="text-2xl font-bold tabular-nums text-white">{formatCurrency(usado)}</p>
          {faturaAtual ? (
            <p className="text-xs text-white/60">
              Vence em {format(parseISO(faturaAtual.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}
            </p>
          ) : (
            <p className="text-xs text-white/60">Sem lançamentos no ciclo atual</p>
          )}
          {cartao.dia_fechamento ? (
            <p className="text-[11px] text-white/55 mt-0.5">
              Melhor dia de compra: <span className="font-medium text-white">{melhorDiaDeCompra(cartao.dia_fechamento)}</span>
            </p>
          ) : null}
        </div>

        {/* Progresso de limite */}
        {limite > 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-white/60">Limite usado</span>
              <span className="font-medium text-white">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
              <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5 text-[11px] text-white/60">
              <span>Disponível: {formatCurrency(disponivel)}</span>
              <span>Total: {formatCurrency(limite)}</span>
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2">
          <button
            onClick={onPagar}
            disabled={!faturaAtual || usado <= 0}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-white text-[#0a1120] text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/90 transition-colors"
          >
            <Wallet className="h-3.5 w-3.5" />
            Pagar fatura
          </button>
          <button
            aria-label="Novo lançamento"
            onClick={onNovoLancamento}
            className="grid place-items-center h-9 w-9 rounded-xl bg-white/12 text-white hover:bg-white/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
          </button>
          {onImportCsv && (
            <button
              aria-label="Importar CSV (IA categoriza)"
              onClick={onImportCsv}
              className="grid place-items-center h-9 w-9 rounded-xl bg-white/12 text-white hover:bg-white/20 transition-colors"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}
          <button
            aria-label="Ver lançamentos"
            onClick={onLancamentos}
            className="grid place-items-center h-9 w-9 rounded-xl bg-white/12 text-white hover:bg-white/20 transition-colors"
          >
            <Receipt className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
