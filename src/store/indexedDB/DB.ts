import { auth } from "@/firebase/firebaseConfig";
import { encryptRow, decryptRow, ensureCEK as workerEnsureCEK, rewrapCekBlobWithWrappedKEK, rewrapCekBlobWithRawKEK, WrappedKEKEnvelope } from "@/crypto/crypto";


// Current database version - increment when schema changes
const CURRENT_DB_VERSION = "1.6.0";
const DB_VERSION_KEY = "indexeddb_version";

//static class to access the message cache
// Export the DB class
export class DB {
  static db: IDBDatabase;
  static inited = false;
  private static initPromise: Promise<void> | null = null;

  static async init() {
    if (DB.inited) return;
    if (DB.initPromise) { await DB.initPromise; return; }

    DB.initPromise = (async () => {

    const user = auth.currentUser;
    if (!user) {
      DB.initPromise = null;
      return;
    }

    const userID = user.uid;

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
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("workspaces")) {
          db.createObjectStore("workspaces", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("categories")) {
          db.createObjectStore("categories", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("tasks")) {
          db.createObjectStore("tasks", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("teams")) {
          db.createObjectStore("teams", { keyPath: "id" });
        }
        // New reference tables used by RTL publications
        if (!db.objectStoreNames.contains("statuses")) {
          db.createObjectStore("statuses", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("priorities")) {
          db.createObjectStore("priorities", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("spots")) {
          db.createObjectStore("spots", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("tags")) {
          db.createObjectStore("tags", { keyPath: "id" });
        }
        // Custom fields and category-field-assignments (GenericCache-backed)
        if (!db.objectStoreNames.contains("custom_fields")) {
          db.createObjectStore("custom_fields", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("category_field_assignments")) {
          db.createObjectStore("category_field_assignments", { keyPath: "id" });
        }

        // User management tables
        if (!db.objectStoreNames.contains("users")) {
          db.createObjectStore("users", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("roles")) {
          db.createObjectStore("roles", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("permissions")) {
          db.createObjectStore("permissions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("user_teams")) {
          db.createObjectStore("user_teams", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("user_permissions")) {
          db.createObjectStore("user_permissions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("role_permissions")) {
          db.createObjectStore("role_permissions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("task_users")) {
          db.createObjectStore("task_users", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("status_transitions")) {
          db.createObjectStore("status_transitions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("task_tags")) {
          db.createObjectStore("task_tags", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("spot_types")) {
          db.createObjectStore("spot_types", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("slas")) {
          db.createObjectStore("slas", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("sla_alerts")) {
          db.createObjectStore("sla_alerts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("category_priorities")) {
          db.createObjectStore("category_priorities", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("forms")) {
          db.createObjectStore("forms", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("invitations")) {
          db.createObjectStore("invitations", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("task_logs")) {
          db.createObjectStore("task_logs", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("templates")) {
          db.createObjectStore("templates", { keyPath: "id" });
        }

        // Custom Fields & Values
        if (!db.objectStoreNames.contains("spot_custom_fields")) {
          db.createObjectStore("spot_custom_fields", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("template_custom_fields")) {
          db.createObjectStore("template_custom_fields", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("task_custom_field_values")) {
          db.createObjectStore("task_custom_field_values", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("spot_custom_field_values")) {
          db.createObjectStore("spot_custom_field_values", { keyPath: "id" });
        }

        // Forms & Fields
        if (!db.objectStoreNames.contains("form_fields")) {
          db.createObjectStore("form_fields", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("form_versions")) {
          db.createObjectStore("form_versions", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("task_forms")) {
          db.createObjectStore("task_forms", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("field_options")) {
          db.createObjectStore("field_options", { keyPath: "id" });
        }

        // Activity & Logging
        if (!db.objectStoreNames.contains("session_logs")) {
          db.createObjectStore("session_logs", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("config_logs")) {
          db.createObjectStore("config_logs", { keyPath: "id" });
        }

        // File Management
        if (!db.objectStoreNames.contains("task_attachments")) {
          db.createObjectStore("task_attachments", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("task_recurrences")) {
          db.createObjectStore("task_recurrences", { keyPath: "id" });
        }

        // Error Tracking
        if (!db.objectStoreNames.contains("exceptions")) {
          db.createObjectStore("exceptions", { keyPath: "id" });
        }
        // Keys store for per-store Content Encryption Keys (CEKs)
        if (!db.objectStoreNames.contains("cache_keys")) {
          const ks = db.createObjectStore("cache_keys", { keyPath: "store" });
          ks.createIndex("store_idx", "store", { unique: true });
          // store -> { wrappedCEK: { iv, ct }, kid }
        }
        // Crypto provisioning metadata
        if (!db.objectStoreNames.contains("crypto_meta")) {
          db.createObjectStore("crypto_meta", { keyPath: "key" });
        }
      };

      request.onerror = () => {
        console.error("DB.init: Error opening database:", request.error);
        _reject(request.error as any);
      };
      request.onsuccess = () => {   
        resolve(request.result);
      };
    });

    DB.db = db;
    DB.inited = true;
    DB.initPromise = null;
  })();

    await DB.initPromise;
  }

  private static async deleteDatabase(userID: string): Promise<void> {
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
        console.log("Closed existing database connection");
      } catch (err) {
        console.error("Error closing database connection:", err);
      }
      DB.inited = false;
      DB.db = undefined as unknown as IDBDatabase;
    }

    return new Promise<void>((resolve, _reject) => {
      // Create a timeout to prevent indefinite hanging
      const timeout = setTimeout(() => {
        console.warn("Database deletion timed out after 5 seconds");
        resolve(); // Resolve anyway to prevent hanging
      }, 5000);

      try {
        const request = indexedDB.deleteDatabase(userID);

        request.onsuccess = () => {
          clearTimeout(timeout);
          console.log("Database successfully deleted");
          resolve();
        };

        request.onerror = () => {
          clearTimeout(timeout);
          console.error("Error deleting database:", request.error);
          // Still resolve to prevent hanging
          resolve();
        };

        // Critical: Handle blocked events
        request.onblocked = () => {
          console.warn("Database deletion blocked - connections still open");
          // We'll continue waiting for the timeout
        };
      } catch (err) {
        clearTimeout(timeout);
        console.error("Exception during database deletion:", err);
        resolve(); // Resolve anyway to prevent hanging
      }
    });
  }

  public static getStoreRead(
    name: "workspaces" | "categories" | "tasks" | "teams" | "statuses" | "priorities" | "spots" | "tags" | "custom_fields" | "category_field_assignments" | "users" | "roles" | "permissions" | "user_teams" | "user_permissions" | "role_permissions" | "task_users" | "status_transitions" | "task_tags" | "spot_types" | "slas" | "sla_alerts" | "category_priorities" | "forms" | "invitations" | "task_logs" | "templates" | "spot_custom_fields" | "template_custom_fields" | "task_custom_field_values" | "spot_custom_field_values" | "form_fields" | "form_versions" | "task_forms" | "field_options" | "session_logs" | "config_logs" | "task_attachments" | "task_recurrences" | "exceptions",
    mode: IDBTransactionMode = "readonly"
  ) {
    if (!DB.inited) throw new Error("DB not initialized");
    if (!DB.db) throw new Error("DB not initialized");
    return DB.db.transaction(name, mode).objectStore(name);
  }

  public static getStoreWrite(
    name: "workspaces" | "categories" | "tasks" | "teams" | "statuses" | "priorities" | "spots" | "tags" | "custom_fields" | "category_field_assignments" | "users" | "roles" | "permissions" | "user_teams" | "user_permissions" | "role_permissions" | "task_users" | "status_transitions" | "task_tags" | "spot_types" | "slas" | "sla_alerts" | "category_priorities" | "forms" | "invitations" | "task_logs" | "templates" | "spot_custom_fields" | "template_custom_fields" | "task_custom_field_values" | "spot_custom_field_values" | "form_fields" | "form_versions" | "task_forms" | "field_options" | "session_logs" | "config_logs" | "task_attachments" | "task_recurrences" | "exceptions",
    mode: IDBTransactionMode = "readwrite"
  ) {
    if (!DB.inited) throw new Error("DB not initialized");
    if (!DB.db) throw new Error("DB not initialized");
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
    if (!DB.inited) await DB.init();
    const store = DB.getStoreRead(storeName as any);
    const req = store.getAll();
    const rows = await new Promise<any[]>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error as any); });
    if (!DB.ENCRYPTION_ENABLED) return rows.filter((r) => r != null);
    // If encrypted rows exist, make sure KEK/CEK are ready before attempting decrypt
    const hasEncrypted = rows.some((r) => r && r.enc && r.enc.ct);
    if (hasEncrypted) {
      try {
        const { hasKEK } = await import('../../crypto/crypto');
        let ready = await hasKEK();
        for (let i = 0; i < 6 && !ready; i++) { await new Promise(r => setTimeout(r, 50)); ready = await hasKEK(); }
        // Ensure CEK once before decrypting many rows
        try {
          await DB.ensureCEKForStore(storeName);
        } catch (e: any) {
          if (String(e?.message || e).includes('KEK not provisioned')) {
            // Cannot decrypt yet; return empty to avoid endless CEK-not-ready errors
            return [];
          }
          throw e;
        }
      } catch { /* proceed; decrypt will skip on failure */ }
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
        // Skip rows that fail to decrypt (e.g., key not ready yet); they will
        // be revalidated/refetched by integrity logic shortly.
      }
    }
    return out;
  }

  public static async get(storeName: string, key: number | string): Promise<any | null> {
    if (!DB.inited) await DB.init();
    const store = DB.getStoreRead(storeName as any);
    const req = store.get(DB.toKey(key));
    const rec = await new Promise<any>((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error as any); });
    if (!rec) return null;
    if (!DB.ENCRYPTION_ENABLED || !(rec && rec.enc && rec.enc.ct)) return rec;
    return await DB.decryptEnvelope(storeName, rec);
  }

  public static async put(storeName: string, row: any): Promise<void> {
    if (!DB.inited) await DB.init();
    // Important: perform any async work BEFORE opening the transaction to avoid
    // TransactionInactiveError due to the event loop returning while idle.
    if (!DB.ENCRYPTION_ENABLED) {
      const store = DB.getStoreWrite(storeName as any);
      store.put(row);
      return;
    }
    const env = await DB.encryptEnvelope(storeName, row);
    const store = DB.getStoreWrite(storeName as any);
    store.put(env);
  }

  public static async bulkPut(storeName: string, rows: any[]): Promise<void> {
    if (!DB.inited) await DB.init();
    // Same rationale as put(): precompute all encryption material before opening
    // the write transaction so it remains active for the duration of the puts.
    if (!DB.ENCRYPTION_ENABLED) {
      const store = DB.getStoreWrite(storeName as any);
      for (const r of rows) store.put(r);
      return;
    }
    const envelopes: any[] = [];
    for (const r of rows) {
      const env = await DB.encryptEnvelope(storeName, r);
      envelopes.push(env);
    }
    const store = DB.getStoreWrite(storeName as any);
    for (const env of envelopes) store.put(env);
  }

  public static async delete(storeName: string, key: number | string): Promise<void> {
    if (!DB.inited) await DB.init();
    DB.getStoreWrite(storeName as any).delete(DB.toKey(key));
  }

  public static async clear(storeName: string): Promise<void> {
    if (!DB.inited) await DB.init();
    DB.getStoreWrite(storeName as any).clear();
  }

  public static async clearCryptoStores(): Promise<void> {
    if (!DB.inited) await DB.init();
    DB.getStoreWrite('cache_keys' as any).clear();
    DB.getStoreWrite('crypto_meta' as any).clear();
  }

  // --- Encryption helpers ---
  private static async encryptEnvelope(storeName: string, row: any): Promise<any> {
    await DB.ensureCEKForStore(storeName);
    const id = row?.id ?? row?.ID ?? row?.Id;
    // Use worker for encryption for isolation
    return await encryptRow(storeName, id, row);
  }

  private static async decryptEnvelope(storeName: string, env: any): Promise<any> {
    try {
      console.debug('[DB] decryptEnvelope start', storeName, !!env?.enc?.aad);
      await DB.ensureCEKForStore(storeName);
      const row = await decryptRow(storeName, env);
      console.debug('[DB] decryptEnvelope ok', storeName);
      return row;
    } catch (e) {
      // If CEK wasn't ready yet, try to ensure and retry once
      if (String((e as any)?.message || e).includes('CEK not ready')) {
        try {
          await DB.ensureCEKForStore(storeName);
          const row = await decryptRow(storeName, env);
          console.debug('[DB] decryptEnvelope retry ok', storeName);
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

  private static async ensureCEKForStore(storeName: string): Promise<void> {
    if (!DB.inited) await DB.init();
    const ksRead = DB.getStoreRead('cache_keys' as any);
    const getReq = ksRead.get(storeName);
    const existing = await new Promise<any>((resolve) => { getReq.onsuccess = () => resolve(getReq.result); getReq.onerror = () => resolve(null); });
    try {
      const { wrappedCEK } = await workerEnsureCEK(storeName, existing?.wrappedCEK ?? null);
      if (!existing && wrappedCEK) {
        // Attach current kid if available
        let kid: string | null = null;
        try {
          const metaStore = DB.getStoreRead('crypto_meta' as any);
          const metaReq = metaStore.get('device');
          const meta = await new Promise<any>((resolve) => { metaReq.onsuccess = () => resolve(metaReq.result); metaReq.onerror = () => resolve(null); });
          kid = meta?.kid ?? null;
        } catch {}
        const ksWrite = DB.getStoreWrite('cache_keys' as any);
        ksWrite.put({ store: storeName, wrappedCEK, kid, createdAt: Date.now() });
      }
    } catch (e: any) {
      // If KEK not provisioned and a wrapped CEK exists, wait briefly for KEK then retry
      if (existing?.wrappedCEK && String(e?.message || e).includes('KEK not provisioned')) {
        try {
          const { hasKEK } = await import('../../crypto/crypto');
          let ready = await hasKEK();
          for (let i = 0; i < 20 && !ready; i++) { await new Promise(r => setTimeout(r, 50)); ready = await hasKEK(); }
          if (ready) {
            const { wrappedCEK } = await workerEnsureCEK(storeName, existing.wrappedCEK);
            if (wrappedCEK) {
              const ksWrite = DB.getStoreWrite('cache_keys' as any);
              // Preserve existing kid and createdAt
              ksWrite.put({ store: storeName, wrappedCEK, kid: existing.kid ?? null, createdAt: existing.createdAt || Date.now() });
            }
          }
          return;
        } catch (_e2) {
          return;
        }
      }
      throw e;
    }
  }

  // --- Rotation helpers ---
  public static async rewrapAllCEKs(params: { newKid: string, wrappedKEKEnvelope?: WrappedKEKEnvelope, rawKEKBase64?: string }): Promise<void> {
    if (!DB.inited) await DB.init();
    const ksRead = DB.getStoreRead('cache_keys' as any);
    const getAllReq = ksRead.getAll();
    const entries = await new Promise<any[]>((resolve) => { getAllReq.onsuccess = () => resolve(getAllReq.result || []); getAllReq.onerror = () => resolve([]); });
    if (!entries.length) return;
    const ksWrite = DB.getStoreWrite('cache_keys' as any);
    for (const entry of entries) {
      if (!entry?.wrappedCEK) continue;
      try {
        let newWrapped;
        if (params.wrappedKEKEnvelope) {
          newWrapped = await rewrapCekBlobWithWrappedKEK(entry.wrappedCEK, params.wrappedKEKEnvelope);
        } else if (params.rawKEKBase64) {
          newWrapped = await rewrapCekBlobWithRawKEK(entry.wrappedCEK, params.rawKEKBase64);
        } else {
          continue;
        }
        ksWrite.put({ store: entry.store, wrappedCEK: newWrapped, kid: params.newKid, createdAt: entry.createdAt || Date.now() });
      } catch (_e) {
        // If rewrap fails for one store, skip and continue others
      }
    }
  }

}






