// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { api, getTokenForUser, initializeAuth } from '../api/whagonsApi';
import { User } from '../types/user';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
// Custom slice with advanced features (tasks only)
import { getTasksFromIndexedDB } from '@/store/reducers/tasksSlice';

// Generic slices actions (handles all other tables)
import { genericActions, genericCaches } from '@/store/genericSlices';

// Custom caches with advanced features
import { RealTimeListener } from '@/store/realTimeListener/RTL';
import { TasksCache } from '@/store/indexedDB/TasksCache';

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
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }

      // console.log('AuthContext: Fetching user data...');
      const response = await api.get('/users/me');
      if (response.status === 200) {
        const userData = response.data.data || response.data;
        setUser(userData);
        // console.log('AuthContext: User data loaded successfully');

        // On mount/reload: validate and hydrate caches, then populate Redux from IndexedDB

        // Initialize custom cache with advanced features
        await TasksCache.init();

        
        try {
          // Validate only core keys, then refresh those slices
          const coreKeys = ['workspaces',
            'teams',
            'categories',
            'templates',
            'statuses',
            'priorities',
            'slas',
            'priorities',
          ] as const;
          await Promise.all(coreKeys.map((k) => genericCaches[k].validate()));

          coreKeys.forEach((k) => {
            (dispatch as any)((genericActions as any)[k].getFromIndexedDB());
          });
        } catch (e) {
          console.warn('AuthProvider: cache validate failed', e);
        }

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
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      firebaseUser, 
      user, 
      loading, 
      userLoading,
      refetchUser 
    }}>
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
