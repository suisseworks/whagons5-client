import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import api from '@/api/whagonsApi';
import { DB } from '../indexedDB/DB';

// State interface for tenant availability
export interface TenantAvailabilityState {
  value: boolean | null; // null = unknown, true = exists (taken), false = available
  loading: boolean;
  error: string | null;
  lastCheckedTenant: string | null; // Track which tenant was last checked
}

// IndexedDB cache entry structure
interface TenantAvailabilityCache {
  tenantName: string;
  exists: boolean;
  checkedAt: number; // timestamp
}

const initialState: TenantAvailabilityState = {
  value: null,
  loading: false,
  error: null,
  lastCheckedTenant: null,
};

// Cache TTL: 5 minutes (300000 ms)
const CACHE_TTL = 5 * 60 * 1000;

// IndexedDB store name for tenant availability cache
const CACHE_STORE = 'tenant_availability';

/**
 * Get cached availability result from IndexedDB
 */
const getCachedAvailability = async (tenantName: string): Promise<boolean | null> => {
  try {
    if (!DB.inited) await DB.init();
    if (!DB.inited || !DB.db) return null;

    const cached = await DB.get(CACHE_STORE, tenantName);
    if (!cached) return null;

    const cacheEntry = cached as TenantAvailabilityCache;
    const now = Date.now();
    const age = now - cacheEntry.checkedAt;

    // Return cached value if still fresh
    if (age < CACHE_TTL) {
      return cacheEntry.exists;
    }

    // Cache expired, return null to trigger fresh check
    return null;
  } catch (error) {
    console.warn('Failed to read tenant availability cache:', error);
    return null;
  }
};

/**
 * Store availability result in IndexedDB cache
 */
const cacheAvailability = async (tenantName: string, exists: boolean): Promise<void> => {
  try {
    if (!DB.inited) await DB.init();
    if (!DB.inited || !DB.db) return;

    const cacheEntry: TenantAvailabilityCache = {
      tenantName,
      exists,
      checkedAt: Date.now(),
    };

    await DB.put(CACHE_STORE, cacheEntry);
  } catch (error) {
    console.warn('Failed to cache tenant availability:', error);
    // Don't throw - caching failure shouldn't break the flow
  }
};

/**
 * Async thunk to check tenant availability
 * Implements Redux pattern with IndexedDB fallback for offline resilience
 */
export const checkTenantAvailability = createAsyncThunk<
  boolean, // Return type: true = exists (taken), false = available
  string, // Argument type: tenant name
  { rejectValue: string }
>(
  'tenantAvailability/check',
  async (tenantName: string, { rejectWithValue }) => {
    // Normalize tenant name (lowercase, trimmed)
    const normalizedName = tenantName.trim().toLowerCase();
    
    if (!normalizedName || normalizedName.length < 2) {
      return rejectWithValue('Tenant name must be at least 2 characters');
    }

    // Try cache first (offline resilience)
    const cached = await getCachedAvailability(normalizedName);
    if (cached !== null) {
      return cached;
    }

    // Try API call
    try {
      const response = await api.get(
        `/tenants/check-availability/${encodeURIComponent(normalizedName)}`,
        {
          validateStatus: (status) => status < 500, // Don't throw on 404
        }
      );

      // 200 = tenant exists (taken)
      // 404 = tenant doesn't exist (available)
      const exists = response.status === 200;
      
      // Cache the result for offline resilience
      await cacheAvailability(normalizedName, exists);
      
      return exists;
    } catch (error: any) {
      // Network errors or other failures
      // Try to use cached value if available (even if expired)
      try {
        if (!DB.inited) await DB.init();
        if (DB.inited && DB.db) {
          const staleCache = await DB.get(CACHE_STORE, normalizedName);
          if (staleCache) {
            const cacheEntry = staleCache as TenantAvailabilityCache;
            console.warn('Using stale cache due to network error:', error?.message);
            return cacheEntry.exists;
          }
        }
      } catch (cacheError) {
        // Ignore cache read errors
      }

      // If no cache available, reject with error
      const errorMessage = error?.response?.data?.message || error?.message || 'Failed to check tenant availability';
      return rejectWithValue(errorMessage);
    }
  }
);

const tenantAvailabilitySlice = createSlice({
  name: 'tenantAvailability',
  initialState,
  reducers: {
    clearAvailability: (state) => {
      state.value = null;
      state.error = null;
      state.lastCheckedTenant = null;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkTenantAvailability.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkTenantAvailability.fulfilled, (state, action) => {
        state.loading = false;
        state.value = action.payload;
        state.error = null;
        // Track which tenant was checked (extracted from the thunk argument)
        // Note: We can't access the argument here, so we'll track it via a separate action if needed
      })
      .addCase(checkTenantAvailability.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || 'Failed to check tenant availability';
        // Keep previous value on error (don't reset to null)
      });
  },
});

export const { clearAvailability, setError } = tenantAvailabilitySlice.actions;
export default tenantAvailabilitySlice.reducer;
