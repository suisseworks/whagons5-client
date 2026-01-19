import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { actionsApi } from '@/api/whagonsActionsApi';
import { User, OnboardingData, InitializationStage } from '@/types/user';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import EmailVerificationStep from '@/pages/onboarding/steps/EmailVerificationStep';
import NameStep from '@/pages/onboarding/steps/NameStep';
import OrganizationNameStep from '@/pages/onboarding/steps/OrganizationNameStep';
import OptionalStep from '@/pages/onboarding/steps/OptionalStep';
import WhagonsCheck from '@/assets/WhagonsCheck';
// Using generic caches instead of custom caches
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { genericActions } from '@/store/genericSlices';
import { getTasksFromIndexedDB } from '@/store/reducers/tasksSlice';
import RotatingBackground from '@/components/marketing/RotatingBackground';
import { HERO_BACKGROUND_IMAGES } from '@/assets/marketing/heroBackgrounds';

interface OnboardingWrapperProps {
  user: User;
}

const OnboardingWrapper: React.FC<OnboardingWrapperProps> = ({ user }) => {
  const navigate = useNavigate();
  const { refetchUser } = useAuth();
  const { language, t } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    email: user.email,
    name: user.name,
    team_name: user.team_name,
    organization_name: user.organization_name,
    tenant_domain_prefix: user.tenant_domain_prefix,
    url_picture: user.url_picture,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [quoteIndex, setQuoteIndex] = useState<number>(0);
  
  const isSpanish = language === 'es-ES' || language.startsWith('es');
  
  const quotes = useMemo(() => {
    if (isSpanish) {
      return [
        'Construye impulso. Un pequeño paso a la vez.',
        'La claridad viene de la acción, no del pensamiento.',
        'Empieza donde estás. Usa lo que tienes. Haz lo que puedas.',
        'Enfócate en el progreso, no en la perfección.',
        'El viaje de mil millas comienza con un solo paso.',
        'Es mejor completar que perfeccionar.',
        'Tu yo futuro te agradecerá por empezar hoy.',
        'El éxito es la suma de pequeños esfuerzos, repetidos día tras día.',
        'Sueña en grande. Empieza pequeño. Actúa ahora.'
      ];
    }
    return [
      'Build momentum. One small step at a time.',
      'Clarity comes from action, not thought.',
      'Start where you are. Use what you have. Do what you can.',
      'Focus on progress, not perfection.',
      'The journey of a thousand miles begins with a single step.',
      'Done is better than perfect.',
      'Your future self will thank you for starting today.',
      'Success is the sum of small efforts, repeated day in and day out.',
      'Dream big. Start small. Act now.'
    ];
  }, [isSpanish]);

  const syncCachesAndStore = async () => {
    // Ensure tasks cache is ready only; core slices are hydrated by AuthProvider
    await TasksCache.init();
  };

  // Determine starting step based on user's current state
  useEffect(() => {
    // If user has completed onboarding, navigate away immediately
    if (user.initialization_stage === InitializationStage.COMPLETED) {
      navigate('/');
      return;
    }
    
    // Handle initialization stage 2 - user has completed organization step, go to final step
    if (user.initialization_stage === 2) {
      setCurrentStep(2);
    } else if (user.initialization_stage === InitializationStage.HAS_NAME && user.name) {
      setCurrentStep(1);
    } else if (user.initialization_stage === InitializationStage.NEEDS_ONBOARDING) {
      setCurrentStep(user.email ? 0 : -1); // -1 for email verification if needed
    }
  }, [user, navigate]);

  useEffect(() => {
    setQuoteIndex(Math.floor(Math.random() * quotes.length));
  }, [quotes.length]);

  const updateOnboardingData = (data: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
  };

  const updateUserProfile = async (data: Partial<OnboardingData>, newStage?: number) => {
    setLoading(true);
    try {
      const response = await actionsApi.patch('/users/me', {
        ...data,
        ...(newStage !== undefined && { initialization_stage: newStage })
      });
      
      if (response.status === 200) {
        setLoading(false);
        return true;
      }
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Failed to update user profile:', error);
      setLoading(false);
      return false;
    }
  };

  const createAndAssignTenant = async (organizationName: string, tenantDomainPrefix: string) => {
    setLoading(true);
    try {
      const safeTenant = tenantDomainPrefix.toLowerCase();

      // Always use the generated tenant identifier as the subdomain prefix
      const domain = `${safeTenant}.${import.meta.env.VITE_API_URL}`;
      
      const response = await actionsApi.post('/users/me/create-and-assign-tenant', {
        name: organizationName,
        domain: domain,
        // Use the generated tenant identifier as the database name as well
        database: safeTenant
      });
      
      if (response.status === 200) {
        setLoading(false);
        return true;
      }
      setLoading(false);
      return false;
    } catch (error) {
      console.error('Failed to create and assign tenant:', error);
      setLoading(false);
      return false;
    }
  };

  const handleNextStep = async (stepData?: Partial<OnboardingData>) => {
    let success = false;
    
    // Update state with new data if provided
    if (stepData) {
      setOnboardingData(prev => ({ ...prev, ...stepData }));
    }
    
    // Use passed data if available, otherwise use current state
    const dataToUse = stepData ? { ...onboardingData, ...stepData } : onboardingData;

    switch (currentStep) {
      case 0: // Name step
        // Check if name has changed from the original user data
        if (dataToUse.name && dataToUse.name !== user.name) {
          success = await updateUserProfile({ name: dataToUse.name }, InitializationStage.HAS_NAME);
          if (success) setCurrentStep(1);
        } else if (dataToUse.name === user.name || user.name) {
          // Name hasn't changed or user already has a name, just advance
          setCurrentStep(1);
        }
        break;
      case 1: // Organization name step
        // Check if organization is already set (tenant exists) or if data hasn't changed
        if (user.tenant_domain_prefix) {
          // Tenant already exists, just advance to next step
          setCurrentStep(2);
        } else if (dataToUse.organization_name && dataToUse.tenant_domain_prefix) {
          // New organization data, create tenant
          success = await createAndAssignTenant(
            dataToUse.organization_name,
            dataToUse.tenant_domain_prefix
          );
          if (success) {
            // Immediately refetch user data to ensure tenant_domain_prefix is updated
            // This prevents redirect issues where user data hasn't been refreshed yet
            await refetchUser();
            setCurrentStep(2);
          }
        }
        break;
      case 2: // Optional step
        // Check if profile picture has changed
        if (dataToUse.url_picture !== user.url_picture) {
          success = await updateUserProfile(
            { url_picture: dataToUse.url_picture },
            InitializationStage.COMPLETED
          );
        } else {
          // No change in profile picture, just complete onboarding
          success = await updateUserProfile({}, InitializationStage.COMPLETED);
        }
        if (success) {
          // Refetch user data to ensure AuthProvider has the latest state,
          // then initialize caches and populate Redux before navigating
          setLoading(true);
          await refetchUser();
          await syncCachesAndStore();
          setLoading(false);
          navigate('/');
        }
        break;
      default:
        break;
    }
  };

  const handleStepClick = (step: number) => {
    // Only allow going back to previous steps or current step
    if (step <= currentStep) {
      setCurrentStep(step);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return (
          <NameStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={handleNextStep}
            loading={loading}
          />
        );
      case 1:
        return (
          <OrganizationNameStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={handleNextStep}
            loading={loading}
            hasActiveSubscription={user.has_active_subscription || false}
          />
        );
      case 2:
        return (
          <OptionalStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={handleNextStep}
            loading={loading}
          />
        );
      default:
        return (
          <EmailVerificationStep
            email={user.email}
            onVerified={() => setCurrentStep(0)}
          />
        );
    }
  };

  return (
    <div className="min-h-screen w-full grid grid-cols-1 lg:grid-cols-2">
      {/* Left: photo with quote */}
      <div className="relative hidden lg:block">
        <RotatingBackground images={HERO_BACKGROUND_IMAGES} intervalMs={10_000} className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
          <div className="relative z-10 h-full flex flex-col justify-between p-10 lg:p-10 max-[900px]:p-6">
            <div />
            <div>
              <div className="text-white/90 text-lg mb-1">{t('onboarding.welcomeTo', 'Welcome to')}</div>
              <h1 className="text-4xl font-semibold tracking-tight leading-none text-white">Whagons</h1>
              <p className="mt-8 text-2xl leading-snug text-white max-w-xl">{quotes[quoteIndex]}</p>
            </div>
            <div className="flex items-center gap-2 text-white/80">
              <WhagonsCheck width={28} height={14} color="#27C1A7" />
              <span className="text-sm font-semibold">Whagons</span>
            </div>
          </div>
        </RotatingBackground>
      </div>

      {/* Right: form card */}
      <div className="relative overflow-y-auto h-screen px-6 py-6 lg:py-8 bg-[url('/images/onboarding/gradient-waves.svg')] bg-cover bg-center">
        <div className="absolute inset-0 pointer-events-none bg-white/65 dark:bg-gray-900/70 backdrop-blur-sm" />
        <div className="relative w-full max-w-md mx-auto z-10 pb-6">
          <div className="text-center mb-6 lg:mb-6">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{t('onboarding.welcomeToWhagons', 'Welcome to Whagons')}</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">{t('onboarding.letsGetAccountSetUp', 'Let\'s get your account set up')}</p>
            </div>
          </div>

          <div className="mb-6 lg:mb-6">
            <div className="flex items-center justify-between">
              {[0, 1, 2].map((step) => (
                <div key={step} className="flex items-center">
                  <button
                    onClick={() => handleStepClick(step)}
                    disabled={step > currentStep}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ${
                      step <= currentStep
                        ? 'bg-primary text-white cursor-pointer hover:bg-primary/90 shadow-lg'
                        : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400 cursor-not-allowed'
                    } ${step < currentStep ? 'hover:scale-105' : ''}`}
                  >
                    {step + 1}
                  </button>
                  {step < 2 && (
                    <div
                      className={`w-14 lg:w-16 max-[900px]:w-10 h-1 mx-3 rounded-full ${
                        step < currentStep
                          ? 'bg-primary'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-white/20 dark:border-gray-700/20 p-6 lg:p-6">
            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OnboardingWrapper; 