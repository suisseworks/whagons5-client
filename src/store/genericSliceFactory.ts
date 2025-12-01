import { createAsyncThunk, createSlice, PayloadAction, Slice } from "@reduxjs/toolkit";
import type { SliceCaseReducers, SliceSelectors } from "@reduxjs/toolkit";
import { DuckGenericCache } from "./database/DuckGenericCache";

// Generic event emitter for all tables (replaces TaskEvents for generic slices)
export class GenericEvents {
  private static listeners: Map<string, ((data: any) => void)[]> = new Map();

  static on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  static emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  static getEvents(tableName: string) {
    return {
      CREATED: `${tableName}:created`,
      UPDATED: `${tableName}:updated`,
      DELETED: `${tableName}:deleted`,
      BULK_UPDATE: `${tableName}:bulk_update`,
      CACHE_INVALIDATE: `${tableName}:cache_invalidate`
    };
  }
}

// Generic state interface for all slices
export interface GenericSliceState<T = any> {
    value: T[];
    loading: boolean;
    error: string | null;
}

// Configuration interface for creating a generic slice
export interface GenericSliceConfig {
    name: string;
    table: string;
    endpoint: string;
    store: string;
    hashFields?: string[];
    cache?: DuckGenericCache<any>;
}

// Return type interface for createGenericSlice
export interface GenericSliceResult<T = any> {
    slice: Slice<GenericSliceState<T>>;
    actions: Record<string, any>;
    cache: DuckGenericCache<any>;
    events: typeof GenericEvents;
    eventNames: {
        CREATED: string;
        UPDATED: string;
        DELETED: string;
        BULK_UPDATE: string;
        CACHE_INVALIDATE: string;
    };
}



