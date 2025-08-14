import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api/whagonsApi';
import { User, OnboardingData, InitializationStage } from '@/types/user';
import { useAuth } from '@/providers/AuthProvider';
import EmailVerificationStep from '@/pages/onboarding/steps/EmailVerificationStep';
import NameStep from '@/pages/onboarding/steps/NameStep';
import OrganizationNameStep from '@/pages/onboarding/steps/OrganizationNameStep';
import OptionalStep from '@/pages/onboarding/steps/OptionalStep';
import WhagonsCheck from '@/assets/WhagonsCheck';
import { WorkspaceCache } from '@/store/indexedDB/WorkspaceCache';
import { TeamsCache } from '@/store/indexedDB/TeamsCache';
import { CategoriesCache } from '@/store/indexedDB/CategoriesCache';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { getWorkspacesFromIndexedDB } from '@/store/reducers/workspacesSlice';
import { getTeamsFromIndexedDB } from '@/store/reducers/teamsSlice';
import { getCategoriesFromIndexedDB } from '@/store/reducers/categoriesSlice';
import { getTasksFromIndexedDB } from '@/store/reducers/tasksSlice';

interface OnboardingWrapperProps {
  user: User;
}

const OnboardingWrapper: React.FC<OnboardingWrapperProps> = ({ user }) => {
  const navigate = useNavigate();
  const { refetchUser } = useAuth();
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

  const syncCachesAndStore = async () => {
    // Ensure caches are initialized and up-to-date
    await Promise.all([
      WorkspaceCache.init(),
      TeamsCache.init(),
      CategoriesCache.init(),
      TasksCache.init()
    ]);

    // Populate Redux store from IndexedDB once caches are ready
    await Promise.all([
      dispatch(getWorkspacesFromIndexedDB()),
      dispatch(getTeamsFromIndexedDB()),
      dispatch(getCategoriesFromIndexedDB()),
      dispatch(getTasksFromIndexedDB())
    ]);
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

  const updateOnboardingData = (data: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...data }));
  };

  const updateUserProfile = async (data: Partial<OnboardingData>, newStage?: number) => {
    setLoading(true);
    try {
      const response = await api.patch('/users/me', {
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
          // In development, use organization name with VITE_DOMAIN
    // In production, use the tenant prefix with domain suffix
    const domain = import.meta.env.VITE_DEVELOPMENT === 'true' 
      ? `${organizationName.toLowerCase()}.${import.meta.env.VITE_DOMAIN}`
      : `${tenantDomainPrefix}.${import.meta.env.VITE_DOMAIN}`;
      
      const response = await api.post('/users/me/create-and-assign-tenant', {
        name: organizationName,
        domain: domain,
        database: organizationName.toLowerCase() // name and database are usually the same
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
          if (success) setCurrentStep(2);
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

  const handleSkipStep = async () => {
    if (currentStep === 2) {
      // Skipping optional step - complete onboarding
      const success = await updateUserProfile({}, InitializationStage.COMPLETED);
      if (success) {
        // Refetch user, sync caches/store, then navigate
        setLoading(true);
        await refetchUser();
        await syncCachesAndStore();
        setLoading(false);
        navigate('/');
      }
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
            onSkip={handleSkipStep}
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
    <div className="flex flex-col items-center justify-center min-h-screen px-4 sm:px-6 lg:px-8 bg-gray-50 dark:bg-gray-900">
      {/* Small logo in top left corner */}
      <div className="absolute top-6 left-6">
        <div className="flex items-center">
          <WhagonsCheck width={28} height={14} color="#27C1A7" />
          <div className="text-sm pl-1.5 font-semibold text-[#27C1A7]" style={{ fontFamily: 'Montserrat' }}>
            Whagons
          </div>
        </div>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome to Whagons
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Let's get your account set up
            </p>
          </div>
        </div>

        {/* Progress indicator */}
        <div className="mb-10">
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
                    className={`w-16 h-1 mx-3 rounded-full ${
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

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWrapper; 