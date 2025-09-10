# Store Architecture Documentation

## Overview

This document explains the data flow architecture used in the Whagons application, specifically focusing on how workspaces (and teams) are managed through IndexedDB caching and Redux state management.

## Architecture Pattern

The application uses a **3-tier caching strategy**:

```
API Server → IndexedDB (Local Cache) → Redux Store → React Components
```

### Benefits of this approach:
- **Offline support**: Data available even without internet
- **Performance**: Fast local access to frequently used data
- **Synchronization**: Smart updates only when data changes
- **Persistence**: Data survives app refreshes and sessions

## Data Flow

### 1. Initial Load (User Authentication)
```typescript
User Authenticates → AuthProvider
  → Initialize caches (Workspace/Teams/Categories/Tasks)
  → Hydrate Redux from IndexedDB
  → For GenericCache-backed reference tables, hydrate + network refresh
```

1. **User logs in** via Firebase Authentication
2. **AuthProvider** detects authentication and fetches user data
3. **After successful user fetch**, AuthProvider initializes caches and hydrates Redux state
4. **Redux store** is populated from IndexedDB for fast UI
5. **Reference tables** (GenericCache-backed) also fetch from network to refresh cache
6. **Components** receive data via `useSelector`

### 2. Cache Initialization Process

The `WorkspaceCache.init()` method handles intelligent data loading:

```typescript
WorkspaceCache.init() → Check if initialized → Fetch from API if needed → Store in IndexedDB
```

**First time (not initialized):**
- Fetches all workspaces from API: `GET /workspaces`
- Stores data in IndexedDB
- Marks as initialized in localStorage
- Records last updated timestamp

**Subsequent loads (already initialized):**
- Validates cached data against server
- Fetches only updated workspaces: `GET /workspaces?updated_after={lastUpdated}`
- Updates only changed records
- Updates last updated timestamp

### 3. Component Usage

Components access workspace data through Redux:

```typescript
const { value: workspaces, loading, error } = useSelector((state: RootState) => state.workspaces);
```

## GenericCache-backed entities (reference tables)

Some smaller/reference entities use the shared `GenericCache` with thin slices that:
- Load from IndexedDB (fast, offline) using `get<X>FromIndexedDB`
- Optionally call `fetch<X>` to refresh the cache from the network

Current GenericCache-backed slices:
- `statusesSlice` → `getStatusesFromIndexedDB`, `fetchStatuses`
- `prioritiesSlice` → `getPrioritiesFromIndexedDB`, `fetchPriorities`
- `spotsSlice` → `getSpotsFromIndexedDB`, `fetchSpots`
- `tagsSlice` → `getTagsFromIndexedDB`, `fetchTags`
- `customFieldsSlice` → `getCustomFieldsFromIndexedDB`, `fetchCustomFields`
- `categoryFieldAssignmentsSlice` → fetch per category (`getAssignmentsForCategory`); assignments are persisted in a GenericCache store and reused

### AuthProvider hydration

After login, the provider initializes caches and dispatches hydration for all tables. Key lines:

```ts
// Initialize IndexedDB caches that require auth
await Promise.all([
  WorkspaceCache.init(),
  TeamsCache.init(),
  CategoriesCache.init(),
  TasksCache.init(),
]);

// Hydrate Redux from IndexedDB (fast)
dispatch(getWorkspacesFromIndexedDB());
dispatch(getTeamsFromIndexedDB());
dispatch(getCategoriesFromIndexedDB());
dispatch(getTasksFromIndexedDB());

// GenericCache-backed reference tables: load from cache, then refresh from network
dispatch(getStatusesFromIndexedDB());
dispatch(fetchStatuses());
dispatch(getPrioritiesFromIndexedDB());
dispatch(fetchPriorities());
dispatch(getSpotsFromIndexedDB());
dispatch(fetchSpots());
dispatch(getTagsFromIndexedDB());
dispatch(fetchTags());
dispatch(getCustomFieldsFromIndexedDB());
dispatch(fetchCustomFields());

// Category-field-assignments are fetched per category on demand and cached
```

Notes:
- `DB.ts` defines object stores; new stores (`custom_fields`, `category_field_assignments`) require a DB version bump.
- For large listings (e.g., Workspace tasks grid), components may read directly from IndexedDB (via a cache/query helper) for performance.

## Tasks vs GenericCache

`TasksCache` is bespoke to support:
- Real-time event emitters for grid refresh
- Local query engine to filter/sort/paginate offline, mirroring backend

This coexists with GenericCache-backed slices for reference data. Future large entities can adopt the GenericCache + local query helper pattern documented in `GenericCache-Guide.md`.

## Implementation Details

### WorkspaceCache Class

**Location**: `src/store/indexedDB/WorkspaceCache.ts`

