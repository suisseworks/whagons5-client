import { auth } from '@/firebase/firebaseConfig';
import {
  encryptRow,
  decryptRow,
  ensureCEK as workerEnsureCEK,
  CryptoHandler,
  WrappedKEKEnvelope,
  rewrapCekBlobWithWrappedKEK,
  rewrapCekBlobWithRawKEK
} from '@/crypto/crypto';
import { getCurrentTenant } from '@/api/whagonsApi';


// Current database version - increment when schema changes
const CURRENT_DB_VERSION = '1.6.0';
const DB_VERSION_KEY = 'indexeddb_version';

//static class to access the message cache
// Export the DB class
export class DB {
  static db: IDBDatabase;
  static inited = false;
  private static initPromise: Promise<boolean> | null = null;
  // Per-store operation queue to serialize actions over the same object store
  private static storeQueues: Map<string, Promise<any>> = new Map();

  // Per-store encryption overrides (true = enabled, false = disabled)
  private static storeEncryptionOverrides: Map<string, boolean> = new Map();

  private static runExclusive<T>(storeName: string, fn: () => Promise<T>): Promise<T> {
    const tail = DB.storeQueues.get(storeName) || Promise.resolve();
    const next = tail.catch(() => {}).then(fn);
    // Ensure the tail always advances even if next rejects
    DB.storeQueues.set(storeName, next.catch(() => {}));
    return next;
  }

  // Allow callers to toggle encryption on a per-store basis (e.g., disable for 'tasks')
  public static setEncryptionForStore(storeName: string, enabled: boolean): void {
    DB.storeEncryptionOverrides.set(storeName, enabled);
  }

  public static getEncryptionForStore(storeName: string): boolean {
    const override = DB.storeEncryptionOverrides.get(storeName);
    if (override !== undefined) return override;
    return DB.ENCRYPTION_ENABLED;
  }

  private static isEncryptionEnabledForStore(storeName: string): boolean {
    const override = DB.storeEncryptionOverrides.get(storeName);
    if (override !== undefined) return override;
    return DB.ENCRYPTION_ENABLED;
  }

