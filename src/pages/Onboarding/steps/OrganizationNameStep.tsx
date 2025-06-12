import React, { useState } from 'react';
import { OnboardingData } from '@/types/user';
import { checkTenantExists, createTenantName } from '@/utils/tenant';

interface OrganizationNameStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onNext: (data?: Partial<OnboardingData>) => void;
  loading: boolean;
  hasActiveSubscription?: boolean;
}

const OrganizationNameStep: React.FC<OrganizationNameStepProps> = ({ 
  data, 
  onUpdate, 
  onNext, 
  loading,
  hasActiveSubscription = false 
}) => {
  const [organizationName, setOrganizationName] = useState(data.organization_name || '');
  const [finalTenantName, setFinalTenantName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!organizationName.trim()) {
      setError('Please enter an organization name');
      return;
    }
    
    if (organizationName.trim().length < 2) {
      setError('Organization name must be at least 2 characters long');
      return;
    }

    if (organizationName.trim().length > 50) {
      setError('Organization name must be less than 50 characters');
      return;
    }

    // Clean the organization name by replacing spaces with underscores
    const cleanedOrgName = organizationName.trim().replace(/\s+/g, '_').toLowerCase();

    // Check if tenant exists (placeholder function)
    const tenantExists = await checkTenantExists(cleanedOrgName);
    if (tenantExists) {
      setError('This organization name is already taken. Please choose another one.');
      return;
    }

    // Use the existing finalTenantName that was generated in the preview
    // This ensures consistency and prevents regenerating random suffixes
    let tenantToUse = finalTenantName;
    
    // If for some reason finalTenantName is empty, generate it
    if (!tenantToUse) {
      tenantToUse = createTenantName(cleanedOrgName, hasActiveSubscription);
      setFinalTenantName(tenantToUse);
    }

    setError('');
    onNext({ 
      organization_name: organizationName.trim(),
      tenant_name: tenantToUse
    });
  };

  const handleOrganizationNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOrganizationName(value);
    setError('');
    
    // Preview the tenant name as user types
    if (value.trim()) {
      // Replace spaces with underscores and convert to lowercase
      const cleanedValue = value.trim().replace(/\s+/g, '_').toLowerCase();
      const previewTenant = createTenantName(cleanedValue, hasActiveSubscription);
      setFinalTenantName(previewTenant);
    } else {
      setFinalTenantName('');
    }
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
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          What's your organization name?
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          This will be used as your tenant identifier for the app. Choose a name that represents your organization.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="organizationName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Organization Name
          </label>
          <input
            type="text"
            id="organizationName"
            value={organizationName}
            onChange={handleOrganizationNameChange}
            placeholder="Enter your organization name"
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            disabled={loading}
          />
          {error && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {organizationName.length}/50 characters
          </p>
        </div>

        {/* Tenant Name Preview */}
        {finalTenantName && (
          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Your tenant identifier will be:
                </p>
                <p className="text-lg font-mono text-gray-900 dark:text-white mt-1">
                  {finalTenantName}
                </p>
              </div>
              {!hasActiveSubscription && finalTenantName.includes('_') && (
                <div className="flex-shrink-0 ml-4">
                  <button
                    type="button"
                    className="text-xs bg-primary text-white px-3 py-1 rounded-full hover:bg-primary/90 transition-colors"
                    onClick={() => {
                      // TODO: Navigate to subscription page
                      console.log('Navigate to subscription page');
                    }}
                  >
                    Upgrade
                  </button>
                </div>
              )}
            </div>
            
            {!hasActiveSubscription && finalTenantName.includes('_') && (
              <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      Random characters have been added to your organization name. 
                      <strong> Upgrade to a paid plan</strong> to use your preferred name without the suffix.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Tenant Identifier:</strong> This will be your unique organization identifier in the app. 
                Choose a meaningful name like "whagons", "acme", or "alpha".
              </p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !organizationName.trim()}
          className="w-full bg-primary text-white py-3 px-4 rounded-lg hover:bg-primary/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Saving...
            </div>
          ) : (
            'Continue'
          )}
        </button>
      </form>
    </div>
  );
};

export default OrganizationNameStep; 