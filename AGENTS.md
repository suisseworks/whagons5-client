# Agents: Frontend Data Flow, Caching, and State Management

This document explains the generic architecture and lifecycle applied across the frontend application, detailing how Redux, IndexedDB caching, real-time listeners, and event-driven updates work together to provide a seamless user experience. This complements the backend AGENTS.md by explaining the client-side data management patterns.

## Overview

- **API Integration**: RESTful endpoints with optimistic updates and error handling
- **Redux Store**: Global state management with async thunks for data operations
- **Generic Slice Factory**: Automated Redux slice creation for simple CRUD operations
- **IndexedDB Caching**: Persistent local storage with intelligent synchronization
- **Real-Time Updates**: WebSocket-based change propagation from backend publications
- **Event Emitters**: Decoupled communication between cache layer and Redux store
- **Integrity Validation**: Client-side hash verification against server state

## Request → State Lifecycle

1. **User Interaction**
   - User performs action (create, update, delete, filter, search)
   - Redux action dispatched with optimistic updates

2. **Optimistic Updates**
   - UI immediately reflects changes in Redux store
   - Temporary IDs/states used for pending operations

3. **API Communication**
   - HTTP request sent to backend API
   - Success: Real data replaces optimistic updates
   - Failure: Rollback to previous state

4. **Cache Synchronization**
   - IndexedDB updated with authoritative data
   - Event emitters notify other components of changes

5. **Real-Time Propagation**
   - WebSocket receives database change notifications
   - Cache updated automatically in background
   - Redux store refreshed from updated cache

## Architecture Pattern

The application uses a **3-tier caching strategy**:

```
API Server → IndexedDB (Local Cache) → Redux Store → React Components
```

### Benefits of this approach:
- **Offline support**: Data available even without internet connection
- **Performance**: Sub-millisecond local access to frequently used data
- **Synchronization**: Smart updates only when data changes
- **Persistence**: Data survives app refreshes, browser crashes, and sessions
- **Real-time updates**: Automatic synchronization across multiple clients

## Data Flow Patterns

### 1. Initial Load (User Authentication)

```typescript
User Authenticates → AuthProvider
  → Initialize caches (Tasks/Categories/Teams/Workspaces)
  → Hydrate Redux from IndexedDB
  → For reference tables, hydrate + network refresh
```

**Detailed Flow:**
1. User authenticates via Firebase
2. AuthProvider detects auth state change
3. User data fetched from `/user` endpoint
4. Cache initialization begins for all entities
5. Redux store hydrated from IndexedDB (fast local access)
6. Reference tables refreshed from network in background
7. Components receive data via `useSelector` hooks

### 2. Cache Initialization Process

### 🚀 Cache Initialization Process (Critical for Performance)

**⚠️ IMPORTANT**: Cache initialization is a critical performance optimization that determines app startup speed and offline capability.

**Custom Cache Classes** (Tasks only - advanced features):

```typescript
TasksCache.init() → Check local count → Empty cache: full fetch → Non-empty: validate
```

**First time (empty cache):**
- Fetches all records from API with pagination
- Stores complete dataset in IndexedDB
- Marks as initialized in localStorage

**Subsequent loads (populated cache):**
- Validates local data against server integrity hashes
- Compares block-level hashes to detect changes
- Fetches only changed records by ID
- Updates cache incrementally

**GenericCache** (All other 30+ tables):

```typescript
GenericCache.init() → Auto-initialized on first access → No explicit init needed
```

- **Auto-initialization**: Generic caches initialize themselves when first accessed
- Simple key-value storage pattern with automatic CRUD operations
- Integrity validation using backend hash comparison
- **Performance**: No blocking initialization - caches load lazily as needed

**⚡ Performance Benefits:**
- **Immediate app start**: No waiting for 30+ cache initializations
- **Lazy loading**: Data loads only when components need it
- **Reduced memory**: Only active data kept in memory
- **Better UX**: App starts instantly while data loads in background

### Generic Slice Factory

**Location**: `src/store/genericSliceFactory.ts`, `src/store/genericSlices.ts`

**Purpose**: Eliminate boilerplate code for simple CRUD tables by automatically generating Redux slices, caches, and registrations.

