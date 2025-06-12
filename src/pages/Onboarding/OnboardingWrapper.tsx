import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { User, OnboardingData, InitializationStage } from '@/types/user';
import EmailVerificationStep from './steps/EmailVerificationStep';
import NameStep from './steps/NameStep';
import OrganizationNameStep from './steps/OrganizationNameStep';
import OptionalStep from './steps/OptionalStep';
import WhagonsCheck from '@/assets/WhagonsCheck';

interface OnboardingWrapperProps {
  user: User;
}

const OnboardingWrapper: React.FC<OnboardingWrapperProps> = ({ user }) => {
  console.log('OnboardingWrapper - Received user:', user);
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({
    email: user.email,
    name: user.name,
    team_name: user.team_name,
    organization_name: user.organization_name,
    tenant_name: user.tenant_name,
    url_picture: user.url_picture,
  });
  const [loading, setLoading] = useState<boolean>(false);

  // Determine starting step based on user's current state
  useEffect(() => {
    console.log('OnboardingWrapper - useEffect - user:', user);
    console.log('OnboardingWrapper - useEffect - initialization_stage:', user.initialization_stage);
    if (user.initialization_stage === InitializationStage.HAS_NAME && user.name) {
      console.log('OnboardingWrapper - Setting step to 1 (organization name)');
      setCurrentStep(1);
    } else if (user.initialization_stage === InitializationStage.NEEDS_ONBOARDING) {
      console.log('OnboardingWrapper - Setting step to', user.email ? 0 : -1);
      setCurrentStep(user.email ? 0 : -1); // -1 for email verification if needed
    }
  }, [user]);

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
        if (dataToUse.name) {
          success = await updateUserProfile({ name: dataToUse.name }, InitializationStage.HAS_NAME);
          if (success) setCurrentStep(1);
        }
        break;
      case 1: // Organization name step
        if (dataToUse.organization_name) {
          success = await updateUserProfile({ 
            organization_name: dataToUse.organization_name,
            tenant_name: dataToUse.tenant_name
          });
          if (success) setCurrentStep(2);
        }
        break;
      case 2: // Optional step
        success = await updateUserProfile(
          { url_picture: dataToUse.url_picture },
          InitializationStage.COMPLETED
        );
        if (success) {
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
    console.log('OnboardingWrapper - renderStep - currentStep:', currentStep);
    switch (currentStep) {
      case 0:
        console.log('OnboardingWrapper - Rendering NameStep');
        return (
          <NameStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={handleNextStep}
            loading={loading}
          />
        );
      case 1:
        console.log('OnboardingWrapper - Rendering OrganizationNameStep');
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
        console.log('OnboardingWrapper - Rendering OptionalStep');
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
        console.log('OnboardingWrapper - Rendering EmailVerificationStep');
        return (
          <EmailVerificationStep
            email={user.email}
            onVerified={() => setCurrentStep(0)}
          />
        );
    }
  };

  console.log('OnboardingWrapper - Rendering main component');
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