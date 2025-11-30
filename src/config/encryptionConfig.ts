/**
 * Encryption Configuration
 *
 * This file allows you to easily control which IndexedDB stores SHOULD be encrypted.
 * By default, no stores are encrypted unless they are listed in ENCRYPTED_STORES
 * or toggled at runtime via DB.setEncryptionForStore.
 *
 * This gives you "plaintext by default, opt‑in encryption for sensitive data".
 */

export interface EncryptionConfig {
  /** Array of store names that SHOULD be encrypted */
  ENCRYPTED_STORES: string[];
}

/**
 * Add store names to this array to enable encryption for those specific stores.
 * The store names must match the exact names used in the DB class.
 *
 * Examples of common store names:
 * - 'users' - User information
 * - 'session_logs' - Session/activity logs
 * - 'config_logs' - Config changes
 * - 'exceptions' - Error payloads
 * - 'task_attachments' - Attachment metadata
 */
export const ENCRYPTED_STORES: string[] = [
  // Define sensitive stores here, e.g.:
  'users',
  'user_teams',
  'user_permissions',
  'crypto_meta',
  'invitations',
  'cache_keys',
  // 'session_logs',
  // 'config_logs',
  // 'exceptions',
];

/**
 * Apply encryption configuration to the DB system
 * This function should be called during app initialization
 */
export function applyEncryptionConfig(): void {
  // Import DB here to avoid circular dependencies
  import('../store/database/DB').then(({ DB }) => {
    ENCRYPTED_STORES.forEach(storeName => {
      DB.setEncryptionForStore(storeName, true);
      console.log(`[EncryptionConfig] Enabled encryption for store: ${storeName}`);
    });
  }).catch(error => {
    console.error('[EncryptionConfig] Failed to apply encryption config:', error);
  });
}

/**
 * Check if a store should be encrypted based on configuration
 */
export function shouldEncryptStore(storeName: string): boolean {
  return ENCRYPTED_STORES.includes(storeName);
}

/**
 * Get the current encryption configuration for all stores
 */
export function getEncryptionConfig(): Record<string, boolean> {
  const config: Record<string, boolean> = {};

  // You could expand this to include all known stores from DB.
  // For now we only expose explicitly encrypted ones.
  ENCRYPTED_STORES.forEach(storeName => {
    config[storeName] = true;
  });

  return config;
}

/**
 * Helper function to add a store to the disabled encryption list
 * Note: This only affects runtime, you'll need to update the array above for persistence
 */
export function disableEncryptionForStore(storeName: string): void {
  import('../store/database/DB').then(({ DB }) => {
    DB.setEncryptionForStore(storeName, false);
    console.log(`[EncryptionConfig] Disabled encryption for store: ${storeName}`);
  });
}

/**
 * Helper function to enable encryption for a store
 * Note: This only affects runtime, you'll need to remove from the array above for persistence
 */
export function enableEncryptionForStore(storeName: string): void {
  import('../store/database/DB').then(({ DB }) => {
    DB.setEncryptionForStore(storeName, true);
    console.log(`[EncryptionConfig] Enabled encryption for store: ${storeName}`);
  });
}