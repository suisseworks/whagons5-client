import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faTags, 
  faPlus,
  faCubes,
  faBroom,
  faWrench,
  faSeedling,
  faTools,
  faHome,
  faCar,
  faUtensils,
  faLaptop,
  faBook
} from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Category, Task, Team, StatusTransitionGroup } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  IconPicker,
  CategoryFieldsManager,
  TextField,
  SelectField,
  CheckboxField
} from "../components";

// Custom cell renderer for category name with icon
const CategoryNameCellRenderer = (props: ICellRendererParams) => {
  const categoryIcon = props.data?.icon;
  const categoryColor = props.data?.color || '#6B7280';
  const categoryName = props.value;
  
  if (!categoryIcon) {
    return <span>{categoryName}</span>;
  }
  
  // Parse FontAwesome icon class (e.g., "fas fa-broom")
  const iconClasses = categoryIcon.split(' ');
  const iconName = iconClasses[iconClasses.length - 1]; // Get the last part (fa-broom)
  
  // Map common FontAwesome icons to their equivalents
  const iconMap: { [key: string]: any } = {
    'fa-broom': faBroom,
    'fa-wrench': faWrench,
    'fa-seedling': faSeedling,
    'fa-tools': faTools,
    'fa-home': faHome,
    'fa-car': faCar,
    'fa-utensils': faUtensils,
    'fa-laptop': faLaptop,
    'fa-book': faBook,
    'fa-tags': faTags,
  };
  
  const icon = iconMap[iconName] || faTags;
  
  return (
    <div className="flex items-center space-x-3 h-full">
      <FontAwesomeIcon 
        icon={icon} 
        className="w-4 h-4" 
        style={{ color: categoryColor }}
      />
      <span>{categoryName}</span>
    </div>
  );
};

