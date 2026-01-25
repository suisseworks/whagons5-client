# Route Synchronization System

This document explains how the automated route synchronization system works between the frontend (React Router) and backend (Go assistant tool schemas).

## Problem

Previously, route definitions were manually maintained in the Go backend (`browser_navigate.go`), which meant:
- Routes had to be updated in two places whenever a new route was added
- Tab query parameters (like `?tab=basics`) were often missed
- Documentation could become stale and inaccurate

## Solution

An automated 3-step process that:
1. **Extracts routes** from React Router files
2. **Discovers tabs** by scanning components for `searchParams.get('tab')` usage
3. **Generates Go code** with up-to-date route documentation

## Architecture

```
Frontend Router Files (*.tsx)
         ↓
  extract-routes.ts (TypeScript scanner)
         ↓
    routes.json (intermediate format)
         ↓
  generate-browser-navigate.go (Go code generator)
         ↓
  browser_navigate.go (with auto-generated docs)
         ↓
  gen_schema tool (Go AST parser)
         ↓
  Browser_Navigate.json (Claude tool schema)
```

## Files

### Frontend

- **`scripts/extract-routes.ts`**: Scans React Router files and component implementations
  - Extracts `<Route path="...">` definitions
  - Discovers URL-based tabs by finding `searchParams.get('tab')` usage
  - Detects `<TabsTrigger value="...">` components to enumerate tab values
  - Generates `routes.json` with complete route metadata

- **`routes.json`**: Intermediate format containing:
  ```json
  {
    "generatedAt": "2026-01-24T...",
    "routes": [
      {
        "path": "/settings",
        "description": "Settings page",
        "category": "main",
        "tabs": ["basics", "advanced", "favorites"],
        "queryParams": ["tab"],
        "examples": [
          "/settings?tab=basics",
          "/settings?tab=advanced",
          "/settings?tab=favorites"
        ]
      }
    ]
  }
  ```

### Backend

- **`scripts/generate-browser-navigate.go`**: Reads `routes.json` and generates Go code
  - Uses Go templates to generate properly formatted documentation
  - Groups routes by category
  - Includes tab information and examples in docstrings
  - Produces valid Go source code with `//go:generate` directive

- **`frontend_tools/browser_navigate.go`**: Auto-generated Go file
  - Contains `Browser_Navigate` function with comprehensive route documentation
  - Used by `gen_schema` tool to extract JSON schema for Claude
  - **Should not be edited manually** - regenerate instead

## Usage

### Quick Sync (Recommended)

Run from **either** workspace:

```bash
# From frontend
cd whagons5-client
npm run sync-routes

# From backend
cd whagons_assistant
make sync-routes
```

Both commands do the same thing:
1. Extract routes from frontend
2. Generate Go code in backend
3. Regenerate JSON schema

### Step-by-Step

If you need to debug or run steps individually:

```bash
# Step 1: Extract routes (frontend)
cd whagons5-client
npm run extract-routes
# → Generates routes.json

# Step 2: Generate Go code (backend)
cd ../whagons_assistant
go run scripts/generate-browser-navigate.go
# → Updates frontend_tools/browser_navigate.go

# Step 3: Regenerate schema
make gen-schemas
# → Updates godantic/schemas/cached_schemas/Browser_Navigate.json
```

## When to Sync

Run `npm run sync-routes` whenever you:

- ✅ Add a new route in `AppRouter.tsx` or `HomeRouter.tsx`
- ✅ Add tabs to a page using `searchParams.get('tab')`
- ✅ Change route paths or parameters
- ✅ Add/modify `<TabsTrigger>` components with URL query parameters
- ✅ Before committing route-related changes

You do **NOT** need to sync when:
- ❌ Adding component-internal tabs (useState-based, not URL query params)
- ❌ Changing page content without affecting routes
- ❌ Modifying styles or non-routing logic

## Tab Detection

The system detects two types of tabs:

### URL-Based Tabs ✅ (Detected)
Pages using `searchParams.get('tab')` for URL query parameters:

