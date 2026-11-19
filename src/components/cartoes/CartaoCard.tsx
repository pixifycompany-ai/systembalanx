import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
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

/** Situação da fatura atual para o selo do cartão. */
function situacao(f: FaturaDB | null | undefined, emAberto: number) {
  if (!f) return { txt: 'Sem fatura aberta', cls: 'bg-white/15 text-white' };
  const hoje = format(new Date(), 'yyyy-MM-dd');
  if (emAberto <= 0.009) return { txt: 'Fatura paga', cls: 'bg-emerald-300/90 text-emerald-950' };
  if (f.data_vencimento < hoje) return { txt: 'Vencida', cls: 'bg-rose-400 text-white' };
  if (f.status === 'fechada' || f.data_fechamento <= hoje) return { txt: `Fechada · pague até ${format(parseISO(f.data_vencimento), 'dd/MM')}`, cls: 'bg-amber-300/90 text-amber-950' };
  if (f.status === 'parcialmente_paga') return { txt: 'Parcialmente paga', cls: 'bg-white/15 text-white' };
  return { txt: 'Fatura aberta', cls: 'bg-white/15 text-white' };
}

export function CartaoCard({ cartao, faturaAtual, usado: usadoProp, onEdit, onDelete, onPagar, onLancamentos, onNovoLancamento, onImportCsv }: CartaoCardProps) {
  const limite = Number(cartao.limite || 0);
  const emAberto = faturaAtual ? Math.max(Number(faturaAtual.valor_total) - Number(faturaAtual.valor_pago), 0) : 0;
  // Limite USADO = TODAS as faturas em aberto (parcelas futuras também ocupam o limite).
  const usado = Math.max(usadoProp ?? -Number(cartao.saldo_atual ?? 0), 0);
  const livre = Math.max(limite - usado, 0);
  const pct = limite > 0 ? Math.min((usado / limite) * 100, 100) : 0;
  const cor = cartao.cor || '#7a2ea8';
  const brand = brandByName(cartao.bandeira);
  const sit = situacao(faturaAtual, emAberto);
  const mesFatura = faturaAtual ? format(parseISO(faturaAtual.competencia), 'MMMM', { locale: ptBR }) : '';

  return (
    <div className="overflow-hidden rounded-[26px] border border-border bg-surface">
      {/* face do cartão — abre a fatura */}
      <button type="button" onClick={onLancamentos} aria-label={`Ver fatura de ${cartao.nome}`}
        className="relative block w-full overflow-hidden p-5 text-left text-white"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, color-mix(in srgb, ${cor} 55%, #0b0712) 100%)`, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10)' }}>
        <span aria-hidden className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <span className="relative flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">{cartao.nome}</span>
            <span className="block truncate text-[12px] text-white/75">{[cartao.bandeira, cartao.banco].filter(Boolean).join(' · ') || 'Cartão de crédito'}</span>
          </span>
          <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px]', sit.cls)}>{sit.txt}</span>
        </span>
        <span className="relative mt-6 block text-[12px] capitalize text-white/70">{faturaAtual ? `Fatura de ${mesFatura}` : 'Fatura atual'}</span>
        <span className="relative block font-heading text-[30px] font-semibold tabular-nums tracking-[-0.03em]">{formatCurrency(emAberto)}</span>
        <span className="relative mt-1 flex items-end justify-between gap-3">
          <span className="text-[12px] text-white/75">
            {cartao.dia_fechamento ? `fecha dia ${cartao.dia_fechamento}` : ''}{cartao.dia_fechamento && cartao.dia_vencimento ? ' · ' : ''}{cartao.dia_vencimento ? `vence dia ${cartao.dia_vencimento}` : ''}
          </span>
          {brand && <BrandMark brand={brand} bg={cor} height={18} />}
        </span>
      </button>

      <div className="space-y-3 p-4">
        {limite > 0 ? (
          <div>
            <div className="flex justify-between text-[12.5px]"><span className="text-foreground-muted">Limite usado</span><span className="tabular-nums text-foreground"><b className="font-semibold">{formatCurrency(usado)}</b> de {formatCurrency(limite)}</span></div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"><div className={cn('h-full rounded-full', pct > 80 ? 'bg-danger-fg' : 'bg-primary')} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
            <p className="mt-1 text-[12px] text-foreground-muted">{formatCurrency(livre)} livres{usado > emAberto + 0.009 ? ` · inclui ${formatCurrency(usado - emAberto)} de parcelas futuras` : ''}</p>
          </div>
        ) : (
          <p className="text-[12.5px] text-foreground-muted">Sem limite cadastrado. <button type="button" onClick={onEdit} className="text-primary hover:underline">Informar limite</button></p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={onLancamentos} className="h-10 flex-1 rounded-full border border-border text-[13.5px] text-foreground hover:bg-surface-2">Ver fatura</button>
          <button type="button" onClick={onPagar} disabled={!faturaAtual || emAberto <= 0} className="h-10 flex-1 rounded-full bg-foreground text-[13.5px] font-medium text-background hover:opacity-90 disabled:opacity-40">Pagar</button>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Opções do cartão" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-foreground-muted hover:bg-surface-2"><MoreHorizontal className="h-4 w-4" /></button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 rounded-2xl border border-border bg-surface p-1.5">
              <button type="button" onClick={onNovoLancamento} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground hover:bg-surface-2"><Plus className="h-4 w-4 text-foreground-muted" />Lançar compra</button>
              {onImportCsv && <button type="button" onClick={onImportCsv} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground hover:bg-surface-2"><Sparkles className="h-4 w-4 text-foreground-muted" />Importar CSV · IA</button>}
              <button type="button" onClick={onEdit} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-foreground hover:bg-surface-2"><Pencil className="h-4 w-4 text-foreground-muted" />Editar cartão</button>
              <div className="my-1 h-px bg-border" />
              <button type="button" onClick={onDelete} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13.5px] text-danger-fg hover:bg-danger-bg"><Trash2 className="h-4 w-4" />Excluir cartão</button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