**Benefits:**
- **95% Reduction in Boilerplate**: From 4,000+ lines to ~300 lines
- **Automatic Integration**: Cache registry, store registration, and AuthProvider initialization
- **Type Safety**: Full TypeScript support with proper interfaces
- **Consistency**: All generic slices follow the same patterns
- **Event System**: Built-in event emission for UI updates
- **Generic CRUD Actions**: `addAsync`, `updateAsync`, `removeAsync` for all tables

**How to Add a New Table (4 Steps):**
```typescript
// 1. Add TypeScript interface
export interface YourEntity {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
}

// 2. Add to generic slice configuration
{ name: 'yourEntities', table: 'wh_your_entities', endpoint: '/your-entities', store: 'your_entities' }

// 3. Add IndexedDB store
if (!db.objectStoreNames.contains("your_entities")) {
    db.createObjectStore("your_entities", { keyPath: "id" });
}

// 4. Increment DB version
const CURRENT_DB_VERSION = "1.5.0";
```

**That's it!** The factory automatically creates:
- Redux slice with `getFromIndexedDB`, `fetchFromAPI`, `addAsync`, `updateAsync`, `removeAsync` actions
- GenericCache instance with real-time updates
- Cache registry entry for database change notifications
- Store reducer registration
- AuthProvider initialization and hydration
- Event emission system for UI updates

**Usage in Components:**
```typescript
import { genericActions } from '@/store/genericSlices';

const data = useSelector(state => state.yourEntities);

// Load data
dispatch(genericActions.yourEntities.getFromIndexedDB());
dispatch(genericActions.yourEntities.fetchFromAPI());

// CRUD operations
dispatch(genericActions.yourEntities.addAsync(newItem));
dispatch(genericActions.yourEntities.updateAsync({ id: 1, updates: {...} }));
dispatch(genericActions.yourEntities.removeAsync(1));

// Listen for events (for custom components)
useEffect(() => {
  const unsubscribe = genericActions.yourEntities.events.on(
    genericActions.yourEntities.eventNames.UPDATED,
    (data) => {
      console.log('Entity updated:', data);
    }
  );
  return unsubscribe;
}, []);
```

### 3. Component Integration

Components access data through Redux selectors:

```typescript
const { value: tasks, loading, error } = useSelector((state: RootState) => state.tasks);
```

## Caching Strategies

### Custom Cache Classes

**Location**: `src/store/indexedDB/TasksCache.ts`, `CategoriesCache.ts`, etc.

**Features:**
- **Local Query Engine**: Filter, sort, paginate offline (mirrors backend API)
- **Event Emitters**: Notify Redux of cache changes
- **Integrity Validation**: SHA-256 hash comparison with server
- **Smart Synchronization**: Block-level change detection

**Example - TasksCache.queryTasks():**
```typescript
// Supports complex queries offline
const results = await TasksCache.queryTasks({
  workspace_id: 1,
  status_id: 2,
  search: 'urgent',
  sortModel: [{ colId: 'created_at', sort: 'desc' }],
  startRow: 0,
  endRow: 50
});
```

### GenericCache

**Location**: `src/store/indexedDB/GenericCache.ts`

**Features:**
- **Generic CRUD**: Reusable for simple entities
- **Automatic Hashing**: Configurable field-based row hashing
- **Batch Operations**: Efficient bulk insert/update/delete
- **Memory Efficient**: Streaming for large datasets

**Configuration Example:**
```typescript
const statusesCache = new GenericCache({
  table: 'wh_statuses',      // Backend table for integrity
  endpoint: '/statuses',     // API endpoint
  store: 'statuses',         // IndexedDB store name
  hashFields: ['id', 'name', 'color', 'position', 'updated_at']
});
```

### Cache Registry

**Location**: `src/store/indexedDB/CacheRegistry.ts`

Routes database change notifications to appropriate cache handlers:

```typescript
const cacheByTable: Record<string, CacheHandler> = {
  'wh_tasks': {
    add: (row) => TasksCache.addTask(row),
    update: (id, row) => TasksCache.updateTask(String(id), row),
    remove: (id) => TasksCache.deleteTask(String(id))
  },
  'wh_statuses': {
    add: (row) => statusesCache.add(row),
    update: (id, row) => statusesCache.update(id, row),
    remove: (id) => statusesCache.remove(id)
  }
  // ... other tables
};
```

## Real-Time Updates

