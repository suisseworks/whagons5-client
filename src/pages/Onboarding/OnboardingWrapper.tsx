import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { User, OnboardingData, InitializationStage } from '@/types/user';
import EmailVerificationStep from './steps/EmailVerificationStep';
import NameStep from './steps/NameStep';
import TeamNameStep from './steps/TeamNameStep';
import OptionalStep from './steps/OptionalStep';
import WhagonsTitle from '@/assets/WhagonsTitle';

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
    url_picture: user.url_picture,
  });
  const [loading, setLoading] = useState<boolean>(false);

  // Determine starting step based on user's current state
  useEffect(() => {
    console.log('OnboardingWrapper - useEffect - user:', user);
    console.log('OnboardingWrapper - useEffect - initialization_stage:', user.initialization_stage);
    if (user.initialization_stage === InitializationStage.HAS_NAME && user.name) {
      console.log('OnboardingWrapper - Setting step to 1 (team name)');
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

  const handleNextStep = async () => {
    let success = false;

    switch (currentStep) {
      case 0: // Name step
        if (onboardingData.name) {
          success = await updateUserProfile({ name: onboardingData.name }, InitializationStage.HAS_NAME);
          if (success) setCurrentStep(1);
        }
        break;
      case 1: // Team name step
        if (onboardingData.team_name) {
          success = await updateUserProfile({ team_name: onboardingData.team_name });
          if (success) setCurrentStep(2);
        }
        break;
      case 2: // Optional step
        success = await updateUserProfile(
          { url_picture: onboardingData.url_picture },
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
        console.log('OnboardingWrapper - Rendering TeamNameStep');
        return (
          <TeamNameStep
            data={onboardingData}
            onUpdate={updateOnboardingData}
            onNext={handleNextStep}
            loading={loading}
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
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <WhagonsTitle />
          <h1 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            Welcome to Whagons
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Let's get your account set up
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[0, 1, 2].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                  }`}
                >
                  {step + 1}
                </div>
                {step < 2 && (
                  <div
                    className={`w-16 h-1 mx-2 ${
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

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          {renderStep()}
        </div>
      </div>
    </div>
  );
};

export default OnboardingWrapper; 