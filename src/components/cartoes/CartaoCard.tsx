import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditCard, Pencil, Plus, Receipt, Sparkles, Trash2, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/shared/IconButton';
import { Progress } from '@/components/ui/progress';
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

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border p-4 sm:p-5 text-foreground shadow-sm transition hover:shadow-md"
      style={{
        background: `linear-gradient(135deg, ${cartao.cor}15 0%, hsl(var(--surface-2)) 100%)`,
      }}
    >
      {/* Faixa de cor */}
      <div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: cartao.cor }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="grid place-items-center w-9 h-9 rounded-lg flex-shrink-0"
            style={{ backgroundColor: `${cartao.cor}20` }}
          >
            <CreditCard className="w-5 h-5" style={{ color: cartao.cor }} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">{cartao.nome}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {[cartao.bandeira, cartao.banco].filter(Boolean).join(' • ') || 'Cartão de crédito'}
            </p>
          </div>
        </div>
        <div className="flex gap-1 flex-shrink-0">
          <IconButton label="Editar cartão" tooltipSide="top" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Excluir cartão" tooltipSide="top" emphasis="destructive" className="h-7 w-7" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Valor */}
      <div className="mb-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Fatura atual</p>
        <p className="text-2xl font-bold tabular-nums">{formatCurrency(usado)}</p>
        {faturaAtual ? (
          <p className="text-xs text-muted-foreground">
            Vence em {format(parseISO(faturaAtual.data_vencimento), "dd 'de' MMMM", { locale: ptBR })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Sem lançamentos no ciclo atual</p>
        )}
        {cartao.dia_fechamento ? (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Melhor dia de compra: <span className="font-medium text-foreground">{melhorDiaDeCompra(cartao.dia_fechamento)}</span>
          </p>
        ) : null}
      </div>

      {/* Progresso de limite */}
      {limite > 0 && (
        <div className="mb-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">Limite usado</span>
            <span className="font-medium">{pct.toFixed(0)}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
          <div className="flex justify-between mt-1 text-[11px] text-muted-foreground">
            <span>Disponível: {formatCurrency(disponivel)}</span>
            <span>Total: {formatCurrency(limite)}</span>
          </div>
        </div>
      )}

      {/* Ações */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1"
          onClick={onPagar}
          disabled={!faturaAtual || usado <= 0}
        >
          <Wallet className="h-3.5 w-3.5 mr-1" />
          Pagar fatura
        </Button>
        <IconButton label="Novo lançamento" emphasis="primary" onClick={onNovoLancamento} className="h-9 w-9">
          <Plus className="h-4 w-4" />
        </IconButton>
        {onImportCsv && (
          <IconButton label="Importar CSV (IA categoriza)" variant="outline" onClick={onImportCsv} className="h-9 w-9">
            <Sparkles className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton label="Ver lançamentos" variant="outline" onClick={onLancamentos} className="h-9 w-9">
          <Receipt className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}
