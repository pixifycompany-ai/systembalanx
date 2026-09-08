import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { BalanxLoader } from '@/components/shared/BalanxLoader';

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

  return <>{children}</>;
}
