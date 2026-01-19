import React, { useState } from 'react';
import { actionsApi } from '@/api/whagonsActionsApi';
import { useLanguage } from '@/providers/LanguageProvider';

interface EmailVerificationStepProps {
  email: string;
  onVerified: () => void;
}

const EmailVerificationStep: React.FC<EmailVerificationStepProps> = ({ email, onVerified }) => {
  const { t } = useLanguage();
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleResendVerification = async () => {
    setIsResending(true);
    try {
      // Update to use your actual backend endpoint for resending verification
      const response = await actionsApi.post('/auth/resend-verification', { email });
      if (response.status === 200) {
        setResendSuccess(true);
        setTimeout(() => setResendSuccess(false), 3000);
      }
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    } finally {
      setIsResending(false);
    }
  };

  const handleContinue = () => {
    // In a real implementation, you might want to check verification status
    // For now, we'll trust the user clicked the verification link
    onVerified();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-blue-600 dark:text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t('onboarding.emailVerification.title', 'Verify your email')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('onboarding.emailVerification.sentLink', 'We\'ve sent a verification link to')}{' '}
          <span className="font-medium text-gray-900 dark:text-white">{email}</span>
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('onboarding.emailVerification.checkEmail', 'Please check your email and click the verification link to continue.')}
        </p>
      </div>

      <div className="space-y-4">
        <button
          onClick={handleContinue}
          className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors font-medium"
        >
          {t('onboarding.emailVerification.verified', 'I\'ve verified my email')}
        </button>

        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {t('onboarding.emailVerification.didntReceive', 'Didn\'t receive the email?')}
          </p>
          <button
            onClick={handleResendVerification}
            disabled={isResending}
            className="text-primary hover:text-primary/80 transition-colors font-medium disabled:opacity-50"
          >
            {isResending ? t('onboarding.emailVerification.sending', 'Sending...') : t('onboarding.emailVerification.resend', 'Resend verification email')}
          </button>
          {resendSuccess && (
            <p className="text-green-600 dark:text-green-400 text-sm mt-2">
              {t('onboarding.emailVerification.resendSuccess', 'Verification email sent successfully!')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmailVerificationStep; 