import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
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
              
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
