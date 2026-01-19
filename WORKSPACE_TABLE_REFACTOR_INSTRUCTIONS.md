# WorkspaceTable refactor instructions (next agent)

## Non-negotiable requirements

- **UI + behavior must be identical** (grid modes, filters, grouping, columns, context menu, edit mode, delete flow, approval flows, overlays).
- **No file may exceed 500 lines.** If a file is >500 lines, split it into **single-responsibility** modules until every file is <500.
- **Net code reduction required.** Don’t “simplify” by only moving code into more files. You must delete redundant logic and reduce total LOC meaningfully.
- **No spaghetti:** each module should have one job (e.g., “status column”, “name column”, “approval/SLA badge”, “custom field columns”, etc.).
- **No new debug/metrics/logging** unless gated behind an existing debug flag and strictly necessary (prefer deletion).

## Current state (what’s already done)

- `src/pages/spaces/components/WorkspaceTable.tsx` is ~962 lines (still too large; must be split).
- `src/pages/spaces/components/workspaceTable/columns.tsx` is ~1800+ lines (still too large; must be split).
- Added shared utilities (new files):
  - `src/pages/spaces/components/workspaceTable/columnUtils/color.ts` exports `getContrastTextColor`
  - `src/pages/spaces/components/workspaceTable/columnUtils/promptForComment.ts` exports `promptForComment`
  - `src/pages/spaces/components/workspaceTable/columnUtils/icon.tsx` exports `useIconDefinition`, `IconBadge`
- `workspaceTable/dataSource.ts`:
  - `refreshClientSideGrid()` accepts optional `sortModel` and returns `{ rows, totalFiltered }`
- `workspaceTable/useFilterPersistence.ts` now provides:
  - `applyFilterModelToGrid`, `handleGridFilterChanged`, `ensureFiltersApplied`
- `workspaceTable/agGridSetup.ts` no longer hard-disables the context menu.

## What you must do next (in order)

### 1) Enforce <500 lines per file

Split these files until **every** output file is <500 lines:

- **Split `workspaceTable/columns.tsx`**
  - Suggested structure:
    - `src/pages/spaces/components/workspaceTable/columns/index.ts` (exports `buildWorkspaceColumns`)
    - `src/pages/spaces/components/workspaceTable/columns/nameColumn.tsx`
    - `src/pages/spaces/components/workspaceTable/columns/statusColumn.tsx`
    - `src/pages/spaces/components/workspaceTable/columns/priorityColumn.tsx`
    - `src/pages/spaces/components/workspaceTable/columns/ownerColumn.tsx`
    - `src/pages/spaces/components/workspaceTable/columns/configColumnApprovalSla.tsx`
    - `src/pages/spaces/components/workspaceTable/columns/customFieldColumns.tsx`

- **Split `WorkspaceTable.tsx`**
  - Suggested structure:
    - `src/pages/spaces/components/workspaceTable/useStatusIcons.ts`
    - `src/pages/spaces/components/workspaceTable/useGridRefresh.ts` (infinite + client refresh)
    - `src/pages/spaces/components/workspaceTable/useApprovalRefresh.ts`
    - Keep `WorkspaceTable.tsx` as a thin orchestrator (<500 lines).

### 2) Delete redundancy (net LOC down)

In the columns logic:

- **Remove duplicated icon loader code** and use `columnUtils/icon.tsx`:
  - Delete local `iconCache` / `iconLoadingPromises`
  - Replace `CategoryIconSmall` and `TagIconSmall` with `IconBadge` / `useIconDefinition`
- Remove any remaining local `getContrastTextColor` and import it from `columnUtils/color.ts`.
- Remove any remaining local `promptForComment` and import it from `columnUtils/promptForComment.ts`.
- **Collapse duplicated custom-field column building** (there are two near-identical paths); keep one implementation.

### 3) Do not increase code just to “organize”

- If splitting introduces wrappers that add LOC, compensate by deleting duplication so total LOC decreases.

### 4) Keep correctness

- Re-run lints on touched files and fix issues.
- Verify `buildWorkspaceColumns` is still only imported by `WorkspaceTable.tsx`.

## Tooling note

- If repo search is broken, use a small python script to search occurrences (walk the `src/` tree and scan `.ts/.tsx`).

## Acceptance criteria (must meet all)

- **Every touched file <500 lines**
- **Total LOC for `WorkspaceTable` + `workspaceTable/` decreases significantly** (not just moved)
- **No lints** in edited files
- **UI/behavior remains identical**

