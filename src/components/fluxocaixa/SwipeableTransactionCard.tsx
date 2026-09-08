import { useRef, useState, useCallback } from 'react';
import { Check, Trash2, ArrowLeftRight } from 'lucide-react';
import { formatCurrency } from '@/utils/formatters';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';
import { EmpresaFonteBadge, type EmpresaFonte } from '@/components/shared/EmpresaFonteBadge';

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

  const statusBadge = () => {
    if (isTransfer) return { label: 'Transferência', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' };
    const s = t.status;
    if (s === 'recebido') return { label: 'Recebido', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
    if (s === 'pago') return { label: 'Pago', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
    if (s === 'atrasado') return { label: 'Atrasado', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' };
    if (s === 'pendente') {
      const label = t.tipo === 'entrada' ? 'Não recebido' : 'Não pago';
      return { label, cls: 'bg-red-500/15 text-red-600 dark:text-red-400' };
    }
    return { label: s, cls: 'bg-muted text-muted-foreground' };
  };

  const badge = statusBadge();
  const catColor = t.categoria?.cor || 'hsl(var(--muted-foreground))';

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
        {/* Category icon */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold",
            isTransfer && "bg-blue-500/15 text-blue-600 dark:text-blue-400"
          )}
          style={isTransfer ? undefined : { backgroundColor: `${catColor}20`, color: catColor }}
        >
          {isTransfer ? (
            <ArrowLeftRight className="h-4 w-4" />
          ) : (
            t.categoria?.nome?.charAt(0)?.toUpperCase() || (t.tipo === 'entrada' ? '↑' : '↓')
          )}
        </div>

        {/* Description & meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-foreground">{t.descricao}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {contaNome && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                {contaCor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: contaCor }} />}
                {contaNome}
              </span>
            )}
            {contaNome && <span className="text-[11px] text-muted-foreground">·</span>}
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", badge.cls)}>
              {badge.label}
            </span>
            {t.cliente?.empresa_fonte && (
              <EmpresaFonteBadge empresa={t.cliente.empresa_fonte as EmpresaFonte} size="xs" />
            )}
          </div>
        </div>

        {/* Value */}
        <span className={cn(
          "text-[15px] font-semibold shrink-0 tabular-nums",
          isTransfer
            ? 'text-muted-foreground'
            : t.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
        )}>
          {isTransfer ? '' : (t.tipo === 'entrada' ? '+' : '-')}{formatCurrency(t.valor)}
        </span>
      </div>
    </div>
  );
}
