import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight } from 'lucide-react';
import { usePendencias } from '@/hooks/usePendencias';

/** Aviso discreto no Início quando há pendências; leva para a tela de Pendências. */
export function PendenciasAviso() {
  const { pendencias, total } = usePendencias();
  if (!total) return null;
  const risco = pendencias.filter((p) => p.bloco === 'risco').length;
  return (
    <Link
      to="/pendencias"
      className="mb-4 flex items-center gap-3 rounded-[20px] border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2 md:mb-6"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-warning-bg text-warning-fg">
        <AlertTriangle className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-[13px] text-foreground">
        <b className="font-semibold">{total} {total === 1 ? 'pendência' : 'pendências'}</b>
        {risco > 0 && <span className="text-foreground-muted"> · {risco} com dinheiro em risco</span>}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-foreground-muted" />
    </Link>
  );
}
