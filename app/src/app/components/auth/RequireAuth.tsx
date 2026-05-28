import { Navigate } from 'react-router';
import { useApp } from '../../context/AppContext';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useApp();
  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