// Generic slice factory function
export function createGenericSlice<T = any>(config: GenericSliceConfig): GenericSliceResult<T> {
    const { name, table, endpoint, store, cache, hashFields } = config;

    // Create DuckDB-backed cache instance if not provided.
    // For now, we derive a simple column set: numeric id + TEXT columns for hashFields.
    const cacheInstance: DuckGenericCache<any> =
        cache ||
        new DuckGenericCache<any>({
            name,
            table: `duck_${store}`,
            serverTable: table,
            endpoint,
            columns: (() => {
                const cols: { name: string; type: any; primaryKey?: boolean }[] = [
                    { name: 'id', type: 'BIGINT', primaryKey: true },
                ];
                const extraFields = (hashFields || [])
                    .map((f) => String(f))
                    .filter((f) => f !== 'id');
                for (const f of extraFields) {
                    // Avoid duplicates
                    if (!cols.find((c) => c.name === f)) {
                        cols.push({ name: f, type: 'TEXT' });
                    }
                }
                return cols as any;
            })(),
            idField: 'id' as any,
            hashFields: hashFields as any,
        });

    // Get event names for this table
    const events = GenericEvents.getEvents(table);

    // Single-flight guard for DuckDB hydration
let inflightLoad: Promise<T[]> | null = null;

    // Helper function to normalize all ID fields to numbers
    const normalizeIds = (data: any): any => {
      if (!data || typeof data !== 'object') return data;
      if (Array.isArray(data)) {
        return data.map(normalizeIds);
      }
      const normalized = { ...data };
      for (const key in normalized) {
        if (Object.prototype.hasOwnProperty.call(normalized, key)) {
          const value = normalized[key];
          // Normalize ID fields (ending with _id or exactly 'id')
          if (key === 'id' || (typeof key === 'string' && key.endsWith('_id'))) {
            if (value != null && value !== '') {
              if (typeof value === 'bigint') {
                normalized[key] = Number(value);
              } else if (typeof value === 'string' && /^\d+$/.test(value)) {
                const num = Number(value);
                if (Number.isFinite(num)) normalized[key] = num;
              }
            }
          }
          // Handle arrays of IDs (like user_ids)
          else if (key === 'user_ids' && Array.isArray(value)) {
            normalized[key] = value.map((v: any) => {
              if (typeof v === 'bigint') return Number(v);
              if (typeof v === 'string' && /^\d+$/.test(v)) {
                const num = Number(v);
                return Number.isFinite(num) ? num : v;
              }
              return typeof v === 'number' && Number.isFinite(v) ? v : v;
            });
          }
          // Recursively normalize nested objects
          else if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
            normalized[key] = normalizeIds(value);
          }
        }
      }
      return normalized;
    };

    // Async thunks
    const getFromDuckDB = createAsyncThunk<T[], { force?: boolean } | undefined, { state: any }>(
        `${name}/loadFromDuckDB`,
        async (_arg, { getState: _getState }) => {
            // Always fetch fresh data from DuckDB-backed cache
            if (inflightLoad) {
                return inflightLoad;
            }

            inflightLoad = (async () => {
                const rows = (await cacheInstance.getAll()) as T[];
                // Normalize all IDs to numbers before storing in Redux
                const normalized = normalizeIds(rows) as T[];
                inflightLoad = null;
                return normalized;
            })();
            return inflightLoad;
        }
    );

    const fetchFromAPI = createAsyncThunk<T[], any | undefined>(
        `${name}/fetchFromAPI`,
        async (params?: any) => {
            const success = await cacheInstance.fetchAll(params);
            if (success) {
                const data = await cacheInstance.getAll() as T[];
                // Normalize all IDs to numbers before storing in Redux
                return normalizeIds(data) as T[];
            }
            throw new Error(`Failed to fetch ${name}`);
        }
    );

    // Generic update async thunk with optimistic Redux updates
    const updateAsync = createAsyncThunk<{ id: number | string; updates: Partial<T> }, { id: number | string; updates: Partial<T> }, { rejectValue: string; state: any }>(
        `${name}/updateAsync`,
        async (
            { id, updates }: { id: number | string; updates: Partial<T> },
            { rejectWithValue, dispatch, getState }
        ) => {
            // Save previous state for rollback
            const prevItems: any[] = (getState()[name]?.value ?? []) as any[];
            const previous = prevItems.find((it) => String((it as any).id) === String(id));

            try {
                // Optimistic update in Redux
                dispatch((slice.actions as any).updateItem({ id, ...(updates as any) }));
                GenericEvents.emit(events.UPDATED, { id, ...(updates as any) });

                // Remote update
                const saved = await cacheInstance.updateRemote(id as any, updates as any);

                // Persist into DuckDB cache with server response
                await cacheInstance.update(id as any, saved);

                // Normalize IDs before updating Redux
                const normalizedSaved = normalizeIds(saved);

                // Update Redux with server truth
                dispatch((slice.actions as any).updateItem(normalizedSaved));
                GenericEvents.emit(events.UPDATED, saved);

                return { id, updates };
            } catch (error: any) {
                // Rollback optimistic update
                if (previous) {
                    dispatch((slice.actions as any).updateItem(previous));
                }
                return rejectWithValue(error?.message as string);
            }
        }
    );

    // Generic add async thunk with optimistic Redux updates
    const addAsync = createAsyncThunk<T, T, { rejectValue: string; state: any }>(
        `${name}/addAsync`,
        async (item: T, { rejectWithValue, dispatch }) => {
            // Generate temp id for optimistic UI
            const hasId = (item as any)?.id !== undefined && (item as any)?.id !== null;
            const tempId = hasId ? (item as any).id : -Date.now();
            const optimistic: any = { ...(item as any), id: tempId };

            try {
                // Optimistic update to Redux immediately
                dispatch((slice.actions as any).addItem(optimistic));
                GenericEvents.emit(events.CREATED, optimistic);

                // Create on server
                const saved = await cacheInstance.createRemote(item as any);

                // Persist into DuckDB cache with real data from server
                await cacheInstance.add(saved);

                // Normalize IDs before updating Redux
                const normalizedSaved = normalizeIds(saved);

                // Replace optimistic item with real data in Redux
                dispatch((slice.actions as any).removeItem(tempId));
                dispatch((slice.actions as any).addItem(normalizedSaved));
                GenericEvents.emit(events.CREATED, saved);

                return saved as T;
            } catch (error: any) {
                // Rollback optimistic update on error
                dispatch((slice.actions as any).removeItem(tempId));
                return rejectWithValue(error?.message as string);
            }
        }
    );

    // Generic remove async thunk with optimistic Redux updates
    const removeAsync = createAsyncThunk<number | string, number | string, { rejectValue: string; state: any }>(
        `${name}/removeAsync`,
        async (id: number | string, { rejectWithValue, dispatch, getState }) => {
            // Save item for rollback
            const items: any[] = (getState()[name]?.value ?? []) as any[];
            const itemToRemove = items.find((it) => String((it as any).id) === String(id));

            try {
                // Optimistic remove from Redux
                dispatch((slice.actions as any).removeItem(id));
                GenericEvents.emit(events.DELETED, { id });

                // Remote delete (404 means already deleted, treat as success)
                try {
                    await cacheInstance.deleteRemote(id as any);
                } catch (error: any) {
                    // If 404, item is already deleted on server - treat as success
                    if (error?.response?.status === 404) {
                        console.log(`${name}/removeAsync: Item ${id} already deleted on server (404)`);
                    } else {
                        throw error; // Re-throw other errors
                    }
                }

                // Remove from DuckDB cache (idempotent - safe if already deleted)
                try {
                    await cacheInstance.remove(id);
                } catch (error: any) {
                    // Ignore errors if item doesn't exist in DuckDB cache
                    console.warn(`${name}/removeAsync: Failed to remove from DuckDB cache (may already be deleted)`, error);
                }

                // Always refresh Redux from DuckDB cache to ensure sync
                dispatch(getFromDuckDB());

                return id;
            } catch (error: any) {
                // Rollback optimistic delete
                if (itemToRemove) {
                    dispatch((slice.actions as any).addItem(itemToRemove));
                }
                return rejectWithValue(error?.message as string);
            }
        }
    );

    // Initial state
    const initialState: GenericSliceState<T> = {
        value: [],
        loading: false,
        error: null,
    };

    // Create slice
    const slice = createSlice<
        GenericSliceState<T>,
        SliceCaseReducers<GenericSliceState<T>>,
        string,
        SliceSelectors<GenericSliceState<T>>
    >({
        name,
        initialState,
        reducers: {
            setLoading: (state, action: PayloadAction<boolean>) => {
                state.loading = action.payload;
            },
            setError: (state, action: PayloadAction<string | null>) => {
                state.error = action.payload;
            },
            clearError: (state) => {
                state.error = null;
            },
            updateItem: (state, action: PayloadAction<T>) => {
                const index = state.value.findIndex((item: any) => (item as any).id === (action.payload as any).id);
                if (index !== -1) {
                    state.value[index] = { ...(state.value[index] as any), ...(action.payload as any) } as any;
                }
            },
            addItem: (state, action: PayloadAction<T>) => {
                const newItem = action.payload as any;
                const existingIndex = state.value.findIndex((item: any) => (item as any).id === newItem.id);

                if (existingIndex >= 0) {
                    // Replace existing item with the same ID
                    state.value[existingIndex] = newItem;
                } else {
                    // Add new item if no existing item with same ID
                    state.value.push(newItem);
                }
            },
            removeItem: (state, action: PayloadAction<number | string>) => {
                state.value = state.value.filter((item: any) => (item as any).id !== action.payload) as unknown as typeof state.value;
            },
        },
        extraReducers: (builder) => {
            // Handle getFromDuckDB
            builder
                .addCase(getFromDuckDB.pending, (state) => {
                    state.loading = true;
                    state.error = null;
                })
                .addCase(getFromDuckDB.fulfilled, (state, action: PayloadAction<T[]>) => {
                    state.loading = false;
                    state.value = action.payload as unknown as typeof state.value;
                    state.error = null;
                })
                .addCase(getFromDuckDB.rejected, (state, action) => {
                    state.loading = false;
                    state.error = action.error.message || null;
                });

            // Handle fetchFromAPI
            builder
                .addCase(fetchFromAPI.pending, (state) => {
                    state.loading = true;
                    state.error = null;
                })
                .addCase(fetchFromAPI.fulfilled, (state, action: PayloadAction<T[]>) => {
                    state.loading = false;
                    state.value = action.payload as unknown as typeof state.value;
                    state.error = null;
                })
                .addCase(fetchFromAPI.rejected, (state, action) => {
                    state.loading = false;
                    state.error = action.error.message || null;
                });
        },
    });

    return {
        slice,
        actions: {
            ...slice.actions,
            getFromDuckDB,
            // Legacy alias for callers not yet migrated
            getFromIndexedDB: getFromDuckDB,
            fetchFromAPI,
            updateAsync,
            addAsync,
            removeAsync,
        },
        cache: cacheInstance,
        events: GenericEvents,
        eventNames: events,
    };
}

// Utility function to create multiple slices at once (without strict typing for flexibility)
export function createGenericSlices(configs: GenericSliceConfig[]) {
    const slices: Record<string, GenericSliceResult<any>> = {};
    const reducers: Record<string, any> = {};
    const caches: Record<string, DuckGenericCache<any>> = {};

    configs.forEach(config => {
        const result = createGenericSlice(config);
        slices[config.name] = result;
        reducers[config.name] = result.slice.reducer;
        caches[config.name] = result.cache;
    });

    return {
        slices,
        reducers,
        caches,
    };
}
