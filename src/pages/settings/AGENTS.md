# Settings Subpage Development Guide

This guide explains how to create a new settings subpage in the WHagons client application, following the established patterns and architecture.

## Overview

Settings subpages in WHagons follow a standardized pattern using:
- **SettingsLayout**: Provides consistent header, navigation, and structure
- **SettingsGrid**: AG Grid-based data table with pagination and sorting
- **SettingsDialog**: Modal dialogs for CRUD operations
- **useSettingsState**: Custom hook for state management
- **FormFields**: Reusable form components

## Directory Structure

```
src/pages/settings/
├── Settings.tsx                    # Main settings page with navigation cards
├── sub_pages/                      # Individual settings pages
│   ├── Categories.tsx
│   ├── Teams.tsx
│   ├── Templates.tsx
│   ├── Users.tsx
│   └── [YourNewPage].tsx          # Your new subpage
├── components/                     # Shared components
│   ├── SettingsLayout.tsx         # Layout wrapper
│   ├── SettingsGrid.tsx          # Data grid component
│   ├── SettingsDialog.tsx        # Modal dialog
│   ├── useSettingsState.tsx      # State management hook
│   ├── FormFields.tsx            # Form field components
│   └── index.ts                  # Component exports
└── AGENTS.md                      # This guide
```

## Step-by-Step Implementation

### 1. Add Navigation Card to Main Settings

First, add your new settings option to the main Settings page (`Settings.tsx`):

```tsx
// In Settings.tsx, add to settingsOptions array:
{
  id: 'your-entity',
  title: 'Your Entity',
  icon: faYourIcon, // Import from @fortawesome/free-solid-svg-icons
  count: counts.yourEntity,
  description: 'Manage your entities',
  color: 'text-your-color-500'
}

// Add navigation case in handleSettingClick:
case 'your-entity':
  navigate('/settings/your-entity');
  break;
```

### 2. Create the Subpage Component

Create `sub_pages/YourEntity.tsx` following this template:

```tsx
import { useMemo } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faYourIcon, faPlus } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { YourEntity, RelatedEntity } from "@/store/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField
} from "../components";

// Custom cell renderers (if needed)
const YourEntityNameCellRenderer = (props: ICellRendererParams) => {
  // Custom rendering logic
  return <span>{props.value}</span>;
};

function YourEntityPage() {
  // Redux state for related data
  const { value: relatedEntities } = useSelector((state: RootState) => state.relatedEntities);
  
  // Use shared state management
  const {
    items: yourEntities,
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    createItem,
    updateItem,
    deleteItem,
    isSubmitting,
    formError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    editingItem,
    deletingItem,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<YourEntity>({
    entityName: 'yourEntities', // Must match Redux slice name
    searchFields: ['name', 'description'] // Fields to search
  });

  // Helper functions for validation/counts
  const canDeleteEntity = (entity: YourEntity) => {
    // Add validation logic
    return true;
  };

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: 'Name',
      flex: 2,
      minWidth: 200,
      cellRenderer: YourEntityNameCellRenderer
    },
    { 
      field: 'description', 
      headerName: 'Description',
      flex: 3,
      minWidth: 250
    },
    {
      field: 'created_at',
      headerName: 'Created',
      flex: 1,
      minWidth: 150,
      valueFormatter: (params) => {
        return params.value ? new Date(params.value).toLocaleDateString() : '';
      }
    },
    {
      headerName: 'Actions',
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDelete,
        canDelete: canDeleteEntity
      }),
      width: 120,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMenu: true
    }
  ], [handleEdit, handleDelete]);

  // Form validation
  const validateForm = (formData: Partial<YourEntity>) => {
    if (!formData.name?.trim()) {
      return "Name is required";
    }
    // Add more validation
    return null;
  };

  // Handle form submission
  const handleSubmit = async (formData: Partial<YourEntity>) => {
    const validationError = validateForm(formData);
    if (validationError) {
      throw new Error(validationError);
    }

    if (editingItem) {
      await updateItem(editingItem.id, formData);
    } else {
      await createItem(formData);
    }
  };

  // Statistics for the layout
  const statistics = useMemo(() => ({
    title: "Your Entity Statistics",
    description: "Overview of your entities",
    items: [
      { label: "Total Entities", value: yourEntities.length },
      { label: "Active", value: yourEntities.filter(e => e.is_active).length },
      // Add more stats
    ]
  }), [yourEntities]);

  return (
    <SettingsLayout
      title="Your Entities"
      description="Manage your entities and their configurations"
      icon={faYourIcon}
      iconColor="#your-color"
      search={{
        placeholder: "Search entities...",
        value: searchQuery,
        onChange: setSearchQuery
      }}
      loading={{ isLoading: loading }}
      error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
      statistics={statistics}
      headerActions={
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-2" />
          Add Entity
        </Button>
      }
    >
      <SettingsGrid
        columnDefs={colDefs}
        rowData={filteredItems}
        loading={loading}
        onRowDoubleClicked={(event) => handleEdit(event.data)}
      />

      {/* Create/Edit Dialog */}
      <SettingsDialog
        isOpen={isCreateDialogOpen || isEditDialogOpen}
        onClose={() => {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
        }}
        title={editingItem ? "Edit Entity" : "Create New Entity"}
        description={editingItem ? "Update entity details" : "Add a new entity to the system"}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        type={editingItem ? 'edit' : 'create'}
      >
        {({ formData, setFormData }) => (
          <div className="space-y-4">
            <TextField
              label="Name"
              value={formData.name || ''}
              onChange={(value) => setFormData({ ...formData, name: value })}
              placeholder="Enter entity name"
              required
            />
            
            <TextAreaField
              label="Description"
              value={formData.description || ''}
              onChange={(value) => setFormData({ ...formData, description: value })}
              placeholder="Enter entity description"
            />

            <CheckboxField
              label="Active"
              checked={formData.is_active || false}
              onChange={(checked) => setFormData({ ...formData, is_active: checked })}
              description="Enable this entity"
            />
          </div>
        )}
      </SettingsDialog>

      {/* Delete Confirmation Dialog */}
      <SettingsDialog
        isOpen={isDeleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        title="Delete Entity"
        description={`Are you sure you want to delete "${deletingItem?.name}"?`}
        onSubmit={() => deleteItem(deletingItem!.id)}
        isSubmitting={isSubmitting}
        error={formError}
        type="delete"
      />
    </SettingsLayout>
  );
}

export default YourEntityPage;
```

