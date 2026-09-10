import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BalanxLoader } from "@/components/shared/BalanxLoader";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "./pages/Dashboard";
import Receitas from "./pages/Receitas";
import Despesas from "./pages/Despesas";
import FluxoCaixa from "./pages/FluxoCaixa";
import Clientes from "./pages/Clientes";
import Contratos from "./pages/Contratos";
import Calendario from "./pages/Calendario";
import Relatorios from "./pages/Relatorios";
import Categorias from "./pages/Categorias";
import Contas from "./pages/Contas";
import Analises from "./pages/Analises";
import Visao from "./pages/Visao";
import MeuPerfil from "./pages/MeuPerfil";

import Login from "./pages/Login";
import CriarConta from "./pages/CriarConta";
import EsqueciSenha from "./pages/EsqueciSenha";
import RedefinirSenha from "./pages/RedefinirSenha";
import Onboarding from "./pages/Onboarding";
import Iara from "./pages/Iara";
import Superadmin from "./pages/Superadmin";
import LancarVoz from "./pages/LancarVoz";
import Assinatura from "./pages/Assinatura";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

/** Splash de abertura (cold start): mostra o BalanxLoader por um tempo mínimo a cada load da página. */
function BootSplash({ children }: { children: React.ReactNode }) {
  const [booting, setBooting] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 1400);
    return () => clearTimeout(t);
  }, []);
  if (booting) return <BalanxLoader />;
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TenantProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BootSplash>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/criar-conta" element={<CriarConta />} />
              <Route path="/esqueci-senha" element={<EsqueciSenha />} />
              <Route path="/redefinir-senha" element={<RedefinirSenha />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
              <Route path="/fluxo-caixa" element={<ProtectedRoute><AppLayout><FluxoCaixa /></AppLayout></ProtectedRoute>} />
              <Route path="/analises" element={<ProtectedRoute><AppLayout><Analises /></AppLayout></ProtectedRoute>} />
              <Route path="/visao" element={<ProtectedRoute><AppLayout><Visao /></AppLayout></ProtectedRoute>} />
              <Route path="/calendario" element={<ProtectedRoute><AppLayout><Calendario /></AppLayout></ProtectedRoute>} />
              <Route path="/relatorios" element={<ProtectedRoute><AppLayout><Relatorios /></AppLayout></ProtectedRoute>} />
              <Route path="/receitas" element={<ProtectedRoute><AppLayout><Receitas /></AppLayout></ProtectedRoute>} />
              <Route path="/despesas" element={<ProtectedRoute><AppLayout><Despesas /></AppLayout></ProtectedRoute>} />
              <Route path="/clientes" element={<ProtectedRoute><AppLayout><Clientes /></AppLayout></ProtectedRoute>} />
              <Route path="/contratos" element={<ProtectedRoute><AppLayout><Contratos /></AppLayout></ProtectedRoute>} />
              <Route path="/categorias" element={<ProtectedRoute><AppLayout><Categorias /></AppLayout></ProtectedRoute>} />
              <Route path="/contas" element={<ProtectedRoute><AppLayout><Contas /></AppLayout></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><AppLayout><MeuPerfil /></AppLayout></ProtectedRoute>} />
              <Route path="/iara" element={<ProtectedRoute><AppLayout><Iara /></AppLayout></ProtectedRoute>} />
              <Route path="/superadmin" element={<ProtectedRoute><Superadmin /></ProtectedRoute>} />
              <Route path="/lancar-voz" element={<ProtectedRoute><LancarVoz /></ProtectedRoute>} />
              <Route path="/assinatura" element={<ProtectedRoute><Assinatura /></ProtectedRoute>} />
              
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
          </BootSplash>
        </TooltipProvider>
        </TenantProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
