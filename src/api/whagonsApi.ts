import axios from 'axios';
import { getEnvVariables } from '@/lib/getEnvVariables';
import { auth } from '@/firebase/firebaseConfig';
import { ApiLoadingTracker } from './apiLoadingTracker';

const { VITE_API_URL, VITE_DEVELOPMENT} = getEnvVariables();

// Simple obfuscation key (in production, this should be more secure)
const OBFUSCATION_KEY = 'whagons-auth-key-2024';

// Deduplication for 403 error toasts - prevent showing same error multiple times
let last403Toast = { message: '', timestamp: 0 };

const PROTOCOL = VITE_DEVELOPMENT === 'true' ? 'http' : 'https';

// Simple obfuscation functions
const obfuscateToken = (token: string): string => {
  // XOR cipher with key
  let obfuscated = '';
  for (let i = 0; i < token.length; i++) {
    const charCode = token.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
    obfuscated += String.fromCharCode(charCode);
  }
  // Base64 encode the result
  return btoa(obfuscated);
};

const deObfuscateToken = (obfuscatedToken: string): string => {
  try {
    // Base64 decode first
    const decoded = atob(obfuscatedToken);
    // XOR cipher to get original token
    let original = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length);
      original += String.fromCharCode(charCode);
    }
    return original;
  } catch (error) {
    console.error('Failed to deobfuscate token:', error);
    return '';
  }
};

// Cookie utility functions
const setCookie = (name: string, value: string, days: number = 7) => {
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  // Remove Secure flag in development since localhost doesn't use HTTPS
  const secureFlag = VITE_DEVELOPMENT === 'true' ? '' : '; Secure';
  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Strict${secureFlag}`;
};

const getCookie = (name: string): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
};

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
};

// Enhanced token storage with Firebase UUID mapping
const setTokenForUser = (token: string, firebaseUid: string) => {
  const tokenData = {
    token: obfuscateToken(token),
    uid: firebaseUid,
    timestamp: Date.now()
  };
  setCookie('auth_token', btoa(JSON.stringify(tokenData)), 90); // 90 days
};

// Function to clear all stored tokens (for logout)
const clearAllTokens = () => {
  deleteCookie('auth_token');
  // Also clear any legacy tokens that might exist
  deleteCookie('auth_token_legacy');
};

// Export the getTokenForUser function for use in AuthContext
export const getTokenForUser = (firebaseUid: string): string | null => {
  const cookieValue = getCookie('auth_token');
  if (!cookieValue) return null;
  
  try {
    const tokenData = JSON.parse(atob(cookieValue));
    // Validate that this token belongs to the current Firebase user
    if (tokenData.uid !== firebaseUid) {
      console.warn('Token belongs to different user, clearing token');
      deleteCookie('auth_token');
      return null;
    }
    
    // Token expiration is now handled by the backend only
    
    return deObfuscateToken(tokenData.token);
  } catch (error) {
    console.error('Failed to parse stored token data:', error);
    deleteCookie('auth_token');
    return null;
  }
};

const getSubdomain = () => {
  //the default subdomain is nothing but once I can set it and get it from local storage
  return localStorage.getItem('whagons-subdomain') || '';
};

// Expose current tenant (domain prefix without trailing dot) for consumers like encryption AAD
export const getCurrentTenant = (): string => {
  const sd = getSubdomain();
  return sd.endsWith('.') ? sd.slice(0, -1) : sd;
};

export const setSubdomain = (subdomain: string) => {
  //add a dot at the end if missing, but only if subdomain is not empty
  if (subdomain && !subdomain.endsWith('.')) {
    subdomain += '.';
  }
  localStorage.setItem('whagons-subdomain', subdomain);
};

// Create API instance without store dependency
const api = axios.create({
  baseURL: `${PROTOCOL}://${getSubdomain()}${VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withXSRFToken: true,
  withCredentials: true,
});

// Function to update the auth token
export const updateAuthToken = (token: string) => {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  
  // Get current Firebase user's UID for secure token storage
  const currentUser = auth.currentUser;
  if (currentUser) {
    setTokenForUser(token, currentUser.uid);
  } else {
    console.warn('No Firebase user found when updating auth token');
    // Fallback to old method for edge cases
    setCookie('auth_token', obfuscateToken(token), 90); // 90 days
  }
};

// Function to check if we have a valid token in cookies
const getStoredToken = (): string | null => {
  const currentUser = auth.currentUser;
  if (currentUser) {
    return getTokenForUser(currentUser.uid);
  }
  
  // Fallback to old method for edge cases (migration support)
  const obfuscatedToken = getCookie('auth_token');
  if (obfuscatedToken) {
    try {
      // Try to parse as new format first
      const tokenData = JSON.parse(atob(obfuscatedToken));
      if (tokenData.token && tokenData.uid) {
        // This is new format but no current user yet
        // Don't clear the cookie - Firebase Auth might still be initializing
        // Just return null and let AuthContext handle it when user is available
        return null;
      }
    } catch {
      // This is old format, try to deobfuscate directly
      return deObfuscateToken(obfuscatedToken);
    }
  }
  return null;
};

// Initialize API with stored token if available
export const initializeAuth = () => {
  const storedToken = getStoredToken();
  if (storedToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
  }
};

// Function to refresh the token
const refreshToken = async () => {
  // First check if we have a valid stored token
  const storedToken = getStoredToken();
  if (storedToken) {
    // Try to use the stored token first
    api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    return storedToken;
  }

  let token = await auth.currentUser?.getIdToken();
  // console.log('Refreshing token', token);
  if (!token) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return refreshToken();
  }

  try {
    const response = await api.post(`/login`, {
      token: token,
    });

    if (response.status === 200) {
      // console.log('Successfully refreshed token');
      updateAuthToken(response.data.token);
      return response.data.token;
    } else {
      console.error('Refresh token failed');
      throw new Error('Refresh token failed');
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    // If refresh fails, clear the stored token
    deleteCookie('auth_token');
    throw error;
  }
};