### RealTimeListener (RTL)

**Location**: `src/store/realTimeListener/RTL.ts`

**Features:**
- **WebSocket Connection**: SockJS-based persistent connection
- **Auto-Reconnection**: Exponential backoff retry logic
- **Multi-tenant Support**: Subdomain-aware connection routing
- **Change Routing**: Maps database notifications to cache updates

**Connection Flow:**
```typescript
// Smart connection with server availability check
await rtl.smartConnectAndHold();

// Listen for database changes
rtl.on('publication:received', (data) => {
  // Route to appropriate cache handler
  handleTablePublication(data);
});
```

**Message Types:**
- `database`: Change notifications from PostgreSQL publications
- `system`: Connection status and authentication
- `error`: Error handling and recovery

### Change Propagation

1. **Backend Publication**: PostgreSQL publishes changes to `whagons_<table>_changes`
2. **WebSocket Notification**: SockJS server forwards to client
3. **Cache Update**: RTL routes change to appropriate cache handler
4. **Event Emission**: Cache emits events for Redux synchronization
5. **UI Refresh**: Components re-render with updated data

## Redux Integration

### Async Thunks with Optimistic Updates

**Location**: `src/store/reducers/tasksSlice.ts`, etc.

**Pattern:**
```typescript
export const updateTaskAsync = createAsyncThunk(
  'tasks/updateTaskAsync',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      // API call with optimistic updates
      const response = await api.patch(`/tasks/${id}`, updates);
      await TasksCache.updateTask(id.toString(), response.data);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);
```

### Optimistic Update Flow

```typescript
// 1. Store previous state for rollback
state.previousState = [...state.value];

// 2. Apply optimistic update immediately
const index = state.value.findIndex(task => task.id === id);
if (index !== -1) {
  state.value[index] = { ...state.value[index], ...updates };
}

// 3. On success: Keep optimistic update
// 4. On failure: Rollback to previousState
```

### Event-Driven Synchronization

**Location**: `src/store/eventEmiters/taskEvents.ts`

```typescript
// Cache notifies Redux of changes
TaskEvents.emit(TaskEvents.EVENTS.TASK_UPDATED, updatedTask);

// Redux listens for cache events
useEffect(() => {
  const unsubscribe = TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, (task) => {
    dispatch(updateTaskInRedux(task));
  });
  return unsubscribe;
}, []);
```

## Integrity Validation

### Client-Side Hash Verification

Similar to backend but optimized for client constraints:

```typescript
// 1. Compute local block hashes
const localBlocks = await computeLocalBlockHashes();

// 2. Compare with server global hash (fast short-circuit)
const localGlobalHash = sha256(localBlocks.map(b => b.block_hash).join(''));

// 3. If mismatch, compare block-level hashes
// 4. Fetch and update only changed blocks
```

### Hash Parity Configuration (hashFields)

We ensure client/server hash parity by configuring per-slice `hashFields` and normalizing values in `GenericCache`:

- File: `src/store/genericSliceFactory.ts` adds `hashFields?: string[]` to `GenericSliceConfig` and passes it to `GenericCache`.
- File: `src/store/indexedDB/GenericCache.ts` computes row hashes using:
  - The `hashFields` list in the exact order.
  - Normalization rules to match backend triggers:
    - Date-like fields ending with `_at` or `_date` → converted to UTC epoch ms.
    - Booleans → `'t'`/`'f'` (Postgres text casting).
    - Arrays/Objects → deterministically stringified (stable JSON) to mirror `::text` semantics.

Configured examples in `src/store/genericSlices.ts`:

```ts
{ name: 'workspaces', table: 'wh_workspaces', endpoint: '/workspaces', store: 'workspaces', hashFields: ['id','name','description','color','icon','teams','type','category_id','spots','created_by','updated_at'] },
{ name: 'categories', table: 'wh_categories', endpoint: '/categories', store: 'categories', hashFields: ['id','name','description','color','icon','enabled','sla_id','team_id','workspace_id','updated_at'] },
{ name: 'teams', table: 'wh_teams', endpoint: '/teams', store: 'teams', hashFields: ['id','name','description','color','updated_at'] },
{ name: 'priorities', table: 'wh_priorities', endpoint: '/priorities', store: 'priorities', hashFields: ['id','name','color','sla_id','category_id','updated_at'] },
{ name: 'statuses', table: 'wh_statuses', endpoint: '/statuses', store: 'statuses', hashFields: ['id','category_id','name','action','color','icon','system','initial','final','updated_at'] },
```

