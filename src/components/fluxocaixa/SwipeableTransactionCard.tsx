import { useRef, useState, useCallback } from 'react';
import { parseISO } from 'date-fns';
import { Check, Trash2, ArrowUpRight, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';

function statusLabel(t: TransacaoUnificada): string {
  if (t.tabela_origem === 'transferencia') return 'Transferência';
  const map: Record<string, string> = { recebido: 'Recebido', pago: 'Pago', pendente: 'Pendente', atrasado: 'Atrasado' };
  return map[t.status] || t.status;
}

function metaVencimento(dateStr?: string): string {
  if (!dateStr) return '';
  const d = parseISO(dateStr); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return `atrasado ${Math.abs(diff)}d`;
  if (diff === 0) return 'vence hoje';
  if (diff === 1) return 'vence amanhã';
  return `vence em ${diff}d`;
}

interface SwipeableTransactionCardProps {
  transaction: TransacaoUnificada;
  contaNome?: string;
  contaCor?: string;
  onConfirm: (t: TransacaoUnificada) => void;
  onDelete: (t: TransacaoUnificada) => void;
  onClick: (t: TransacaoUnificada) => void;
}

// iOS Mail-style thresholds
const THRESHOLD = 64;      // reveal "ready" state
const FULL_SWIPE = 120;    // fire without release
const INTENT_GUARD = 12;
const MAX_PULL = 140;
const ACTION_WIDTH = 96;   // action pill saturates at this width

export function SwipeableTransactionCard({
  transaction: t,
  contaNome,
  contaCor,
  onConfirm,
  onDelete,
  onClick,
}: SwipeableTransactionCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const isTransfer = t.tabela_origem === 'transferencia';
  const isSettled = isTransfer || t.status === 'recebido' || t.status === 'pago';

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = false;
    isHorizontal.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (isHorizontal.current === null) {
      if (Math.abs(dx) < INTENT_GUARD && Math.abs(dy) < INTENT_GUARD) return;
      if (Math.abs(dx) <= Math.abs(dy) * 1.3 || Math.abs(dx) < INTENT_GUARD) {
        isHorizontal.current = false;
        return;
      }
      isHorizontal.current = true;
    }

    if (!isHorizontal.current) return;

    isDragging.current = true;
    if (dx > 0 && isSettled) {
      setOffsetX(0);
      return;
    }

    const sign = dx < 0 ? -1 : 1;
    const abs = Math.abs(dx);
    let value: number;
    if (abs <= THRESHOLD) {
      value = abs;
    } else {
      const over = abs - THRESHOLD;
      value = THRESHOLD + over * 0.5;
    }
    value = Math.min(MAX_PULL, value) * sign;
    setOffsetX(value);
  }, [isSettled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;

    // Fire on either full swipe OR passing threshold on release (iOS Mail-like)
    if ((offsetX > FULL_SWIPE || offsetX > THRESHOLD) && !isSettled && offsetX > 0) {
      onConfirm(t);
    } else if (offsetX < -FULL_SWIPE || offsetX < -THRESHOLD) {
      onDelete(t);
    }

    setOffsetX(0);
    isDragging.current = false;
    isHorizontal.current = null;
  }, [offsetX, isSettled, onConfirm, onDelete, t]);

  const handleClick = useCallback(() => {
    if (!isDragging.current && offsetX === 0) {
      onClick(t);
    }
  }, [onClick, t, offsetX]);


  const leftPillWidth = offsetX > 0 && !isSettled ? Math.min(offsetX, ACTION_WIDTH) : 0;
  const rightPillWidth = offsetX < 0 ? Math.min(-offsetX, ACTION_WIDTH) : 0;
  const leftReady = leftPillWidth >= THRESHOLD;
  const rightReady = rightPillWidth >= THRESHOLD;

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Left action pill - confirm */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 flex items-center justify-center rounded-lg transition-colors overflow-hidden",
          leftReady ? "bg-emerald-500" : "bg-emerald-500/70"
        )}
        style={{ width: leftPillWidth }}
      >
        {leftPillWidth > 24 && <Check className="h-5 w-5 text-white shrink-0" />}
      </div>

      {/* Right action pill - delete */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 flex items-center justify-center rounded-lg transition-colors overflow-hidden",
          rightReady ? "bg-red-500" : "bg-red-500/70"
        )}
        style={{ width: rightPillWidth }}
      >
        {rightPillWidth > 24 && <Trash2 className="h-5 w-5 text-white shrink-0" />}
      </div>

      {/* Card content */}
      <div
        ref={cardRef}
        className="relative flex items-center gap-3 p-3 bg-card border border-border/50 rounded-lg transition-transform duration-150 ease-out active:bg-accent/30"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        {/* Avatar quadrado (igual HTML: seta verde/vermelha) */}
        <div className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
          isTransfer ? "bg-primary/15 text-primary"
            : t.tipo === 'entrada' ? "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]"
              : "bg-[hsl(var(--danger))]/15 text-[hsl(var(--danger))]",
        )}>
          {isTransfer ? <CreditCard className="h-[18px] w-[18px]" /> : <ArrowUpRight className="h-[18px] w-[18px]" />}
        </div>

        {/* Descrição + conta · status */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-foreground">{t.descricao}</p>
          <p className="text-[11px] text-foreground-muted truncate mt-0.5">
            {[contaNome, statusLabel(t)].filter(Boolean).join(' · ')}
          </p>
        </div>

        {/* Valor + meta */}
        <div className="text-right shrink-0">
          <div className={cn(
            "text-[15px] font-semibold tabular-nums",
            isTransfer ? 'text-foreground-muted'
              : t.tipo === 'entrada' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--danger))]',
          )}>
            {isTransfer ? '' : (t.tipo === 'entrada' ? '+' : '−')}{formatCurrency(t.valor)}
          </div>
          {!isSettled && (
            <div className="text-[11px] text-foreground-muted mt-0.5">{metaVencimento(t.data_vencimento)}</div>
          )}
        </div>
      </div>
    </div>
  );
}
