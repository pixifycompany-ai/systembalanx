import { useEffect, useRef, useState, ReactNode } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  children: ReactNode;
  /** Pixels of pull needed to trigger refresh */
  threshold?: number;
  /** Max pixels the indicator can travel */
  maxPull?: number;
}

/**
 * Native-style pull-to-refresh wrapper.
 * Activates only when the document is scrolled to the very top and the user
 * drags down. On release past the threshold, reloads the page (which always
 * pulls the freshest build in the PWA shortcut since we use no service worker).
 */
export function PullToRefresh({ children, threshold = 70, maxPull = 140 }: PullToRefreshProps) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);
  const pullRef = useRef(0);

  useEffect(() => {
    pullRef.current = pull;
  }, [pull]);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      // Only start when at the very top of the page
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop > 0 || refreshing) {
        startY.current = null;
        tracking.current = false;
        return;
      }
      startY.current = e.touches[0].clientY;
      tracking.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking.current || startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      // Rubber-band resistance
      const resisted = Math.min(maxPull, dy * 0.5);
      setPull(resisted);
    };

    const onTouchEnd = async () => {
      if (!tracking.current) return;
      tracking.current = false;
      const current = pullRef.current;
      startY.current = null;
      if (current >= threshold) {
        setRefreshing(true);
        setPull(threshold);
        // small delay so the user sees the spinner before reload
        setTimeout(() => window.location.reload(), 250);
      } else {
        setPull(0);
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [threshold, maxPull, refreshing]);

  const progress = Math.min(1, pull / threshold);
  const ready = pull >= threshold;

  return (
    <>
      <div
        className={cn(
          'pointer-events-none fixed left-0 right-0 top-0 z-[60] flex items-center justify-center',
          'transition-opacity',
          pull > 0 ? 'opacity-100' : 'opacity-0'
        )}
        style={{ height: `${pull}px` }}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground/90 text-background shadow-lg">
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowDown
              className={cn('h-4 w-4 transition-transform', ready && 'rotate-180')}
              style={{ opacity: 0.4 + 0.6 * progress }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          transform: pull > 0 ? `translateY(${pull}px)` : undefined,
          transition: tracking.current ? 'none' : 'transform 200ms ease-out',
        }}
      >
        {children}
      </div>
    </>
  );
}
