import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../providers/AuthProvider';

interface AuthRouteProps {
  children: ReactNode;
}

export const AuthRoute: React.FC<AuthRouteProps> = ({ children }) => {
  const { firebaseUser, user, loading: authLoading, userLoading } = useAuth();

  // Show loading while checking auth state or fetching user data
  // Important: allow background user refetches without flashing a full-screen loader.
  // Only block when we truly don't have user data yet.
  if (authLoading || (userLoading && !user)) {
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

