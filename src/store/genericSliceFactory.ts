import { createAsyncThunk, createSlice, PayloadAction, Slice } from "@reduxjs/toolkit";
import type { SliceCaseReducers, SliceSelectors } from "@reduxjs/toolkit";
import { GenericCache } from "./indexedDB/GenericCache";

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
    cache?: GenericCache;
}

// Return type interface for createGenericSlice
export interface GenericSliceResult<T = any> {
    slice: Slice<GenericSliceState<T>>;
    actions: Record<string, any>;
    cache: GenericCache;
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

    // Create cache instance if not provided
    const cacheInstance = cache || new GenericCache({ table, endpoint, store, hashFields });

    // Get event names for this table
    const events = GenericEvents.getEvents(table);

    // Async thunks
    const getFromIndexedDB = createAsyncThunk<T[]>(
        `${name}/loadFromIndexedDB`,
        async () => {
            return await cacheInstance.getAll() as T[];
        }
    );

    const fetchFromAPI = createAsyncThunk<T[], any | undefined>(
        `${name}/fetchFromAPI`,
        async (params?: any) => {
            const success = await cacheInstance.fetchAll(params);
            if (success) {
                return await cacheInstance.getAll() as T[];
            }
            throw new Error(`Failed to fetch ${name}`);
        }
    );

    // Generic update async thunk
    const updateAsync = createAsyncThunk<{ id: number | string; updates: Partial<T> }, { id: number | string; updates: Partial<T> }, { rejectValue: string }>(
        `${name}/updateAsync`,
        async ({ id, updates }: { id: number | string; updates: Partial<T> }, { rejectWithValue }) => {
            try {
                // Update in cache
                await cacheInstance.update(id, updates as any);

                // Emit event for UI updates
                GenericEvents.emit(events.UPDATED, { id, ...updates });

                return { id, updates };
            } catch (error: any) {
                return rejectWithValue(error.message as string);
            }
        }
    );

    // Generic add async thunk
    const addAsync = createAsyncThunk<T, T, { rejectValue: string }>(
        `${name}/addAsync`,
        async (item: T, { rejectWithValue }) => {
            try {
                // Add to cache
                await cacheInstance.add(item as any);

                // Emit event for UI updates
                GenericEvents.emit(events.CREATED, item);

                return item as T;
            } catch (error: any) {
                return rejectWithValue(error.message as string);
            }
        }
    );

    // Generic remove async thunk
    const removeAsync = createAsyncThunk<number | string, number | string, { rejectValue: string }>(
        `${name}/removeAsync`,
        async (id: number | string, { rejectWithValue }) => {
            try {
                // Remove from cache
                await cacheInstance.remove(id);

                // Emit event for UI updates
                GenericEvents.emit(events.DELETED, { id });

                return id;
            } catch (error: any) {
                return rejectWithValue(error.message as string);
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
                state.value.push(action.payload as any);
            },
            removeItem: (state, action: PayloadAction<number | string>) => {
                state.value = state.value.filter((item: any) => (item as any).id !== action.payload) as unknown as typeof state.value;
            },
        },
        extraReducers: (builder) => {
            // Handle getFromIndexedDB
            builder
                .addCase(getFromIndexedDB.pending, (state) => {
                    state.loading = true;
                    state.error = null;
                })
                .addCase(getFromIndexedDB.fulfilled, (state, action: PayloadAction<T[]>) => {
                    state.loading = false;
                    state.value = action.payload as unknown as typeof state.value;
                    state.error = null;
                })
                .addCase(getFromIndexedDB.rejected, (state, action) => {
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
            getFromIndexedDB,
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
    const caches: Record<string, GenericCache> = {};

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
