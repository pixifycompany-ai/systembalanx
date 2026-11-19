import { useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { OlhoValores } from '@/components/shared/OlhoValores';
import { rotaInfo } from './navItems';

/** Barra de cima do desktop: breadcrumb + ocultar valores + notificações. No celular cada tela traz o próprio título. */
export function Header() {
  const { pathname } = useLocation();
  const rota = rotaInfo(pathname);

  return (
    <header
      // Transparente, sem borda nem desfoque: a grade do fundo passa por trás.
      className="sticky top-0 z-40 hidden items-center justify-between gap-3 bg-transparent px-10 md:flex"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)', height: 'calc(3.5rem + env(safe-area-inset-top, 0px))' }}
    >
      <div className="min-w-0 flex-1">
        {rota && (
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-[13px]">
            <span className="text-foreground-muted">{rota.grupo}</span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground-subtle" />
            <span className="truncate text-foreground">{rota.label}</span>
          </nav>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <OlhoValores className="h-9 w-9 rounded-full border-0 bg-transparent text-foreground-muted hover:bg-surface-2 hover:text-foreground [&>svg]:h-[18px] [&>svg]:w-[18px]" />
        <NotificationBell />
      </div>
    </header>
  );
}
