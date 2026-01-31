# Kanban Board Quick Reference

## Quick Start

```tsx
import { KanbanBoard } from '@/pages/spaces/components/kanban';

// Basic usage
<KanbanBoard workspaceId="1" />

// In a full-height container
<div className="h-full w-full">
  <KanbanBoard workspaceId={workspaceId} />
</div>
```

## File Structure

```
kanban/
├── KanbanBoard.tsx          # Main container (drag & drop context)
├── KanbanColumn.tsx          # Status columns (droppable zones)
├── KanbanCard.tsx            # Task cards (draggable items)
├── KanbanControls.tsx        # Filters, search, view mode
├── KanbanSwimLane.tsx        # Grouping lanes (collapsible)
├── index.ts                  # Public exports
├── README.md                 # Full documentation
├── QUICK_REFERENCE.md        # This file
├── hooks/
│   ├── useKanbanFilters.ts   # Filter logic
│   └── useKanbanGrouping.ts  # Grouping logic
├── types/
│   └── kanban.types.ts       # TypeScript interfaces
└── utils/
    ├── groupTasks.ts         # Task grouping utilities
    └── exportUtils.ts        # Export functions
```

## Key Features

### 1. Drag & Drop
Tasks can be dragged between status columns. Changes are:
- **Optimistically applied** to IndexedDB (instant UI feedback)
- **Sent to API** in background
- **Automatically rolled back** on API errors

### 2. Real-Time Updates
Board automatically updates when:
- Other users create/update/delete tasks
- Tasks are modified via TaskDialog
- Changes arrive via WebSocket (TaskEvents)

### 3. Filters
Filter tasks by:
- **Search**: Task name and description
- **Categories**: Select multiple categories
- **Priorities**: Select multiple priorities
- **Teams**: Select multiple teams

Filters are persisted to localStorage per workspace.

### 4. Grouping (Swim Lanes)
Group tasks horizontally by:
- **None**: Single row of status columns (default)
- **Priority**: Lanes per priority level
- **Team**: Lanes per team
- **Assignee**: Lanes per assigned user

Each lane can be collapsed/expanded.

### 5. View Modes
- **Compact**: Minimal cards, show more tasks
- **Detailed**: Full cards with all metadata

### 6. Export
Export current board state to Excel with all visible tasks.

## Integration Points

### Redux Store
```typescript
// Used selectors
state.tasks.value          // All tasks
state.statuses.value       // All statuses
state.categories.value     // For filters
state.priorities.value     // For filters
state.teams.value          // For filters
state.users.value          // For grouping by assignee
```

### IndexedDB Cache
```typescript
// Operations
TasksCache.getTask(id)           // Fetch task
TasksCache.updateTask(id, data)  // Update task
```

### Events
```typescript
// Real-time listeners
TaskEvents.TASK_CREATED
TaskEvents.TASK_UPDATED
TaskEvents.TASK_DELETED
TaskEvents.TASKS_BULK_UPDATE
```

### API
```typescript
// Endpoints used
PATCH /tasks/{id}  // Update task status on drag
```

## Customization

### Add New Filter
1. Add field to `KanbanFilters` in `types/kanban.types.ts`
2. Update `useKanbanFilters` hook to apply new filter
3. Add UI control in `KanbanControls.tsx`

### Add New Grouping Option
1. Add option to `KanbanViewMode.groupBy` type
2. Update `useKanbanGrouping` hook with new logic
3. Add button in `KanbanControls.tsx`

### Customize Card Layout
Edit `KanbanCard.tsx`:
- Add/remove metadata fields
- Adjust styling and colors
- Add quick actions (hover menu)

### Change Column Appearance
Edit `KanbanColumn.tsx`:
- Modify header styling
- Add WIP limits
- Customize empty state

## Performance Tips

1. **Large Datasets**: The board handles 200+ tasks smoothly. For 1000+ tasks, consider:
   - Adding virtualization (react-window)
   - Implementing pagination
   - Adding lazy loading

2. **Real-Time Updates**: Already optimized with:
   - Debounced Redux updates
   - Memoized computations
   - Selective re-renders

3. **Drag Performance**: Already 60 FPS with:
   - CSS transforms (not layout changes)
   - Optimistic updates (no API wait)
   - Framer Motion optimizations

## Troubleshooting

### Tasks not appearing
- Check workspace filter: `workspaceId` prop
- Check status configuration: Tasks need valid `status_id`
- Check Redux store: `state.tasks.value`

### Drag not working
- Verify `@dnd-kit` packages installed
- Check browser console for errors
- Ensure cards have unique `id` prop

### Filters not working
- Check localStorage: `wh_kanban_prefs_{workspaceId}`
- Verify filter arrays: `filters.categories`, etc.
- Check useKanbanFilters hook logic

### Real-time updates missing
- Verify TaskEvents listener in KanbanBoard
- Check WebSocket connection (RTL)
- Verify TasksCache.updateTask calls

## Testing Checklist

- [ ] Drag task between columns
- [ ] Task updates status via API
- [ ] Rollback works on API error
- [ ] Search filters tasks correctly
- [ ] Category/Priority/Team filters work
- [ ] Group by Priority/Team/Assignee
- [ ] Swim lanes collapse/expand
- [ ] Click card opens TaskDialog
- [ ] TaskDialog changes reflect in board
- [ ] Real-time updates from other users
- [ ] Export to Excel works
- [ ] View mode toggle works
- [ ] Preferences persist on refresh
- [ ] Mobile drag and drop works
- [ ] Keyboard navigation works

## Common Tasks

### Add a new task
1. User creates task in TaskDialog (or other UI)
2. TaskEvents.TASK_CREATED fires
3. Board refreshes from IndexedDB
4. New task appears in appropriate column

### Move a task
1. User drags card to new column
2. KanbanBoard.handleDragEnd fires
3. TasksCache.updateTask (optimistic)
4. API call: PATCH /tasks/{id}
5. On success: Keep optimistic update
6. On failure: Rollback to previous state

### Filter tasks
1. User selects filters in KanbanControls
2. onFilterChange updates state
3. useKanbanFilters recomputes filtered tasks
4. Board re-renders with filtered results
5. Filters saved to localStorage

### Group by team
1. User selects "Team" in group dropdown
2. onGroupByChange updates state
3. useKanbanGrouping creates TaskGroup[]
4. Board switches to KanbanSwimLane layout
5. Each team gets its own lane with status columns

## Dependencies

Already installed in package.json:
- `@dnd-kit/core` - Drag and drop core
- `@dnd-kit/sortable` - Sortable lists
- `@dnd-kit/utilities` - Helper utilities
- `framer-motion` - Animations
- `lucide-react` - Icons
- `react-hot-toast` - Toast notifications
- `xlsx` - Excel export

## Support

For issues or questions:
1. Check README.md for full documentation
2. Review component source code
3. Check browser console for errors
4. Verify data in Redux DevTools
5. Test with small dataset first
