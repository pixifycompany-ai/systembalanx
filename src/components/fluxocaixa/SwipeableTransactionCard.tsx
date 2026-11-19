import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, User, Store, Paperclip } from 'lucide-react';
import { EyeIcon, DocumentDuplicateIcon, TrashIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/utils/formatters';
import type { TransacaoUnificada } from '@/types/fluxoCaixa';
import { cn } from '@/lib/utils';
import { TipoIcone } from './TipoIcone';
import { serieDe, statusInfo } from './lancamento';

interface SwipeableTransactionCardProps {
  transaction: TransacaoUnificada;
  contaNome?: string;
  contaCor?: string;
  saldoCorrente?: number;
  onConfirm: (t: TransacaoUnificada) => void;
  onDelete: (t: TransacaoUnificada) => void;
  onClick: (t: TransacaoUnificada) => void;
  onDuplicate?: (t: TransacaoUnificada) => void;
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
  saldoCorrente,
  onConfirm,
  onDelete,
  onClick,
  onDuplicate,
}: SwipeableTransactionCardProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);

  const clearLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };
  const openMenu = useCallback(() => {
    setOffsetX(0);
    setMenuOpen(true);
    suppressClick.current = true;
    try { navigator.vibrate?.(12); } catch { /* noop */ }
  }, []);

  const isTransfer = t.tabela_origem === 'transferencia';
  const isSettled = isTransfer || t.status === 'recebido' || t.status === 'pago';

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = false;
    isHorizontal.current = null;
    suppressClick.current = false;
    clearLongPress();
    longPressTimer.current = setTimeout(() => { if (!isDragging.current) openMenu(); }, 480);
  }, [openMenu]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;

    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearLongPress();

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
    clearLongPress();
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
    if (suppressClick.current) { suppressClick.current = false; return; }
    if (!isDragging.current && offsetX === 0) {
      onClick(t);
    }
  }, [onClick, t, offsetX]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    openMenu();
  }, [openMenu]);


  const leftPillWidth = offsetX > 0 && !isSettled ? Math.min(offsetX, ACTION_WIDTH) : 0;
  const rightPillWidth = offsetX < 0 ? Math.min(-offsetX, ACTION_WIDTH) : 0;
  const leftReady = leftPillWidth >= THRESHOLD;
  const rightReady = rightPillWidth >= THRESHOLD;

  const isEntrada = t.tipo === 'entrada';
  const valueTint = isTransfer
    ? 'text-foreground-muted'
    : isEntrada ? 'text-success-fg' : 'text-danger-fg';
  const valorLabel = `${isTransfer ? '' : (isEntrada ? '+' : '−')}${formatCurrency(t.valor)}`;
  const parte = !isTransfer ? (t.cliente?.nome || (t.fornecedor && !t.fornecedor.startsWith('[') ? t.fornecedor : undefined)) : undefined;
  const st = statusInfo(t);
  const { base } = serieDe(t.descricao);
  const subTexto = isTransfer
    ? [t.conta_origem?.nome, t.conta_destino?.nome].filter(Boolean).join(' → ')
    : [parte, contaNome].filter(Boolean).join(' · ');

  return (
    <div className="group relative overflow-hidden">
      {/* Ação à esquerda — dar baixa */}
      <div
        className={cn(
          'absolute inset-y-0 left-0 flex items-center justify-center overflow-hidden transition-colors',
          leftReady ? 'bg-success text-background' : 'bg-success-bg text-success-fg',
        )}
        style={{ width: leftPillWidth }}
      >
        {leftPillWidth > 24 && <Check className="h-5 w-5 shrink-0" strokeWidth={2.4} />}
      </div>

      {/* Ação à direita — excluir */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-center overflow-hidden transition-colors',
          rightReady ? 'bg-danger text-background' : 'bg-danger-bg text-danger-fg',
        )}
        style={{ width: rightPillWidth }}
      >
        {rightPillWidth > 24 && <Trash2 className="h-5 w-5 shrink-0" />}
      </div>

      {/* Linha do lançamento (desliza) */}
      <div
        ref={cardRef}
        className="relative bg-surface px-3.5 transition-transform duration-150 ease-out active:bg-surface-2"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        <div className="flex items-center gap-3 border-b border-border py-3">
          <TipoIcone t={t} className="h-9 w-9" />

          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <p className="flex min-w-0 items-center gap-1 text-[14.5px] font-medium leading-tight text-foreground">
              <span className="truncate">{base}</span>
              {!!t.anexos?.length && <Paperclip className="h-3.5 w-3.5 shrink-0 text-foreground-muted" aria-label={`${t.anexos.length} anexo(s)`} />}
            </p>
            <p className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-foreground-muted">
              {parte && (t.cliente?.nome ? <User className="h-3 w-3 shrink-0" /> : <Store className="h-3 w-3 shrink-0" />)}
              <span className="truncate">{subTexto || t.categoria?.nome || ''}</span>
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={cn('whitespace-nowrap font-heading text-[14.5px] font-semibold tabular-nums tracking-[-0.02em]', valueTint)}>
              {valorLabel}
            </span>
            <span className={cn('whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px]', st.cls)}>{st.txt}</span>
          </div>
        </div>
      </div>

      {/* Menu de contexto (long-press / right-click) — portal p/ escapar do overflow/transform */}
      {menuOpen && createPortal(
        <div className="fixed inset-0 z-[70]" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute inset-x-3 bottom-4 overflow-hidden rounded-[24px] border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
          >
            {/* Preview do lançamento */}
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <TipoIcone t={t} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{base}</p>
                <p className="truncate text-[12px] text-foreground-muted">
                  {[contaNome, st.txt, typeof saldoCorrente === 'number' && isSettled ? `saldo ${formatCurrency(saldoCorrente)}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={cn('whitespace-nowrap font-heading text-[15px] font-semibold tabular-nums tracking-[-0.02em]', valueTint)}>
                {valorLabel}
              </span>
            </div>
            {/* Ações */}
            <button onClick={() => { setMenuOpen(false); onClick(t); }} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium text-foreground active:bg-foreground/[0.04]">
              <EyeIcon className="h-5 w-5 text-foreground-muted" /> Ver detalhe
            </button>
            {onDuplicate && !isTransfer && (
              <button onClick={() => { setMenuOpen(false); onDuplicate(t); }} className="flex w-full items-center gap-3 border-t border-border px-4 py-3.5 text-left text-sm font-medium text-foreground active:bg-foreground/[0.04]">
                <DocumentDuplicateIcon className="h-5 w-5 text-foreground-muted" /> Duplicar
              </button>
            )}
            <button onClick={() => { setMenuOpen(false); onDelete(t); }} className="flex w-full items-center gap-3 border-t border-border px-4 py-3.5 text-left text-sm font-semibold text-[hsl(var(--danger-fg))] active:bg-foreground/[0.04]">
              <TrashIcon className="h-5 w-5" /> Excluir
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
