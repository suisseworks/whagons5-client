# Generic Slice Factory

## Overview

The generic slice factory provides a reusable way to create Redux slices with GenericCache integration, eliminating the need to create individual slice files for each table.

## How to Add a New Table

### 1. Add TypeScript Interface

Add the interface to `src/store/types.ts`:

```typescript
export interface YourEntity {
    id: number;
    name: string;
    // ... other fields
    created_at: string;
    updated_at: string;
}
```

### 2. Add to Generic Slices Configuration

Update `src/store/genericSlices.ts`:

```typescript
const genericSliceConfigs = [
    // ... existing configs
    { name: 'yourEntities', table: 'wh_your_entities', endpoint: '/your-entities', store: 'your_entities' },
];
```

### 3. Add IndexedDB Store

Update `src/store/indexedDB/DB.ts`:

```typescript
if (!db.objectStoreNames.contains("your_entities")) {
  db.createObjectStore("your_entities", { keyPath: "id" });
}
```

And update the type definitions:

```typescript
name: "workspaces" | "categories" | /* ... */ | "your_entities",
```

### 4. Increment Database Version

Update the version in `DB.ts`:

```typescript
const CURRENT_DB_VERSION = "1.5.0"; // Increment version
```

That's it! The generic slice factory will automatically create:
- Redux slice with actions (getFromIndexedDB, fetchFromAPI)
- GenericCache instance
- Cache registry entry for real-time updates
- Store reducer registration
- AuthProvider initialization

## Usage in Components

```typescript
import { useSelector, useDispatch } from 'react-redux';
import { genericActions } from '@/store/genericSlices';

const YourComponent = () => {
    const dispatch = useDispatch();
    const yourEntities = useSelector(state => state.yourEntities);

    // Load from IndexedDB
    const loadData = () => {
        dispatch(genericActions.yourEntities.getFromIndexedDB());
    };

    // Fetch from API
    const refreshData = () => {
        dispatch(genericActions.yourEntities.fetchFromAPI());
    };

    return (
        <div>
            {yourEntities.loading && <p>Loading...</p>}
            {yourEntities.value.map(entity => (
                <div key={entity.id}>{entity.name}</div>
            ))}
        </div>
    );
};
```

## Benefits

1. **Reduced Boilerplate**: No need to create individual slice files
2. **Consistency**: All slices follow the same pattern
3. **Maintainability**: Single place to update slice behavior
4. **Type Safety**: Full TypeScript support
5. **Real-time Updates**: Automatic integration with CacheRegistry
6. **Performance**: Efficient batch operations

## Migration from Individual Slices

If you have existing individual slices that you want to migrate:

1. Add configuration to `genericSlices.ts`
2. Remove individual slice files
3. Update imports in `store.ts` and `AuthProvider.tsx`
4. Remove individual cache instances from `CacheRegistry.ts`

## Advanced Usage

### Custom Cache Configuration

```typescript
const customCache = new GenericCache({
    table: 'wh_custom_table',
    endpoint: '/custom-endpoint',
    store: 'custom_store',
    // Custom options
});

const customSlice = createGenericSlice({
    name: 'customSlice',
    table: 'wh_custom_table',
    endpoint: '/custom-endpoint',
    store: 'custom_store',
    cache: customCache, // Use custom cache instance
});
```

### Adding Custom Actions

Extend the generic slice with additional actions:

```typescript
const customSlice = createGenericSlice({ /* config */ });

// Add custom actions
const customSliceWithExtra = {
    ...customSlice,
    actions: {
        ...customSlice.actions,
        customAction: createAsyncThunk(/* ... */),
    },
};
```

## Event System

### Overview
The generic slice factory includes a built-in event system that allows components to listen for changes to any table. This is useful for UI updates, cross-component communication, and custom business logic.

### Event Types
Each generic slice emits events for the following actions:
- `CREATED`: When a new item is added
- `UPDATED`: When an item is modified
- `DELETED`: When an item is removed
- `BULK_UPDATE`: When multiple items are updated
- `CACHE_INVALIDATE`: When the cache is invalidated

### Usage in Components

```typescript
import { genericEvents, genericEventNames } from '@/store/genericSlices';
import { useEffect } from 'react';

const MyComponent = () => {
  useEffect(() => {
    // Listen for workspace updates
    const unsubscribe = genericEvents.on(
      genericEventNames.workspaces.UPDATED,
      (data) => {
        console.log('Workspace updated:', data);
        // Handle UI updates, show notifications, etc.
      }
    );

    // Listen for new categories
    const unsubscribe2 = genericEvents.on(
      genericEventNames.categories.CREATED,
      (data) => {
        console.log('New category created:', data);
        // Refresh category list, update UI, etc.
      }
    );

    // Cleanup on unmount
    return () => {
      unsubscribe();
      unsubscribe2();
    };
  }, []);

  return (
    <div>
      {/* Your component JSX */}
    </div>
  );
};
```

### Event Data Format
Events receive data in the following format:
```typescript
{
  id: number | string,        // Item ID
  updates?: Partial<Item>,    // Update data (for UPDATED events)
  // ... other item properties
}
```

### Best Practices
1. **Always cleanup subscriptions** in useEffect return functions
2. **Use specific event names** to avoid unnecessary updates
3. **Handle errors gracefully** in event callbacks
4. **Consider performance** when attaching many event listeners
