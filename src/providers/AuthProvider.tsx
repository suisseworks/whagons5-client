// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  api as apiClient,
  getTokenForUser,
  initializeAuth,
} from '../api/whagonsApi';
import { User } from '../types/user';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
// Custom slice with advanced features (tasks only)
// import { getTasksFromIndexedDB } from '@/store/reducers/tasksSlice';

// Generic slices actions (handles all other tables)
import { genericActions, genericCaches } from '@/store/genericSlices';
import { GenericCache } from '@/store/indexedDB/GenericCache';

// Custom caches with advanced features
import { RealTimeListener } from '@/store/realTimeListener/RTL';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import {
  zeroizeKeys,
} from '@/crypto/crypto';
import { DB } from '@/store/indexedDB/DB';
import { verifyManifest } from '@/lib/manifestVerify';

// Define context types
interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  userLoading: boolean;
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
      const response = await apiClient.get('/users/me');
      if (response.status === 200) {
        const userData = response.data.data || response.data;
        setUser(userData);
        // console.log('AuthContext: User data loaded successfully');

        if (!userData?.tenant_domain_prefix) {
          return;
        }
        console.log(firebaseUser.uid)
        let result = await DB.init(firebaseUser.uid);
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



        try {
          // Validate only core keys, then refresh those slices
          const coreKeys = [
            'workspaces',
            'teams',
            'categories',
            'templates',
            'statuses',
            'priorities',
            'slas',
            'templates',
            'spots',
            'users'
          ] as const;
          const caches: GenericCache[] = coreKeys.map((k) => genericCaches[k]);
          await GenericCache.validateMultiple(caches);

          for (const key of coreKeys) {
            await dispatch((genericActions as any)[key].getFromIndexedDB());
          }
        } catch (e) {
          console.warn('AuthProvider: cache validate failed', e);
        }

        // Initialize and validate tasks AFTER core caches are ready
        await TasksCache.init();
        await TasksCache.validateTasks();


        // Manifest verify LAST to avoid racing with decryption/hydration
        try {
          const manifestResp = await apiClient.get('/sync/manifest');
          if (manifestResp.status === 200) {
            const m = manifestResp.data?.data || manifestResp.data;
            const ok = await verifyManifest(m);
            if (!ok) {
              console.warn('Manifest signature invalid');
            }
          }
        } catch (e) {
          console.warn('Manifest fetch/verify failed (continuing):', e);
        }


        console.log("here")

        // Category-field-assignments are fetched per category on demand and cached via GenericCache

        const rtl = new RealTimeListener({ debug: true });
        rtl.connectAndHold();
      }
    } catch (error) {
      console.error('AuthContext: Error fetching user data:', error);
      setUser(null);
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
