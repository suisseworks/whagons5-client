# Code Cleanup Prompt for Next Agent

## What is DuckCache?

**DuckCache** is a DuckDB-based client-side caching layer that provides:
- **Local SQL database** using DuckDB (in-browser SQL engine)
- **CRUD operations** with automatic integrity validation
- **Hash-based synchronization** with server (SHA-256 block/global hashes)
- **Data repair** when local/server data diverges
- **Real-time sync** via WebSocket notifications
- **Transform support** for data conversion (e.g., arrays ↔ text)

### Architecture

```
DuckGenericCache<T> (Generic, reusable)
  ├── Handles all CRUD operations (getAll, upsert, bulkUpsert, remove, replaceAll)
  ├── Integrity validation (hash comparison with server)
  ├── Data repair (ID range comparison, incremental block repair)
  ├── Schema migration (auto-adds missing columns)
  ├── Transform support (transformInput/transformOutput)
  └── Event emission (optional eventEmitter callback)

DuckTaskCache (Task-specific wrapper)
  ├── Uses DuckGenericCache<Task> internally
  ├── Adds task-specific query method (queryForAgGrid)
  ├── Handles user_ids transformation (array ↔ text)
  ├── Emits TaskEvents for UI updates
  └── Task-specific bootstrap logic
```

### Key Features

1. **Integrity Validation**: Compares local SHA-256 hashes with server to detect changes
2. **Data Repair**: Automatically fixes missing/extra rows using ID range comparison
3. **Incremental Repair**: Block-level hash comparison for efficient updates
4. **Transform Functions**: Convert data format (e.g., `user_ids: number[]` ↔ `user_ids_text: "[1,2,3]"`)
5. **Event Emission**: Optional callback for cache operations (used by tasks for TaskEvents)

### Important: DO NOT Reimplement

- ✅ **DO**: Use `DuckGenericCache` for new entity types
- ✅ **DO**: Add transform functions if data needs conversion
- ✅ **DO**: Use `eventEmitter` if you need cache operation events
- ❌ **DON'T**: Create new cache classes - use DuckGenericCache
- ❌ **DON'T**: Duplicate CRUD logic - DuckGenericCache handles it
- ❌ **DON'T**: Reimplement integrity validation - it's already done
- ❌ **DON'T**: Create separate repair logic - use `dataRepair.ts` helpers

### Usage Example

```typescript
// For a new entity type, just create a DuckGenericCache instance:
const myEntityCache = new DuckGenericCache<MyEntity>({
  name: 'myEntities',
  table: 'duck_my_entities',
  serverTable: 'wh_my_entities',
  endpoint: '/my-entities',
  columns: [
    { name: 'id', type: 'BIGINT', primaryKey: true },
    { name: 'name', type: 'TEXT' },
    // ... more columns
  ],
  hashFields: ['id', 'name', 'updated_at'], // For integrity validation
  eventEmitter: (event, data) => {
    // Optional: emit events for UI updates
  },
  transformInput: (row) => {
    // Optional: transform before storing
    return { ...row, someField: transform(row.someField) };
  },
  transformOutput: (row) => {
    // Optional: transform after reading
    return { ...row, someField: reverseTransform(row.someField) };
  },
});

// That's it! You get all CRUD + integrity validation + repair logic for free.
```

## Context
The DuckDB cache files (`DuckGenericCache.ts` and `DuckTaskCache.ts`) have been significantly refactored. DuckTaskCache now uses DuckGenericCache internally, achieving massive code reduction.

## Current State
- **DuckGenericCache.ts**: 956 lines (target: ~800) - ✅ Close to target
- **DuckTaskCache.ts**: 398 lines (target: ~800) - ✅ **EXCEEDED TARGET** (73% reduction!)

## What's Already Done
1. ✅ Extracted SQL operations to `duckCache/sqlOperations.ts`
2. ✅ Extracted integrity validation to `duckCache/integrityValidation.ts`
3. ✅ Extracted hash computation helpers to `duckCache/hashComputationHelpers.ts`
4. ✅ Extracted task utilities to `duckCache/taskUtilities.ts`
5. ✅ Removed experimental comments and excessive console logs
6. ✅ Removed useless wrapper methods (e.g., `normalizeRowIds` wrapper)
7. ✅ **Unified DuckTaskCache with DuckGenericCache** - DuckTaskCache now uses DuckGenericCache internally
8. ✅ **Enhanced dataRepair.ts** - Complete implementations of `repairFromIdRanges` and `fetchMissingIdsInChunks`
9. ✅ **Added transform support** - DuckGenericCache now supports `transformInput` and `transformOutput` for data transformation
10. ✅ **Added event emitter support** - DuckGenericCache can optionally emit events (used by DuckTaskCache for TaskEvents)
11. ✅ **Fixed all linter warnings** - No unused imports or variables
12. ✅ **Extracted repair methods** - `repairFromIdRanges` and `fetchMissingIdsInChunks` now use shared helpers from `dataRepair.ts`

