# WorkspaceTable Component Architecture

This directory contains the WorkspaceTable component and its supporting modules. The codebase has been refactored to ensure all files are under 500 lines and follow a modular architecture with organized subfolders.

## Directory Structure

```
workspaceTable/
├── columns/                    # Column definitions (modular)
│   ├── index.ts               # Main column builder (combines all columns)
│   ├── types.ts               # TypeScript type definitions
│   ├── baseColumns.tsx        # Base columns (ID, Notes, Due Date, Location, Last Modified, Tag Filter)
│   ├── nameColumn.tsx         # Name column with category icon, tags, description
│   ├── statusColumn.tsx       # Status column with status cell renderer
│   ├── priorityColumn.tsx     # Priority column with priority pill
│   ├── ownerColumn.tsx        # Owner column with user avatars
│   ├── configColumnApprovalSla.tsx  # Approval/SLA badge column
│   ├── customFieldColumns.tsx # Dynamic custom field columns
│   ├── shared/                # Shared column utilities
│   │   └── utils.tsx         # Shared utilities (UserInitial, caches, visibility checker)
│   └── columnUtils/           # Column-specific utilities
│       ├── color.ts          # Color contrast utilities
│       ├── icon.tsx          # Icon loading utilities (IconBadge, useIconDefinition)
│       └── promptForComment.ts  # Comment prompt modal
├── hooks/                     # React hooks (organized by functionality)
│   ├── index.ts              # Centralized hook exports
│   ├── useStatusIcons.ts     # Status icon loading
│   ├── useApprovalRefresh.ts # Approval refresh events
│   ├── useColumnManagement.ts # Column visibility and ordering
│   ├── useEditMode.ts        # Edit mode state
│   ├── useFilterPersistence.ts # Filter persistence
│   ├── useTaskDeletion.tsx   # Task deletion flow
│   ├── useWorkspaceTableLookups.ts # Lookup maps and derived state
│   ├── useGridReady.ts       # Grid ready callback
│   ├── useWorkspaceChange.ts # Workspace change handling
│   ├── useContextMenu.ts     # Context menu items
│   ├── useGridGrouping.ts    # Grid grouping configuration
│   ├── useImperativeHandleMethods.ts # Ref methods
│   ├── useGridRefresh.ts     # Grid refresh logic
│   ├── useMetadataSync.ts    # Metadata synchronization
│   ├── useStatusChange.ts    # Status change handler
│   └── useDoneStatusId.ts    # Done status ID getter
├── grid/                      # Grid-related modules
│   ├── index.ts              # Centralized grid exports
│   ├── agGridSetup.ts        # AG Grid module loading
│   ├── gridConfig.tsx        # Grid constants and UI helpers
│   ├── gridState.ts          # Grid state management hooks
│   └── dataSource.ts         # Data source and refresh helpers
├── utils/                     # Utility functions
│   ├── index.ts              # Centralized utility exports
│   ├── userUtils.ts          # User display utilities (parseUserIds, date formatting)
│   ├── mappers.ts            # Data mappers (createRecordMap helper)
│   ├── filterUtils.ts        # Filter normalization
│   └── filterPresets.ts      # Filter presets
├── handlers/                  # Event handlers
│   ├── index.ts              # Centralized handler exports
│   └── eventHandlers.ts      # Task event handlers
├── components/                # Reusable components
│   └── EmptyOverlay.tsx      # Empty state overlay
├── types.ts                   # TypeScript type definitions
└── README.md                  # This file
```

## File Organization Principles

### 1. **hooks/** - React Hooks
All custom hooks are organized in the `hooks/` folder:
- **State Management**: `useEditMode`, `useFilterPersistence`, `useColumnManagement`
- **Data Loading**: `useStatusIcons`, `useMetadataSync`, `useWorkspaceTableLookups`
- **Event Handling**: `useApprovalRefresh`, `useWorkspaceChange`, `useStatusChange`
- **Grid Operations**: `useGridReady`, `useGridRefresh`, `useGridGrouping`
- **UI**: `useContextMenu`, `useImperativeHandleMethods`

### 2. **grid/** - Grid Configuration
All AG Grid-related code:
- Module loading and configuration
- Grid state management
- Data source implementation
- Grid constants and UI helpers

### 3. **utils/** - Utility Functions
Pure utility functions:
- User display formatting (`parseUserIds`, `formatDateWithPrefix`)
- Data transformation (mappers with `createRecordMap` helper)
- Filter normalization
- Filter presets

### 4. **handlers/** - Event Handlers
Event handler setup and management:
- Task event handlers
- Custom event listeners

### 5. **components/** - Reusable Components
Small, reusable UI components:
- EmptyOverlay for empty states

### 6. **columns/** - Column Definitions
Modular column definitions:
- Each column type in its own file
- Shared utilities in `shared/`
- Column-specific utilities in `columnUtils/`

## Column Architecture

### Column Modules

Each column type is defined in its own module:

- **baseColumns.tsx**: Core columns that are always present (ID, Notes, Due Date, Location, Last Modified, Tag Filter)
- **nameColumn.tsx**: Task name with category icon, tags, description, and latest comment
- **statusColumn.tsx**: Status dropdown with approval blocking
- **priorityColumn.tsx**: Priority pill with color coding
- **ownerColumn.tsx**: User avatars with assignment
- **configColumnApprovalSla.tsx**: Approval/SLA badges with interactive popovers
- **customFieldColumns.tsx**: Dynamic columns for workspace custom fields

### Column Builder Pattern

