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
import {
  CryptoHandler,
  hasKEK,
  zeroizeKeys,
} from '@/crypto/crypto';
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
  hydrationError: string | null;
  refetchUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CORE_ENCRYPTED_STORES: readonly string[] = [
  'workspaces',
  'teams',
  'categories',
  'templates',
  'statuses',
  'status_transitions',
  'status_transition_groups',
  'priorities',
  'slas',
  'approvals',
  'approval_approvers',
  'task_approval_instances',
  'spots',
  'spot_types',
  'users',
  'user_teams',
  'invitations',
  'job_positions',
  'forms',
  'form_versions',
  'custom_fields',
  'category_custom_fields',
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface WaitForKekOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  label?: string;
}

async function waitForKEKReady(options: WaitForKekOptions = {}): Promise<boolean> {
  const { maxAttempts = 40, baseDelayMs = 250, label = 'AuthProvider.waitForKEKReady' } = options;
  const start = performance.now();
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ready = await hasKEK();
    if (ready) {
      if (attempt > 1) {
        console.info(`${label}: KEK ready after ${attempt} attempts (${Math.round(performance.now() - start)}ms)`);
      }
      return true;
    }
    const elapsed = Math.round(performance.now() - start);
    console.debug(`${label}: waiting for KEK (attempt ${attempt}/${maxAttempts}, elapsed ${elapsed}ms)`);
    await wait(baseDelayMs * attempt);
  }
  console.error(`${label}: KEK not provisioned after ${maxAttempts} attempts (~${Math.round(performance.now() - start)}ms)`);
  return false;
}

async function ensureStoreCEK(store: string, maxAttempts = 10): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ok = await DB.ensureCEKForStore(store);
    if (ok) return true;
    await wait(250 * (attempt + 1));
  }
  console.warn(`AuthProvider: CEK still not ready for ${store} after retries`);
  return false;
}

type CryptoInitFailureReason = 'init_failed' | 'kek_timeout';
type EnsureCryptoResult =
  | { ok: true }
  | { ok: false; reason: CryptoInitFailureReason; error: Error };

async function runCryptoInitAttempt(label: string): Promise<EnsureCryptoResult> {
  try {
    await CryptoHandler.init();
  } catch (error) {
    return { ok: false, reason: 'init_failed', error: error as Error };
  }

  const kekReady = await waitForKEKReady({ label });
  if (!kekReady) {
    return {
      ok: false,
      reason: 'kek_timeout',
      error: new Error('KEK not provisioned after retries'),
    };
  }

  return { ok: true };
}

async function ensureCoreCryptoReady(): Promise<EnsureCryptoResult> {
  let initResult = await runCryptoInitAttempt('AuthProvider.waitForKEKReady#1');

  if (!initResult.ok) {
    console.warn('AuthProvider: crypto init attempt failed, retrying once', initResult.reason, initResult.error);
    CryptoHandler.reset();
    initResult = await runCryptoInitAttempt('AuthProvider.waitForKEKReady#retry');
    if (!initResult.ok) {
      return initResult;
    }
  }

  const pendingStores: string[] = [];
  for (const store of CORE_ENCRYPTED_STORES) {
    const storeReady = await ensureStoreCEK(store);
    if (!storeReady) {
      pendingStores.push(store);
    }
  }
  if (pendingStores.length) {
    console.warn('AuthProvider: CEK still pending for stores (will retry lazily)', pendingStores);
  }

  return { ok: true };
}

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
              if (!userData?.tenant_domain_prefix) {
                // Ensure crypto knows we're not in tenant mode
                CryptoHandler.setTenantMode(false);
                return;
              }
              // Enable tenant mode for crypto operations
              CryptoHandler.setTenantMode(true);
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

              const cryptoStatus = await ensureCoreCryptoReady();
              if (!cryptoStatus.ok) {
                const friendlyMessage =
                  cryptoStatus.reason === 'kek_timeout'
                    ? 'Still preparing encrypted cache. Please refresh the page to retry.'
                    : 'Secure storage initialization failed. Please reload and try again.';
                setHydrationError(friendlyMessage);
                console.error('AuthProvider: ensureCoreCryptoReady failed', cryptoStatus);
                return;
              }

              const dataManager = new DataManager(dispatch);
              try {
                await dataManager.loadCoreFromIndexedDB();
              } catch (err) {
                console.warn('AuthProvider: loadCoreFromIndexedDB failed (continuing to network hydration)', err);
              }
              (async () => {
                try {
                  await dataManager.validateAndRefresh();
                } catch (e) {
                  console.warn('AuthProvider: validation failed', e);
                }
              })();
              setHydrationError(null);

              // Verify manifest
              try {
                await dataManager.verifyManifest();
              } catch (e) {
                console.warn('Manifest fetch/verify failed (continuing):', e);
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
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // console.log('AuthContext: Auth state changed:', currentUser?.uid);
      setFirebaseUser(currentUser);

      if (currentUser) {
        // User logged in - fetch their data (will skip if on invitation page)
        await fetchUser(currentUser);
      } else {
        // User logged out - clear user data, crypto keys, IndexedDB and Redux state
        setUser(null);
        CryptoHandler.setTenantMode(false);
        setHydrating(false);
        setHydrationError(null);
        
        // Unregister FCM token on logout
        try {
          await unregisterToken();
        } catch (err) {
          console.warn('AuthProvider: failed to unregister FCM token on logout', err);
        }
        
        try {
          await zeroizeKeys();
        } catch {}
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
      unsubscribe();
    };
  }, []); // Note: fetchUser checks window.location.pathname dynamically, so no need to re-run on route change

  // Note: userTeams is now validated via DataManager.validateAndRefresh() 
  // which uses batch integrity checking - no need for separate fetch here

  // Refresh tasks when the user's team memberships change so stale team tasks disappear from local cache
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
        await TasksCache.init();
        await TasksCache.fetchTasks();
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