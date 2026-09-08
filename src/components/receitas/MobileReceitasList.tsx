import { useMemo, useRef, useState, useCallback } from 'react';
import { format, parseISO, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmptyState } from '@/components/shared/EmptyState';
import { SkeletonTable } from '@/components/shared/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { haptic } from '@/lib/haptics';
import { Check, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Receita {
  id: string;
  descricao: string;
  valor: number;
  data_vencimento: string;
  status: 'pendente' | 'recebido' | 'atrasado';
  cliente?: { nome: string } | null;
  categoria?: { nome: string; cor: string } | null;
}

interface MobileReceitasListProps {
  receitas: Receita[];
  isLoading: boolean;
  onEdit: (r: Receita) => void;
  onConfirm: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

function formatDateHeader(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return `Hoje, ${format(date, "d 'de' MMMM", { locale: ptBR })}`;
  return format(date, "EEE., d 'de' MMMM", { locale: ptBR });
}

function SwipeCard({ item, onConfirm, onDelete, onClick }: { item: Receita; onConfirm: (id: string) => void; onDelete: (id: string) => void; onClick: (r: Receita) => void }) {
  const [offsetX, setOffsetX] = useState(0);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isHorizontal = useRef<boolean | null>(null);
  const isSettled = item.status === 'recebido';
  const THRESHOLD = 80;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isDragging.current = false;
    isHorizontal.current = null;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (isHorizontal.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
      isHorizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!isHorizontal.current) return;
    isDragging.current = true;
    if (dx > 0 && isSettled) { setOffsetX(0); return; }
    setOffsetX(Math.max(-120, Math.min(120, dx)));
  }, [isSettled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    if (offsetX > THRESHOLD && !isSettled) { haptic(15); onConfirm(item.id); }
    else if (offsetX < -THRESHOLD) { haptic([10, 30, 10]); onDelete(item.id); }
    setOffsetX(0);
    isDragging.current = false;
    isHorizontal.current = null;
  }, [offsetX, isSettled, onConfirm, onDelete, item.id]);

  const handleClick = useCallback(() => { if (!isDragging.current) onClick(item); }, [onClick, item]);

  const badge = (() => {
    if (item.status === 'recebido') return { label: 'Recebido', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' };
    if (item.status === 'atrasado') return { label: 'Atrasado', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' };
    return { label: 'Não recebido', cls: 'bg-red-500/15 text-red-600 dark:text-red-400' };
  })();

  const catColor = item.categoria?.cor || 'hsl(var(--muted-foreground))';

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-0 flex">
        <div className={cn("flex items-center justify-start pl-5 w-1/2 transition-colors", offsetX > THRESHOLD / 2 ? "bg-emerald-500" : "bg-emerald-500/60")}>
          <Check className="h-6 w-6 text-white" />
        </div>
        <div className={cn("flex items-center justify-end pr-5 w-1/2 transition-colors", offsetX < -THRESHOLD / 2 ? "bg-red-500" : "bg-red-500/60")}>
          <Trash2 className="h-6 w-6 text-white" />
        </div>
      </div>
      <div
        className="relative flex items-center gap-3 p-3 bg-card border border-border/50 rounded-lg transition-transform duration-150 ease-out active:bg-accent/30"
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: `${catColor}20`, color: catColor }}>
          {item.categoria?.nome?.charAt(0)?.toUpperCase() || '↑'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate text-foreground">{item.descricao}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[11px] text-muted-foreground truncate">{item.cliente?.nome || '-'}</span>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", badge.cls)}>{badge.label}</span>
          </div>
        </div>
        <span className="text-[15px] font-semibold shrink-0 tabular-nums text-emerald-600 dark:text-emerald-400">
          {formatCurrency(Number(item.valor))}
        </span>
      </div>
    </div>
  );
}

export function MobileReceitasList({ receitas, isLoading, onEdit, onConfirm, onDelete, onNew }: MobileReceitasListProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Receita[]>();
    for (const r of receitas) {
      const key = r.data_vencimento;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [receitas]);

  if (isLoading) return <SkeletonTable rows={5} />;

  if (receitas.length === 0) {
    return (
      <EmptyState emoji="📊" title="Nenhuma receita encontrada" description="Crie sua primeira receita."
        action={<Button onClick={onNew} className="gap-2"><Plus className="h-4 w-4" />Nova Receita</Button>}
      />
    );
  }

  return (
    <div className="space-y-1">
      {grouped.map(([date, items]) => (
        <div key={date}>
          <div className="px-1 py-2">
            <span className="text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">
              {formatDateHeader(date)}
            </span>
          </div>
          <div className="space-y-1.5">
            {items.map((r) => (
              <SwipeCard key={r.id} item={r} onConfirm={onConfirm} onDelete={onDelete} onClick={onEdit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
