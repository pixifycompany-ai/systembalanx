import { useLocation } from 'react-router-dom';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { NotificationBell } from './NotificationBell';

const routeLabels: Record<string, { group: string; label: string }> = {
  '/': { group: 'Visão geral', label: 'Dashboard' },
  '/calendario': { group: 'Visão geral', label: 'Calendário' },
  '/fluxo-caixa': { group: 'Financeiro', label: 'Fluxo de Caixa' },
  '/relatorios': { group: 'Análise', label: 'Relatórios' },
  '/analises': { group: 'Análise', label: 'Análises' },
  '/clientes': { group: 'Comercial', label: 'Clientes' },
  '/contratos': { group: 'Comercial', label: 'Contratos' },
  '/contas': { group: 'Cadastros', label: 'Contas Bancárias' },
  '/categorias': { group: 'Cadastros', label: 'Categorias' },
  '/configuracoes': { group: 'Sistema', label: 'Configurações' },
};

export function Header() {
  const location = useLocation();
  const route = routeLabels[location.pathname];
  const showBreadcrumb = location.pathname !== '/';

  return (
    <header
      className="sticky top-0 z-40 hidden md:flex items-center justify-between gap-2 px-3 md:px-6 md:border-b md:border-border md:bg-background/80 md:backdrop-blur-md"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        height: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
      }}
    >
      {/* Desktop: trigger do sidebar + breadcrumb. Mobile: sem hambúrguer/título (o cabeçalho da tela já traz o título, igual mockup) */}
      <div className="hidden md:flex items-center gap-2 min-w-0 flex-1">
        <SidebarTrigger className="text-foreground-muted hover:text-foreground shrink-0" />
        {showBreadcrumb && route && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="text-foreground-muted">{route.group}</span>
            <span className="text-foreground-subtle">/</span>
            <span className="text-foreground font-medium truncate">{route.label}</span>
          </nav>
        )}
      </div>
      <div className="md:hidden flex-1" />

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        <NotificationBell />
      </div>
    </header>
  );
}
