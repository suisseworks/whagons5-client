import axios from 'axios';
import { getEnvVariables } from '../helpers';
import { auth } from '../firebase/firebaseConfig';

const { VITE_API_URL } = getEnvVariables();

// Simple obfuscation key (in production, this should be more secure)
const OBFUSCATION_KEY = 'whagons-auth-key-2024';

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
  document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Strict; Secure`;
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

// Create API instance without store dependency
const api = axios.create({
  baseURL: `http://${VITE_API_URL}/api`,
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
  // Save token to cookie (expires in 30 minutes)
  setCookie('auth_token', obfuscateToken(token), 30 / (24 * 60)); // 30 minutes in days
};

// Function to check if we have a valid token in cookies
const getStoredToken = (): string | null => {
  const obfuscatedToken = getCookie('auth_token');
  if (obfuscatedToken) {
    return deObfuscateToken(obfuscatedToken);
  }
  return null;
};

// Initialize API with stored token if available
const initializeAuth = () => {
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

// Function to clear auth state
export const clearAuth = () => {
  delete api.defaults.headers.common['Authorization'];
  deleteCookie('auth_token');
};

// Initialize auth on module load
initializeAuth();

axios.defaults.headers.post['Access-Control-Allow-Origin'] = '*';

const web = axios.create({
  baseURL: `http://${VITE_API_URL}/`,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  withXSRFToken: true,
  withCredentials: true,
});

// Add response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

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
        const newToken = await refreshToken();

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

export default api;

export { api, web };