All columns are built using the `ColumnBuilderOptions` interface, which provides:
- Lookup maps (statusMap, priorityMap, userMap, etc.)
- Callback functions (getUserDisplayName, handleChangeStatus, etc.)
- Configuration (visibleColumns, density, tagDisplayMode, etc.)

The main `buildWorkspaceColumns` function in `columns/index.ts` combines all column modules.

## Key Design Decisions

### 1. Modular Hook Extraction

**Why**: WorkspaceTable.tsx was 893 lines, violating the <500 line requirement.

**Solution**: Extracted logic into focused hooks:
- `useGridRefresh` - Grid refresh logic (~70 lines)
- `useMetadataSync` - Metadata synchronization (~100 lines)
- `useGridReady` - Grid ready callback (~70 lines)
- `useWorkspaceChange` - Workspace change handling (~60 lines)
- `useGridGrouping` - Grouping configuration (~100 lines)
- `useContextMenu` - Context menu items (~30 lines)
- `useStatusChange` - Status change handler (~50 lines)
- `useDoneStatusId` - Done status getter (~20 lines)
- `useImperativeHandleMethods` - Ref methods (~40 lines)

**Result**: WorkspaceTable.tsx reduced from 893 to 490 lines (45% reduction)

### 2. Organized Subfolders

**Before**: 20+ files in root directory

**After**: Organized into logical subfolders:
- `hooks/` - 16 hook files
- `grid/` - 5 grid-related files
- `utils/` - 5 utility files
- `handlers/` - 2 handler files
- `components/` - 1 component file
- `columns/` - 9 column files (already organized)

### 3. Removed Duplication

**Code Reduction Summary**:
- **columns.tsx**: 1755 → 1466 lines (289 lines removed, 16.5% reduction)
- **Duplicate files removed**: 657 lines (useFilterPersistence, useWorkspaceTableLookups, gridState, agGridSetup)
- **Total reduction**: ~946 lines across the folder

**Duplicates Eliminated**:
- ✅ Removed duplicate `promptForComment` function (now uses `columnUtils/promptForComment.ts`)
- ✅ Removed duplicate `getContrastingTextColor` function (now uses `columnUtils/color.ts`)
- ✅ Refactored icon loading to use `useIconDefinition` hook (200+ lines removed)
- ✅ Extracted custom field `valueGetter` and `cellRenderer` helpers (120 lines removed)
- ✅ Consolidated user ID parsing (`parseUserIds` in `utils/userUtils.ts`)
- ✅ Consolidated date formatting (`formatDateWithPrefix` in `utils/userUtils.ts`)
- ✅ Generic map creator (`createRecordMap` in `utils/mappers.ts`)
- ✅ Visibility checker (`createVisibilityChecker` in `columns/shared/utils.tsx`)
- ✅ Workspace query params builder (`buildParams` in `grid/dataSource.ts`)

### 4. Centralized Exports

Each subfolder has an `index.ts` file for centralized exports:
- `hooks/index.ts` - All hooks
- `grid/index.ts` - All grid modules
- `utils/index.ts` - All utilities
- `handlers/index.ts` - All handlers

## File Size Compliance

All files are under 500 lines:

### Main Component
- `WorkspaceTable.tsx`: **490 lines** ✅

### Column Modules
- `columns/index.ts`: 101 lines
- `columns/baseColumns.tsx`: 299 lines
- `columns/nameColumn.tsx`: 187 lines
- `columns/statusColumn.tsx`: 107 lines
- `columns/priorityColumn.tsx`: 76 lines
- `columns/ownerColumn.tsx`: 112 lines
- `columns/configColumnApprovalSla.tsx`: 449 lines
- `columns/customFieldColumns.tsx`: 173 lines

### Hooks
- All hooks: <150 lines each ✅

### Other Modules
- All grid/utils/handlers: <200 lines each ✅

## Usage

```typescript
import { buildWorkspaceColumns } from './workspaceTable/columns/index';
import { useStatusIcons, useGridRefresh, ... } from './workspaceTable/hooks';
import { loadAgGridModules, ... } from './workspaceTable/grid';
import { getUserDisplayName, ... } from './workspaceTable/utils';

// Use hooks
const { getStatusIcon } = useStatusIcons(statuses);
const refreshGrid = useGridRefresh({ ... });
```

## Import Patterns

### From hooks/
```typescript
import { useStatusIcons, useGridRefresh } from './workspaceTable/hooks';
```

### From grid/
```typescript
import { loadAgGridModules, createGridOptions } from './workspaceTable/grid';
```

### From utils/
```typescript
import { getUserDisplayName, formatDueDate } from './workspaceTable/utils';
```

### From handlers/
```typescript
import { setupTaskEventHandlers } from './workspaceTable/handlers';
```

## Code Reduction Summary

- **WorkspaceTable.tsx**: 893 → 490 lines (45% reduction)
- **columns.tsx**: 1755 → 1466 lines (16.5% reduction)
- **Duplicate files removed**: 657 lines
- **Total hooks extracted**: 9 new hooks (~540 lines)
- **Files organized**: 20+ files → 6 subfolders
- **Duplicate code removed**: ~946 lines
- **Net improvement**: Better organization, easier maintenance, all files <500 lines

## Notes

- All hooks follow the same pattern: take options object, return values/callbacks
- Centralized exports make imports cleaner
- Type definitions in `types.ts` ensure consistency
- Components are small and focused (EmptyOverlay is ~40 lines)
- No functionality was changed - only code organization
- All duplicate logic has been consolidated into reusable utilities