// Ensure only a single refresh is in-flight across concurrent 401s
let inFlightRefresh: Promise<string> | null = null;
const getSingleFlightRefreshToken = async (): Promise<string> => {
  if (!inFlightRefresh) {
    inFlightRefresh = refreshToken().finally(() => {
      inFlightRefresh = null;
    });
  }
  return inFlightRefresh;
};

// Function to clear auth state
export const clearAuth = () => {
  delete api.defaults.headers.common['Authorization'];
  clearAllTokens();
  
  // Reset API baseURL to default (no subdomain) to clear subdomain from memory
  api.defaults.baseURL = `${PROTOCOL}://${VITE_API_URL}/api`;
};

// Initialize auth on module load
initializeAuth();

axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*';

console.log("Thing", `${PROTOCOL}://${getSubdomain()}${VITE_API_URL}/`, VITE_DEVELOPMENT)

const web = axios.create({
  baseURL: `${PROTOCOL}://${getSubdomain()}${VITE_API_URL}/`,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withXSRFToken: true,
  withCredentials: true,
});

// Add request interceptor to ensure every request uses the current subdomain
api.interceptors.request.use(
  (config) => {
    // Force every request to use the current subdomain from localStorage
    const currentSubdomain = getSubdomain();
    const correctBaseURL = `${PROTOCOL}://${currentSubdomain}${VITE_API_URL}/api`;
    
    // Override the baseURL for this specific request to ensure correct tenant routing
    config.baseURL = correctBaseURL;
    
    
    // Debug logging for invitation signup requests
    if (config.url?.includes('/invitations/signup/')) {
      console.log('Invitation signup request:', {
        url: config.url,
        subdomain: currentSubdomain,
        baseURL: config.baseURL,
        fullURL: `${config.baseURL}${config.url}`
      });
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor
api.interceptors.response.use(
  (response) => {
    
    // Handle 225 responses for tenant switching
    if (response.status === 225) {
      console.log('225 response detected, switching tenant for:', response.config.url);
      
      // Extract new subdomain from response data
      const tenant = response.data?.tenant;
      const domain_prefix = tenant.split('.')[0];
      console.log('Extracted domain_prefix:', domain_prefix);
      
      setSubdomain(domain_prefix);
      console.log('Set subdomain in localStorage:', localStorage.getItem('whagons-subdomain'));
      
      console.log('Tenant switched to:', domain_prefix, 'Need to retry request...');
      
      // Retry the original request - the request interceptor will use the new subdomain
      return api(response.config);
    }
    return response;
  },
  async (error) => {
    console.log('error interceptor triggered:', error.response?.status, error.config?.url);
    const originalRequest = error.config;

    // Handle 503 errors on /users/me (tenant database doesn't exist or is down)
    // Fall back to landlord by clearing subdomain and retrying
    if (
      error.response?.status === 503 &&
      originalRequest.url === '/users/me' &&
      !originalRequest._retryWithoutSubdomain
    ) {
      console.warn('503 on /users/me - tenant database unavailable, falling back to landlord');
      setSubdomain('');
      originalRequest._retryWithoutSubdomain = true;
      return api(originalRequest);
    }

    // Handle tenant-related 404s on login (either tenant missing or user missing in tenant)
    const tenantErrorMessages = [
      'Tenant not found for this domain.',
      'User not found. Please register first.'
    ];
    const tenantError = tenantErrorMessages.includes(error.response?.data?.error);
    if (tenantError) {
      setSubdomain('');
      deleteCookie('auth_token');
      clearAuth();

      if (
        originalRequest.url === '/login' &&
        !originalRequest._retryWithoutSubdomain
      ) {
        originalRequest._retryWithoutSubdomain = true;
        return api(originalRequest);
      }

      // Force re-login on landlord for any other failing endpoint by rejecting
      // so callers can handle the 404 and re-init auth flow.
      return Promise.reject(error);
    }

    // Handle 403 Forbidden errors - display server message via toast
    if (error.response?.status === 403) {
      const serverMessage = error.response?.data?.message || error.response?.data?.error || 'You do not have permission to perform this action.';
      
      // Deduplicate: only show toast if it's a different message or more than 1 second has passed
      const now = Date.now();
      if (last403Toast.message !== serverMessage || (now - last403Toast.timestamp) > 1000) {
        last403Toast = { message: serverMessage, timestamp: now };
        // Dynamically import toast to avoid circular dependencies
        const toast = (await import('react-hot-toast')).default;
        toast.error(serverMessage, { duration: 5000 });
      }
      
      // Still reject the error so callers can handle it if needed
      return Promise.reject(error);
    }

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/login'
    ) {
      originalRequest._retry = true;

      try {
        // console.log('originalRequest.url', originalRequest.url);
        // Clear stored token on 401 and get a fresh one
        deleteCookie('auth_token');
        // Single-flight refresh so concurrent 401s share the same /login
        const newToken = await getSingleFlightRefreshToken();

        return api({
          ...originalRequest,
          headers: {
            ...originalRequest.headers,
            Authorization: `Bearer ${newToken}`,
          },
        });
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        clearAuth();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Remove the tenant switching tracking since we're using request interceptor approach
export const isTenantSwitchingInProgress = () => false;
export const waitForTenantSwitching = async () => Promise.resolve();

// Note: `api` is exported here ONLY for internalApi.ts to re-export.
// UI components MUST NOT import `api` directly - use actionsApi from @/api/whagonsActionsApi instead.
// Store layer should import from @/store/api/internalApi
export { api };
