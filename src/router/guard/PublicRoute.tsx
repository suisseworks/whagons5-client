import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router';
// import { useAuthStore } from "../../features/auth/hooks/useAuthStore";
import { useAuth } from '../../context/AuthContext';
import { api } from '@/api';
import { User, InitializationStage } from '@/types/user';

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
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!firebaseUser) {
        setLoading(false);
        setError(false);
        return;
      }

      try {
        const response = await api.get('/users/me');
        if (response.status === 200) {
          setUser(response.data.data || response.data);
          setError(false);
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
        // Only set error state after a few retries to handle timing issues
        // during sign-in process where Firebase auth completes before backend login
        if (retryCount >= 2) {
          setError(true);
        } else {
          // Retry after a short delay
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, 1000);
          return; // Don't set loading to false, keep retrying
        }
      } finally {
        if (retryCount >= 2) {
          setLoading(false);
        }
      }
    };

    if (!authLoading) {
      fetchUserData();
    }
  }, [firebaseUser, authLoading, retryCount]);

  // Reset retry count when firebaseUser changes
  useEffect(() => {
    setRetryCount(0);
    setError(false);
  }, [firebaseUser]);

  // While loading auth state or user data, show loading
  if (authLoading || loading) {
    return <LoadingScreen message={authLoading ? "Authenticating..." : "Loading user data..."} />;
  }

  // If not authenticated, show public route content
  if (!firebaseUser) {
    return <>{children}</>;
  }

  // If authenticated but user data couldn't be fetched after retries, show error
  if (error && !user) {
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
            We couldn't load your user information. This might be a temporary issue.
          </p>
          <button
            onClick={() => {
              setRetryCount(0);
              setError(false);
              setLoading(true);
            }}
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            <svg 
              className="w-5 h-5 mr-2" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If user data is still being fetched, show loading
  if (!user && !error) {
    return <LoadingScreen message="Setting up your account..." />;
  }

  // If user needs onboarding and not already on onboarding page, redirect to onboarding
  if (user && user.initialization_stage !== InitializationStage.COMPLETED && 
      location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  // If user has completed onboarding and tries to access onboarding, redirect to home
  if (user && user.initialization_stage === InitializationStage.COMPLETED && 
      location.pathname === '/onboarding') {
    return <Navigate to="/" replace />;
  }

  // If user is authenticated and has completed onboarding, redirect to home
  return user && user.initialization_stage === InitializationStage.COMPLETED ? 
    <Navigate to="/" replace /> : 
    <>{children}</>;
};

export default PublicRoute;
