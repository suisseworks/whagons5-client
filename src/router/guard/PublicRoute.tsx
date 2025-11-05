import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
// import { useAuthStore } from "../../features/auth/hooks/useAuthStore";
import { useAuth } from '../../providers/AuthProvider';
import { InitializationStage } from '@/types/user';

interface PublicRouteProps {
  children: ReactNode;
}

const LoadingScreen = ({ message = "Loading..." }: { message?: string }) => (
  <div className="flex items-center justify-center min-h-screen bg-white dark:bg-boxdark">
    <div className="text-center">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-4"></div>
      <p className="text-lg font-medium text-black dark:text-white">{message}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Please wait while we load your data</p>
    </div>
  </div>
);

export const PublicRoute = ({ children }: PublicRouteProps) => {
  const { firebaseUser, user, loading, userLoading } = useAuth();
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth/signin' || location.pathname === '/auth/signup';

  // For auth pages, show form immediately - don't wait for loading states
  // This prevents hanging if Firebase auth state check or API calls hang
  if (isAuthPage) {
    // If no Firebase user, show sign-in form immediately
    if (!firebaseUser) {
      return <>{children}</>;
    }
    
    // If Firebase user exists but no backend user, still show form (user needs to re-auth)
    if (!user) {
      return <>{children}</>;
    }
    
    // User is authenticated - redirect based on onboarding status
    if (user.initialization_stage !== InitializationStage.COMPLETED) {
      return <Navigate to="/onboarding" replace />;
    }
    
    // User completed onboarding - redirect to home
    return <Navigate to="/" replace />;
  }

  // For non-auth pages, wait for loading to complete
  if (loading || userLoading) {
    return <LoadingScreen message={loading ? "Authenticating..." : "Loading user data..."} />;
  }

  // If not authenticated, show public route content
  if (!firebaseUser) {
    return <>{children}</>;
  }

  // If no user data after auth completed, show error
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white dark:bg-boxdark">
        <div className="text-center">
          <div className="mb-6">
            <svg 
              className="w-16 h-16 text-red-500 mx-auto mb-4" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-black dark:text-white mb-2">
            Error Loading User Data
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            We couldn't load your user information. Please try signing in again.
          </p>
        </div>
      </div>
    );
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