### 3. Add Route Configuration

Add the route to your routing configuration (typically in `App.tsx` or routing file):

```tsx
import YourEntityPage from './pages/settings/sub_pages/YourEntity';

// Add to your routes:
<Route path="/settings/your-entity" element={<YourEntityPage />} />
```

### 4. Update Redux Store

Ensure your entity has a Redux slice following the established pattern:

```tsx
// In store/slices/yourEntitySlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { YourEntity } from '../types';

interface YourEntityState {
  value: YourEntity[];
  loading: boolean;
  error: string | null;
}

const initialState: YourEntityState = {
  value: [],
  loading: false,
  error: null
};

const yourEntitySlice = createSlice({
  name: 'yourEntities',
  initialState,
  reducers: {
    setYourEntities: (state, action: PayloadAction<YourEntity[]>) => {
      state.value = action.payload;
      state.loading = false;
      state.error = null;
    },
    addYourEntity: (state, action: PayloadAction<YourEntity>) => {
      // Generate a temporary ID if not provided (for optimistic updates)
      const newEntity = {
        ...action.payload,
        id: action.payload.id || Date.now(),
        created_at: action.payload.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      state.value.push(newEntity);
    },
    updateYourEntity: (state, action: PayloadAction<YourEntity>) => {
      const index = state.value.findIndex(item => item.id === action.payload.id);
      if (index !== -1) {
        state.value[index] = {
          ...action.payload,
          updated_at: new Date().toISOString()
        };
      }
    },
    removeYourEntity: (state, action: PayloadAction<number>) => {
      state.value = state.value.filter(item => item.id !== action.payload);
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    }
  }
});

export const { 
  setYourEntities, 
  addYourEntity, 
  updateYourEntity, 
  removeYourEntity,
  setLoading,
  setError 
} = yourEntitySlice.actions;
export default yourEntitySlice.reducer;
```

Don't forget to add your slice to the root store configuration:

```tsx
// In store/store.ts
import yourEntityReducer from './slices/yourEntitySlice';

export const store = configureStore({
  reducer: {
    // ... other reducers
    yourEntities: yourEntityReducer,
  },
});
```

## Key Components Reference

### SettingsLayout Props

```tsx
interface SettingsLayoutProps {
  title: string;                    // Page title
  description: string;              // Page description
  icon: IconDefinition;             // FontAwesome icon
  iconColor?: string;               // Icon color
  backPath?: string;                // Back navigation path (default: '/settings')
  breadcrumbs?: Array<{             // Breadcrumb navigation
    label: string; 
    path?: string;
  }>;
  children: React.ReactNode;        // Main content
  headerActions?: React.ReactNode;  // Actions in header (e.g., Add button)
  search?: {                        // Search configuration
    placeholder?: string;
    value: string;
    onChange: (value: string) => void;
  };
  loading?: {                       // Loading state
    isLoading: boolean;
    message?: string;
  };
  error?: {                         // Error state
    message: string;
    onRetry?: () => void;
  };
  statistics?: {                    // Statistics section
    title: string;
    description?: string;
    items: StatisticItem[];
  };
  showGrid?: boolean;               // Show grid component
  gridComponent?: React.ReactNode;  // Custom grid component
  beforeContent?: React.ReactNode;  // Content before main area
  afterContent?: React.ReactNode;   // Content after main area
}
```

