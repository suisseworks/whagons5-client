import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';
import { User, InitializationStage } from '@/types/user';
import OnboardingWrapper from '@/pages/Onboarding/OnboardingWrapper';

const OnboardingRoute: React.FC = () => {
  console.log('OnboardingRoute - Component mounted');
  const { user: firebaseUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('OnboardingRoute - useEffect - authLoading:', authLoading);
    console.log('OnboardingRoute - useEffect - firebaseUser:', firebaseUser);
    const fetchUserData = async () => {
      if (!firebaseUser) {
        console.log('OnboardingRoute - No firebase user, setting loading to false');
        setLoading(false);
        return;
      }

      try {
        console.log('OnboardingRoute - Fetching user data...');
        const response = await api.get('/users/me');
        if (response.status === 200) {
          console.log('OnboardingRoute - Full response:', response);
          console.log('OnboardingRoute - User data:', response.data.data);
          console.log('OnboardingRoute - Setting user data');
          setUser(response.data.data);
        } else {
          console.log('OnboardingRoute - Failed to fetch user data, status:', response.status);
          setError('Failed to fetch user data');
        }
      } catch (err) {
        console.error('OnboardingRoute - Error fetching user data:', err);
        setError('Failed to fetch user data');
      } finally {
        console.log('OnboardingRoute - Setting loading to false');
        setLoading(false);
      }
    };

    if (!authLoading) {
      fetchUserData();
    }
  }, [firebaseUser, authLoading]);

  // Show loading while checking auth state or fetching user data
  if (authLoading || loading) {
    console.log('OnboardingRoute - Showing loading state');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect to signin if not authenticated
  if (!firebaseUser) {
    console.log('OnboardingRoute - No firebase user, redirecting to signin');
    return <Navigate to="/auth/signin" replace />;
  }

  // Show error if user data couldn't be fetched
  if (error || !user) {
    console.log('OnboardingRoute - Error or no user data:', { error, user });
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
    console.log('OnboardingRoute - User completed onboarding, redirecting to home');
    return <Navigate to="/" replace />;
  }

  // Show onboarding flow
  console.log('OnboardingRoute - Rendering OnboardingWrapper with user:', user);
  return <OnboardingWrapper user={user} />;
};

export default OnboardingRoute; 