  static async init(uid?: string): Promise<boolean> {
    if (DB.inited) return true;
    if (DB.initPromise) {
      // If a prior init started without a uid, wait for it; if it didn't complete, retry with provided uid
      const ok = await DB.initPromise.catch(() => false);
      if (DB.inited && DB.db) return true;
      if (uid && !ok) {
        // Retry initialization with the explicit uid
      } else {
        return ok;
      }
    }

    DB.initPromise = (async () => {
      // Wait for a user id if not provided
      const userID = await DB.waitForUID(uid);
      if (!userID) {
        try { console.warn('DB.init: no user id available after waiting'); } catch {}
        DB.initPromise = null;
        return false as any;
      }

      try {
        console.log('DB.init: starting', {
          uid: userID,
          secureContext: (globalThis as any).isSecureContext,
          hasIndexedDB: typeof indexedDB !== 'undefined',
          locationProtocol: (globalThis as any).location?.protocol,
        });
      } catch {}

      // Check stored version against current version
      const storedVersion = localStorage.getItem(DB_VERSION_KEY);
      const shouldResetDatabase = storedVersion !== CURRENT_DB_VERSION;

      if (shouldResetDatabase && storedVersion) {
        console.log(
          `DB.init: Version changed from ${storedVersion} to ${CURRENT_DB_VERSION}, resetting database`,
          userID
        );
        await DB.deleteDatabase(userID);
      }

      // Store current version
      localStorage.setItem(DB_VERSION_KEY, CURRENT_DB_VERSION);

      const request = indexedDB.open(userID, 1);

      // Wrap in a Promise to await db setup
      const db = await new Promise<IDBDatabase>((resolve, _reject) => {
        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          try { console.log('DB.init: onupgradeneeded'); } catch {}
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('workspaces')) {
            db.createObjectStore('workspaces', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('categories')) {
            db.createObjectStore('categories', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('tasks')) {
            db.createObjectStore('tasks', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('teams')) {
            db.createObjectStore('teams', { keyPath: 'id' });
          }
          // New reference tables used by RTL publications
          if (!db.objectStoreNames.contains('statuses')) {
            db.createObjectStore('statuses', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('priorities')) {
            db.createObjectStore('priorities', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('spots')) {
            db.createObjectStore('spots', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('tags')) {
            db.createObjectStore('tags', { keyPath: 'id' });
          }
          // Custom fields and category-field-assignments (GenericCache-backed)
          if (!db.objectStoreNames.contains('custom_fields')) {
            db.createObjectStore('custom_fields', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('category_field_assignments')) {
            db.createObjectStore('category_field_assignments', {
              keyPath: 'id',
            });
          }

          // User management tables
          if (!db.objectStoreNames.contains('users')) {
            db.createObjectStore('users', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('roles')) {
            db.createObjectStore('roles', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('permissions')) {
            db.createObjectStore('permissions', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('user_teams')) {
            db.createObjectStore('user_teams', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('user_permissions')) {
            db.createObjectStore('user_permissions', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('role_permissions')) {
            db.createObjectStore('role_permissions', { keyPath: 'id' });
          }
          // task_users store removed - user assignments are now stored as JSON in tasks.user_ids
          if (!db.objectStoreNames.contains('status_transitions')) {
            db.createObjectStore('status_transitions', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('task_tags')) {
            db.createObjectStore('task_tags', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('spot_types')) {
            db.createObjectStore('spot_types', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('slas')) {
            db.createObjectStore('slas', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('sla_alerts')) {
            db.createObjectStore('sla_alerts', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('category_priorities')) {
            db.createObjectStore('category_priorities', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('forms')) {
            db.createObjectStore('forms', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('invitations')) {
            db.createObjectStore('invitations', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('task_logs')) {
            db.createObjectStore('task_logs', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('templates')) {
            db.createObjectStore('templates', { keyPath: 'id' });
          }

          // Custom Fields & Values
          if (!db.objectStoreNames.contains('spot_custom_fields')) {
            db.createObjectStore('spot_custom_fields', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('template_custom_fields')) {
            db.createObjectStore('template_custom_fields', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('task_custom_field_values')) {
            db.createObjectStore('task_custom_field_values', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('spot_custom_field_values')) {
            db.createObjectStore('spot_custom_field_values', { keyPath: 'id' });
          }

          // Forms & Fields
          if (!db.objectStoreNames.contains('form_fields')) {
            db.createObjectStore('form_fields', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('form_versions')) {
            db.createObjectStore('form_versions', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('task_forms')) {
            db.createObjectStore('task_forms', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('field_options')) {
            db.createObjectStore('field_options', { keyPath: 'id' });
          }

          // Activity & Logging
          if (!db.objectStoreNames.contains('session_logs')) {
            db.createObjectStore('session_logs', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('config_logs')) {
            db.createObjectStore('config_logs', { keyPath: 'id' });
          }

          // File Management
          if (!db.objectStoreNames.contains('task_attachments')) {
            db.createObjectStore('task_attachments', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('task_recurrences')) {
            db.createObjectStore('task_recurrences', { keyPath: 'id' });
          }

          // Error Tracking
          if (!db.objectStoreNames.contains('exceptions')) {
            db.createObjectStore('exceptions', { keyPath: 'id' });
          }
          // Keys store for per-store Content Encryption Keys (CEKs)
          if (!db.objectStoreNames.contains('cache_keys')) {
            const ks = db.createObjectStore('cache_keys', { keyPath: 'store' });
            ks.createIndex('store_idx', 'store', { unique: true });
            // store -> { wrappedCEK: { iv, ct }, kid }
          }
          // Crypto provisioning metadata
          if (!db.objectStoreNames.contains('crypto_meta')) {
            db.createObjectStore('crypto_meta', { keyPath: 'key' });
          }
        };

        request.onerror = () => {
          console.error('DB.init: Error opening database:', request.error);
          _reject(request.error as any);
        };
        request.onblocked = () => {
          console.warn('DB.init: open request blocked - another tab/window may be holding the database open');
        };
        request.onsuccess = () => {
          try { console.log('DB.init: open success'); } catch {}
          resolve(request.result);
        };
      });

      DB.db = db;
      try {
        DB.db.onversionchange = () => {
          try { console.warn('DB.onversionchange: closing DB connection'); } catch {}
          try { DB.db?.close(); } catch {}
          DB.inited = false;
        };
      } catch {}
      DB.inited = true;
      try { console.log('DB.init: DB assigned and inited set to true'); } catch {}
      DB.initPromise = null as any;
      return true as any;
    })();

    await DB.initPromise;
    await CryptoHandler.init();
    return DB.inited;
  }

  // Wait until DB.db is assigned and DB.inited is true. Used to avoid races on login.
  public static async whenReady(timeoutMs: number = 5000): Promise<boolean> {
    if (DB.inited && DB.db) return true;
    const start = Date.now();
    while (!(DB.inited && DB.db)) {
      if (DB.initPromise) {
        try { await DB.initPromise; } catch {}
      } else {
        // Let the event loop progress; avoid tight loop
        await new Promise((r) => setTimeout(r, 10));
      }
      if (DB.inited && DB.db) return true;
      if (Date.now() - start > timeoutMs) {
        try { console.warn('DB.whenReady: timed out waiting for DB readiness'); } catch {}
        return false;
      }
    }
    return true;
  }

  private static async waitForUID(prefUid?: string, timeoutMs: number = 15000): Promise<string | null> {
    if (prefUid) return prefUid;
    const start = Date.now();
    let current: string | undefined | null = auth.currentUser?.uid;
    while (!current) {
      await new Promise((r) => setTimeout(r, 20));
      current = auth.currentUser?.uid;
      if (current) break;
      if (Date.now() - start > timeoutMs) return null;
    }
    return current as string;
  }

  public static async deleteDatabase(userID: string): Promise<void> {
    // Clear session storage for good measure
    sessionStorage.clear();

    // Clear all cache initialization flags from localStorage
    if (auth.currentUser?.uid) {
      const userId = auth.currentUser.uid;

      // Clear workspace cache flags
      localStorage.removeItem(`workspaceCacheInitialized-${userId}`);
      localStorage.removeItem(`workspaceCacheLastUpdated-${userId}`);

      // Clear teams cache flags
      localStorage.removeItem(`teamsCacheInitialized-${userId}`);
      localStorage.removeItem(`teamsCacheLastUpdated-${userId}`);

      // Clear categories cache flags
      localStorage.removeItem(`categoriesCacheInitialized-${userId}`);
      localStorage.removeItem(`categoriesCacheLastUpdated-${userId}`);

      // Clear tasks cache flags
      localStorage.removeItem(`tasksCacheInitialized-${userId}`);
      localStorage.removeItem(`tasksCacheLastUpdated-${userId}`);

      console.log(`Cleared all cache flags for user ${userId}`);
    }

    // First close our own connection to the database if it exists
    if (DB.inited && DB.db) {
      try {
        DB.db.close();
        console.log('Closed existing database connection');
      } catch (err) {
        console.error('Error closing database connection:', err);
      }
      DB.inited = false;
      DB.db = undefined as unknown as IDBDatabase;
    }

    return new Promise<void>((resolve, _reject) => {
      // Create a timeout to prevent indefinite hanging
      const timeout = setTimeout(() => {
        console.warn('Database deletion timed out after 5 seconds');
        resolve(); // Resolve anyway to prevent hanging
      }, 5000);

      try {
        const request = indexedDB.deleteDatabase(userID);

        request.onsuccess = () => {
          clearTimeout(timeout);
          console.log('Database successfully deleted');
          resolve();
        };

        request.onerror = () => {
          clearTimeout(timeout);
          console.error('Error deleting database:', request.error);
          // Still resolve to prevent hanging
          resolve();
        };

        // Critical: Handle blocked events
        request.onblocked = () => {
          console.warn('Database deletion blocked - connections still open');
          // We'll continue waiting for the timeout
        };
      } catch (err) {
        clearTimeout(timeout);
        console.error('Exception during database deletion:', err);
        resolve(); // Resolve anyway to prevent hanging
      }
    });
  }

  

  public static getStoreRead(
    name:
      | 'workspaces'
      | 'categories'
      | 'tasks'
      | 'teams'
      | 'statuses'
      | 'priorities'
      | 'spots'
      | 'tags'
      | 'custom_fields'
      | 'category_field_assignments'
      | 'users'
      | 'roles'
      | 'permissions'
      | 'user_teams'
      | 'user_permissions'
      | 'role_permissions'

      | 'status_transitions'
      | 'task_tags'
      | 'spot_types'
      | 'slas'
      | 'sla_alerts'
      | 'category_priorities'
      | 'forms'
      | 'invitations'
      | 'task_logs'
      | 'templates'
      | 'spot_custom_fields'
      | 'template_custom_fields'
      | 'task_custom_field_values'
      | 'spot_custom_field_values'
      | 'form_fields'
      | 'form_versions'
      | 'task_forms'
      | 'field_options'
      | 'session_logs'
      | 'config_logs'
      | 'task_attachments'
      | 'task_recurrences'
      | 'exceptions',
    mode: IDBTransactionMode = 'readonly'
  ) {
    if (!DB.inited) throw new Error('DB not initialized');
    if (!DB.db) throw new Error('DB not initialized');
    return DB.db.transaction(name, mode).objectStore(name);
  }

  public static getStoreWrite(
    name:
      | 'workspaces'
      | 'categories'
      | 'tasks'
      | 'teams'
      | 'statuses'
      | 'priorities'
      | 'spots'
      | 'tags'
      | 'custom_fields'
      | 'category_field_assignments'
      | 'users'
      | 'roles'
      | 'permissions'
      | 'user_teams'
      | 'user_permissions'
      | 'role_permissions'

      | 'status_transitions'
      | 'task_tags'
      | 'spot_types'
      | 'slas'
      | 'sla_alerts'
      | 'category_priorities'
      | 'forms'
      | 'invitations'
      | 'task_logs'
      | 'templates'
      | 'spot_custom_fields'
      | 'template_custom_fields'
      | 'task_custom_field_values'
      | 'spot_custom_field_values'
      | 'form_fields'
      | 'form_versions'
      | 'task_forms'
      | 'field_options'
      | 'session_logs'
      | 'config_logs'
      | 'task_attachments'
      | 'task_recurrences'
      | 'exceptions',
    mode: IDBTransactionMode = 'readwrite'
  ) {
    if (!DB.inited) throw new Error('DB not initialized');
    if (!DB.db) throw new Error('DB not initialized');
    return DB.db.transaction(name, mode).objectStore(name);
  }

  // --- Encryption-aware convenience facade ---

  private static get ENCRYPTION_ENABLED(): boolean {
    // Allow explicit toggle via VITE_CACHE_ENCRYPTION, otherwise disable in development
    const explicit = (import.meta as any).env?.VITE_CACHE_ENCRYPTION;
    if (explicit === 'true') return true;
    if (explicit === 'false') return false;
    return (import.meta as any).env?.VITE_DEVELOPMENT !== 'true';
  }

  private static toKey(key: number | string): number | string {
    // Most stores use numeric id; allow string keys for flexibility
    const n = Number(key);
    return isNaN(n) ? key : n;
  }

  public static async getAll(storeName: string): Promise<any[]> {
    return DB.runExclusive(storeName, async () => {
      if (!DB.inited) await DB.init();
      if (!DB.inited || !DB.db) {
        console.warn(`[DB] getAll: DB not initialized for ${storeName}`);
        return [] as any[];
      }

      // Use an explicit transaction and await its completion to ensure read consistency
      const tx = DB.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName as any);
      const rows = await new Promise<any[]>((resolve, reject) => {
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error as any);
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as any);
        tx.onabort = () => reject(tx.error as any);
      });
      if (!DB.isEncryptionEnabledForStore(storeName)) return rows.filter((r) => r != null);
      // If encrypted rows exist, make sure KEK/CEK are ready before attempting decrypt
      const hasEncrypted = rows.some((r) => r && r.enc && r.enc.ct);
      if (hasEncrypted) {
        if (!CryptoHandler.inited) await CryptoHandler.init();
        try {
          const ready = CryptoHandler.inited && !!CryptoHandler.kid;
          if (ready) {
            const cekReady = await DB.ensureCEKForStore(storeName);
            if (!cekReady) {
              console.log('CEK not ready for', storeName, '- cannot decrypt');
              return [] as any[];
            }
          } else {
            console.log('kek not ready', storeName);
            return [] as any[];
          }
        } catch {
          console.log('error', storeName);
          /* proceed; decrypt will skip on failure */
        }
      }
      const out: any[] = [];
      for (const r of rows) {
        try {
          if (r && r.enc && r.enc.ct && r.enc.iv) {
            const dec = await DB.decryptEnvelope(storeName, r);
            if (dec != null) out.push(dec);
          } else if (r != null) {
            out.push(r);
          }
        } catch (_e) {
          console.log('error decrypting', storeName);
        }
      }
      return out;
    });
  }

  public static async get(
    storeName: string,
    key: number | string
  ): Promise<any | null> {
    return DB.runExclusive(storeName, async () => {
      if (!DB.inited) await DB.init();
      if (!DB.inited || !DB.db) {
        console.warn(`[DB] get: DB not initialized for ${storeName}`);
        return null;
      }
      // Use an explicit transaction and await its completion for consistent reads
      const tx = DB.db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName as any);
      const rec = await new Promise<any>((resolve, reject) => {
        const req = store.get(DB.toKey(key));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error as any);
      });
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as any);
        tx.onabort = () => reject(tx.error as any);
      });
      if (!rec) return null;
      if (!DB.isEncryptionEnabledForStore(storeName) || !(rec && rec.enc && rec.enc.ct)) return rec;
      return await DB.decryptEnvelope(storeName, rec);
    });
  }

  public static async put(storeName: string, row: any): Promise<void> {
    return DB.runExclusive(storeName, async () => {
      if (!DB.inited) await DB.init();

      // Important: perform any async work BEFORE opening the transaction to avoid
      // TransactionInactiveError due to the event loop returning while idle.
      let payload: any = row;
      if (DB.isEncryptionEnabledForStore(storeName)) {
        const env = await DB.encryptEnvelope(storeName, row);
        if (env === null) {
          console.warn(`[DB] Not storing ${storeName} row due to encryption failure`);
          return; // Don't store the data
        }
        payload = env;
      }
      const tx = DB.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName as any);
      store.put(payload);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as any);
        tx.onabort = () => reject(tx.error as any);
      });
    });
  }

  public static async bulkPut(storeName: string, rows: any[]): Promise<void> {
    return DB.runExclusive(storeName, async () => {
      if (!DB.inited) await DB.init();

      // Same rationale as put(): precompute all encryption material before opening
      // the write transaction so it remains active for the duration of the puts.
      let payloads: any[] = rows;
      if (DB.isEncryptionEnabledForStore(storeName)) {
        const envelopes: any[] = [];
        for (const r of rows) {
          const env = await DB.encryptEnvelope(storeName, r);
          if (env !== null) {
            envelopes.push(env);
          } else {
            console.warn(`[DB] Skipping ${storeName} row due to encryption failure`);
          }
        }
        if (envelopes.length === 0) {
          console.warn(`[DB] No ${storeName} rows stored due to encryption failures`);
          return;
        }
        payloads = envelopes;
      }
      const tx = DB.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName as any);
      for (const p of payloads) store.put(p);
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as any);
        tx.onabort = () => reject(tx.error as any);
      });
    });
  }

  public static async delete(
    storeName: string,
    key: number | string
  ): Promise<void> {
    return DB.runExclusive(storeName, async () => {
      if (!DB.inited) await DB.init();
      DB.getStoreWrite(storeName as any).delete(DB.toKey(key));
    });
  }

  public static async clear(storeName: string): Promise<void> {
    return DB.runExclusive(storeName, async () => {
      if (!DB.inited) await DB.init();
      DB.getStoreWrite(storeName as any).clear();
    });
  }

  public static async clearCryptoStores(): Promise<void> {
    if (!DB.inited) await DB.init();
    DB.getStoreWrite('cache_keys' as any).clear();
    DB.getStoreWrite('crypto_meta' as any).clear();
  }

  // --- Encryption helpers ---
  private static async encryptEnvelope(
    storeName: string,
    row: any
  ): Promise<any | null> {
    const cekReady = await DB.ensureCEKForStore(storeName);
    if (!cekReady) {
      console.warn(`[DB] Encryption failed for ${storeName}: CEK not ready, not storing`);
      return null; // Don't store the data
    }
    const id = row?.id ?? row?.ID ?? row?.Id;
    // Use worker for encryption for isolation
    try {
      const tenant = getCurrentTenant();
      const overrides = tenant ? { tenant } : undefined;
      return await encryptRow(storeName, id, row, overrides);
    } catch (e) {
      console.warn(`[DB] Encryption failed for ${storeName}: ${e}, not storing`);
      return null; // Don't store the data
    }
  }

  private static async decryptEnvelope(
    storeName: string,
    env: any
  ): Promise<any> {

    const cekReady = await DB.ensureCEKForStore(storeName);
    if (!cekReady) {
      console.warn(`[DB] Decryption skipped for ${storeName}: CEK not ready`);
      return null;
    }

    try {
      const row = await decryptRow(storeName, env);

      return row;
    } catch (e) {
      // If CEK wasn't ready yet, try to ensure and retry once
      if (String((e as any)?.message || e).includes('CEK not ready')) {
        try {
          const retryReady = await DB.ensureCEKForStore(storeName);
          if (!retryReady) {
            console.warn('[DB] decryptEnvelope retry failed: CEK not ready');
            return null;
          }
          const row = await decryptRow(storeName, env);
          return row;
        } catch (e2) {
          console.warn('[DB] decryptEnvelope retry failed', storeName, e2);
          return null;
        }
      }
      console.warn('[DB] decryptEnvelope failed', storeName, e);
      return null;
    }
  }

  private static async ensureCEKForStore(storeName: string): Promise<boolean> {
    return DB.runExclusive('cache_keys', async () => {
      if (!DB.inited) await DB.init();
      if (CryptoHandler.kid == null || !CryptoHandler.inited) {
        await CryptoHandler.init();
      }

      // Check if crypto is available at all
      if (!CryptoHandler.kid) {
        return false;
      }

      if (!DB.db) {
        console.warn('[DB] ensureCEKForStore: DB not ready');
        return false;
      }

      try {
        // Read existing entry using explicit transaction and await completion
        const rtx = DB.db.transaction('cache_keys', 'readonly');
        const rstore = rtx.objectStore('cache_keys' as any);
        const rreq = rstore.get(storeName);
        const existing = await new Promise<any>((resolve) => {
          rreq.onsuccess = () => resolve(rreq.result);
          rreq.onerror = () => resolve(null);
        });
        await new Promise<void>((resolve, reject) => {
          rtx.oncomplete = () => resolve();
          rtx.onerror = () => reject(rtx.error as any);
          rtx.onabort = () => reject(rtx.error as any);
        });

        const result = await workerEnsureCEK(storeName, existing?.wrappedCEK ?? null);

        // If workerEnsureCEK succeeds, CEK is ready for this store
        if (result.ok) {
          // Save the wrapped CEK if we generated a new one and don't have an existing entry
          if (!existing && result.wrappedCEK) {
            const wtx = DB.db.transaction('cache_keys', 'readwrite');
            const wstore = wtx.objectStore('cache_keys' as any);
            wstore.put({ store: storeName, wrappedCEK: result.wrappedCEK, kid: CryptoHandler.kid, createdAt: Date.now() });
            await new Promise<void>((resolve, reject) => {
              wtx.oncomplete = () => resolve();
              wtx.onerror = () => reject(wtx.error as any);
              wtx.onabort = () => reject(wtx.error as any);
            });
          }
          return true;
        } else {
          console.warn(`[DB] ensureCEKForStore failed for ${storeName}:`, result.error);
          return false;
        }
      } catch (error) {
        console.warn(`[DB] ensureCEKForStore error for ${storeName}:`, error);
        return false;
      }
    });
  }

  // --- Rotation helpers ---
  public static async rewrapAllCEKs(params: {
    newKid: string;
    wrappedKEKEnvelope?: WrappedKEKEnvelope;
    rawKEKBase64?: string;
  }): Promise<void> {
    if (!DB.inited) await DB.init();
    const ksRead = DB.getStoreRead('cache_keys' as any);
    const getAllReq = ksRead.getAll();
    const entries = await new Promise<any[]>((resolve) => {
      getAllReq.onsuccess = () => resolve(getAllReq.result || []);
      getAllReq.onerror = () => resolve([]);
    });
    if (!entries.length) return;
    const ksWrite = DB.getStoreWrite('cache_keys' as any);
    for (const entry of entries) {
      if (!entry?.wrappedCEK) continue;
      try {
        let newWrapped;
        if (params.wrappedKEKEnvelope) {
          newWrapped = await rewrapCekBlobWithWrappedKEK(
            entry.wrappedCEK,
            params.wrappedKEKEnvelope
          );
        } else if (params.rawKEKBase64) {
          newWrapped = await rewrapCekBlobWithRawKEK(
            entry.wrappedCEK,
            params.rawKEKBase64
          );
        } else {
          continue;
        }
        ksWrite.put({
          store: entry.store,
          wrappedCEK: newWrapped,
          kid: params.newKid,
          createdAt: entry.createdAt || Date.now(),
        });
      } catch (_e) {
        // If rewrap fails for one store, skip and continue others
      }
    }
  }
}
