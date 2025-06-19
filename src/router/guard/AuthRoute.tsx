import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface AuthRouteProps {
  children: ReactNode;
}

export const AuthRoute: React.FC<AuthRouteProps> = ({ children }) => {
  const { firebaseUser, loading: authLoading, userLoading } = useAuth();

  // Show loading while checking auth state or fetching user data
  if (authLoading || userLoading) {
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

