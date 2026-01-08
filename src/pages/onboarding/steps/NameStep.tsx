import React, { useState } from 'react';
import { OnboardingData } from '@/types/user';
import { useLanguage } from '@/providers/LanguageProvider';

interface NameStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onNext: (data?: Partial<OnboardingData>) => void;
  loading: boolean;
}

const NameStep: React.FC<NameStepProps> = ({ data, onNext, loading }) => {
  const { t } = useLanguage();
  const [name, setName] = useState(data.name || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError(t('onboarding.nameStep.pleaseEnterName', 'Please enter your name'));
      return;
    }
    
    if (name.trim().length < 2) {
      setError(t('onboarding.nameStep.nameTooShort', 'Name must be at least 2 characters long'));
      return;
    }

    setError('');
    onNext({ name: name.trim() });
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setName(value);
    setError('');
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-600 dark:text-green-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {t('onboarding.nameStep.title', 'What\'s your name?')}
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {t('onboarding.nameStep.description', 'This will be displayed on your profile and used to personalize your experience.')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('onboarding.nameStep.fullName', 'Full Name')}
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={handleNameChange}
            placeholder={t('onboarding.nameStep.enterFullName', 'Enter your full name')}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {error && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {t('onboarding.nameStep.saving', 'Saving...')}
            </div>
          ) : (
            t('onboarding.nameStep.continue', 'Continue')
          )}
        </button>
      </form>
    </div>
  );
};

export default NameStep; 