import { useEffect, useRef, useState } from 'react';
import { CometSpinner } from '@/components/shared/BalanxLoader';
import { ArrowDownIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

const THRESHOLD = 72;
const MAX_PULL = 110;

/** Puxe-para-atualizar no topo da lista (mobile), igual iOS. */
export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;

    const setP = (v: number) => { pullRef.current = v; setPull(v); };

    const onStart = (e: TouchEvent) => {
      if (refreshingRef.current || !atTop()) return;
      startY.current = e.touches[0].clientY;
      pulling.current = true;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling.current) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || !atTop()) { pulling.current = false; setP(0); return; }
      e.preventDefault();
      setP(Math.min(dy * 0.5, MAX_PULL));
    };
    const onEnd = async () => {
      if (!pulling.current) return;
      pulling.current = false;
      if (pullRef.current >= THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setP(52);
        try { await onRefresh(); } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setP(0);
        }
      } else {
        setP(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [onRefresh]);

  const ready = pull >= THRESHOLD;

  return (
    <div ref={ref} className={cn('relative', className)}>
      {/* Indicador */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center justify-center"
        style={{ top: 0, height: pull, width: 40, transform: `translate(-50%, ${Math.max(pull - 40, -8)}px)`, opacity: pull > 6 ? 1 : 0 }}
      >
        {refreshing ? (
          <CometSpinner size={26} />
        ) : (
          <ArrowDownIcon
            className={cn('h-5 w-5 text-foreground-muted transition-transform', ready && 'rotate-180 text-primary')}
          />
        )}
      </div>
      {/* Conteúdo */}
      <div style={{ transform: `translateY(${pull}px)`, transition: pulling.current ? 'none' : 'transform 0.25s ease' }}>
        {children}
      </div>
    </div>
  );
}