Debugging parity:

- Enable verbose integrity logs:

```js
localStorage.setItem('wh-debug-integrity','true');
```

- On mismatches, `GenericCache.validate()` logs:
  - Global hash mismatch (local vs server)
  - Row-level diff: `{ table, blockId, rowId, localHash, serverHash }`
  - Post-refetch confirmation of local vs server row hashes

Backend alignment (reference):

- Hash triggers defined in `database/migrations/2025_08_14_000900_create_wh_integrity_hash_tables.php` using `CONCAT_WS` of canonical columns and UTC epoch ms for timestamps.
- Ensure each table that needs validation has a trigger; e.g., `wh_templates` added to triggers and publications.

### Prompt to complete hashFields for remaining slices

Use this prompt with an agent that can edit `src/store/genericSlices.ts` and view backend migrations:

```
Goal: Complete `hashFields` configuration for all slices in `src/store/genericSlices.ts` so client hashes match backend triggers.

Context:
- Frontend hashing behavior is defined in `src/store/indexedDB/GenericCache.ts` and expects `hashFields` to list columns in exact order.
- Date fields ending `_at` or `_date` are normalized to UTC epoch ms, booleans map to 't'/'f', and arrays/objects stringify deterministically, matching server `::text`.
- Backend triggers live in `whagons5-api/database/migrations/2025_08_14_000900_create_wh_integrity_hash_tables.php`. Each table’s row hash uses `CONCAT_WS` of specific columns.

Steps:
1) For each generic slice without `hashFields`, find the corresponding backend trigger definition in the migration and copy the column order into an array of strings. Use canonical frontend property names that match API payloads.
2) Add `hashFields: [...]` to each slice config in `genericSlices.ts` using the exact order and fields used by the backend trigger.
3) Skip tables without triggers (or add minimal fields if they won’t be validated yet). Note: `wh_templates` trigger has been added; include it if the frontend needs validation.
4) Validate by running the app with `localStorage['wh-debug-integrity']='true'` and confirm that `GenericCache` logs show `global compare equal: true` for all configured tables after a reload. If mismatches persist, compare server trigger fields vs API shape and adjust field names accordingly (e.g., booleans, nested arrays/objects).

Deliverables:
- A PR updating `src/store/genericSlices.ts` with complete `hashFields` entries for all remaining slices, verified by integrity logs showing parity.
```

### Data Consistency Guarantees

- **Block-Level Comparison**: Detects changes without full data transfer
- **Row-Level Verification**: Precise identification of modified records
- **Automatic Repair**: Missing or corrupted data automatically refetched
- **Background Operation**: Validation doesn't block UI interactions

## Error Handling and Recovery

### Network Failure
- **Graceful Degradation**: Cached data remains available
- **Retry Logic**: Exponential backoff for failed requests
- **Offline Mode**: Full functionality using IndexedDB

### Authentication Issues
- **Session Recovery**: Automatic token refresh
- **Reconnection**: WebSocket reconnection on auth restore
- **Data Consistency**: Cache validation after reconnection

### Data Corruption
- **Cache Clearing**: Automatic reset on version mismatch
- **Rebuild Logic**: Complete cache reconstruction from server
- **Integrity Checks**: Continuous validation with server state

## Performance Optimizations

### 1. Intelligent Caching
- **Lazy Loading**: Data loaded only when needed
- **Incremental Updates**: Only changed data transferred
- **Background Sync**: Updates happen transparently

### 2. Memory Management
- **IndexedDB**: Handles large datasets efficiently
- **Pagination**: Client-side pagination for large lists
- **Streaming**: Large imports processed in chunks

### 3. Query Optimization
- **Local Filtering**: Complex queries executed locally
- **Index Utilization**: IndexedDB indexes for fast lookups
- **Result Caching**: Frequently accessed query results cached

## Implementation Examples

### Adding a New Entity

To add a new cached entity following this pattern:

1. **Create Cache Class** (optional, or use GenericCache):
```typescript
export class MyEntityCache extends GenericCache {
  constructor() {
    super({
      table: 'wh_my_entities',
      endpoint: '/my-entities',
      store: 'my_entities'
    });
  }
}
```

