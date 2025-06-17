import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';
import { User, InitializationStage } from '@/types/user';
import OnboardingWrapper from '@/pages/Onboarding/OnboardingWrapper';

const OnboardingRoute: React.FC = () => {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!firebaseUser) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/users/me');
        if (response.status === 200) {
          setUser(response.data.data);
        } else {
          setError('Failed to fetch user data');
        }
      } catch (err) {
        console.error('OnboardingRoute - Error fetching user data:', err);
        setError('Failed to fetch user data');
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

  // Redirect to signin if not authenticated
  if (!firebaseUser) {
    return <Navigate to="/auth/signin" replace />;
  }

  // Show error if user data couldn't be fetched
  if (error || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            {error || 'Failed to load user data'}
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

  // Redirect to main app if onboarding is already completed
  if (user.initialization_stage === InitializationStage.COMPLETED) {
    return <Navigate to="/" replace />;
  }

  // Show onboarding flow
  return <OnboardingWrapper user={user} />;
};

export default OnboardingRoute; 