### useSettingsState Hook

The `useSettingsState` hook manages all the state and actions for a settings subpage through Redux:

```tsx
const {
  items,                    // All items from Redux store
  filteredItems,           // Filtered items based on search query
  loading,                 // Loading state from Redux
  error,                   // Error state from Redux
  searchQuery,             // Current search query (local state)
  setSearchQuery,          // Update search query
  handleSearch,            // Search handler (filters items locally)
  createItem,              // Dispatches add action to Redux
  updateItem,              // Dispatches update action to Redux
  deleteItem,              // Dispatches remove action to Redux
  isSubmitting,            // Form submission state (local)
  formError,               // Form error state (local)
  isCreateDialogOpen,      // Create dialog state (local)
  setIsCreateDialogOpen,   // Set create dialog state
  isEditDialogOpen,        // Edit dialog state (local)
  setIsEditDialogOpen,     // Set edit dialog state
  isDeleteDialogOpen,      // Delete dialog state (local)
  editingItem,             // Currently editing item (local)
  deletingItem,            // Item being deleted (local)
  handleEdit,              // Edit handler (opens dialog)
  handleDelete,            // Delete handler (opens dialog)
  handleCloseDeleteDialog  // Close delete dialog handler
} = useSettingsState<YourEntity>({
  entityName: 'yourEntities',        // Redux slice name (must match store)
  searchFields: ['name', 'description'] // Fields to search locally
});
```

The hook automatically:
- Reads data from the Redux store using `useSelector`
- Dispatches actions using `useDispatch` when items are created/updated/deleted
- Manages local UI state for dialogs and forms
- Handles search filtering without affecting the Redux store

### Form Field Components

Available form field components:
- `TextField`: Single-line text input
- `TextAreaField`: Multi-line text input
- `SelectField`: Dropdown selection
- `CheckboxField`: Boolean checkbox
- `PreviewField`: Read-only preview
- `IconPicker`: FontAwesome icon selector
- `ColorPicker`: Color selection (if available)

## Best Practices

### 1. Consistent Naming
- Use PascalCase for component names
- Use camelCase for props and variables
- Match Redux slice names with `entityName` in `useSettingsState`

### 2. Validation
- Always validate form data before submission
- Provide clear error messages
- Handle both client-side and server-side validation

### 3. Performance
- Use `useMemo` for expensive computations (column definitions, statistics)
- Implement proper loading and error states
- Use appropriate data structures for searches and filters

### 4. Accessibility
- Provide meaningful labels and descriptions
- Use proper ARIA attributes
- Ensure keyboard navigation works

### 5. Responsive Design
- Test on different screen sizes
- Use appropriate grid layouts
- Ensure mobile usability

## Common Patterns

### Custom Cell Renderers
```tsx
const CustomCellRenderer = (props: ICellRendererParams) => {
  const value = props.value;
  const data = props.data;
  
  return (
    <div className="flex items-center space-x-2">
      {/* Custom rendering logic */}
      <span>{value}</span>
    </div>
  );
};
```

### Validation Logic
```tsx
const validateForm = (formData: Partial<YourEntity>) => {
  if (!formData.name?.trim()) {
    return "Name is required";
  }
  if (formData.name.length > 255) {
    return "Name must be less than 255 characters";
  }
  return null;
};
```

### Statistics Calculation
```tsx
const statistics = useMemo(() => ({
  title: "Statistics",
  items: [
    { label: "Total", value: items.length },
    { label: "Active", value: items.filter(i => i.is_active).length },
    { label: "Recent", value: items.filter(i => isRecent(i.created_at)).length }
  ]
}), [items]);
```

## Troubleshooting

### Common Issues

1. **Redux state not updating**: Ensure slice name matches `entityName` in `useSettingsState`
2. **Search not working**: Check that `searchFields` includes the correct property names
3. **Form validation errors**: Verify validation logic and error handling
4. **Grid not displaying**: Check column definitions and row data structure
5. **Navigation not working**: Ensure routes are properly configured

### Debug Tips

1. Use Redux DevTools to inspect state changes
2. Add console.logs to track data flow
3. Check browser network tab for API calls
4. Verify component props with React DevTools

## Examples

See existing implementations:
- `Categories.tsx` - Complex form with custom fields and validation
- `Teams.tsx` - Simple CRUD with color indicators
- `Templates.tsx` - Advanced features with relationships
- `Users.tsx` - User management with roles and permissions

## Redux Integration

Settings subpages integrate entirely through Redux state management. The `useSettingsState` hook handles:
- Reading data from Redux store
- Dispatching actions for creating, updating, and deleting items
- Local state management for UI interactions (dialogs, forms)
- Search and filtering logic

All data operations are performed through Redux reducers and actions:
- Data is read from the Redux store using `useSelector`
- CRUD operations dispatch actions to update the store
- The store handles all state mutations and persistence
- No direct API calls are made from components
