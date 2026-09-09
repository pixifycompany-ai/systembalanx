import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { PullToRefresh } from './PullToRefresh';
import { useNavigate, Navigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();
  const { acessoAtivo, loading: tenantLoading } = useTenant();

  // Gate de assinatura: acesso expirado (trial acabou, não é cortesia nem ativa) → assinatura
  if (!tenantLoading && !acessoAtivo) {
    return <Navigate to="/assinatura" replace />;
  }

  const handleNewEntrada = () => navigate('/fluxo-caixa?action=nova-entrada');
  const handleNewSaida = () => navigate('/fluxo-caixa?action=nova-saida');
  const handleNewTransferencia = () => navigate('/fluxo-caixa?action=nova-transferencia');

  return (
    <PullToRefresh>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-transparent">

          <Header />
          <main className="flex-1 px-3 py-3 md:px-10 md:py-8 pb-24 md:pb-8 overflow-x-hidden max-w-full">
            {children}
          </main>
        </SidebarInset>
        <MobileBottomNav
          onNewEntrada={handleNewEntrada}
          onNewSaida={handleNewSaida}
          onNewTransferencia={handleNewTransferencia}
        />
      </SidebarProvider>
    </PullToRefresh>
  );
}
