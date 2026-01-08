// NOTE: checkTenantExists has been migrated to Redux-based state management
// See: src/store/reducers/tenantAvailabilitySlice.ts
// Use checkTenantAvailability thunk from Redux instead

// Generate random suffix for non-paying users
export const generateTenantSuffix = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 10; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Create final tenant name based on subscription status
export const createTenantName = (baseName: string, hasActiveSubscription: boolean): string => {
  if (hasActiveSubscription) {
    return baseName;
  }
  
  const suffix = generateTenantSuffix();
  return `${baseName}-${suffix}`;
}; 