// src/components/ProtectedRoute.tsx
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';
import { InitializationStage } from '@/types/user';

interface PrivateRouteProps {
  children: ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { firebaseUser, user, loading, userLoading } = useAuth();

  // Show loading while checking auth state or fetching user data
  if (loading || userLoading) {
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

  // If no user data, redirect to signin (shouldn't happen but safety check)
  if (!user) {
    return <Navigate to="/auth/signin" replace />;
  }

  // If user hasn't completed onboarding, redirect to onboarding
  if (user.initialization_stage !== InitializationStage.COMPLETED) {
    return <Navigate to="/onboarding" replace />;
  }

  // If authenticated and onboarding complete, show the protected content
  return <>{children}</>;
};

export default PrivateRoute;
