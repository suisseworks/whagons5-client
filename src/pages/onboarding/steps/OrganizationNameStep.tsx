import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { OnboardingData } from '@/types/user';
import { checkTenantExists, createTenantName } from '@/lib/tenant';
import { getEnvVariables } from '@/lib/getEnvVariables';
import { useLanguage } from '@/providers/LanguageProvider';

// Normalize an organization name into a safe tenant slug:
// - lowercase
// - only a-z, 0-9 and hyphens
// - collapse multiple non-alphanumerics into a single hyphen
// - trim leading/trailing hyphens
const slugifyOrganizationName = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error';

interface OrganizationNameStepProps {
  data: OnboardingData;
  onUpdate: (data: Partial<OnboardingData>) => void;
  onNext: (data?: Partial<OnboardingData>) => void;
  loading: boolean;
  hasActiveSubscription?: boolean;
}

const OrganizationNameStep: React.FC<OrganizationNameStepProps> = ({ 
  data, 
  onNext, 
  loading,
  hasActiveSubscription = false 
}) => {
  const { t, language } = useLanguage();
  const [organizationName, setOrganizationName] = useState(data.organization_name || '');
  const [finalTenantName, setFinalTenantName] = useState(data.tenant_domain_prefix || '');
  const [error, setError] = useState('');
  const [availabilityStatus, setAvailabilityStatus] = useState<AvailabilityStatus>('idle');
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const checkCacheRef = useRef<Map<string, AvailabilityStatus>>(new Map());
  
  // Check if tenant is already set (organization is already created)
  const isTenantSet = Boolean(data.tenant_domain_prefix);

  // Dynamic loading messages
  const loadingMessages = useMemo(() => {
    const isSpanish = language === 'es-ES' || language.startsWith('es');
    
    if (isSpanish) {
      return [
        t('onboarding.organization.preparing', 'Preparando tu ambiente...'),
        t('onboarding.organization.configuring', 'Configurando tu espacio...'),
        t('onboarding.organization.settingUp', 'Configurando tu organización...'),
        t('onboarding.organization.almostReady', '¡Casi listo!...'),
      ];
    }
    return [
      t('onboarding.organization.preparing', 'Preparing your workspace...'),
      t('onboarding.organization.configuring', 'Setting up your environment...'),
      t('onboarding.organization.settingUp', 'Configuring your organization...'),
      t('onboarding.organization.almostReady', 'Almost ready!...'),
    ];
  }, [t, language]);

  // Rotate loading messages
  useEffect(() => {
    if (!loading) {
      setLoadingMessageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000); // Change message every 2 seconds

    return () => clearInterval(interval);
  }, [loading, loadingMessages.length]);

  // Auto-focus input on mount
  useEffect(() => {
    if (!isTenantSet && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isTenantSet]);

  // Debounced availability check
  const checkAvailability = useCallback(async (cleanedName: string) => {
    if (!cleanedName || cleanedName.length < 2) {
      setAvailabilityStatus('idle');
      return;
    }

    // Check cache first
    const cached = checkCacheRef.current.get(cleanedName);
    if (cached && cached !== 'checking') {
      setAvailabilityStatus(cached);
      return;
    }

    setAvailabilityStatus('checking');
    
    try {
      const exists = await checkTenantExists(cleanedName);
      const status: AvailabilityStatus = exists ? 'taken' : 'available';
      setAvailabilityStatus(status);
      checkCacheRef.current.set(cleanedName, status);
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error('Availability check failed:', error);
      setAvailabilityStatus('error');
    }
  }, []);

  // Handle organization name change with debounced availability check
  const handleOrganizationNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setOrganizationName(value);
    setError('');
    setCopied(false);
    
    // Don't update tenant preview if tenant is already set
    if (isTenantSet) return;
    
    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Preview the tenant name as user types
    if (value.trim()) {
      const cleanedValue = slugifyOrganizationName(value);
      const previewTenant = createTenantName(cleanedValue, hasActiveSubscription);
      setFinalTenantName(previewTenant);
      
      // Debounce availability check (only check base name, not with suffix)
      if (cleanedValue.length >= 2 && hasActiveSubscription) {
        debounceTimerRef.current = setTimeout(() => {
          checkAvailability(cleanedValue);
        }, 500);
      } else {
        setAvailabilityStatus('idle');
      }
    } else {
      setFinalTenantName('');
      setAvailabilityStatus('idle');
    }
  }, [isTenantSet, hasActiveSubscription, checkAvailability]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Copy tenant identifier to clipboard
  const handleCopyTenantId = async () => {
    if (!finalTenantName) return;
    
    try {
      await navigator.clipboard.writeText(finalTenantName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Retry availability check
  const handleRetryCheck = () => {
    if (!organizationName.trim()) return;
    const cleanedValue = slugifyOrganizationName(organizationName);
    if (cleanedValue.length >= 2) {
      checkCacheRef.current.delete(cleanedValue); // Clear cache
      setRetryCount(prev => prev + 1);
      checkAvailability(cleanedValue);
    }
  };

  // Handle Enter key submission
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && organizationName.trim() && !error) {
      handleSubmit(e as any);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If tenant is already set, just proceed to next step
    if (isTenantSet) {
      onNext();
      return;
    }
    
    if (!organizationName.trim()) {
      setError(t('onboarding.organization.errorRequired', 'Please enter an organization name'));
      return;
    }
    
    if (organizationName.trim().length < 2) {
      setError(t('onboarding.organization.errorMinLength', 'Organization name must be at least 2 characters long'));
      return;
    }

    if (organizationName.trim().length > 50) {
      setError(t('onboarding.organization.errorMaxLength', 'Organization name must be less than 50 characters'));
      return;
    }

    // Clean the organization name into a safe slug
    const cleanedOrgName = slugifyOrganizationName(organizationName);

    if (!cleanedOrgName) {
      setError(t('onboarding.organization.errorInvalid', 'Organization name must contain letters or numbers.'));
      return;
    }

    // Check availability if user has subscription (for custom names)
    if (hasActiveSubscription && availabilityStatus === 'taken') {
      setError(t('onboarding.organization.errorTaken', 'This organization name is already taken. Please choose another one.'));
      return;
    }

    // Final availability check before submission
    if (hasActiveSubscription) {
      try {
        const tenantExists = await checkTenantExists(cleanedOrgName);
        if (tenantExists) {
          setError(t('onboarding.organization.errorTaken', 'This organization name is already taken. Please choose another one.'));
          return;
        }
      } catch (error) {
        // If check fails, allow submission but show warning
        console.warn('Availability check failed, proceeding anyway:', error);
      }
    }

    // Use the existing finalTenantName that was generated in the preview
    let tenantToUse = finalTenantName;
    
    // If for some reason finalTenantName is empty, generate it
    if (!tenantToUse) {
      tenantToUse = createTenantName(cleanedOrgName, hasActiveSubscription);
      setFinalTenantName(tenantToUse);
    }

    setError('');
    onNext({ 
      organization_name: organizationName.trim(),
      tenant_domain_prefix: tenantToUse
    });
  };

  // Get API URL for tenant preview
  const getTenantUrl = () => {
    const { VITE_API_URL } = getEnvVariables();
    if (!finalTenantName) return '';
    return `${finalTenantName}.${VITE_API_URL}`;
  };

  // Get availability status icon
  const getAvailabilityIcon = () => {
    switch (availabilityStatus) {
      case 'checking':
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
        );
      case 'available':
        return (
          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'taken':
        return (
          <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'error':
        return (
          <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  // Get input border color based on status
  const getInputBorderColor = () => {
    if (error) return 'border-red-500';
    if (availabilityStatus === 'available') return 'border-green-500';
    if (availabilityStatus === 'taken') return 'border-red-500';
    if (availabilityStatus === 'checking') return 'border-blue-500';
    return 'border-gray-300';
  };

  // Character count progress
  const charCount = organizationName.length;
  const maxChars = 50;
  const charProgress = (charCount / maxChars) * 100;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto w-14 h-14 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-3">
          <svg
            className="w-7 h-7 text-blue-600 dark:text-blue-400 transition-transform hover:scale-110"
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
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1.5">
          {isTenantSet ? t('onboarding.organization.titleSet', 'Your organization') : t('onboarding.organization.title', 'What\'s your organization name?')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {isTenantSet 
            ? t('onboarding.organization.descriptionSet', 'Your organization is already configured. You can proceed to the next step.')
            : t('onboarding.organization.description', 'Choose a name that represents your organization. This will be your unique identifier.')
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-2">
            <label 
              htmlFor="organizationName" 
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              {t('onboarding.organization.label', 'Organization Name')}
            </label>
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="text-xs text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
              aria-label="Toggle help information"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              {showHelp ? t('onboarding.organization.hideHelp', 'Hide help') : t('onboarding.organization.showHelp', 'Show help')}
            </button>
          </div>

          {/* Help section */}
          {showHelp && (
            <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg transition-all duration-300 ease-in-out">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                <strong>{t('onboarding.organization.helpTitle', 'Tips:')}</strong>
              </p>
              <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1 list-disc list-inside">
                <li>{t('onboarding.organization.helpTip1', 'Use 2-50 characters')}</li>
                <li>{t('onboarding.organization.helpTip2', 'Letters, numbers, and spaces are allowed')}</li>
                <li>{t('onboarding.organization.helpTip3', 'Special characters will be converted to hyphens')}</li>
                <li>{t('onboarding.organization.helpTip4', 'Examples: "Acme Corp", "Tech Startup", "My Company"')}</li>
              </ul>
            </div>
          )}

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              id="organizationName"
              value={organizationName}
              onChange={handleOrganizationNameChange}
              onKeyDown={handleKeyDown}
              placeholder={t('onboarding.organization.placeholder', 'e.g., Acme Corporation')}
              className={`w-full px-4 py-3 pr-12 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white transition-all duration-200 ${
                getInputBorderColor()
              } ${isTenantSet ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed' : ''}`}
              disabled={loading || isTenantSet}
              readOnly={isTenantSet}
              aria-label="Organization name"
              aria-describedby="org-name-help org-name-error org-name-counter"
              aria-invalid={!!error || availabilityStatus === 'taken'}
            />
            
            {/* Inline validation icon */}
            {!isTenantSet && organizationName.trim() && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                {getAvailabilityIcon()}
              </div>
            )}
          </div>

          {/* Character counter with progress bar */}
          {!isTenantSet && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span 
                  id="org-name-counter"
                  className={`transition-colors ${
                    charCount > maxChars * 0.9 
                      ? 'text-yellow-600 dark:text-yellow-400' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {charCount}/{maxChars} {t('onboarding.organization.characters', 'characters')}
                </span>
                {availabilityStatus === 'available' && (
                  <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    {t('onboarding.organization.available', 'Available')}
                  </span>
                )}
                {availabilityStatus === 'taken' && (
                  <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1">
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {t('onboarding.organization.taken', 'Taken')}
                  </span>
                )}
                {availabilityStatus === 'checking' && (
                  <span className="text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent" />
                    {t('onboarding.organization.checking', 'Checking...')}
                  </span>
                )}
              </div>
              <div className="h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    charProgress > 90 
                      ? 'bg-yellow-500' 
                      : charProgress > 70 
                      ? 'bg-blue-500' 
                      : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(charProgress, 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div 
              id="org-name-error"
              className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-all duration-300 ease-in-out"
              role="alert"
            >
              <div className="flex items-start">
                <svg className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="ml-3 flex-1">
                  <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  {availabilityStatus === 'error' && retryCount < 3 && (
                    <button
                      type="button"
                      onClick={handleRetryCheck}
                      className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 underline"
                    >
                      {t('onboarding.organization.retryCheck', 'Retry availability check')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tenant Name Preview */}
        {(finalTenantName || isTenantSet) && (
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-all duration-300 hover:shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {isTenantSet ? t('onboarding.organization.tenantIdentifierSet', 'Your tenant identifier:') : t('onboarding.organization.tenantIdentifier', 'Your tenant identifier will be:')}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-lg font-mono text-gray-900 dark:text-white break-all">
                    {finalTenantName}
                  </p>
                  {!isTenantSet && (
                    <button
                      type="button"
                      onClick={handleCopyTenantId}
                      className="flex-shrink-0 p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group"
                      aria-label="Copy tenant identifier"
                      title="Copy to clipboard"
                    >
                      {copied ? (
                        <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
                
                {/* Full URL preview */}
                {!isTenantSet && getTenantUrl() && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 break-all">
                    <span className="font-medium">{t('onboarding.organization.fullUrl', 'Full URL:')}</span> {getTenantUrl()}
                  </p>
                )}

                {/* Highlight random suffix */}
                {!hasActiveSubscription && finalTenantName.includes('-') && !isTenantSet && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                    <span className="font-medium">{t('onboarding.organization.note', 'Note:')}</span> {t('onboarding.organization.randomSuffixNote', 'Random suffix highlighted in yellow below')}
                  </p>
                )}
              </div>
              
              {!hasActiveSubscription && finalTenantName.includes('-') && !isTenantSet && (
                <div className="flex-shrink-0">
                  <button
                    type="button"
                    className="text-xs bg-primary text-white px-4 py-2 rounded-full hover:bg-primary/90 transition-all duration-200 hover:scale-105 shadow-md"
                    onClick={() => {
                      // TODO: Navigate to subscription page
                      console.log('Navigate to subscription page');
                    }}
                  >
                    {t('onboarding.organization.upgrade', 'Upgrade')}
                  </button>
                </div>
              )}
            </div>
            
            {/* Warning box for random suffix */}
            {!hasActiveSubscription && finalTenantName.includes('-') && !isTenantSet && (
              <div className="mt-3 p-2.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg transition-all duration-300 ease-in-out">
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
                  <div className="ml-3 flex-1">
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      {t('onboarding.organization.warning', 'Random characters have been added to your organization name.')}{' '}
                      <strong>{t('onboarding.organization.warningUpgrade', 'Upgrade to a paid plan')}</strong>{' '}
                      {t('onboarding.organization.warningSuffix', 'to use your preferred name without the suffix.')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info box - only show when yellow warning is not shown */}
        {!(!hasActiveSubscription && finalTenantName.includes('-') && !isTenantSet) && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 transition-all duration-300 ease-in-out">
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
                  <strong>{t('onboarding.organization.infoTitle', 'Tenant Identifier:')}</strong>{' '}
                  {t('onboarding.organization.infoDescription', 'This will be your unique organization identifier in the app. Choose a meaningful name like "whagons", "acme", or "alpha".')}
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || (!isTenantSet && (!organizationName.trim() || availabilityStatus === 'taken' || availabilityStatus === 'checking'))}
          className="w-full bg-primary text-white py-2.5 px-4 rounded-lg hover:bg-primary/90 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transform hover:scale-[1.01] disabled:hover:scale-100 relative overflow-hidden"
        >
          {loading ? (
            <>
              {/* Background shimmer effect */}
              <div 
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent z-0"
                style={{
                  animation: 'shimmer 2s infinite',
                }}
              ></div>
              
              {/* Content */}
              <div className="flex items-center justify-center relative z-10">
                {/* Animated spinner with pulse effect */}
                <div className="relative mr-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <div className="absolute inset-0 animate-ping rounded-full h-5 w-5 border-2 border-white opacity-20"></div>
                </div>
                {/* Rotating message with fade animation */}
                <span 
                  key={loadingMessageIndex}
                  className="font-semibold animate-in fade-in duration-500"
                  style={{
                    animation: 'fadeIn 0.5s ease-in-out',
                  }}
                >
                  {loadingMessages[loadingMessageIndex]}
                </span>
              </div>
              
              {/* Sparkle effects around button */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-2 left-1/4 w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-60" style={{ animationDelay: '0s', animationDuration: '1.5s' }}></div>
                <div className="absolute top-2 right-1/4 w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-60" style={{ animationDelay: '0.5s', animationDuration: '1.5s' }}></div>
                <div className="absolute bottom-2 left-1/3 w-1.5 h-1.5 bg-white rounded-full animate-ping opacity-60" style={{ animationDelay: '1s', animationDuration: '1.5s' }}></div>
                <div className="absolute top-1/2 right-1/5 w-1 h-1 bg-white rounded-full animate-ping opacity-40" style={{ animationDelay: '1.5s', animationDuration: '2s' }}></div>
              </div>
            </>
          ) : (
            <span className="relative z-10">{t('onboarding.organization.continue', 'Continue')}</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default OrganizationNameStep;
