import axios from 'axios';
import { getEnvVariables } from '../helpers';
import { auth } from '../firebase/firebaseConfig';

const { VITE_API_URL } = getEnvVariables();

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
};

// Function to refresh the token
const refreshToken = async () => {
  let token = await auth.currentUser?.getIdToken();
  console.log('Refreshing token', token);
  if (!token) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return refreshToken();
  }

  try {
    const response = await api.post(`/login`, {
      token: token,
    });

    if (response.status === 200) {
      console.log('Successfully refreshed token');
      updateAuthToken(response.data.token);
      return response.data.token;
    } else {
      console.error('Refresh token failed');
      throw new Error('Refresh token failed');
    }
  } catch (error) {
    console.error('Error refreshing token:', error);
    throw error;
  }
};

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

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
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
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export { api, web };
