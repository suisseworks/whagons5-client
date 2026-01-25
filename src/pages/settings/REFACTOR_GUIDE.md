## Settings Subpages Refactor Guide

Keep Settings maintainable by enforcing **UI-only pages**, **stable imports**, and a strict **< 600 LOC** cap for each subpage entry file.

### Hard rules (don’t break)

- **UI-only**: Settings subpages must not call APIs or IndexedDB directly. Follow `src/pages/settings/AGENTS.md`.
- **Size cap**: every entry page (`src/pages/settings/sub_pages/<folder>/<Page>.tsx`) must be **< 600 LOC**.
- **Stable import path**: router/nav must import pages from `@/pages/settings/sub_pages/<folder>/<Page>`.

### Canonical structure (per subpage)

- `src/pages/settings/sub_pages/<folder>/<Page>.tsx`: wiring only (layout + state + compose extracted UI)
- `components/`: page-only UI blocks (tabs, dialogs, cell components)
- `hooks/`: derived/memoized state helpers
- `utils/`: pure helpers (column defs, mappers, validators)
- `types.ts`: page-local types

### Refactor checklist (do this every time)

- **Move into folder**: `sub_pages/<folder>/<Page>.tsx`
- **Fix imports**: update router/nav to the canonical import path; leave **no old wrapper files**
- **Split until < 600 LOC**: extract the biggest blocks into `components/`, `hooks/`, `utils/`, `types.ts`
- **Shared duplication rule**: if you copy/paste logic across pages, move it to `src/pages/settings/shared/`
- **Sanity check**: no broken routes/imports; no new data fetching; lints pass for touched files

### Gotchas

- **macOS case-only renames**: do a two-step rename to avoid casing conflicts.
- **FontAwesome**: always pass real icon definitions (not strings).

### Remaining TODO

- **Split any entry page still over 600 LOC** (extract into `components/`, `hooks/`, `utils/`, `types.ts` until the entry file is < 600).
- **Current over-600 entry files (as of now):**
  - `sub_pages/workflows/Workflows.tsx` (1183)
  - `sub_pages/workspaces/Workspaces.tsx` (1164)
  - `sub_pages/slas/Slas.tsx` (1131)
  - `sub_pages/statuses/Statuses.tsx` (1100)
  - `sub_pages/spots/Spots.tsx` (935)
  - `sub_pages/categories/Categories.tsx` (830)
  - `sub_pages/roles-and-permissions/RolesAndPermissions.tsx` (808)
  - `sub_pages/forms/Forms.tsx` (760)

### ✅ Completed Refactors

- `sub_pages/teams/Teams.tsx` (541 LOC) - Extracted components, hooks, and utils
- `sub_pages/templates/Templates.tsx` (528 LOC) - Extracted components and dialogs

