// Placeholder function to check if tenant name exists
// TODO: Replace with actual API call when backend endpoint is ready
export const checkTenantExists = async (tenantName: string): Promise<boolean> => {
  // Always return false for now as per requirement
  return false;
};

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