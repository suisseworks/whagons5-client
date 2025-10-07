# Simplified Settings Subpage Guide

## Overview

Settings subpages follow a basic pattern for CRUD: SettingsLayout (header/search/stats), useSettingsState (Redux/UI hook), SettingsGrid (AG Grid), SettingsDialog (modals). Components are UI-only.

## Key Rules: No Direct Data Ops

- All data pre-loaded to Redux on login via external thunks/actions.
- NO `fetchFromAPI`, `getFromIndexedDB`, API calls, or fetch reducers in components.
- Read: Use `useSelector` via hook for Redux data.
- CRUD: Dispatch actions (createItem/updateItem/deleteItem) for optimistic local updates.
- External (thunks/middleware) handles API sync post-dispatch.
- Search/Filter: Local filtering on Redux data only.
- NEVER access APIs/IndexedDB directly—reducers manage everything externally.

This keeps components clean.

## Directory

```
src/pages/settings/
├── Settings.tsx    # Nav cards
├── sub_pages/      # e.g., YourEntity.tsx
├── components/     # Shared: Layout/Grid/Dialog/Hook/Fields
└── AGENTS.md
```

## Steps to Add Subpage

1. **Nav (Settings.tsx)**: Add option to settingsOptions (id/title/icon/count/desc/color). Add navigate case in handleSettingClick.

2. **Subpage (sub_pages/YourEntity.tsx)**: Import basics (useMemo/useSelector/ColDef/icons/types/Button/components). Use useSettingsState<YourEntity>(entityName: 'yourEntities', searchFields: ['name', 'desc']). Define colDefs (useMemo), validateForm, handleSubmit. Render SettingsLayout with search/stats/actions > SettingsGrid (rowData=filteredItems) + Dialogs (create/edit/delete).

3. **Route (App.tsx)**: Add <Route path="/settings/your-entity" element={<YourEntityPage />} />.

4. **Redux**: Create slice 'yourEntities' with set/add/update/remove/loading/error actions (or use genericSliceFactory). Add reducer to store. External thunks dispatch set on login.

Look at existing subpages (e.g., Categories.tsx) for code patterns.

## Tips

- entityName must match slice name.
- Define YourEntity type in store/types.ts.
- Add custom fields/validators as needed.
- Use separate selectors for related data.
