import { useEffect, useLayoutEffect, useState } from 'react';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { PullToRefresh } from './PullToRefresh';
import { BuscaRapida } from './BuscaRapida';
import { Navigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';
import { ligarMascara } from '@/lib/ocultarValores';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { acessoAtivo, loading: tenantLoading, memberships, isSuperadmin } = useTenant();
  const [busca, setBusca] = useState(false);

  // Layout effect: esconde os valores antes da 1ª pintura da tela
  useLayoutEffect(() => ligarMascara(), []);

  // ⌘K / Ctrl+K abre a busca rápida em qualquer tela
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setBusca((v) => !v); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Sem nenhuma conta (cadastro interrompido no meio) → volta pro onboarding
  if (!tenantLoading && memberships.length === 0 && !isSuperadmin) {
    return <Navigate to="/onboarding" replace />;
  }

  // Gate de assinatura: acesso expirado (trial acabou, não é cortesia nem ativa) → assinatura
  if (!tenantLoading && !acessoAtivo) {
    return <Navigate to="/assinatura" replace />;
  }

  return (
    <PullToRefresh>
      <div className="flex min-h-dvh w-full">
        <AppSidebar onBusca={() => setBusca(true)} />
        <div className="flex min-w-0 flex-1 flex-col bg-transparent">
          <Header />
          <main className="app-safe-top max-w-full flex-1 overflow-x-hidden px-3 py-3 pb-24 md:px-10 md:pb-8 md:pt-4">
            {children}
          </main>
        </div>
        <MobileBottomNav onBusca={() => setBusca(true)} />
      </div>
      <BuscaRapida open={busca} onOpenChange={setBusca} />
    </PullToRefresh>
  );
}
