## Generic Cache and Slices Guide

### What this covers

- The end-to-end data flow used for large entity lists (e.g., tasks)
- How the `GenericCache` works and when to use it vs a bespoke cache
- How the Workspace page reads from the cache directly for fast grids
- How to implement a new entity using this pattern (cache + slice + events)

### High-level architecture

```
API → IndexedDB (GenericCache) → Redux (slices for mutations/UI) → Components
                                   └─ Components may also read directly from cache for big lists
```

- **IndexedDB** persists entity rows per user (see `src/store/indexedDB/DB.ts`).
- **GenericCache** provides minimal, reusable CRUD + fetchAll + integrity validation.
- **Redux slices** manage UI state and optimistic mutations (create/update/delete).
- **Large tables** (e.g., Workspace tasks grid) query from cache directly for performance/offline use, then react to cache events for refreshes.

---

## GenericCache

### Location

`src/store/indexedDB/GenericCache.ts`

### Constructor options

- `table`: server table name for integrity endpoints (e.g., `wh_tasks`)
- `endpoint`: REST resource path (e.g., `/tasks`)
- `store`: IndexedDB object store name (e.g., `tasks`)
- `idField` (optional): primary key field, defaults to `id`
- `hashFields` (optional): list of fields to build a row hash; if omitted, a stable JSON hash is used

### Core methods

- `add(row)`: upsert a row into the object store
- `update(id, row)`: upsert a row (same as add, but explicit signature)
- `remove(id)`: delete by key
- `getAll()`: return all rows from object store
- `fetchAll(params?)`: GET the `endpoint`, write all rows to cache
- `validate()`: integrity validation against backend block hashes; selectively refetches rows that differ and removes local-only rows

### Integrity model (why it’s fast)

1. Compute local block hashes over ID ranges (block size 1024)
2. Compare to server block hashes via `/integrity/blocks` and optionally `/integrity/global`
3. For mismatched blocks, fetch only differing rows via `/integrity/blocks/{id}/rows` and `GET endpoint?ids=…`

This avoids full refreshes and keeps large caches in sync quickly.

---

## Tasks: how it’s wired today

### Cache

`src/store/indexedDB/TasksCache.ts` predates `GenericCache` and implements:
- Initialization that waits for auth and IndexedDB (`DB.init()`)
- A full `fetchTasks()` (paginated) and `validateTasks()` with hashing (always-on)
- Query helpers (`queryTasks(params)`) to filter/sort/paginate locally, mirroring backend behavior
- Emits UI events via `TaskEvents` on cache writes

New entities should generally rely on `GenericCache` and keep custom code minimal. For big grids, you can still add a small `query<Entity>` helper to run local filtering/sorting if needed.

### Slice

`src/store/reducers/tasksSlice.ts` uses async thunks to:
- Load from IndexedDB (`getTasksFromIndexedDB`)
- Perform optimistic `add`, `update`, `remove` by calling the API and then writing to the cache

Slices keep UI state (loading/errors) and enable optimistic UX. The large Workspace grid does not read tasks from Redux; it queries the cache directly for performance.

### Workspace usage

`src/pages/spaces/components/WorkspaceTable.tsx`:
- On first access, ensures cache is ready (`TasksCache.init()`)
- Calls `TasksCache.queryTasks({ ...agGridParams, workspace_id, search })` to get rows/count from IndexedDB
- Subscribes to `TaskEvents` (created/updated/deleted/bulk_update/cache_invalidate) to clear an in-memory page cache and refresh the grid

This pattern keeps the grid responsive for very large datasets, works offline, and avoids Redux bloat for thousands of rows.

---

## Implementing a new entity with GenericCache

Follow these steps when adding a new cached entity (e.g., `spots`, `tags`, `statuses`, etc.).

### 1) Ensure an IndexedDB store exists

Add a new object store in `src/store/indexedDB/DB.ts` (inside `onupgradeneeded`):

```ts
if (!db.objectStoreNames.contains("spots")) {
  db.createObjectStore("spots", { keyPath: "id" });
}
```

Note: bump the `CURRENT_DB_VERSION` if the schema changes.

### 2) Create a thin cache wrapper using GenericCache

Add `src/store/indexedDB/SpotsCache.ts`:

```ts
import { GenericCache } from "./GenericCache";

export const SpotsCache = new GenericCache({
  table: "wh_spots",          // server table name used by integrity endpoints
  endpoint: "/spots",         // REST endpoint to fetch rows
  store: "spots",             // IndexedDB object store name
  idField: "id",              // defaults to "id" (optional)
  hashFields: [                // keep this small; include fields that affect UI/logic
    "id",
    "name",
    "workspace_id",
    "updated_at",
  ],
});

// Optional: provide a small query helper if you need local filtering/sorting for a grid
export async function querySpots(params: any = {}) {
  const rows = await SpotsCache.getAll();
  // apply simple filters/sort/pagination similarly to TasksCache.queryTasks
  // keep this minimal and tailored to your UI needs
  return { rows, rowCount: rows.length };
}
```

