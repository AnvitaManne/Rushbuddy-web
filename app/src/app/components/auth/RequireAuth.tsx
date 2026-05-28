import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../context/AppContext';

/** Redirects unauthenticated users to the auth flow. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || !user?.verified) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  if (!isAuthenticated || !user?.verified) {
    return null;
  }

  return <>{children}</>;
}
