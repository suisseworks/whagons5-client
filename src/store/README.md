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
User Authenticates → AuthProvider → dispatch(getWorkspacesFromIndexedDB()) → WorkspaceCache.init()
```

1. **User logs in** via Firebase Authentication
2. **AuthProvider** detects authentication and fetches user data
3. **After successful user fetch**, AuthProvider dispatches `getWorkspacesFromIndexedDB()`
4. **Async thunk** calls `WorkspaceCache.getWorkspaces()` to get cached data
5. **Redux store** is populated with workspace data
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