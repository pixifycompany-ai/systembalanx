import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { PullToRefresh } from './PullToRefresh';
import { useNavigate } from 'react-router-dom';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const navigate = useNavigate();

  const handleNewEntrada = () => navigate('/fluxo-caixa?action=nova-entrada');
  const handleNewSaida = () => navigate('/fluxo-caixa?action=nova-saida');
  const handleNewTransferencia = () => navigate('/fluxo-caixa?action=nova-transferencia');

  return (
    <PullToRefresh>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
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
