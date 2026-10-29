import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BalanxLoader } from '@/components/shared/BalanxLoader';
import { MfaGate } from '@/components/auth/MfaGate';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <BalanxLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Exige o 2º fator (se o usuário tiver 2FA ativo). Sem 2FA, passa direto.
  return <MfaGate>{children}</MfaGate>;
}