Usage guidelines:
- Call `await SpotsCache.fetchAll()` once if cache is empty; otherwise `await SpotsCache.validate()` on page entry
- For large lists, read directly from `SpotsCache`/`querySpots` in the component
- For normal screens, load into Redux for UI state with a slice (below)

### 3) Define a slice with optimistic mutations

Create `src/store/reducers/spotsSlice.ts` with a familiar structure:

```ts
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/api/whagonsApi";
import type { Spot } from "@/store/types";
import { SpotsCache } from "@/store/indexedDB/SpotsCache";

export const getSpotsFromIndexedDB = createAsyncThunk("spots/load", async () => {
  return await SpotsCache.getAll();
});

export const addSpotAsync = createAsyncThunk("spots/add", async (payload: Omit<Spot, "id"|"created_at"|"updated_at">, { rejectWithValue }) => {
  try {
    const resp = await api.post("/spots", payload);
    const spot = resp.data.rows?.[0] || resp.data;
    await SpotsCache.add(spot);
    return spot;
  } catch (e: any) {
    return rejectWithValue(e.response?.data?.message || "Failed to add spot");
  }
});

// add update/remove thunks similarly, writing to SpotsCache on success

const initialState = { value: [] as Spot[], loading: false, error: null as string|null, previousState: null as Spot[]|null };

export const spotsSlice = createSlice({
  name: "spots",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getSpotsFromIndexedDB.pending, (s) => { s.loading = true; })
      .addCase(getSpotsFromIndexedDB.fulfilled, (s, a) => { s.loading = false; s.value = a.payload; })
      .addCase(getSpotsFromIndexedDB.rejected, (s, a) => { s.loading = false; s.error = a.error.message || null; })
      // add optimistic add/update/remove handlers as in tasksSlice
  }
});

export default spotsSlice.reducer;
```

Finally, register the reducer in `src/store/store.ts`.

### 4) Optional: an event bus for real-time grid refreshes

For heavy grids, emit events after cache writes so components can refresh without Redux selectors:

```ts
// src/store/eventEmiters/spotEvents.ts
export class SpotEvents {
  private static listeners: Map<string, ((data: any) => void)[]> = new Map();
  static on(event: string, cb: (d: any) => void) { (this.listeners.get(event) ?? this.listeners.set(event, []).get(event)!)!.push(cb); return () => {
    const arr = this.listeners.get(event); if (!arr) return; const i = arr.indexOf(cb); if (i > -1) arr.splice(i, 1);
  }; }
  static emit(event: string, data?: any) { this.listeners.get(event)?.forEach(cb => cb(data)); }
  static readonly EVENTS = { CREATED: "spot:created", UPDATED: "spot:updated", DELETED: "spot:deleted", BULK: "spots:bulk_update", INVALIDATE: "cache:invalidate" } as const;
}
```

Call `SpotEvents.emit(...)` inside your cache wrapper after `add/update/remove/fetchAll` to notify grids.

### 5) Component pattern for large lists (similar to WorkspaceTable)

In your table component:
- Ensure the cache is initialized (call `fetchAll()` if empty else `validate()`)
- Implement an AG Grid datasource whose `getRows` pulls from `query<Entity>()`
- Memoize an in-memory request cache key across `startRow/endRow/filterModel/sortModel/searchText`
- Subscribe to `<Entity>Events` to clear the request cache and refresh the grid

---

## Best practices

- **Prefer GenericCache** for new entities; only add custom code for local querying if the UI needs it
- **Keep `hashFields` minimal** and include `updated_at` (or equivalent) to detect changes cheaply
- **Do not block on Redux** for very large lists; read from the cache directly
- **Emit events** on cache writes so grids can react instantly
- **Guard for auth**: `DB.init()` requires an authenticated user; init caches after auth
- **Integrity first**: on page mount, validate; only full fetch when cache is empty

---

## Minimal checklist to add a new cached entity

1. Add an object store in `DB.ts` (and bump version if needed)
2. Create a `GenericCache` instance with correct `table`, `endpoint`, `store`, and `hashFields`
3. Add a Redux slice with a thunk to load from IndexedDB and thunks for optimistic mutations
4. For big lists, add a tiny `query<Entity>()` helper for local filtering/pagination
5. Optionally add an `<Entity>Events` emitter and wire it into the component to refresh grids

With this pattern, future entities can be implemented consistently, efficiently, and without copying the bespoke tasks cache.