// Custom cell renderer for enabled status
const EnabledCellRenderer = (props: ICellRendererParams) => {
  const isEnabled = props.value;
  
  return (
    <Badge 
      variant={isEnabled ? "default" : "secondary"} 
      className={isEnabled ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-gray-100 text-gray-800 hover:bg-gray-100"}
    >
      {isEnabled ? "Enabled" : "Disabled"}
    </Badge>
  );
};

function Categories() {
  const dispatch = useDispatch();
  // Redux state for related data
  const { value: teams } = useSelector((state: RootState) => state.teams) as { value: Team[] };
  const { value: tasks } = useSelector((state: RootState) => state.tasks) as { value: Task[] };
  const { value: categoryFieldAssignments } = useSelector((state: RootState) => state.categoryFieldAssignments) as { value: any[] };
  const statusTransitionGroups = useSelector((s: RootState) => (s as any).statusTransitionGroups.value) as StatusTransitionGroup[];

  // Load transition groups (for dropdowns and column rendering)
  useEffect(() => {
    dispatch(genericActions.statusTransitionGroups.getFromIndexedDB());
    dispatch(genericActions.statusTransitionGroups.fetchFromAPI({ per_page: 1000 }));
  }, [dispatch]);
  
  // Use shared state management
  const {
    items: categories,
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    handleSearch,
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
    editingItem: editingCategory,
    deletingItem: deletingCategory,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Category>({
    entityName: 'categories',
    searchFields: ['name', 'description']
  });

  // Manage Fields dialog state
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false);
  const [fieldsCategory, setFieldsCategory] = useState<Category | null>(null);

  const assignmentCountByCategory = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    (categoryFieldAssignments as any[]).forEach((a) => {
      map[a.category_id] = (map[a.category_id] || 0) + 1;
    });
    return map;
  }, [categoryFieldAssignments]);

  const openManageFields = (category: Category) => {
    setFieldsCategory(category);
    setIsFieldsDialogOpen(true);
  };

  const closeManageFields = () => {
    setIsFieldsDialogOpen(false);
    setFieldsCategory(null);
  };

  // Get task count for a category
  const getCategoryTaskCount = (categoryId: number) => {
    return tasks.filter((task: Task) => task.category_id === categoryId).length;
  };

  const canDeleteCategory = (category: Category) => {
    return getCategoryTaskCount(category.id) === 0;
  };

  const handleDeleteCategory = (category: Category) => {
    if (canDeleteCategory(category)) {
      deleteItem(category.id);
    } else {
      handleDelete(category);
    }
  };

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: 'Category Name',
      flex: 2,
      minWidth: 150,
      cellRenderer: CategoryNameCellRenderer
    },
    { 
      field: 'description', 
      headerName: 'Description',
      flex: 2,
      minWidth: 150
    },
    // Fields column removed per request
    { 
      field: 'team_id', 
      headerName: 'Team',
      width: 180,
      cellRenderer: (params: ICellRendererParams) => {
        const teamId = params.value;
        
        if (!teamId) {
          return <span className="text-muted-foreground">No Team</span>;
        }
        
        const team = teams.find((t: any) => t.id === teamId);
        
        return (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 min-w-[1.5rem] bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
              {team?.name ? team.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <span>{team?.name || `Team ${teamId}`}</span>
          </div>
        );
      },
      sortable: true,
      filter: true
    },
    {
      field: 'status_transition_group_id',
      headerName: 'Transition Group',
      width: 220,
      cellRenderer: (params: ICellRendererParams) => {
        const groupId = params.value as number | null | undefined;
        if (!groupId) {
          return <span className="text-muted-foreground">Unassigned</span>;
        }
        const group = statusTransitionGroups.find((g: any) => g.id === Number(groupId));
        return <span>{group?.name || `Group ${groupId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    { 
      field: 'enabled', 
      headerName: 'Status',
      width: 100,
      cellRenderer: EnabledCellRenderer,
      sortable: true,
      filter: true
    },
    {
      field: 'actions',
      headerName: 'Actions',
      colId: 'actions',
      minWidth: 160,
      suppressSizeToFit: true,
      cellRenderer: createActionsCellRenderer({
        customActions: [{
          icon: faCubes,
          label: 'Fields',
          variant: 'outline',
          onClick: openManageFields,
          className: 'p-1 h-7'
        }],
        onEdit: handleEdit,
        onDelete: handleDeleteCategory
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [teams, statusTransitionGroups, handleEdit, handleDeleteCategory, assignmentCountByCategory, openManageFields]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    if (!formData.get('team_id')) {
      throw new Error('Please select a team for this category.');
    }
    if (!formData.get('status_transition_group_id')) {
      throw new Error('Please select a transition group for this category.');
    }
    
    const categoryData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      color: formData.get('color') as string,
      icon: formData.get('icon') as string,
      enabled: formData.get('enabled') === 'on',
      team_id: parseInt(formData.get('team_id') as string),
      workspace_id: 1,
      sla_id: 1,
      status_transition_group_id: parseInt(formData.get('status_transition_group_id') as string),
      deleted_at: null
    };
    await createItem(categoryData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      color: formData.get('color') as string,
      icon: formData.get('icon') as string,
      enabled: formData.get('enabled') === 'on',
      team_id: formData.get('team_id') ? parseInt(formData.get('team_id') as string) : 0,
      workspace_id: 1,
      sla_id: 1,
      status_transition_group_id: formData.get('status_transition_group_id') ? parseInt(formData.get('status_transition_group_id') as string) : undefined
    };
    await updateItem(editingCategory.id, updates);
  };

  // Render entity preview for delete dialog
  const renderCategoryPreview = (category: Category) => {
    const iconClasses = category.icon?.split(' ');
    const iconName = iconClasses?.[iconClasses.length - 1];
    
    const iconMap: { [key: string]: any } = {
      'fa-broom': faBroom,
      'fa-wrench': faWrench,
      'fa-seedling': faSeedling,
      'fa-tools': faTools,
      'fa-home': faHome,
      'fa-car': faCar,
      'fa-utensils': faUtensils,
      'fa-laptop': faLaptop,
      'fa-book': faBook,
      'fa-tags': faTags,
    };
    
    const icon = iconMap[iconName] || faTags;
    
    return (
      <div className="flex items-center space-x-3">
        <FontAwesomeIcon 
          icon={icon} 
          className="w-5 h-5" 
          style={{ color: category.color }}
        />
        <div>
          <div className="font-medium">{category.name}</div>
          <div className="text-sm text-muted-foreground">{category.description}</div>
          <div className="flex items-center space-x-2 mt-1">
            {category.team_id && (
              <div className="flex items-center space-x-1">
                <div className="w-4 h-4 min-w-[1rem] bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                  {teams.find((t: Team) => t.id === category.team_id)?.name?.charAt(0).toUpperCase() || 'T'}
                </div>
                <span className="text-xs text-muted-foreground">
                  {teams.find((t: Team) => t.id === category.team_id)?.name || `Team ${category.team_id}`}
                </span>
              </div>
            )}
            <Badge 
              variant={category.enabled ? "default" : "secondary"} 
              className={`text-xs ${category.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
            >
              {category.enabled ? "Enabled" : "Disabled"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {getCategoryTaskCount(category.id)} task{getCategoryTaskCount(category.id) !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <SettingsLayout
      title="Categories"
      description="Manage task categories and labels for better organization"
      icon={faTags}
      iconColor="#ef4444"
      search={{
        placeholder: "Search categories...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: "Loading categories..."
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      statistics={{
        title: "Category Statistics",
        description: "Overview of your category usage",
        items: [
          { label: "Total Categories", value: categories.length },
          { label: "Enabled Categories", value: categories.filter((cat: Category) => cat.enabled).length },
          { label: "Disabled Categories", value: categories.filter((cat: Category) => !cat.enabled).length }
        ]
      }}
      headerActions={
        <div className="flex items-center space-x-2">
          <Link to="/settings/categories/custom-fields">
            <Button variant="outline" className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring">
              Manage custom fields
            </Button>
          </Link>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
            <span>Add Category</span>
          </Button>
        </div>
      }
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={colDefs}
        noRowsMessage="No categories found"
        rowSelection="single"
        onRowDoubleClicked={(row: any) => handleEdit(row)}
      />

      {/* Create Category Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add New Category"
        description="Add a new category to organize your tasks."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <TextField
            id="name"
            label="Name"
            defaultValue=""
            required
          />
          <TextField
            id="description"
            label="Description"
            defaultValue=""
          />
          <TextField
            id="color"
            label="Color"
            type="color"
            defaultValue="#4ECDC4"
          />
          <IconPicker
            id="icon"
            label="Icon"
            value="fas fa-tags"
            onChange={(iconClass) => {
              // This will be handled by the form submission
              const iconInput = document.getElementById('icon-hidden') as HTMLInputElement;
              if (iconInput) iconInput.value = iconClass;
            }}
            color="#4ECDC4"
            required
          />
          <input type="hidden" id="icon-hidden" name="icon" defaultValue="fas fa-tags" />
          <SelectField
            id="team"
            label="Team"
            defaultValue=""
            placeholder="No Team"
            options={teams.map((team: Team) => ({
              value: team.id.toString(),
              label: team.name
            }))}
            required
          />
          <SelectField
            id="status-group"
            label="Transition Group"
            defaultValue=""
            placeholder="Select group…"
            options={statusTransitionGroups.map((g: StatusTransitionGroup) => ({
              value: g.id.toString(),
              label: g.name
            }))}
            required
          />
          <CheckboxField
            id="enabled"
            name="enabled"
            label="Status"
            defaultChecked={true}
            description="Enabled"
          />
        </div>
      </SettingsDialog>

      {/* Edit Category Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit Category"
        description="Update the category information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingCategory}
      >
        {editingCategory && (
          <div className="grid gap-4">
            <TextField
              id="edit-name"
              label="Name"
              value={editingCategory.name}
              onChange={() => {}}
              required
            />
            <TextField
              id="edit-description"
              label="Description"
              value={editingCategory.description || ''}
              onChange={() => {}}
            />
            <TextField
              id="edit-color"
              label="Color"
              type="color"
              value={editingCategory.color || '#4ECDC4'}
              onChange={() => {}}
            />
            <IconPicker
              id="edit-icon"
              label="Icon"
              value={editingCategory.icon || 'fas fa-tags'}
              onChange={(iconClass) => {
                const iconInput = document.getElementById('edit-icon-hidden') as HTMLInputElement;
                if (iconInput) iconInput.value = iconClass;
              }}
              color={editingCategory.color || '#4ECDC4'}
              required
            />
            <input type="hidden" id="edit-icon-hidden" name="icon" defaultValue={editingCategory.icon || 'fas fa-tags'} />
            <SelectField
              id="edit-team"
              label="Team"
              value={editingCategory.team_id?.toString() || ''}
              onChange={() => {}}
              placeholder="No Team"
              options={teams.map((team: Team) => ({
                value: team.id.toString(),
                label: team.name
              }))}
            />
            <SelectField
              id="edit-status-group"
              label="Transition Group"
              value={editingCategory.status_transition_group_id?.toString() || ''}
              onChange={() => {}}
              placeholder="Select group…"
              options={statusTransitionGroups.map((g: StatusTransitionGroup) => ({
                value: g.id.toString(),
                label: g.name
              }))}
              required
            />
            <CheckboxField
              id="edit-enabled"
              name="enabled"
              label="Status"
              defaultChecked={editingCategory.enabled}
              description="Enabled"
            />
          </div>
        )}
      </SettingsDialog>

      {/* Delete Category Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Category"
        description={
          deletingCategory ? (() => {
            const taskCount = getCategoryTaskCount(deletingCategory.id);
            
            if (taskCount > 0) {
              return `This category cannot be deleted because it contains ${taskCount} task${taskCount !== 1 ? 's' : ''}. Please reassign or delete all tasks in this category first.`;
            } else {
              return `Are you sure you want to delete the category "${deletingCategory.name}"? This action cannot be undone.`;
            }
          })() : undefined
        }
        onConfirm={() => deletingCategory && canDeleteCategory(deletingCategory) ? deleteItem(deletingCategory.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingCategory || !canDeleteCategory(deletingCategory)}
        entityName="category"
        entityData={deletingCategory}
        renderEntityPreview={renderCategoryPreview}
      />

      {/* Manage Fields Dialog */}
      <CategoryFieldsManager
        open={isFieldsDialogOpen}
        onOpenChange={(open) => { if (!open) closeManageFields(); }}
        category={fieldsCategory}
      />
    </SettingsLayout>
  );
}

export default Categories;
