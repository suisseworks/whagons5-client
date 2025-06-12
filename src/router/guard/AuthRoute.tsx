import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '@/api';

interface AuthRouteProps {
  children: ReactNode;
}

export const AuthRoute: React.FC<AuthRouteProps> = ({ children }) => {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        await api.get('/users/me');
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      checkAuth();
    }
  }, [firebaseUser, authLoading]);

  // Show loading while checking auth state
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If not authenticated, redirect to signin
  if (!firebaseUser) {
    return <Navigate to="/auth/signin" replace />;
  }

  // If authenticated, show the content
  return <>{children}</>;
};

export default AuthRoute;

