// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase/firebaseConfig';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { api as apiClient, getTokenForUser, initializeAuth } from '../api/whagonsApi';
import { User } from '../types/user';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';
// Custom slice with advanced features (tasks only)
// import { getTasksFromIndexedDB } from '@/store/reducers/tasksSlice';

// Generic slices actions (handles all other tables)
import { genericActions, genericCaches } from '@/store/genericSlices';

// Custom caches with advanced features
import { RealTimeListener } from '@/store/realTimeListener/RTL';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { provisionKEK, provisionWrappedKEK, ensureCEK, getDevicePublicKey, zeroizeKeys, hasKEK, exportDeviceKeys, importDeviceKeys } from '@/crypto/crypto';
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
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }

      // console.log('AuthContext: Fetching user data...');
      const response = await apiClient.get('/users/me');
      if (response.status === 200) {
        const userData = response.data.data || response.data;
        setUser(userData);
        // console.log('AuthContext: User data loaded successfully');

        // Device provisioning (post-auth): register device, fetch KEK, provision worker, ensure CEKs per core store
        try {
          if (import.meta.env.VITE_CACHE_ENCRYPTION === 'true' || import.meta.env.VITE_DEVELOPMENT !== 'true') {
            // Ensure IndexedDB is initialized before using crypto stores
            if (!DB.inited) { await DB.init(); }
            // Check if we already have provisioning metadata
            const metaStore = DB.getStoreRead('crypto_meta' as any);
            const metaReq = metaStore.get('device');
            const meta = await new Promise<any>((resolve) => { metaReq.onsuccess = () => resolve(metaReq.result); metaReq.onerror = () => resolve(null); });

            let dkid: number | null = meta?.dkid ?? null;
            let kid: string = meta?.kid ?? '';
            const prevKid: string = kid;
            const now = Date.now();
            const expired = !meta?.expiresAt || now > meta.expiresAt;
            let deviceId: string = meta?.deviceId ?? '';

            console.log('meta', meta);

            // Persist device keypair locally (private key JWK + pub) and upsert device on server.
            try {
              const existingKeys = meta?.deviceKeys ?? null;
              if (existingKeys?.privJwk && existingKeys?.pubRawB64) {
                await importDeviceKeys(existingKeys.privJwk, existingKeys.pubRawB64);
              } else {
                const exported = await exportDeviceKeys();
                const metaWrite = DB.getStoreWrite('crypto_meta' as any);
                metaWrite.put({ key: 'device', ...(meta || {}), deviceKeys: exported });
              }
              // Ensure we have a stable client-side device_id
              if (!deviceId) { deviceId = (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random()}`; }
              // Always upsert server device record to match current dk_pub
              const dk_pub = await getDevicePublicKey();
              try { console.debug('[Auth] client dk_pub prefix', (dk_pub || '').slice(0, 24)); } catch {}
              const devReg = await apiClient.post('/devices', { dk_pub, curve: 'p256', device_id: deviceId });
              dkid = devReg.data?.data?.dkid || dkid;
              deviceId = devReg.data?.data?.device_id || deviceId;
              // Persist identifiers
              const metaWrite2 = DB.getStoreWrite('crypto_meta' as any);
              metaWrite2.put({ key: 'device', ...(meta || {}), dkid, deviceId, kid, expiresAt: meta?.expiresAt ?? null, deviceKeys: (meta?.deviceKeys ?? null) });
            } catch (_) {}

            // KEK lives only in memory. After reload we must fetch and provision it again.
            // Server should return the SAME KEK (same kid) unless it rotated/expired.
            // Always ensure KEK is present in the worker; metadata kid alone is not sufficient.
            // If server rotates (kid changes), we rewrap CEKs once using the old KEK, then switch.
            const kekPresentNow = await hasKEK();
            if (!kekPresentNow || !kid || expired) {
              console.debug('[Auth] requesting KEK for dkid', dkid, { prevKid, expired });
              // Double-check current device pub just before KEK request to avoid race
              try { const curPub = await getDevicePublicKey(); console.debug('[Auth] client dk_pub prefix (pre-KEK)', (curPub || '').slice(0, 24)); } catch {}
              // Do NOT request preferKid here; a new device key may be in use and the old KEK would be wrapped to the old pub
              const kekResp = await apiClient.post(`/devices/${dkid}/kek`);
              const raw = kekResp.data?.data?.rawKEK;
              const wrapped = kekResp.data?.data?.wrappedKEK;
              const newKid = kekResp.data?.data?.kid || kid;
              const expIso = kekResp.data?.data?.expiresAt;
              try { console.debug('[Auth] server dk_pub_used_prefix', kekResp.data?.data?.debug?.dk_pub_used_prefix); } catch {}
              console.debug('[Auth] KEK response', { kid: newKid, hasRaw: !!raw, hasWrapped: !!wrapped, expIso });
              // Rotation-safe flow: if kid changed and we have prevKid, provision OLD KEK first, rewrap, then switch to NEW KEK
              if (prevKid && newKid && newKid !== prevKid) {
                console.debug('[Auth] kid changed; provisioning old KEK', prevKid, 'before rewrap');
                try {
                  const oldResp = await apiClient.post(`/devices/${dkid}/kek`, { preferKid: prevKid });
                  const oldRaw = oldResp.data?.data?.rawKEK;
                  const oldWrapped = oldResp.data?.data?.wrappedKEK;
                  if (oldRaw) { await provisionKEK(oldRaw); console.debug('[Auth] provision old KEK (raw) ok'); }
                  else if (oldWrapped) { await provisionWrappedKEK(oldWrapped); console.debug('[Auth] provision old KEK (wrapped) ok'); }
                } catch (e) { console.warn('[Auth] failed to provision old KEK for rewrap', e); }
                // Rewrap all CEKs to NEW kid using NEW KEK material
                if (raw) { await DB.rewrapAllCEKs({ newKid: newKid, rawKEKBase64: raw }); }
                else if (wrapped) { await DB.rewrapAllCEKs({ newKid: newKid, wrappedKEKEnvelope: wrapped }); }
                // Now switch worker to NEW KEK
                if (raw) { await provisionKEK(raw); console.debug('[Auth] switched to new KEK (raw)'); }
                else if (wrapped) { await provisionWrappedKEK(wrapped); console.debug('[Auth] switched to new KEK (wrapped)'); }
                kid = newKid;
              } else {
                // No rotation or no previous kid: just provision the returned KEK
                if (raw) {
                  await provisionKEK(raw);
                  console.debug('[Auth] provisionKEK(raw) ok');
                } else if (wrapped) {
                  await provisionWrappedKEK(wrapped);
                  console.debug('[Auth] provisionWrappedKEK ok');
                }
                kid = newKid;
              }
              const metaWrite = DB.getStoreWrite('crypto_meta' as any);
              const merged = {
                ...(meta || {}),
                key: 'device',
                dkid,
                deviceId,
                kid,
                deviceKeys: (meta?.deviceKeys ?? undefined),
                expiresAt: expIso ? new Date(expIso).getTime() : (now + 30*24*3600*1000),
              };
              metaWrite.put(merged as any);

              // Diagnostics: compare cache_keys kids vs newly provisioned kid
              try {
                const ksReadAll = DB.getStoreRead('cache_keys' as any);
                const reqAll = ksReadAll.getAll();
                const entries: any[] = await new Promise((resolve) => { reqAll.onsuccess = () => resolve(reqAll.result || []); reqAll.onerror = () => resolve([]); });
                const kids = Array.from(new Set(entries.map((e: any) => e?.kid).filter(Boolean)));
                console.debug('[Auth] cache_keys kids', kids, 'current kid', kid);
                if (kids.some((k: string) => k !== kid)) {
                  console.debug('[Auth] rewrapAllCEKs due to kid mismatch in cache_keys');
                  if (raw) {
                    await DB.rewrapAllCEKs({ newKid: kid, rawKEKBase64: raw });
                  } else if (wrapped) {
                    await DB.rewrapAllCEKs({ newKid: kid, wrappedKEKEnvelope: wrapped });
                  }
                }
              } catch {}
            }

            // Wait until worker confirms KEK is provisioned
            let kekReady = await hasKEK();
            if (!kekReady) {
              // brief retry loop (<= 200ms) to avoid races
              for (let i = 0; i < 4 && !kekReady; i++) { await new Promise(r => setTimeout(r, 50)); kekReady = await hasKEK(); }
            }

            // Ensure CEK per core store and persist wrapped CEKs (wrapped by KEK)
            if (kekReady) {
              const coreStores = ['workspaces','teams','categories','templates','statuses','priorities','slas','tasks'] as const;
              for (const s of coreStores) {
                const ksRead = DB.getStoreRead('cache_keys' as any);
                const getReq = ksRead.get(s);
                const existing = await new Promise<any>((resolve) => { getReq.onsuccess = () => resolve(getReq.result); getReq.onerror = () => resolve(null); });
                const { wrappedCEK } = await ensureCEK(s, existing?.wrappedCEK ?? null);
                if (!existing && wrappedCEK) {
                  const ks = DB.getStoreWrite('cache_keys' as any);
                  ks.put({ store: s, wrappedCEK, kid, createdAt: Date.now() });
                }
              }
            }
          }
        } catch (e) {
          console.warn('Provisioning failed (dev mode likely):', e);
        }

        // On mount/reload: provision keys → validate caches → hydrate Redux → init tasks → verify manifest

        
        try {
          // Validate only core keys, then refresh those slices
          const coreKeys = ['workspaces','teams','categories','templates','statuses','priorities','slas'] as const;
          await Promise.all(coreKeys.map((k) => genericCaches[k].validate()));

          // Await hydration from IndexedDB so UI renders after caches are ready
          await Promise.all(coreKeys.map((k) =>
            (dispatch as any)((genericActions as any)[k].getFromIndexedDB())
          ));
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
