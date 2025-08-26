# Frontend wh_ Tables Implementation Checklist

🚀 Frontend WH Tables Implementation
Current Status: 40/40 tables completed ✅

This file tracks the frontend implementation of Redux reducers and cache handlers for all wh_ tables that have backend hashing/publications/notifications implemented.

## Implementation Pattern

Each wh_ table needs:

### 1. TypeScript Interface
**Location**: `src/store/types.ts`
```typescript
export interface EntityName {
    id: number;
    // ... other fields based on backend model
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}
```

### 2. Redux Slice with GenericCache
**Location**: `src/store/reducers/entityNameSlice.ts`
```typescript
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { GenericCache } from "../indexedDB/GenericCache";
import api from "@/api/whagonsApi";

const entityCache = new GenericCache({
  table: 'wh_entity_names',
  endpoint: '/entity-names',
  store: 'entity_names'
});

export const getEntityNamesFromIndexedDB = createAsyncThunk(
  'entityNames/loadFromIndexedDB',
  async () => {
    const data = await entityCache.getAll();
    return data;
  }
);

export const fetchEntityNames = createAsyncThunk(
  'entityNames/fetchFromAPI',
  async (params?: any) => {
    const success = await entityCache.fetchAll(params);
    if (success) {
      return await entityCache.getAll();
    }
    throw new Error('Failed to fetch entity names');
  }
);

const entityNamesSlice = createSlice({
  name: 'entityNames',
  initialState: { value: [] as EntityName[], loading: false, error: null as string | null },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(getEntityNamesFromIndexedDB.pending, (state) => {
        state.loading = true;
      })
      .addCase(getEntityNamesFromIndexedDB.fulfilled, (state, action) => {
        state.loading = false;
        state.value = action.payload;
        state.error = null;
      })
      .addCase(getEntityNamesFromIndexedDB.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || null;
      })
      .addCase(fetchEntityNames.fulfilled, (state, action) => {
        state.value = action.payload;
        state.error = null;
      });
  }
});

export default entityNamesSlice.reducer;
```

### 3. Cache Registry Entry
**Location**: `src/store/indexedDB/CacheRegistry.ts`
```typescript
const entityNamesCache = new GenericCache({
  table: 'wh_entity_names',
  endpoint: '/entity-names',
  store: 'entity_names'
});

const cacheByTable: Record<string, CacheHandler> = {
  // ... existing entries
  'wh_entity_names': {
    add: (row) => entityNamesCache.add(row),
    update: (id, row) => entityNamesCache.update(id, row),
    remove: (id) => entityNamesCache.remove(id),
  },
};
```

### 4. Store Registration
**Location**: `src/store/store.ts`
```typescript
import entityNamesReducer from "./reducers/entityNamesSlice";

const rootReducer = combineReducers({
  // ... existing reducers
  entityNames: entityNamesReducer,
});
```

### 5. AuthProvider Integration
**Location**: `src/providers/AuthProvider.tsx`
```typescript
// After user authentication, initialize caches
await Promise.all([
  // ... existing cache inits
  entityNamesCache.init(),
]);

// Hydrate Redux from IndexedDB
dispatch(getEntityNamesFromIndexedDB());

// Optional: Refresh from network in background
dispatch(fetchEntityNames());
```

## Per-table verification checklist

For each table, verify all items are implemented:

### Redux & Cache Implementation
- [ ] TypeScript interface defined in `types.ts`
- [ ] Redux slice created with GenericCache integration
- [ ] GenericCache instance configured with correct table/endpoint/store
- [ ] Cache registry entry added for real-time updates
- [ ] Store reducer registered in `store.ts`
- [ ] AuthProvider initialization added
- [ ] Component integration (useSelector) where needed

### Real-Time Updates
- [ ] Cache registry routes database changes correctly
- [ ] RTL notifications trigger cache updates
- [ ] Redux state updates on cache changes

## Tables Status

### ✅ Currently Implemented (40/40)

#### Core Entities
- [x] wh_tasks (Custom cache with advanced features)
- [x] wh_categories (Custom cache)
- [x] wh_teams (Custom cache)
- [x] wh_workspaces (Custom cache)
- [x] wh_templates (Custom cache)
- [x] wh_statuses (GenericCache)
- [x] wh_priorities (GenericCache)
- [x] wh_spots (GenericCache)
- [x] wh_tags (GenericCache)

#### User Management & Authentication
- [x] wh_users (GenericCache)
- [x] wh_roles (GenericCache)
- [x] wh_permissions (GenericCache)
- [x] wh_user_team (GenericCache)
- [x] wh_user_permission (GenericCache)
- [x] wh_role_permission (GenericCache)
- [x] wh_task_user (GenericCache)

#### Custom Fields
- [x] wh_custom_fields (GenericCache)
- [x] wh_category_custom_field (as categoryFieldAssignments)

#### Status & Transitions
- [x] wh_status_transitions (GenericCache)

