import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { alternarValores, useValoresOcultos } from '@/lib/ocultarValores';

/** Botão do olhinho: mostra/esconde os valores em todo o app. */
export function OlhoValores({ className }: { className?: string }) {
  const oculto = useValoresOcultos();
  const Icone = oculto ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={alternarValores}
      aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}
      aria-pressed={!oculto}
      title={oculto ? 'Mostrar valores' : 'Ocultar valores'}
      className={cn('grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface text-foreground transition-colors hover:bg-surface-2', className)}
    >
      <Icone className="h-5 w-5" />
    </button>
  );
}
