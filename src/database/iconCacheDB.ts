interface CachedIcon {
  id: string;
  name: string;
  iconData: any;
  timestamp: number;
  version: string;
}

interface IconCacheDB extends IDBDatabase {
  transaction(storeNames: string[], mode?: IDBTransactionMode): IDBTransaction & {
    objectStore(name: 'icons'): IDBObjectStore;
  };
}

class IconCacheManager {
  private dbName = 'FontAwesomeIconCache';
  private dbVersion = 1;
  private storeName = 'icons';
  private currentVersion = '1.0.0'; // Update this when icon set changes
  private db: IconCacheDB | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result as IconCacheDB;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result as IconCacheDB;
        
        // Create object store for icons
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  private async ensureDB(): Promise<IconCacheDB> {
    if (!this.db) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  async getCachedIcon(iconName: string): Promise<any | null> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(iconName);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          const result = request.result as CachedIcon;
          if (result) {
            // Only check if version is outdated (no expiration)
            const isOutdated = result.version !== this.currentVersion;
            
            if (isOutdated) {
              // Clean up outdated entry
              this.deleteCachedIcon(iconName);
              resolve(null);
            } else {
              resolve(result.iconData);
            }
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          console.error('Error retrieving cached icon:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in getCachedIcon:', error);
      return null;
    }
  }

  async setCachedIcon(iconName: string, iconData: any): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const cachedIcon: CachedIcon = {
        id: iconName,
        name: iconName,
        iconData,
        timestamp: Date.now(),
        version: this.currentVersion
      };

      const request = store.put(cachedIcon);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Error caching icon:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in setCachedIcon:', error);
      throw error;
    }
  }

  async deleteCachedIcon(iconName: string): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(iconName);

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Error deleting cached icon:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in deleteCachedIcon:', error);
      throw error;
    }
  }

  async getCachedIcons(iconNames: string[]): Promise<{ [key: string]: any }> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const results: { [key: string]: any } = {};

      const promises = iconNames.map(iconName => {
        return new Promise<void>((resolve, reject) => {
          const request = store.get(iconName);
          
          request.onsuccess = () => {
            const result = request.result as CachedIcon;
            if (result) {
              // Only check if version is outdated (no expiration)
              const isOutdated = result.version !== this.currentVersion;
              
              if (!isOutdated) {
                results[iconName] = result.iconData;
              }
            }
            resolve();
          };

          request.onerror = () => {
            console.error('Error retrieving cached icon:', request.error);
            reject(request.error);
          };
        });
      });

      await Promise.all(promises);
      return results;
    } catch (error) {
      console.error('Error in getCachedIcons:', error);
      return {};
    }
  }

  async setCachedIcons(icons: { [key: string]: any }): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const timestamp = Date.now();

      const promises = Object.entries(icons).map(([iconName, iconData]) => {
        const cachedIcon: CachedIcon = {
          id: iconName,
          name: iconName,
          iconData,
          timestamp,
          version: this.currentVersion
        };

        return new Promise<void>((resolve, reject) => {
          const request = store.put(cachedIcon);
          request.onsuccess = () => resolve();
          request.onerror = () => {
            console.error('Error caching icon:', request.error);
            reject(request.error);
          };
        });
      });

      await Promise.all(promises);
    } catch (error) {
      console.error('Error in setCachedIcons:', error);
      throw error;
    }
  }

  async clearOutdatedIcons(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      return new Promise((resolve, reject) => {
        const deletePromises: Promise<void>[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor) {
            const result = cursor.value as CachedIcon;
            if (result.version !== this.currentVersion) {
              deletePromises.push(
                new Promise<void>((deleteResolve, deleteReject) => {
                  const deleteRequest = cursor.delete();
                  deleteRequest.onsuccess = () => deleteResolve();
                  deleteRequest.onerror = () => deleteReject(deleteRequest.error);
                })
              );
            }
            cursor.continue();
          } else {
            Promise.all(deletePromises).then(() => resolve()).catch(reject);
          }
        };

        request.onerror = () => {
          console.error('Error clearing outdated icons:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in clearOutdatedIcons:', error);
      throw error;
    }
  }

  async clearAllIcons(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.error('Error clearing all icons:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in clearAllIcons:', error);
      throw error;
    }
  }

  async getStorageInfo(): Promise<{ totalIcons: number; cacheSize: number }> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.count();

      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          resolve({
            totalIcons: request.result,
            cacheSize: 0 // Would need to calculate actual size
          });
        };
        request.onerror = () => {
          console.error('Error getting storage info:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Error in getStorageInfo:', error);
      return { totalIcons: 0, cacheSize: 0 };
    }
  }
}

// Export a singleton instance
export const iconCacheManager = new IconCacheManager();
export default iconCacheManager; 