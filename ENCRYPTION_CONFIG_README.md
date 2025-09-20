# Encryption Configuration Guide

## Overview

The encryption configuration system allows you to easily control which IndexedDB stores should be encrypted or remain unencrypted. This is useful for performance optimization (some stores don't need encryption) or for debugging purposes.

## How It Works

1. **Configuration File**: Edit `src/config/encryptionConfig.ts`
2. **Simple List**: Add/remove store names from the `DISABLED_ENCRYPTION_STORES` array
3. **Automatic Application**: The configuration is applied automatically when the app initializes

## Quick Setup

### To Disable Encryption for a Store

1. Open `src/config/encryptionConfig.ts`
2. Add the store name to the `DISABLED_ENCRYPTION_STORES` array:

```typescript
export const DISABLED_ENCRYPTION_STORES: string[] = [
  'tasks',           // Already disabled for fast rendering
  'categories',      // Add this line to disable encryption for categories
  'workspaces',      // Add this line to disable encryption for workspaces
  // Add more stores as needed...
];
```

3. Save the file - changes take effect on next app restart

### To Enable Encryption for a Store

1. Remove the store name from the `DISABLED_ENCRYPTION_STORES` array
2. Save the file - changes take effect on next app restart

## Available Store Names

Here are common store names you can use:

### Core Data Stores
- `'tasks'` - Task records (currently disabled for performance)
- `'categories'` - Category definitions
- `'workspaces'` - Workspace information
- `'teams'` - Team data
- `'users'` - User information

### Reference Data Stores
- `'statuses'` - Status definitions
- `'priorities'` - Priority levels
- `'spots'` - Spot/location data
- `'tags'` - Tag definitions
- `'custom_fields'` - Custom field definitions

### Supporting Stores
- `'custom_field_assignments'` - Field assignments
- `'user_teams'` - User-team relationships
- `'user_permissions'` - User permissions
- `'role_permissions'` - Role permissions
- `'task_users'` - Task assignments
- `'status_transitions'` - Status change history

### Form & Template Stores
- `'forms'` - Form definitions
- `'form_fields'` - Form field definitions
- `'form_versions'` - Form version history
- `'templates'` - Task templates

### Activity & Logging Stores
- `'task_logs'` - Task activity logs
- `'session_logs'` - User session logs
- `'config_logs'` - Configuration change logs
- `'exceptions'` - Error/exception logs

## Runtime Control

You can also control encryption at runtime using these helper functions:

```typescript
import { disableEncryptionForStore, enableEncryptionForStore } from '@/config/encryptionConfig';

// Disable encryption for a store at runtime
disableEncryptionForStore('categories');

// Enable encryption for a store at runtime
enableEncryptionForStore('tasks');
```

**Note**: Runtime changes are temporary and will be reset when the app restarts. For permanent changes, edit the configuration file.

## Performance Considerations

- **Unencrypted stores**: Faster read/write operations, larger storage footprint
- **Encrypted stores**: Slower operations due to encryption/decryption, smaller storage footprint
- **Mixed approach**: Recommended - encrypt sensitive data, leave performance-critical data unencrypted

## Current Configuration

As of now, the following stores have encryption disabled:
- `'tasks'` - Disabled for fast rendering performance

## Troubleshooting

### Changes Not Taking Effect
- Restart the application after editing the configuration
- Check browser console for encryption-related messages
- Clear IndexedDB data if switching between encrypted/unencrypted modes

### Performance Issues
- If you notice slowdowns, consider disabling encryption for frequently accessed stores
- Monitor storage usage - encrypted data is typically smaller

### Security Considerations
- Only disable encryption for stores containing non-sensitive data
- Sensitive information (passwords, personal data) should always be encrypted
- Consider the security implications before disabling encryption for any store

## Example Configurations

### Performance-Focused (Fast Rendering)
```typescript
export const DISABLED_ENCRYPTION_STORES: string[] = [
  'tasks',           // Fast task loading
  'categories',      // Fast category loading
  'statuses',        // Fast status lookups
  'priorities',      // Fast priority lookups
];
```

### Security-Focused (Max Encryption)
```typescript
export const DISABLED_ENCRYPTION_STORES: string[] = [
  // Empty array - all stores encrypted
];
```

### Balanced Approach
```typescript
export const DISABLED_ENCRYPTION_STORES: string[] = [
  'tasks',           // Performance-critical
  'categories',      // Frequently accessed
  // Everything else encrypted
];
```

## Migration Notes

When changing encryption settings:
1. Existing data in encrypted stores cannot be read when switching to unencrypted mode
2. Existing data in unencrypted stores will be lost when switching to encrypted mode
3. Consider clearing IndexedDB data when making significant encryption configuration changes
