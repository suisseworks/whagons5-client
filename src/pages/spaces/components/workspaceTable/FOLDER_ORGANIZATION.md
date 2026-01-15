# Folder Organization Guide

## Overview

The workspaceTable directory is organized into logical subfolders to improve maintainability and reduce clutter.

## Folder Structure

### 📁 hooks/ (15 files)
All React hooks for WorkspaceTable functionality.

**Purpose**: Extract reusable logic from the main component.

**Files**:
- `useStatusIcons.ts` - Status icon loading
- `useApprovalRefresh.ts` - Approval refresh events
- `useColumnManagement.ts` - Column visibility/ordering
- `useEditMode.ts` - Edit mode state
- `useFilterPersistence.ts` - Filter persistence
- `useTaskDeletion.tsx` - Task deletion flow
- `useWorkspaceTableLookups.ts` - Lookup maps
- `useGridReady.ts` - Grid ready callback
- `useWorkspaceChange.ts` - Workspace change handling
- `useContextMenu.ts` - Context menu items
- `useGridGrouping.ts` - Grid grouping config
- `useImperativeHandleMethods.ts` - Ref methods
- `useGridRefresh.ts` - Grid refresh logic
- `useMetadataSync.ts` - Metadata sync
- `useStatusChange.ts` - Status change handler
- `useDoneStatusId.ts` - Done status getter
- `index.ts` - Centralized exports

**Import**: `import { useStatusIcons, ... } from './workspaceTable/hooks'`

### 📁 grid/ (5 files)
AG Grid configuration and data source.

**Purpose**: All grid-related functionality.

**Files**:
- `agGridSetup.ts` - Module loading and setup
- `gridConfig.tsx` - Grid constants and UI helpers
- `gridState.ts` - Grid state management hooks
- `dataSource.ts` - Data source implementation
- `index.ts` - Centralized exports

**Import**: `import { loadAgGridModules, ... } from './workspaceTable/grid'`

### 📁 utils/ (5 files)
Pure utility functions.

**Purpose**: Reusable utility functions without side effects.

**Files**:
- `userUtils.ts` - User display formatting
- `mappers.ts` - Data transformation
- `filterUtils.ts` - Filter normalization
- `filterPresets.ts` - Filter presets
- `index.ts` - Centralized exports

**Import**: `import { getUserDisplayName, ... } from './workspaceTable/utils'`

### 📁 handlers/ (2 files)
Event handler setup.

**Purpose**: Event handler configuration and management.

**Files**:
- `eventHandlers.ts` - Task event handlers
- `index.ts` - Centralized exports

**Import**: `import { setupTaskEventHandlers } from './workspaceTable/handlers'`

### 📁 components/ (1 file)
Reusable UI components.

**Purpose**: Small, focused UI components.

**Files**:
- `EmptyOverlay.tsx` - Empty state overlay

**Import**: `import { EmptyOverlay } from './workspaceTable/components/EmptyOverlay'`

### 📁 columns/ (9 files)
Column definitions (already organized).

**Purpose**: Modular column definitions.

**Files**: See columns/README.md

**Import**: `import { buildWorkspaceColumns } from './workspaceTable/columns'`

## Benefits of This Organization

1. **Clear Separation of Concerns**: Each folder has a single responsibility
2. **Easier Navigation**: Find files by their purpose, not by name pattern
3. **Reduced Clutter**: Root directory is cleaner (only 5 top-level items)
4. **Better Imports**: Centralized exports make imports cleaner
5. **Scalability**: Easy to add new files to appropriate folders

## Migration Guide

### Old Imports → New Imports

```typescript
// OLD
import { useStatusIcons } from './workspaceTable/useStatusIcons';
import { loadAgGridModules } from './workspaceTable/agGridSetup';
import { getUserDisplayName } from './workspaceTable/userUtils';

// NEW
import { useStatusIcons } from './workspaceTable/hooks';
import { loadAgGridModules } from './workspaceTable/grid';
import { getUserDisplayName } from './workspaceTable/utils';
```

## Adding New Files

### Adding a Hook
1. Create file in `hooks/`
2. Export from `hooks/index.ts`
3. Import: `import { useNewHook } from './workspaceTable/hooks'`

### Adding a Utility
1. Create file in `utils/`
2. Export from `utils/index.ts`
3. Import: `import { newUtility } from './workspaceTable/utils'`

### Adding a Grid Module
1. Create file in `grid/`
2. Export from `grid/index.ts`
3. Import: `import { newGridModule } from './workspaceTable/grid'`

## File Count Summary

- **hooks/**: 16 files (15 hooks + index.ts)
- **grid/**: 5 files
- **utils/**: 5 files
- **handlers/**: 2 files
- **components/**: 1 file
- **columns/**: 9 files
- **Root**: 3 files (types.ts, README.md, REFACTOR_SUMMARY.md)

**Total**: ~41 files organized into 6 subfolders