**Key Methods**:
- `init()`: Initializes cache with smart loading logic
- `fetchWorkspaces()`: Gets all workspaces from API
- `validateWorkspaces()`: Syncs only changed workspaces
- `getWorkspaces()`: Retrieves cached workspaces from IndexedDB
- `addWorkspace()`, `updateWorkspace()`, `deleteWorkspace()`: CRUD operations

**Initialization Logic**:
```typescript
if (!this.initialized) {
    // First time - fetch all
    await this.fetchWorkspaces();
    this.initialized = true;
} else {
    // Subsequent - validate changes
    await this.validateWorkspaces();
}
```

### WorkspacesSlice

**Location**: `src/store/reducers/workspacesSlice.ts`

**Async Thunk**:
```typescript
export const getWorkspacesFromIndexedDB = createAsyncThunk('loadWorkspaces', async () => {
    const workspaces = await WorkspaceCache.getWorkspaces();
    return workspaces;
});
```

**State Management**:
- `pending`: Sets loading to true
- `fulfilled`: Updates workspaces array, applies defaults
- `rejected`: Sets error state

**Data Transformation**:
The `ensureWorkspaceDefaults` function ensures all workspaces have required UI properties:
```typescript
const ensureWorkspaceDefaults = (workspace: any): Workspace => ({
    ...workspace,
    icon: workspace.icon || 'briefcase',
    iconColor: workspace.iconColor || '#374151',
    description: workspace.description || `Main workspace for ${workspace.name}`
});
```

### AuthProvider Integration

**Location**: `src/providers/AuthProvider.tsx`

The AuthProvider automatically loads workspace data after user authentication:

```typescript
// After successful user fetch
if (response.status === 200) {
    setUser(userData);
    dispatch(getWorkspacesFromIndexedDB()); // Load workspaces
}
```

## Data Types

### Workspace Interface
```typescript
export interface Workspace {
    id: number;
    name: string;
    icon: string;
    iconColor: string;
    description: string | null;
    teams: [] | null;
    type: string;
    category_id: number | null;
    spots: [] | null;
    created_by: number;
    created_at: Date;
    updated_at: Date;
}
```

## Error Handling

- **Network errors**: Gracefully handled, cached data still available
- **Authentication errors**: User redirected to login
- **Data corruption**: Cache can be cleared and rebuilt
- **TypeScript safety**: Full type checking throughout the flow

## Performance Considerations

1. **Lazy loading**: Data loaded only when needed
2. **Incremental updates**: Only changed data is fetched
3. **Memory efficient**: IndexedDB handles large datasets
4. **Background sync**: Updates happen transparently
5. **Optimistic updates**: UI updates immediately, syncs in background

## Teams Implementation

Teams follow the exact same pattern as workspaces:

### TeamsCache Class
**Location**: `src/store/indexedDB/TeamsCache.ts`

**API Endpoint**: `GET /teams` returns:
```json
{
  "rows": [
    {
      "id": 1,
      "name": "Cleaning",
      "description": null,
      "color": null,
      "created_at": "2025-07-30T21:22:58.000000Z",
      "updated_at": "2025-07-30T21:22:58.000000Z",
      "deleted_at": null
    }
  ],
  "rowCount": 3
}
```

### TeamsSlice
**Location**: `src/store/reducers/teamsSlice.ts`

**Async Thunk**:
```typescript
export const getTeamsFromIndexedDB = createAsyncThunk('loadTeams', async () => {
    const teams = await TeamsCache.getTeams();
    return teams;
});
```

**Data Transformation**:
```typescript
const ensureTeamDefaults = (team: any): Team => ({
    ...team,
    color: team.color || '#374151',
    description: team.description || `Team for ${team.name}`
});
```

### AuthProvider Integration
Both workspaces and teams load automatically after authentication:
```typescript
// Load workspaces and teams from IndexedDB after user is authenticated
dispatch(getWorkspacesFromIndexedDB());
dispatch(getTeamsFromIndexedDB());
```

### Component Usage
```typescript
// Access teams data
const { value: teams, loading, error } = useSelector((state: RootState) => state.teams);

// Access workspaces data  
const { value: workspaces, loading, error } = useSelector((state: RootState) => state.workspaces);
```

### Team Interface
```typescript
export interface Team {
    id: number;
    name: string;
    description: string | null;
    color: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}
```

## Complete Data Flow

```
User Authenticates
├── AuthProvider.fetchUser()
├── dispatch(getWorkspacesFromIndexedDB())
│   ├── WorkspaceCache.init()
│   ├── Check if initialized
│   ├── Fetch/validate from API
│   └── Store in IndexedDB → Redux → Components
└── dispatch(getTeamsFromIndexedDB())
    ├── TeamsCache.init()
    ├── Check if initialized
    ├── Fetch/validate from API
    └── Store in IndexedDB → Redux → Components
```

This architecture provides:
- **Consistent patterns** across all data types
- **Scalable structure** for adding new entities
- **Predictable behavior** for developers
- **Optimal performance** with intelligent caching

This ensures consistency and maintainability across all data types in the application. 