## What Still Needs to Be Done

### 1. Extract More Logic to Helper Files (Optional - Most Critical Work Done)

**For DuckTaskCache.ts:**
- ✅ **DONE**: Now uses DuckGenericCache for all CRUD operations
- ✅ **DONE**: Repair methods use shared helpers from `dataRepair.ts`
- ⚠️ **Optional**: Extract `queryForAgGrid` to helper if it grows (currently ~100 lines, acceptable)
- ⚠️ **Optional**: Extract `bootstrapFromApi` to helper if needed (currently simple, acceptable)

**For DuckGenericCache.ts:**
- ⚠️ **Optional**: Extract `incrementalRepairFromIntegrity` method to `duckCache/incrementalRepair.ts` (it's ~200+ lines, but works fine as-is)
- ✅ **DONE**: `repairFromIdRanges` uses shared helper from `dataRepair.ts`
- ✅ **DONE**: `fetchMissingIdsInChunks` uses shared helper from `dataRepair.ts`

### 2. Remove Remaining Useless Code
- Remove any remaining verbose comments that don't add value
- Remove debug-only code paths that are never used
- Remove redundant error handling that just wraps and re-throws
- Consolidate duplicate logic patterns

### 3. Simplify Method Signatures
- Look for methods that take too many parameters - consider passing context objects instead
- Methods that are only called once should be inlined if it improves readability
- Methods that are just thin wrappers should be removed

### 4. Reduce Console Logging
- Keep only critical error logs
- Remove all progress/debug logs unless they're behind a debug flag
- Remove emoji logs (🚨, ✅, 🔄, etc.) - they're noise

### 5. Fix Linter Warnings
✅ **ALL FIXED** - No linter warnings remaining

## Target Structure

```
duckCache/
├── types.ts                    # Shared types ✅ (with transform support)
├── utils.ts                    # Utility functions ✅
├── sqlOperations.ts            # SQL query builders ✅
├── hashComputation.ts          # Hash expression building ✅
├── hashComputationHelpers.ts   # Hash computation functions ✅
├── schemaMigration.ts          # Schema migration ✅
├── dataRepair.ts               # Data repair utilities ✅ (complete implementations)
├── integrityValidation.ts      # Integrity validation ✅
├── taskUtilities.ts            # Task-specific utilities ✅
```

**Note**: We decided NOT to create separate files for queryBuilder, bootstrap, bulkOperations, or incrementalRepair because:
- DuckTaskCache is now a thin wrapper (398 lines) - no need for further extraction
- DuckGenericCache handles bulk operations internally
- Incremental repair is complex but self-contained in DuckGenericCache
- Query building is task-specific and small enough to keep in DuckTaskCache

## Guidelines
1. **Don't break functionality** - All existing methods must still work
2. **Keep it DRY** - If you see the same pattern 3+ times, extract it
3. **Single Responsibility** - Each helper file should have one clear purpose
4. **No experimental comments** - These are production files
5. **Minimal logging** - Only log errors, not progress/debug info
6. **Type safety** - Maintain all TypeScript types

## Success Criteria
- ✅ DuckTaskCache.ts: **398 lines** (target: ~800) - **EXCEEDED TARGET BY 50%**
- ✅ DuckGenericCache.ts: **956 lines** (target: ~800) - Close to target, acceptable
- ✅ No linter warnings
- ✅ All functionality preserved
- ✅ Code is more maintainable and easier to understand
- ✅ Related logic is grouped together in helper files
- ✅ **MAJOR WIN**: Unified DuckTaskCache with DuckGenericCache - eliminated ~1000 lines of duplicate code

## Key Achievements

### DuckTaskCache Refactoring
- **Before**: 1471 lines with duplicate CRUD logic
- **After**: 398 lines using DuckGenericCache internally
- **Reduction**: 73% code reduction
- **Architecture**: Now a thin wrapper around DuckGenericCache with:
  - Task-specific query method (`queryForAgGrid`)
  - Task-specific bootstrap logic
  - User IDs transformation (array ↔ text)
  - Task event emission

### DuckGenericCache Enhancements
- Added `transformInput` and `transformOutput` for data transformation
- Added `eventEmitter` callback for cache operation events
- Enhanced `dataRepair.ts` with complete repair implementations
- All CRUD operations now support transformations and events

## Remaining Optional Work

The codebase is now in excellent shape. Remaining work is optional:
- Extract `incrementalRepairFromIntegrity` if it grows beyond ~250 lines
- Extract `queryForAgGrid` if it becomes more complex
- Further reduce DuckGenericCache if needed (currently 956 lines, target 800)

**Recommendation**: The current state is production-ready. Further extraction should only be done if specific methods become unwieldy or if new requirements emerge.

