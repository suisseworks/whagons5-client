import { auth } from "@/firebase/firebaseConfig";


// Current database version - increment when schema changes
const CURRENT_DB_VERSION = "1.1.0";
const DB_VERSION_KEY = "indexeddb_version";

//static class to access the message cache
// Export the DB class
export class DB {
  static db: IDBDatabase;
  static inited = false;

  static async init() {
    if (DB.inited) return;

    const user = auth.currentUser;
    if (!user) {
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
    name: "workspaces" | "categories" | "tasks" | "teams" | "statuses" | "priorities" | "spots" | "tags",
    mode: IDBTransactionMode = "readonly"
  ) {
    if (!DB.inited) throw new Error("DB not initialized");
    if (!DB.db) throw new Error("DB not initialized");
    return DB.db.transaction(name, mode).objectStore(name);
  }

  public static getStoreWrite(
    name: "workspaces" | "categories" | "tasks" | "teams" | "statuses" | "priorities" | "spots" | "tags",
    mode: IDBTransactionMode = "readwrite"
  ) {
    if (!DB.inited) throw new Error("DB not initialized");
    if (!DB.db) throw new Error("DB not initialized");
    return DB.db.transaction(name, mode).objectStore(name);
  }

  

}