#### Tags and Relations
- [x] wh_task_tag (GenericCache)

#### Spot Types
- [x] wh_spot_types (GenericCache)

#### Custom Fields & Values
- [x] wh_spot_custom_fields (GenericCache)
- [x] wh_template_custom_field (GenericCache)
- [x] wh_task_custom_field_value (GenericCache)
- [x] wh_spot_custom_field_value (GenericCache)

#### SLA & Alerts
- [x] wh_slas (GenericCache)
- [x] wh_sla_alerts (GenericCache)

#### Category Priority
- [x] wh_category_priority (GenericCache)

#### Forms
- [x] wh_forms (GenericCache)
- [x] wh_form_fields (GenericCache)
- [x] wh_form_versions (GenericCache)
- [x] wh_task_form (GenericCache)
- [x] wh_field_options (GenericCache)

#### Activity & Logs
- [x] wh_task_logs (GenericCache)
- [x] wh_session_logs (GenericCache)
- [x] wh_config_logs (GenericCache)

#### File Management
- [x] wh_task_attachments (GenericCache)
- [x] wh_task_recurrences (GenericCache)

#### Misc
- [x] wh_invitations (GenericCache)
- [x] wh_exceptions (GenericCache)

## Implementation Priority

### ✅ COMPLETED High Priority (Core User Experience)
1. **wh_users** - User management and authentication ✅
2. **wh_roles** - Role-based permissions ✅
3. **wh_permissions** - Permission system ✅
4. **wh_user_team** - Team membership ✅
5. **wh_user_permission** - User permissions ✅
6. **wh_role_permission** - Role permissions ✅
7. **wh_task_user** - Task assignments ✅
8. **wh_task_tag** - Task tagging ✅
9. **wh_status_transitions** - Workflow management ✅
10. **wh_spot_types** - Spot categorization ✅

### ✅ COMPLETED Advanced Features (Custom Fields & Forms)
11. **Custom field values** - Dynamic form data ✅
12. **Forms system** - Advanced form management ✅
13. **SLA system** - Service level agreements ✅
14. **Audit logs** - Activity tracking ✅
15. **Attachments & Recurrences** - File management and scheduling ✅

## Implementation Notes

### Database Schema Requirements
- Ensure all tables have proper IndexedDB object stores in `DB.ts`
- Update DB version when adding new stores
- Consider data volume for large tables (use pagination)

### Performance Considerations
- Use GenericCache for simple CRUD operations
- Consider custom caches for tables needing advanced querying
- Implement lazy loading for large datasets
- Add proper error handling and retry logic

### Real-Time Updates
- All tables automatically receive real-time updates via CacheRegistry
- No additional implementation needed beyond cache registration
- RTL handles WebSocket notifications automatically

### Testing Strategy
- Test cache initialization and data loading
- Verify real-time update propagation
- Test error handling and recovery
- Validate data consistency across cache and Redux

## Quick Implementation Template

For each new table, create these files:

1. **Add interface to types.ts**:
```typescript
export interface EntityName {
    id: number;
    name: string;
    // ... other fields
    created_at: string;
    updated_at: string;
}
```

2. **Create entityNameSlice.ts**:
```typescript
// Copy the pattern from existing GenericCache slices
```

3. **Update CacheRegistry.ts**:
```typescript
const entityNamesCache = new GenericCache({
  table: 'wh_entity_names',
  endpoint: '/entity-names',
  store: 'entity_names'
});

cacheByTable['wh_entity_names'] = {
  add: (row) => entityNamesCache.add(row),
  update: (id, row) => entityNamesCache.update(id, row),
  remove: (id) => entityNamesCache.remove(id),
};
```

4. **Update store.ts**:
```typescript
import entityNamesReducer from "./reducers/entityNamesSlice";

const rootReducer = combineReducers({
  // ... add
  entityNames: entityNamesReducer,
});
```

5. **Update AuthProvider.tsx**:
```typescript
// Add to cache initialization
await entityNamesCache.init();

// Add to Redux hydration
dispatch(getEntityNamesFromIndexedDB());
```

This systematic approach ensures all wh_ tables have consistent frontend implementations with real-time updates, caching, and Redux integration.

## 🎉 COMPLETION SUMMARY

**✅ ALL 40 WH_ TABLES SUCCESSFULLY IMPLEMENTED!**

- **High-Priority (Core User Experience)**: 10/10 ✅
- **Advanced Features (Custom Fields & Forms)**: 5/5 ✅
- **All tables now have**:
  - ✅ TypeScript interfaces defined
  - ✅ Redux slices with GenericCache integration
  - ✅ IndexedDB stores configured
  - ✅ Cache registry entries for real-time updates
  - ✅ Store reducer registration
  - ✅ AuthProvider initialization and hydration

The frontend now has complete support for all wh_ database tables with automatic real-time updates via the existing CacheRegistry system.
