import api from '@/api/whagonsApi';

// Check if tenant name exists (availability check)
export const checkTenantExists = async (tenantName: string): Promise<boolean> => {
  try {
    // Try to check via API endpoint if it exists
    // For now, we'll use a GET request to check tenant availability
    // If the endpoint doesn't exist, it will gracefully fail and return false
    const response = await api.get(`/tenants/check-availability/${encodeURIComponent(tenantName)}`, {
      validateStatus: (status) => status < 500 // Don't throw on 404
    });
    
    // If endpoint exists and returns 200, tenant exists
    // If 404, tenant doesn't exist (available)
    return response.status === 200;
  } catch (error: any) {
    // If endpoint doesn't exist (404) or network error, assume available
    // This allows graceful degradation
    if (error.response?.status === 404) {
      return false; // Available
    }
    // For other errors, throw to let caller handle
    throw error;
  }
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