```tsx
// Settings.tsx
const [searchParams] = useSearchParams();
const activeTab = searchParams.get('tab') || 'basics';

return (
  <Tabs value={activeTab}>
    <TabsTrigger value="basics">Basics</TabsTrigger>
    <TabsTrigger value="advanced">Advanced</TabsTrigger>
  </Tabs>
);
```

This generates routes like:
- `/settings?tab=basics`
- `/settings?tab=advanced`

### Component-Internal Tabs ❌ (Not Detected)
Pages using `useState` for component-local tabs:

```tsx
// CreateDialog.tsx
const [activeTab, setActiveTab] = useState('general');

return (
  <Tabs value={activeTab} onValueChange={setActiveTab}>
    <TabsTrigger value="general">General</TabsTrigger>
    <TabsTrigger value="rules">Rules</TabsTrigger>
  </Tabs>
);
```

These are **not** URL-addressable and **should not** be included in route schemas.

## Route Mapping

The system uses heuristics to map routes to component files:

```typescript
const mappings = {
  '/settings': 'src/pages/settings/Settings.tsx',
  '/settings/forms': 'src/pages/settings/sub_pages/forms/Forms.tsx',
  '/broadcasts': 'src/pages/broadcasts/BroadcastsPage.tsx',
  // ... etc
};
```

If you add a page with tabs but it's not detected, add it to the `mapRoutesToComponents()` function in `extract-routes.ts`.

## Troubleshooting

### Routes not detected?
- Check that route is defined in `AppRouter.tsx` or `HomeRouter.tsx`
- Verify the `<Route path="..." element={...}>` syntax is correct

### Tabs not detected?
- Ensure page uses `searchParams.get('tab')`
- Add mapping in `mapRoutesToComponents()` if needed
- Verify `<TabsTrigger value="...">` components exist

### Schema not updating?
```bash
# Rebuild everything from scratch
cd whagons5-client
npm run extract-routes

cd ../whagons_assistant
rm frontend_tools/browser_navigate.go
go run scripts/generate-browser-navigate.go
make gen-schemas
```

### Go compilation errors?
- Check `routes.json` is valid JSON
- Ensure `generate-browser-navigate.go` template syntax is correct
- Verify Go template escaping for backticks

## Benefits

✅ **Single source of truth**: Routes defined once in React Router  
✅ **Automatic discovery**: Tabs extracted from component code  
✅ **Always accurate**: Documentation generated from actual implementation  
✅ **Type-safe**: Go compiler validates generated code  
✅ **Fast**: Runs in seconds, can be part of pre-commit hook  

## CI/CD Integration

Consider adding to your CI pipeline:

```yaml
# .github/workflows/check-routes.yml
- name: Check route sync
  run: |
    npm run extract-routes
    cd ../whagons_assistant
    go run scripts/generate-browser-navigate.go
    # Check if git diff is clean
    git diff --exit-code frontend_tools/browser_navigate.go
```

This ensures routes are always synced in PRs.

## Future Enhancements

Potential improvements:
- [ ] Auto-detect route-to-component mappings using import analysis
- [ ] Extract route descriptions from JSDoc comments
- [ ] Support for dynamic route parameters metadata
- [ ] Validate that all referenced routes exist in frontend
- [ ] Generate TypeScript route constants from routes.json
- [ ] Add pre-commit hook to auto-sync routes

## Architecture Notes

### Why not use OpenAPI/Swagger?
This is for **frontend navigation**, not API endpoints. The assistant needs to understand which **pages** exist in the UI, not which backend APIs are available.

### Why generate Go code instead of just JSON?
The Go function's **docstring** is what gets parsed by `gen_schema` to create the Claude tool description. Go code with good docs is more maintainable than hand-writing JSON schemas.

### Why scan for tabs instead of declaring them explicitly?
Explicit declarations (like a routes config file) would just move the duplication problem. Scanning the actual component code ensures we catch all tabs automatically.

## Related Files

- Frontend routing: `src/router/AppRouter.tsx`, `src/router/HomeRouter.tsx`
- Backend tool execution: `frontend_tools/frontend_tool_execution.go`
- Schema generation: `godantic/schemas/gen_schema.go`
- Tool registration: `godantic/agents.go`
