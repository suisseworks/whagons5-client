// src/components/ProtectedRoute.tsx
import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '@/api';
import { User, InitializationStage } from '@/types/user';

interface PrivateRouteProps {
  children: ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
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
          console.log('Full response:', response);
          console.log('User data:', response.data.data);
          console.log('Initialization stage:', response.data.data.initialization_stage);
          console.log('Is completed?', response.data.data.initialization_stage === InitializationStage.COMPLETED);
          setUserData(response.data.data);
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

  // Show loading while checking auth state or fetching user data
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

  // If authenticated but user data couldn't be fetched, show error
  if (!userData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            Error loading user data
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Debug log for current state
  console.log('Current path:', location.pathname);
  console.log('Current initialization stage:', userData.initialization_stage);
  console.log('Is completed?', userData.initialization_stage === InitializationStage.COMPLETED);

  // If user needs onboarding and not already on onboarding page, redirect to onboarding
  if (Number(userData.initialization_stage) !== InitializationStage.COMPLETED && 
      location.pathname !== '/onboarding') {
    console.log('Redirecting to onboarding - stage not completed');
    return <Navigate to="/onboarding" replace />;
  }

  // If user has completed onboarding and tries to access onboarding, redirect to home
  if (Number(userData.initialization_stage) === InitializationStage.COMPLETED && 
      location.pathname === '/onboarding') {
    console.log('Redirecting to home - stage completed but on onboarding page');
    return <Navigate to="/" replace />;
  }

  // If user is authenticated and has completed onboarding, show the protected content
  const isCompleted = Number(userData.initialization_stage) === InitializationStage.COMPLETED;
  console.log('Final check - is completed?', isCompleted);
  
  return isCompleted ? 
    <>{children}</> : 
    <Navigate to="/onboarding" replace />;
};

export default PrivateRoute;
