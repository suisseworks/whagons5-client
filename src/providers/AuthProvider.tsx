// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  api as apiClient,
  getTokenForUser,
  initializeAuth,
  updateAuthToken,
} from '../api/whagonsApi';
import { User } from '../types/user';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';

// Custom caches with advanced features
import { RealTimeListener } from '@/store/realTimeListener/RTL';
import {
  zeroizeKeys,
} from '@/crypto/crypto';
import { DB } from '@/store/indexedDB/DB';
import { DataManager } from '@/store/DataManager';

// Define context types
interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  userLoading: boolean;
  hydrating: boolean;
  refetchUser: () => Promise<void>;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthProvider component to wrap the app and provide user state
interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [userLoading, setUserLoading] = useState<boolean>(false);
  const [hydrating, setHydrating] = useState<boolean>(false);
  const dispatch = useDispatch<AppDispatch>();

  const fetchUser = async (firebaseUser: FirebaseUser) => {
    if (!firebaseUser) {
      setUser(null);
      return;
    }

    setUserLoading(true);
    try {
      // Ensure auth is initialized for this user
      initializeAuth();

      // Also ensure API has the stored token before making the request
      const storedToken = getTokenForUser(firebaseUser.uid);
      if (storedToken) {
        apiClient.defaults.headers.common[
          'Authorization'
        ] = `Bearer ${storedToken}`;
      }

      // console.log('AuthContext: Fetching user data...');
      let response = await apiClient.get('/users/me');
      if (response.status === 200) {
        const userData = response.data.data || response.data;
        setUser(userData);
        // console.log('AuthContext: User data loaded successfully');

        // Kick off background hydration so UI can render immediately
        (async () => {
          try {
            setHydrating(true);
            // Proceed with hydration even if tenant_domain_prefix is missing
            console.log(firebaseUser.uid);
            const result = await DB.init(firebaseUser.uid);
            console.log('DB.init: result', result);
            if (!result) {
              console.warn('DB failed to initialize, deferring cache hydration');
              return;
            }

            // Explicitly wait for DB readiness to avoid races during first login
            const ready = await DB.whenReady();
            if (!ready) {
              console.warn('DB not ready after init, deferring cache hydration');
              return;
            }

            const dataManager = new DataManager(dispatch);
            await dataManager.loadCoreFromIndexedDB();


            // Background validation
            (async () => {
              try {
                await dataManager.validateAndRefresh();
              } catch (e) {
                console.warn('AuthProvider: validation failed', e);
              }
            })();

            // Verify manifest
            try {
              await dataManager.verifyManifest();
            } catch (e) {
              console.warn('Manifest fetch/verify failed (continuing):', e);
            }

            // Category-field-assignments are fetched per category on demand and cached via GenericCache
            const rtl = new RealTimeListener(
              // {
              //   debug: true,
              // }
            );
            rtl.connectAndHold();
          } catch (err) {
            console.warn('AuthProvider: background hydration failed', err);
          } finally {
            setHydrating(false);
          }
        })();

      } else {
        throw new Error('Unexpected status for /users/me');
      }
    } catch (error) {
      console.error('AuthContext: Error fetching user data (will try re-login):', error);
      try {
        // Force a fresh token and login, then retry once
        const freshIdToken = await firebaseUser.getIdToken(true);
        const loginResp = await apiClient.post('/login', { token: freshIdToken });
        if (loginResp?.status === 200 && loginResp?.data?.token) {
          updateAuthToken(loginResp.data.token);
        }
        const retry = await apiClient.get('/users/me');
        if (retry.status === 200) {
          const userData = retry.data.data || retry.data;
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (err2) {
        console.error('AuthContext: re-login retry failed:', err2);
        setUser(null);
      }
    } finally {
      setUserLoading(false);
    }
  };

  const refetchUser = async () => {
    if (firebaseUser) {
      await fetchUser(firebaseUser);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // console.log('AuthContext: Auth state changed:', currentUser?.uid);
      setFirebaseUser(currentUser);

      if (currentUser) {
        // User logged in - fetch their data
        await fetchUser(currentUser);
      } else {
        // User logged out - clear user data
        setUser(null);
        try {
          await zeroizeKeys();
        } catch {}
        try {
          await DB.clearCryptoStores();
          await DB.clear('tasks');
        } catch {}
      }

      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        userLoading,
        hydrating,
        refetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use authentication state in any component
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Backward compatibility - keep the old interface
export const useAuthUser = () => {
  const { user } = useAuth();
  return user;
};
