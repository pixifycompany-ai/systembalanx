import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Par de botões redondos ‹ › para navegar entre meses/semanas/dias. */
export function CalNav({ onPrev, onNext }: { onPrev: () => void; onNext: () => void }) {
  const cls =
    'no-touch-min grid h-9 w-9 place-items-center rounded-full border border-border bg-surface text-foreground transition-colors hover:bg-surface-2';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={onPrev} aria-label="Anterior" className={cls}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button type="button" onClick={onNext} aria-label="Próximo" className={cls}>
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
