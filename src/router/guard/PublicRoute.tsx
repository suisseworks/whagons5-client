import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
// import { useAuthStore } from "../../features/auth/hooks/useAuthStore";
import { useAuth } from '../../context/AuthContext';
import { api } from '@/api';
import { User, InitializationStage } from '@/types/user';

interface PublicRouteProps {
  children: ReactNode;
}

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/users/me');
        if (response.status === 200) {
          setUser(response.data);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchUserData();
    }
  }, [firebaseUser, authLoading]);

  // While loading auth state or user data, show loading
  if (authLoading || loading) {
    return <div>Loading...</div>;
  }

  // If not authenticated, show public route content
  if (!firebaseUser) {
    return <>{children}</>;
  }

  // If authenticated but user data couldn't be fetched, show error
  if (!user) {
    return <div>Error loading user data</div>;
  }

  // If user needs onboarding and not already on onboarding page, redirect to onboarding
  if (user.initialization_stage !== InitializationStage.COMPLETED && 
      location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If user has completed onboarding and tries to access onboarding, redirect to home
  if (user.initialization_stage === InitializationStage.COMPLETED && 
      location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  // If user is authenticated and has completed onboarding, redirect to home
  return user.initialization_stage === InitializationStage.COMPLETED ? 
    <Navigate to="/" replace /> : 
    <>{children}</>;
};

export default PublicRoute;
