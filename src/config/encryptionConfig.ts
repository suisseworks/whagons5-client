/**
 * Encryption Configuration
 *
 * This file allows you to easily control which IndexedDB stores should NOT be encrypted.
 * Simply add the store name to the DISABLED_ENCRYPTION_STORES array below.
 *
 * Note: This only affects stores that would normally be encrypted based on the global
 * encryption setting. Stores listed here will always use plaintext storage.
 */

export interface EncryptionConfig {
  /** Array of store names that should NOT be encrypted */
  DISABLED_ENCRYPTION_STORES: string[];
}

/**
 * Add store names to this array to disable encryption for those specific stores.
 * The store names must match the exact names used in the DB class.
 *
 * Examples of common store names:
 * - 'tasks' - Task records
 * - 'categories' - Category definitions
 * - 'workspaces' - Workspace information
 * - 'teams' - Team data
 * - 'users' - User information
 * - 'statuses' - Status definitions
 * - 'priorities' - Priority levels
 * - 'spots' - Spot/location data
 * - 'tags' - Tag definitions
 * - 'custom_fields' - Custom field definitions
 */
export const DISABLED_ENCRYPTION_STORES: string[] = [
  // Only disable encryption for tasks (legacy requirement for TasksCache)
  'tasks',
  'users'
];

/**
 * Apply encryption configuration to the DB system
 * This function should be called during app initialization
 */
export function applyEncryptionConfig(): void {
  // Import DB here to avoid circular dependencies
  import('../store/indexedDB/DB').then(({ DB }) => {
    DISABLED_ENCRYPTION_STORES.forEach(storeName => {
      DB.setEncryptionForStore(storeName, false);
      console.log(`[EncryptionConfig] Disabled encryption for store: ${storeName}`);
    });
  }).catch(error => {
    console.error('[EncryptionConfig] Failed to apply encryption config:', error);
  });
}

/**
 * Check if a store should be encrypted based on configuration
 */
export function shouldEncryptStore(storeName: string): boolean {
  return !DISABLED_ENCRYPTION_STORES.includes(storeName);
}

/**
 * Get the current encryption configuration for all stores
 */
export function getEncryptionConfig(): Record<string, boolean> {
  const config: Record<string, boolean> = {};

  // You could expand this to include all known stores from DB
  DISABLED_ENCRYPTION_STORES.forEach(storeName => {
    config[storeName] = false;
  });

  return config;
}

/**
 * Helper function to add a store to the disabled encryption list
 * Note: This only affects runtime, you'll need to update the array above for persistence
 */
export function disableEncryptionForStore(storeName: string): void {
  import('../store/indexedDB/DB').then(({ DB }) => {
    DB.setEncryptionForStore(storeName, false);
    console.log(`[EncryptionConfig] Disabled encryption for store: ${storeName}`);
  });
}

/**
 * Helper function to enable encryption for a store
 * Note: This only affects runtime, you'll need to remove from the array above for persistence
 */
export function enableEncryptionForStore(storeName: string): void {
  import('../store/indexedDB/DB').then(({ DB }) => {
    DB.setEncryptionForStore(storeName, true);
    console.log(`[EncryptionConfig] Enabled encryption for store: ${storeName}`);
  });
}