2. **Create Redux Slice**:
```typescript
const myEntitySlice = createSlice({
  name: 'myEntities',
  initialState: { value: [], loading: false },
  reducers: {
    // Standard CRUD reducers
  },
  extraReducers: (builder) => {
    // Handle async thunks
  }
});
```

3. **Register in Cache Registry**:
```typescript
'wh_my_entities': {
  add: (row) => MyEntityCache.add(row),
  update: (id, row) => MyEntityCache.update(id, row),
  remove: (id) => MyEntityCache.remove(id)
}
```

4. **Add to Store**:
```typescript
const rootReducer = combineReducers({
  // ... existing reducers
  myEntities: myEntitySlice.reducer
});
```

5. **Initialize in AuthProvider**:
```typescript
await MyEntityCache.init();
dispatch(getMyEntitiesFromIndexedDB());
```

## Current Implementation Status

### 🎯 **Final Massive Code Reduction Achieved**

**Before Generic Factory:**
- 25+ individual slice files (4,000+ lines of code)
- Manual maintenance for each table
- Repetitive boilerplate code

**After Generic Factory (Final State):**
- **1 custom slice** (tasks - complex features)
- **1 generic factory** (handles 31+ tables)
- **98.5% reduction in boilerplate code**
- **Single source of truth** for CRUD operations

### Custom Slice (Advanced Features)
- **Tasks Only**: Complete with local query engine, real-time updates, integrity validation, custom caching

### Generic Slices (Automated CRUD)
- **31+ Tables Using Generic Factory**: All simple CRUD operations
- **Zero Boilerplate**: All slices generated from 4-line configuration
- **Full Real-Time Support**: Automatic cache registry integration
- **Type Safety**: Complete TypeScript integration
- **Automatic Cache Management**: No manual cache setup required
- **Lazy Loading**: Auto-initialize on first access for optimal performance

### Migration Completed ✅
**Successfully migrated 24 individual slices to generic factory:**
- categories, categoryFieldAssignments, customFields
- teams, templates, workspaces
- forms, invitations, permissions, rolePermissions
- slas, slaAlerts, spots, statuses, priorities
- spotTypes, statusTransitions, tags
- users, userTeams, userPermissions
- taskUsers, taskTags, taskLogs
- And 13+ additional custom field and form tables

**Only 1 custom slice remains**: tasksSlice with advanced features

### Real-Time Features
- **WebSocket Connection**: Production-ready with reconnection logic
- **Change Notifications**: Automatic cache updates from database changes
- **Multi-tenant Support**: Subdomain-aware connection routing

## Future Enhancements

### Planned Features
- **Advanced Conflict Resolution**: Multi-user editing with merge strategies
- **Selective Synchronization**: Per-user data filtering
- **Background Sync**: Queued operations for offline periods
- **Data Compression**: Reduced storage footprint for mobile devices

### Scalability Improvements
- **Service Worker Integration**: Background sync for progressive web app
- **WebRTC Data Channels**: Peer-to-peer data synchronization
- **CDN Integration**: Global data distribution for large deployments

## Notes on Client-Server Consistency

- **Hash Stability**: Same algorithm used client and server for reliable comparison
- **Timestamp Normalization**: UTC epoch milliseconds for consistent hashing
- **Nullable Handling**: Explicit null/empty value handling in hash computation
- **Field Ordering**: Canonical column ordering for stable hashes

## Example References

- **Redux Store**: `src/store/store.ts`, `src/store/types.ts`
- **Generic Slice Factory**: `src/store/genericSliceFactory.ts`, `src/store/genericSlices.ts`
- **Custom Caches**: `TasksCache.ts`, `CategoriesCache.ts`, `GenericCache.ts`
- **Cache Registry**: `CacheRegistry.ts` (routes database changes to caches)
- **Real-Time Updates**: `RTL.ts`, `taskEvents.ts`
- **Redux Slices**: `tasksSlice.ts`, `categoriesSlice.ts` (custom), `genericSlices.ts` (factory-generated)
- **Authentication Integration**: `AuthProvider.tsx`

This architecture provides a robust, scalable foundation for data management in the Whagons application, ensuring excellent performance, offline capability, and real-time synchronization across all client instances.
