import { auth } from '@/firebase/firebaseConfig';
import {
  encryptRow,
  decryptRow,
  ensureCEK as workerEnsureCEK,
  CryptoHandler,
  WrappedKEKEnvelope,
  rewrapCekBlobWithWrappedKEK,
  rewrapCekBlobWithRawKEK,
  hasKEK,
} from '@/crypto/crypto';
import { getCurrentTenant } from '@/api/whagonsApi';
import { DISABLED_ENCRYPTION_STORES } from '@/config/encryptionConfig';


// Current database version - increment when schema changes
const CURRENT_DB_VERSION = '1.14.0';
const DB_VERSION_KEY = 'indexeddb_version';

//static class to access the message cache
// Export the DB class
export class DB {
  static db: IDBDatabase;
  static inited = false;
  private static nuking = false;
  private static deleting = false; // Track when database deletion is in progress
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
    // First check explicit runtime overrides
    const override = DB.storeEncryptionOverrides.get(storeName);
    if (override !== undefined) return override;
    
    // Then check static config from encryptionConfig.ts (synchronous fallback)
    if (DISABLED_ENCRYPTION_STORES.includes(storeName)) {
      return false;
    }
    
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
          // Virtual workspace: tasks shared with the current user/teams
          if (!db.objectStoreNames.contains('shared_tasks')) {
            db.createObjectStore('shared_tasks', { keyPath: 'id' });
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
          // Custom fields and category custom fields (GenericCache-backed)
          if (!db.objectStoreNames.contains('custom_fields')) {
            db.createObjectStore('custom_fields', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('category_custom_fields')) {
            db.createObjectStore('category_custom_fields', {
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
          if (!db.objectStoreNames.contains('task_users')) {
            db.createObjectStore('task_users', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('status_transitions')) {
            db.createObjectStore('status_transitions', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('status_transition_groups')) {
            db.createObjectStore('status_transition_groups', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('status_transition_logs')) {
            db.createObjectStore('status_transition_logs', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('task_tags')) {
            db.createObjectStore('task_tags', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('task_shares')) {
            db.createObjectStore('task_shares', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('spot_types')) {
            db.createObjectStore('spot_types', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('slas')) {
            db.createObjectStore('slas', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('sla_policies')) {
            db.createObjectStore('sla_policies', { keyPath: 'id' });
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
          if (!db.objectStoreNames.contains('messages')) {
            db.createObjectStore('messages', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('job_positions')) {
            db.createObjectStore('job_positions', { keyPath: 'id' });
          }

          

          // Approvals
          if (!db.objectStoreNames.contains('approvals')) {
            db.createObjectStore('approvals', { keyPath: 'id' });
          }
          // Approval approvers
          if (!db.objectStoreNames.contains('approval_approvers')) {
            db.createObjectStore('approval_approvers', { keyPath: 'id' });
          }
          // Task approval instances
          if (!db.objectStoreNames.contains('task_approval_instances')) {
            db.createObjectStore('task_approval_instances', { keyPath: 'id' });
          }

          // Broadcasts & Acknowledgments
          if (!db.objectStoreNames.contains('broadcasts')) {
            db.createObjectStore('broadcasts', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('broadcast_acknowledgments')) {
            const store = db.createObjectStore('broadcast_acknowledgments', { keyPath: 'id' });
            store.createIndex('broadcast_id', 'broadcast_id', { unique: false });
            store.createIndex('user_id', 'user_id', { unique: false });
            store.createIndex('status', 'status', { unique: false });
          }

          // Plugin System
          if (!db.objectStoreNames.contains('plugins')) {
            const store = db.createObjectStore('plugins', { keyPath: 'id' });
            store.createIndex('slug', 'slug', { unique: true });
            store.createIndex('is_enabled', 'is_enabled', { unique: false });
          }
          if (!db.objectStoreNames.contains('plugin_routes')) {
            const store = db.createObjectStore('plugin_routes', { keyPath: 'id' });
            store.createIndex('plugin_id', 'plugin_id', { unique: false });
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
          if (!db.objectStoreNames.contains('task_notes')) {
            db.createObjectStore('task_notes', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('task_recurrences')) {
            db.createObjectStore('task_recurrences', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('workspace_chat')) {
            db.createObjectStore('workspace_chat', { keyPath: 'id' });
          }

          // Error Tracking
          if (!db.objectStoreNames.contains('exceptions')) {
            db.createObjectStore('exceptions', { keyPath: 'id' });
          }

          // Boards (Communication Boards)
          if (!db.objectStoreNames.contains('boards')) {
            db.createObjectStore('boards', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('board_members')) {
            db.createObjectStore('board_members', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('board_messages')) {
            db.createObjectStore('board_messages', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('board_attachments')) {
            db.createObjectStore('board_attachments', { keyPath: 'id' });
          }

          // Workflows
          if (!db.objectStoreNames.contains('workflows')) {
            db.createObjectStore('workflows', { keyPath: 'id' });
          }

          // Compliance Module
          if (!db.objectStoreNames.contains('compliance_standards')) {
            db.createObjectStore('compliance_standards', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('compliance_requirements')) {
            db.createObjectStore('compliance_requirements', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('compliance_mappings')) {
            db.createObjectStore('compliance_mappings', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('compliance_audits')) {
            db.createObjectStore('compliance_audits', { keyPath: 'id' });
          }

          // Schedule Management
          if (!db.objectStoreNames.contains('schedule_templates')) {
            db.createObjectStore('schedule_templates', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('schedule_template_days')) {
            db.createObjectStore('schedule_template_days', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('user_schedules')) {
            db.createObjectStore('user_schedules', { keyPath: 'id' });
          }

          // Notifications (client-side only)
          if (!db.objectStoreNames.contains('notifications')) {
            const store = db.createObjectStore('notifications', { keyPath: 'id' });
            store.createIndex('received_at', 'received_at', { unique: false });
            store.createIndex('viewed_at', 'viewed_at', { unique: false });
          }

          // Avatar image cache (base64 or blob references)
          if (!db.objectStoreNames.contains('avatars')) {
            db.createObjectStore('avatars', { keyPath: 'id' });
          }
          // Tenant availability cache (keyed by tenant name)
          if (!db.objectStoreNames.contains('tenant_availability')) {
            db.createObjectStore('tenant_availability', { keyPath: 'tenantName' });
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
          DB.deleting = false; // Reset deletion flag on version change
        };
      } catch {}
      DB.inited = true;
      DB.deleting = false; // Ensure deletion flag is cleared after successful init
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
    // Mark deletion as in progress to prevent operations during deletion
    DB.deleting = true;
    
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
        DB.deleting = false; // Reset flag on timeout
        resolve(); // Resolve anyway to prevent hanging
      }, 5000);

      try {
        const request = indexedDB.deleteDatabase(userID);

        request.onsuccess = () => {
          clearTimeout(timeout);
          console.log('Database successfully deleted');
          DB.deleting = false; // Reset flag on success
          resolve();
        };

        request.onerror = () => {
          clearTimeout(timeout);
          console.error('Error deleting database:', request.error);
          DB.deleting = false; // Reset flag on error
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
        DB.deleting = false; // Reset flag on exception
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
      | 'category_custom_fields'
      | 'users'
      | 'roles'
      | 'permissions'
      | 'user_teams'
      | 'user_permissions'
      | 'role_permissions'

      | 'status_transitions'
      | 'task_users'
      | 'task_tags'
      | 'task_shares'
      | 'spot_types'
      | 'slas'
      | 'sla_policies'
      | 'sla_alerts'
      | 'category_priorities'
      | 'forms'
      | 'invitations'
      | 'task_logs'
      | 'templates'
      | 'messages'
      | 'job_positions'
      | 'status_transition_groups'
      | 'approval_approvers'
      | 'task_approval_instances'
      | 'broadcasts'
      | 'broadcast_acknowledgments'
      | 'plugins'
      | 'plugin_routes'
      | 'schedule_templates'
      | 'schedule_template_days'
      | 'user_schedules'
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
      | 'task_notes'
      | 'task_recurrences'
      | 'workspace_chat'
      | 'exceptions'
      | 'board_attachments'
      | 'avatars',
    mode: IDBTransactionMode = 'readonly'
  ) {
    if (DB.deleting) throw new Error('DB deletion in progress');
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
      | 'category_custom_fields'
      | 'users'
      | 'roles'
      | 'permissions'
      | 'user_teams'
      | 'user_permissions'
      | 'role_permissions'

      | 'status_transitions'
      | 'task_users'
      | 'task_tags'
      | 'task_shares'
      | 'spot_types'
      | 'slas'
      | 'sla_policies'
      | 'sla_alerts'
      | 'category_priorities'
      | 'forms'
      | 'invitations'
      | 'task_logs'
      | 'templates'
      | 'messages'
      | 'job_positions'
      | 'status_transition_groups'
      | 'approval_approvers'
      | 'task_approval_instances'
      | 'broadcasts'
      | 'broadcast_acknowledgments'
      | 'plugins'
      | 'plugin_routes'
      | 'schedule_templates'
      | 'schedule_template_days'
      | 'user_schedules'
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
      | 'task_notes'
      | 'task_recurrences'
      | 'workspace_chat'
      | 'exceptions'
      | 'board_attachments'
      | 'avatars',
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
      if (DB.nuking) {
        console.warn('[DB] getAll skipped during nuking');
        return [] as any[];
      }
      if (DB.deleting) {
        console.warn('[DB] getAll skipped during deletion');
        return [] as any[];
      }
      if (!DB.inited) await DB.init();
      if (!DB.inited || !DB.db) {
        console.warn(`[DB] getAll: DB not initialized for ${storeName}`);
        return [] as any[];
      }

      // Use an explicit transaction and await its completion to ensure read consistency
      // Catch InvalidStateError and retry once after ensuring DB is ready
      let rows: any[];
      try {
        const tx = DB.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName as any);
        rows = await new Promise<any[]>((resolve, reject) => {
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error as any);
        });
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error as any);
          tx.onabort = () => reject(tx.error as any);
        });
      } catch (error: any) {
        // Catch InvalidStateError specifically - DB connection is closing
        if (error?.name === 'InvalidStateError' || error?.message?.includes('connection is closing')) {
          console.warn(`[DB] getAll: InvalidStateError for ${storeName}, retrying after DB reinit`);
          // Reset state
          DB.inited = false;
          DB.db = undefined as unknown as IDBDatabase;
          // Wait a bit for deletion/closure to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          // Retry init and operation once
          await DB.init();
          if (!DB.inited || !DB.db || DB.deleting) {
            console.warn(`[DB] getAll: DB not ready after retry for ${storeName}`);
            return [] as any[];
          }
          // Retry the transaction
          const tx = DB.db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName as any);
          rows = await new Promise<any[]>((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error as any);
          });
          await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error as any);
            tx.onabort = () => reject(tx.error as any);
          });
        } else {
          // Re-throw other errors
          throw error;
        }
      }
      
      // If any encrypted rows exist (even if encryption is currently disabled),
      // attempt to decrypt for backward compatibility with previously-encrypted caches
      const hasEncrypted = rows.some((r) => r && r.enc && r.enc.ct);
      if (!hasEncrypted) {
        return rows.filter((r) => r != null);
      }
      
      // For encrypted rows, ensure crypto is initialized and CEK ready
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
      if (DB.nuking) {
        console.warn('[DB] get skipped during nuking');
        return null;
      }
      if (DB.deleting) {
        console.warn('[DB] get skipped during deletion');
        return null;
      }
      if (!DB.inited) await DB.init();
      if (!DB.inited || !DB.db) {
        console.warn(`[DB] get: DB not initialized for ${storeName}`);
        return null;
      }
      // Use an explicit transaction and await its completion for consistent reads
      // Catch InvalidStateError and retry once after ensuring DB is ready
      let rec: any;
      try {
        const tx = DB.db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName as any);
        rec = await new Promise<any>((resolve, reject) => {
          const req = store.get(DB.toKey(key));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error as any);
        });
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error as any);
          tx.onabort = () => reject(tx.error as any);
        });
      } catch (error: any) {
        // Catch InvalidStateError specifically - DB connection is closing
        if (error?.name === 'InvalidStateError' || error?.message?.includes('connection is closing')) {
          console.warn(`[DB] get: InvalidStateError for ${storeName}, retrying after DB reinit`);
          // Reset state
          DB.inited = false;
          DB.db = undefined as unknown as IDBDatabase;
          // Wait a bit for deletion/closure to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          // Retry init and operation once
          await DB.init();
          if (!DB.inited || !DB.db || DB.deleting) {
            console.warn(`[DB] get: DB not ready after retry for ${storeName}`);
            return null;
          }
          // Retry the transaction
          const tx = DB.db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName as any);
          rec = await new Promise<any>((resolve, reject) => {
            const req = store.get(DB.toKey(key));
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error as any);
          });
          await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error as any);
            tx.onabort = () => reject(tx.error as any);
          });
        } else {
          // Re-throw other errors
          throw error;
        }
      }
      if (!rec) return null;
      if (!DB.isEncryptionEnabledForStore(storeName) || !(rec && rec.enc && rec.enc.ct)) return rec;
      return await DB.decryptEnvelope(storeName, rec);
    });
  }

  public static async put(storeName: string, row: any): Promise<void> {
    // Defensive copy to prevent parameter corruption
    const rowCopy = row ? JSON.parse(JSON.stringify(row)) : null;

    return DB.runExclusive(storeName, async () => {
      if (DB.deleting) {
        console.warn('[DB] put skipped during deletion');
        return;
      }
      if (!DB.inited) await DB.init();

      // Debug: Log only if there's an issue
      if (!rowCopy) {
        console.log(`DB.put: Received row parameter`, {
          storeName,
          originalRow: row,
          rowCopy,
          rowType: typeof row,
          rowCopyType: typeof rowCopy
        });
      }

      // Validate the row copy
      if (!rowCopy) {
        console.error(`DB.put: Row copy is null/undefined for ${storeName}`, {
          originalRow: row,
          rowCopy
        });
        throw new Error(`Cannot put null/undefined row to ${storeName}`);
      }

      // Extra debug: pre-encrypt id visibility
      try {
        const dbg = localStorage.getItem('wh-debug-cache') === 'true';
        if (dbg) {
          console.log('DB.put: pre-encrypt', {
            storeName,
            rowHasId: rowCopy && (rowCopy.id !== undefined && rowCopy.id !== null),
            rowId: rowCopy?.id,
            rowKeys: Object.keys(rowCopy || {}),
          });
        }
      } catch {}

      // Use the defensive copy
      let payload: any = rowCopy;
      if (DB.isEncryptionEnabledForStore(storeName)) {
        const env = await DB.encryptEnvelope(storeName, rowCopy);
        if (!env) {
          console.warn(`[DB] Storing ${storeName} row unencrypted due to encryption failure (CEK may not be ready yet)`);
          payload = rowCopy; // Store unencrypted as fallback to prevent data loss
        } else {
          payload = env;
        }
        // Extra debug: post-encrypt envelope check
        try {
          const dbg = localStorage.getItem('wh-debug-cache') === 'true';
          if (dbg) {
            console.log('DB.put: post-encrypt envelope', {
              storeName,
              payloadType: typeof payload,
              payloadHasId: payload && (payload.id !== undefined && payload.id !== null),
              payloadId: payload?.id,
              hasEnc: !!payload?.enc,
              encKeys: payload?.enc ? Object.keys(payload.enc) : [],
            });
          }
        } catch {}
      }


      // Catch InvalidStateError and retry once after ensuring DB is ready
      try {
        const tx = DB.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName as any);
        // Debug: store keyPath visibility
        try {
          const dbg = localStorage.getItem('wh-debug-cache') === 'true';
          if (dbg) {
            const kp = (store as any)?.keyPath;
            console.log('DB.put: target store', { storeName, keyPath: kp, payloadHasId: payload?.id !== undefined && payload?.id !== null, payloadId: payload?.id });
          }
        } catch {}
        const putRequest = store.put(payload);

        putRequest.onerror = (event) => {
          console.error(`DB.put: IndexedDB put request failed for ${storeName}`, {
            error: putRequest.error,
            event,
            payload,
            storeName
          });
        };
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error as any);
          tx.onabort = () => reject(tx.error as any);
        });
      } catch (error: any) {
        // Catch InvalidStateError specifically - DB connection is closing
        if (error?.name === 'InvalidStateError' || error?.message?.includes('connection is closing')) {
          console.warn(`[DB] put: InvalidStateError for ${storeName}, retrying after DB reinit`);
          // Reset state
          DB.inited = false;
          DB.db = undefined as unknown as IDBDatabase;
          // Wait a bit for deletion/closure to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          // Retry init and operation once
          await DB.init();
          if (!DB.inited || !DB.db || DB.deleting) {
            console.warn(`[DB] put: DB not ready after retry for ${storeName}`);
            return;
          }
          // Retry the transaction
          const tx = DB.db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName as any);
          const putRequest = store.put(payload);
          putRequest.onerror = (event) => {
            console.error(`DB.put: IndexedDB put request failed for ${storeName}`, {
              error: putRequest.error,
              event,
              payload,
              storeName
            });
          };
          await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error as any);
            tx.onabort = () => reject(tx.error as any);
          });
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    });
  }

  public static async bulkPut(storeName: string, rows: any[]): Promise<void> {
    return DB.runExclusive(storeName, async () => {
      if (DB.deleting) {
        console.warn('[DB] bulkPut skipped during deletion');
        return;
      }
      if (!DB.inited) await DB.init();

      // Same rationale as put(): precompute all encryption material before opening
      // the write transaction so it remains active for the duration of the puts.
      let payloads: any[] = rows;
      if (DB.isEncryptionEnabledForStore(storeName)) {
        const envelopes: any[] = [];
        let encryptionFailed = false;
        for (const r of rows) {
          const env = await DB.encryptEnvelope(storeName, r);
          if (env !== null) {
            envelopes.push(env);
          } else {
            // Encryption failed - store unencrypted as fallback to prevent data loss
            envelopes.push(r);
            encryptionFailed = true;
          }
        }
        if (encryptionFailed) {
          console.warn(`[DB] Some ${storeName} rows stored unencrypted due to encryption failures (CEK may not be ready yet)`);
        }
        payloads = envelopes;
      }
      // Catch InvalidStateError and retry once after ensuring DB is ready
      try {
        const tx = DB.db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName as any);
        for (const p of payloads) store.put(p);
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error as any);
          tx.onabort = () => reject(tx.error as any);
        });
      } catch (error: any) {
        // Catch InvalidStateError specifically - DB connection is closing
        if (error?.name === 'InvalidStateError' || error?.message?.includes('connection is closing')) {
          console.warn(`[DB] bulkPut: InvalidStateError for ${storeName}, retrying after DB reinit`);
          // Reset state
          DB.inited = false;
          DB.db = undefined as unknown as IDBDatabase;
          // Wait a bit for deletion/closure to complete
          await new Promise(resolve => setTimeout(resolve, 100));
          // Retry init and operation once
          await DB.init();
          if (!DB.inited || !DB.db || DB.deleting) {
            console.warn(`[DB] bulkPut: DB not ready after retry for ${storeName}`);
            return;
          }
          // Retry the transaction
          const tx = DB.db.transaction(storeName, 'readwrite');
          const store = tx.objectStore(storeName as any);
          for (const p of payloads) store.put(p);
          await new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error as any);
            tx.onabort = () => reject(tx.error as any);
          });
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    });
  }

  public static async delete(
    storeName: string,
    key: number | string
  ): Promise<void> {
    return DB.runExclusive(storeName, async () => {
      if (!DB.inited) await DB.init();
      if (!DB.inited || !DB.db) {
        throw new Error('DB not initialized');
      }
      
      const tx = DB.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName as any);
      const deleteRequest = store.delete(DB.toKey(key));
      
      deleteRequest.onerror = (event) => {
        console.error(`DB.delete: IndexedDB delete request failed for ${storeName}`, {
          error: deleteRequest.error,
          event,
          key,
          storeName
        });
      };
      
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as any);
        tx.onabort = () => reject(tx.error as any);
      });
    });
  }

  public static async clear(storeName: string): Promise<void> {
    // Debug logging (can be enabled via localStorage.getItem('wh-debug-db') === 'true')
    if (typeof localStorage !== 'undefined' && localStorage.getItem('wh-debug-db') === 'true') {
      console.log(`[DB] Clearing IndexedDB store: ${storeName}`);
    }
    return DB.runExclusive(storeName, async () => {
      if (!DB.inited) await DB.init();
      if (!DB.inited || !DB.db) {
        throw new Error('DB not initialized');
      }
      
      const tx = DB.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName as any);
      const clearRequest = store.clear();
      
      clearRequest.onerror = (event) => {
        console.error(`DB.clear: IndexedDB clear request failed for ${storeName}`, {
          error: clearRequest.error,
          event,
          storeName
        });
      };
      
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as any);
        tx.onabort = () => reject(tx.error as any);
      });
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

  public static async ensureCEKForStore(storeName: string): Promise<boolean> {
    return DB.runExclusive('cache_keys', async () => {
      if (DB.nuking) return false;
      if (DB.deleting) {
        // When DB is being deleted/closed, skip CEK work silently
        return false;
      }
      if (!DB.inited) await DB.init();
      if (CryptoHandler.kid == null || !CryptoHandler.inited) {
        await CryptoHandler.init();
      }

      // Check if crypto is available at all
      if (!CryptoHandler.kid) {
        return false;
      }

      if (!DB.db) {
        if (DB.deleting) {
          // Transient during deletion/version change
          return false;
        }
        console.warn('[DB] ensureCEKForStore: DB not ready');
        return false;
      }

      let existingRec: any = null;
      try {
        // Read existing entry using explicit transaction and await completion
        const rtx = DB.db.transaction('cache_keys', 'readonly');
        const rstore = rtx.objectStore('cache_keys' as any);
        const rreq = rstore.get(storeName);
        const existing = await new Promise<any>((resolve) => {
          rreq.onsuccess = () => resolve(rreq.result);
          rreq.onerror = () => resolve(null);
        });
        existingRec = existing;
        await new Promise<void>((resolve, reject) => {
          rtx.oncomplete = () => resolve();
          rtx.onerror = () => reject(rtx.error as any);
          rtx.onabort = () => reject(rtx.error as any);
        });

        const result = await workerEnsureCEK(storeName, existing?.wrappedCEK ?? null);

        // If workerEnsureCEK succeeds, CEK is ready for this store
        if (result.ok) {
          // Save the wrapped CEK if we generated a new one and don't have an existing entry
          if (!existingRec && result.wrappedCEK) {
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
          const isUnwrap = String(result?.error || '').toLowerCase().includes('unwrap');
          const kekReady = await hasKEK();
          const hasWrapped = !!existingRec?.wrappedCEK;
          if (isUnwrap && kekReady && CryptoHandler.kid && hasWrapped) {
            await DB.handleCryptoMismatch(`ensureCEK-${storeName}`);
          }
          return false;
        }
      } catch (error) {
        const msg = String((error as any)?.message || '');
        const name = (error as any)?.name;
        const isClosing =
          name === 'InvalidStateError' ||
          msg.includes('connection is closing') ||
          msg.includes("Failed to execute 'transaction'");

        if (isClosing || DB.deleting) {
          // Transient DB closure during delete/version-change; skip CEK ensure without treating as crypto mismatch
          console.warn(`[DB] ensureCEKForStore transient DB error for ${storeName} (connection closing); skipping`);
          return false;
        }

        console.warn(`[DB] ensureCEKForStore error for ${storeName}:`, error);
        const isUnwrap = String((error as any)?.message || error || '').toLowerCase().includes('unwrap');
        const kekReady = await hasKEK();
        const hasWrapped = !!existingRec?.wrappedCEK;
        if (isUnwrap && kekReady && CryptoHandler.kid && hasWrapped) {
          await DB.handleCryptoMismatch(`ensureCEK-exc-${storeName}`);
        }
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

  // --- Crypto mismatch recovery helpers ---
  private static async handleCryptoMismatch(trigger: string): Promise<void> {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      DB.nuking = true;
      console.warn('Crypto mismatch detected, nuking IndexedDB and reloading...', trigger);
      await DB.deleteDatabase(uid);
      try { console.warn('Database delete requested; reloading'); } catch {}
      try { DB.inited = false; DB.db = undefined as any; } catch {}
      // Reload to re-onboard and reprovision fresh keys
      if (typeof window !== 'undefined' && window.location) {
        window.location.reload();
      }
    } catch {}
  }
}
