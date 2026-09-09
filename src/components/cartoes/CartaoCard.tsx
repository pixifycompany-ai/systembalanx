import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCardIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/formatters';
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

export function CartaoCard({ cartao, faturaAtual, onPagar, onLancamentos, onImportCsv }: CartaoCardProps) {
  const limite = Number(cartao.limite || 0);
  const usado = faturaAtual ? Math.max(Number(faturaAtual.valor_total) - Number(faturaAtual.valor_pago), 0) : 0;
  const disponivel = Math.max(limite - usado, 0);
  const pct = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0;
  const cor = cartao.cor || '#7a2ea8';

  // Degradê 135° cor → cor-escura (mesma hue), igual ao .ccard do mockup.
  const cardFace = {
    background: `linear-gradient(135deg, ${cor} 0%, color-mix(in srgb, ${cor} 44%, #0b0712) 100%)`,
    boxShadow: '0 16px 34px -14px rgba(0,0,0,0.62)',
  } as const;

  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-[rgba(244,236,221,0.12)] px-4 pt-4 pb-3.5 text-[#fff5e9]"
      style={cardFace}
    >
      {/* Header — tocável abre o detalhe/lançamentos */}
      <button onClick={onLancamentos} className="relative flex w-full items-center gap-2.5 text-left">
        <div className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-white/[0.16]">
          <CreditCardIcon className="h-[18px] w-[18px] text-[#fff5e9]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-[660]">{cartao.nome}</div>
          <div className="truncate text-[10.5px] text-[rgba(255,245,233,0.7)]">
            {[cartao.bandeira, cartao.banco].filter(Boolean).join(' • ') || 'Cartão de crédito'}
          </div>
        </div>
      </button>

      {/* Fatura atual */}
      <div className="relative mt-3.5 text-[9.5px] uppercase tracking-[0.1em] text-[rgba(255,245,233,0.7)]">Fatura atual</div>
      <div className="relative mt-0.5 text-[24px] font-[680] tracking-[-0.02em] tabular-nums">{formatCurrency(usado)}</div>
      <div className="relative mt-[3px] text-[10.5px] text-[rgba(255,245,233,0.75)]">
        {faturaAtual
          ? `Vence em ${format(parseISO(faturaAtual.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}`
          : 'Sem lançamentos no ciclo atual'}
      </div>

      {/* Barra de limite */}
      {limite > 0 && (
        <>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.18]">
            <div className="h-full rounded-full bg-white/90" style={{ width: `${pct}%` }} />
          </div>
          <div className="relative mt-1.5 flex justify-between text-[10px] text-[rgba(255,245,233,0.72)]">
            <span>Disponível {formatCurrency(disponivel)}</span>
            <span>Limite {formatCurrency(limite)}</span>
          </div>
        </>
      )}

      {/* Ações */}
      <div className="relative mt-3 flex gap-1.5">
        <button
          onClick={onPagar}
          disabled={!faturaAtual || usado <= 0}
          className="flex-1 rounded-[11px] bg-[#eef2f8] px-1 py-2 text-center text-[10.5px] font-semibold text-[#241606] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Pagar fatura
        </button>
        <button
          onClick={onImportCsv}
          className="flex-1 rounded-[11px] bg-white/[0.14] px-1 py-2 text-center text-[10.5px] font-semibold text-[#fff5e9] hover:bg-white/20 transition-colors"
        >
          Importar CSV · IA
        </button>
      </div>
    </div>
  );
}
