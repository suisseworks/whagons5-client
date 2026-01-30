// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  api as apiClient,
  getTokenForUser,
  initializeAuth,
} from '../api/whagonsApi';
import { User } from '../types/user';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { AppDispatch, RootState } from '../store/store';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { getTasksFromIndexedDB } from '../store/reducers/tasksSlice';
import { fetchNotificationPreferences } from '../store/reducers/notificationPreferencesSlice';

// Custom caches with advanced features
import { RealTimeListener } from '@/store/realTimeListener/RTL';
import { DB } from '@/store/indexedDB/DB';
import { DataManager } from '@/store/DataManager';
import { requestNotificationPermission, setupForegroundMessageHandler, unregisterToken } from '@/firebase/fcmHelper';

// Define context types
interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  user: User | null;
  loading: boolean;
  userLoading: boolean;
  hydrating: boolean;
  bootstrapComplete: boolean;
  hydrationError: string | null;
  refetchUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const POST_ONBOARDING_BOOTSTRAP_KEY = 'wh_post_onboarding_bootstrap_pending';
const POST_ONBOARDING_BOOTSTRAP_PENDING_EVENT = 'wh:postOnboardingBootstrapPending';
const POST_ONBOARDING_BOOTSTRAP_DONE_EVENT = 'wh:postOnboardingBootstrapDone';


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
  const [bootstrapComplete, setBootstrapComplete] = useState<boolean>(() => {
    try {
      return localStorage.getItem(POST_ONBOARDING_BOOTSTRAP_KEY) !== '1';
    } catch (_e) {
      return true;
    }
  });
  const [hydrationError, setHydrationError] = useState<string | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  
  // Only access userTeams if user has a tenant (avoid fetching during onboarding)
  // Must check user state OUTSIDE of useSelector to avoid triggering slice auto-fetch
  const hasTenant = user?.tenant_domain_prefix;
  
  // Memoized selector with shallow equality check to prevent unnecessary rerenders
  const userTeams = useSelector(
    (state: RootState) => {
      if (!hasTenant) {
        return [] as Array<{ team_id?: number }>;
      }
      return ((state as any)?.userTeams?.value ?? []) as Array<{ team_id?: number }>;
    },
    shallowEqual // Use shallow equality to compare array contents
  );
  const teamKey = useMemo(() => {
    if (!hasTenant) return '';
    const ids = Array.from(
      new Set(
        (userTeams || [])
          .map((ut) => Number((ut as any)?.team_id))
          .filter((n) => Number.isFinite(n))
      )
    ).sort((a, b) => a - b);
    return ids.join(',');
  }, [userTeams, hasTenant]);
  const prevTeamKeyRef = useRef<string | null>(null);

  // Initialize FCM (Firebase Cloud Messaging) for push notifications
  const initializeFCM = async (userData: User | null, fbUser: FirebaseUser | null) => {
    try {
      // Allow FCM in local development if using trusted certificates (mkcert)
      // Skip only if explicitly set in env or on unsecured localhost
      const skipFCM = import.meta.env.VITE_SKIP_FCM === 'true';
      
      if (skipFCM) {
        return;
      }

      // Only initialize FCM if user is authenticated (Firebase user exists)
      if (!fbUser || !userData) {
        return;
      }

      const token = await requestNotificationPermission();
      
      if (token) {
        // Setup listener for foreground messages
        setupForegroundMessageHandler();
      }
    } catch (error) {
      console.error('❌ FCM initialization error:', error);
      // Don't crash app if FCM fails
    }
  };

  const fetchUser = async (firebaseUser: FirebaseUser) => {
    if (!firebaseUser) {
      setUser(null);
      return;
    }

    // Skip fetching user data if we're on an invitation page
    // Invitation pages are for new signups, so we shouldn't try to fetch existing user data
    // This prevents unnecessary 401 errors when Firebase is logged in but user doesn't exist in backend yet
    // Use window.location.pathname since AuthProvider is outside Router context
    const isInvitationPage = window.location.pathname.startsWith('/auth/invitation/');
    if (isInvitationPage) {
      console.log('Skipping user fetch on invitation page');
      setUser(null);
      setUserLoading(false);
      return;
    }

    setUserLoading(true);
    
    // Retry logic: wait for token to be available (backend login might be in progress)
    const maxRetries = 5;
    const retryDelay = 500; // 500ms between retries
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Ensure auth is initialized for this user
        initializeAuth();

        // Also ensure API has the stored token before making the request
        const storedToken = getTokenForUser(firebaseUser.uid);
        if (storedToken) {
          apiClient.defaults.headers.common[
            'Authorization'
          ] = `Bearer ${storedToken}`;
        } else if (attempt < maxRetries) {
          // Token not available yet, wait and retry (backend login might be in progress)
          console.log(`AuthProvider: Token not available yet, waiting for backend login (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }

        // console.log('AuthContext: Fetching user data...');
        const response = await apiClient.get('/users/me');
        if (response.status === 200) {
          const userData = response.data.data || response.data;
          setUser(userData);
          // console.log('AuthContext: User data loaded successfully');

          // Initialize FCM for push notifications BEFORE hydration
          // This runs for all logged-in users, not just those with tenants
          (async () => {
            try {
              await initializeFCM(userData, firebaseUser);
            } catch (error) {
              console.error('FCM initialization failed:', error);
            }
          })();

          // Load notification preferences at login
          dispatch(fetchNotificationPreferences());

          // Kick off background hydration so UI can render immediately
          (async () => {
            try {
              setHydrating(true);
              setHydrationError(null);
              let shouldBlockWelcome = false;
              try {
                shouldBlockWelcome = localStorage.getItem(POST_ONBOARDING_BOOTSTRAP_KEY) === '1';
              } catch (_e) {
                shouldBlockWelcome = false;
              }
              setBootstrapComplete(!shouldBlockWelcome);
              if (!userData?.tenant_domain_prefix) {
                setBootstrapComplete(true);
                return;
              }
              console.log(firebaseUser.uid);
              const result = await DB.init(firebaseUser.uid);
              console.log('DB.init: result', result);
              if (!result) {
                console.warn('DB failed to initialize, deferring cache hydration');
                // Keep the bootstrap gate in place; user can refresh to retry.
                return;
              }

              // Explicitly wait for DB readiness to avoid races during first login
              const ready = await DB.whenReady();
              if (!ready) {
                console.warn('DB not ready after init, deferring cache hydration');
                return;
              }

              const dataManager = new DataManager(dispatch);
              try {
                await dataManager.loadCoreFromIndexedDB();
              } catch (err) {
                console.warn('AuthProvider: loadCoreFromIndexedDB failed (continuing to network hydration)', err);
              }
              if (shouldBlockWelcome) {
                // First load after onboarding: block the Welcome "Get Started" button
                // until the initial validation + refresh finishes.
                try {
                  await Promise.race([
                    dataManager.bootstrapAndSync(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('bootstrap sync timeout')), 60_000)),
                  ]);
                } catch (e) {
                  console.warn('AuthProvider: validation failed', e);
                }
                setHydrationError(null);

                try {
                  localStorage.removeItem(POST_ONBOARDING_BOOTSTRAP_KEY);
                } catch (_e) {}
                try {
                  window.dispatchEvent(new CustomEvent(POST_ONBOARDING_BOOTSTRAP_DONE_EVENT));
                } catch (_e) {}
                setBootstrapComplete(true);
              } else {
                // Normal loads: keep validation in background.
                try {
                  await dataManager.bootstrapAndSync();
                } catch (e) {
                  console.warn('AuthProvider: validation failed', e);
                }
                setHydrationError(null);

                setBootstrapComplete(true);
              }

              // Category custom fields will be hydrated by DataManager + on-demand fetches
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

          // Success - exit retry loop
          setUserLoading(false);
          return;
        }
      } catch (error) {
        const err = error as any;
        // If 401 and no token yet, retry (backend login might be in progress)
        if (err?.response?.status === 401 && attempt < maxRetries) {
          const storedToken = getTokenForUser(firebaseUser.uid);
          if (!storedToken) {
            console.log(`AuthProvider: 401 without token, retrying after delay (attempt ${attempt + 1}/${maxRetries + 1})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
        }
        
        // If this is the last attempt or a non-retryable error, log and exit
        if (attempt === maxRetries) {
          console.error('AuthContext: Error fetching user data after retries:', err);
          setUser(null);
          setUserLoading(false);
          return;
        } else {
          // For other errors, break and exit
          console.error('AuthContext: Error fetching user data:', err);
          setUser(null);
          setUserLoading(false);
          return;
        }
      }
    }
    
    // If we get here, all retries exhausted without success
    setUserLoading(false);
  };

  const refetchUser = async () => {
    if (firebaseUser) {
      await fetchUser(firebaseUser);
    }
  };

  // Update user state directly without full refetch (for optimistic updates)
  const updateUser = (updates: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updates });
    }
  };

  useEffect(() => {
    // Allow any part of the app (e.g. onboarding) to immediately signal that the
    // first post-onboarding bootstrap is pending, so the Welcome screen can block
    // instantly even before the /users/me refetch hydration flow begins.
    const onPostOnboardingBootstrapPending = () => {
      setBootstrapComplete(false);
    };
    window.addEventListener(POST_ONBOARDING_BOOTSTRAP_PENDING_EVENT, onPostOnboardingBootstrapPending as EventListener);

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // console.log('AuthContext: Auth state changed:', currentUser?.uid);
      setFirebaseUser(currentUser);

      if (currentUser) {
        // User logged in - fetch their data (will skip if on invitation page)
        await fetchUser(currentUser);
      } else {
        // User logged out - clear user data, IndexedDB and Redux state
        setUser(null);
        setHydrating(false);
        setBootstrapComplete(true);
        setHydrationError(null);
        
        // Unregister FCM token on logout
        try {
          await unregisterToken();
        } catch (err) {
          console.warn('AuthProvider: failed to unregister FCM token on logout', err);
        }
        
        try {
          const uid: string | undefined =
            (currentUser ? (currentUser as FirebaseUser).uid : undefined) ??
            firebaseUser?.uid ??
            auth.currentUser?.uid ??
            undefined;
          if (uid) {
            await DB.deleteDatabase(uid);
          }
        } catch (err) {
          console.warn('AuthProvider: failed to delete IndexedDB on logout', err);
        }
        try {
          dispatch({ type: 'auth/logout/reset' });
        } catch (err) {
          console.warn('AuthProvider: failed to reset Redux store on logout', err);
        }
      }

      setLoading(false);
    });

    return () => {
      window.removeEventListener(POST_ONBOARDING_BOOTSTRAP_PENDING_EVENT, onPostOnboardingBootstrapPending as EventListener);
      unsubscribe();
    };
  }, []); // Note: fetchUser checks window.location.pathname dynamically, so no need to re-run on route change

  // Note: userTeams is now hydrated via DataManager.bootstrapAndSync()
  // which uses batch integrity checking - no need for separate fetch here

  // Refresh Redux from cache when user's team memberships change.
  // Sync stream (DataManager) handles task visibility changes automatically.
  useEffect(() => {
    if (loading || userLoading || hydrating || !firebaseUser) {
      prevTeamKeyRef.current = null;
      return;
    }

    if (prevTeamKeyRef.current === null) {
      prevTeamKeyRef.current = teamKey;
      return;
    }

    if (prevTeamKeyRef.current === teamKey) {
      return;
    }

    prevTeamKeyRef.current = teamKey;

    (async () => {
      try {
        await dispatch(getTasksFromIndexedDB());
      } catch (err) {
        console.warn('AuthProvider: failed to refresh tasks after team change', err);
      }
    })();
  }, [teamKey, loading, userLoading, hydrating, firebaseUser, dispatch]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user,
        loading,
        userLoading,
        hydrating,
        bootstrapComplete,
        hydrationError,
        refetchUser,
        updateUser,
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
