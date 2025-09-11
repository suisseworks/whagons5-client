import { useMemo } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faPlus, faFileAlt } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Template, Task, Category, Team } from "@/store/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer
} from "../components";

// Priority mapping
const PRIORITY_MAP = {
  1: { label: 'Low', color: '#6b7280' },
  2: { label: 'Medium', color: '#f59e0b' },
  3: { label: 'High', color: '#ef4444' },
  4: { label: 'Critical', color: '#dc2626' }
};

// Custom cell renderer for template name with icon
const TemplateNameCellRenderer = (props: ICellRendererParams) => {
  const templateName = props.value;
  
  return (
    <div className="flex items-center space-x-3 h-full">
      <FontAwesomeIcon 
        icon={faFileAlt} 
        className="w-4 h-4"
        style={{ color: '#3b82f6' }}
      />
      <span>{templateName}</span>
    </div>
  );
};

// Custom cell renderer for enabled status
const EnabledCellRenderer = (props: ICellRendererParams) => {
  const isEnabled = props.value;
  
  return (
    <Badge 
      variant={isEnabled ? "default" : "secondary"} 
      className={isEnabled ? "" : ""}
    >
      {isEnabled ? "Enabled" : "Disabled"}
    </Badge>
  );
};

// Custom cell renderer for priority
const PriorityCellRenderer = (props: ICellRendererParams) => {
  const priorityId = props.value;
  const priority = PRIORITY_MAP[priorityId as keyof typeof PRIORITY_MAP];
  
  if (!priority) return null;
  
  return (
    <Badge 
      variant="outline" 
      style={{ 
        borderColor: priority.color,
        color: priority.color 
      }}
    >
      {priority.label}
    </Badge>
  );
};

function Templates() {
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: teams } = useSelector((state: RootState) => state.teams);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  
  // Use shared state management
  const {
    items: templates,
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
    editingItem: editingTemplate,
    deletingItem: deletingTemplate,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Template>({
    entityName: 'templates',
    searchFields: ['name', 'description', 'instructions']
  });

  // Helper functions
  const getTemplateTaskCount = (templateId: number) => {
    return tasks.filter((task: Task) => task.template_id === templateId).length;
  };

  const canDeleteTemplate = (template: Template) => {
    return getTemplateTaskCount(template.id) === 0;
  };

  const handleDeleteTemplate = (template: Template) => {
    if (canDeleteTemplate(template)) {
      deleteItem(template.id);
    } else {
      handleDelete(template);
    }
  };

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: 'Template Name',
      flex: 2,
      minWidth: 200,
      cellRenderer: TemplateNameCellRenderer
    },
    { 
      field: 'description', 
      headerName: 'Description',
      flex: 2,
      minWidth: 200
    },
    { 
      field: 'category_id', 
      headerName: 'Category',
      width: 150,
      cellRenderer: (params: ICellRendererParams) => {
        const categoryId = params.value;
        const category = categories.find((c: any) => c.id === categoryId);
        return category ? category.name : `Category ${categoryId}`;
      },
      sortable: true,
      filter: true
    },
    { 
      field: 'team_id', 
      headerName: 'Team',
      width: 150,
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
      field: 'default_priority', 
      headerName: 'Priority',
      width: 100,
      cellRenderer: PriorityCellRenderer,
      sortable: true,
      filter: true
    },
    { 
      field: 'default_duration', 
      headerName: 'Duration (min)',
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        return `${params.value} min`;
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
      width: 120,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDeleteTemplate
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [categories, teams, handleEdit, handleDeleteTemplate]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const templateData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      category_id: parseInt(formData.get('category_id') as string),
      team_id: parseInt(formData.get('team_id') as string),
      workspace_id: 1,
      default_priority: parseInt(formData.get('default_priority') as string),
      default_duration: parseInt(formData.get('default_duration') as string),
      instructions: formData.get('instructions') as string || null,
      enabled: formData.get('enabled') === 'on',
      deleted_at: null
    };
    await createItem(templateData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      name: formData.get('name') as string,
      description: formData.get('description') as string || null,
      category_id: parseInt(formData.get('category_id') as string),
      team_id: parseInt(formData.get('team_id') as string),
      default_priority: parseInt(formData.get('default_priority') as string),
      default_duration: parseInt(formData.get('default_duration') as string),
      instructions: formData.get('instructions') as string || null,
      enabled: formData.get('enabled') === 'on'
    };
    await updateItem(editingTemplate.id, updates);
  };

  // Render entity preview for delete dialog
  const renderTemplatePreview = (template: Template) => (
    <div className="flex items-center space-x-3">
      <FontAwesomeIcon 
        icon={faFileAlt} 
        className="w-5 h-5 text-blue-500"
      />
      <div>
        <div className="font-medium">{template.name}</div>
        <div className="text-sm text-muted-foreground">{template.description}</div>
        <div className="flex items-center space-x-2 mt-1">
          <Badge 
            variant="outline" 
            style={{ 
              borderColor: PRIORITY_MAP[template.default_priority as keyof typeof PRIORITY_MAP]?.color,
              color: PRIORITY_MAP[template.default_priority as keyof typeof PRIORITY_MAP]?.color 
            }}
          >
            {PRIORITY_MAP[template.default_priority as keyof typeof PRIORITY_MAP]?.label}
          </Badge>
          <Badge 
            variant={template.enabled ? "default" : "secondary"} 
            className="text-xs"
          >
            {template.enabled ? "Enabled" : "Disabled"}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {getTemplateTaskCount(template.id)} task{getTemplateTaskCount(template.id) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title="Templates"
      description="Manage task templates for faster task creation and standardized workflows"
      icon={faClipboardList}
      iconColor="#3b82f6"
      search={{
        placeholder: "Search templates...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: "Loading templates..."
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      statistics={{
        title: "Template Statistics",
        description: "Overview of your template management",
        items: [
          { label: "Total Templates", value: templates.length },
          { label: "Enabled Templates", value: templates.filter((template: Template) => template.enabled).length },
          { label: "Disabled Templates", value: templates.filter((template: Template) => !template.enabled).length }
        ]
      }}
      headerActions={
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Add Template
        </Button>
      }
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={colDefs}
        noRowsMessage="No templates found"
      />

      {/* Create Template Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add New Template"
        description="Create a new task template to standardize your workflows."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <Input id="name" name="name" className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Input id="description" name="description" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">Category *</Label>
            <select
              id="category"
              name="category_id"
              className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              required
            >
              <option value="">Select Category</option>
              {categories.map((category: Category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="team" className="text-right">Team *</Label>
            <select
              id="team"
              name="team_id"
              className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              required
            >
              <option value="">Select Team</option>
              {teams.map((team: any) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">Default Priority</Label>
            <select
              id="priority"
              name="default_priority"
              className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              defaultValue="2"
            >
              {Object.entries(PRIORITY_MAP).map(([id, priority]) => (
                <option key={id} value={id}>
                  {priority.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="duration" className="text-right">Default Duration (min)</Label>
            <Input
              type="number"
              id="duration"
              name="default_duration"
              defaultValue="60"
              className="col-span-3"
              min="1"
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="instructions" className="text-right pt-2">Instructions</Label>
            <textarea
              id="instructions"
              name="instructions"
              className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
              placeholder="Enter detailed instructions for tasks created from this template..."
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="enabled" className="text-right">Status</Label>
            <div className="col-span-3 flex items-center space-x-2">
              <input
                type="checkbox"
                id="enabled"
                name="enabled"
                defaultChecked
                className="rounded"
              />
              <Label htmlFor="enabled" className="text-sm">Enabled</Label>
            </div>
          </div>
        </div>
      </SettingsDialog>

      {/* Edit Template Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit Template"
        description="Update the template information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingTemplate}
      >
        {editingTemplate && (
          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name *</Label>
              <Input
                id="edit-name"
                name="name"
                defaultValue={editingTemplate.name}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">Description</Label>
              <Input
                id="edit-description"
                name="description"
                defaultValue={editingTemplate.description || ''}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-category" className="text-right">Category *</Label>
              <select
                id="edit-category"
                name="category_id"
                defaultValue={editingTemplate.category_id}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              >
                <option value="">Select Category</option>
                {categories.map((category: Category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-team" className="text-right">Team *</Label>
              <select
                id="edit-team"
                name="team_id"
                defaultValue={editingTemplate.team_id}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                required
              >
                <option value="">Select Team</option>
                {teams.map((team: Team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-priority" className="text-right">Default Priority</Label>
              <select
                id="edit-priority"
                name="default_priority"
                defaultValue={editingTemplate.default_priority}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              >
                {Object.entries(PRIORITY_MAP).map(([id, priority]) => (
                  <option key={id} value={id}>
                    {priority.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-duration" className="text-right">Default Duration (min)</Label>
              <Input
                type="number"
                id="edit-duration"
                name="default_duration"
                defaultValue={editingTemplate.default_duration}
                className="col-span-3"
                min="1"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-instructions" className="text-right pt-2">Instructions</Label>
              <textarea
                id="edit-instructions"
                name="instructions"
                defaultValue={editingTemplate.instructions || ''}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
                placeholder="Enter detailed instructions for tasks created from this template..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-enabled" className="text-right">Status</Label>
              <div className="col-span-3 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-enabled"
                  name="enabled"
                  defaultChecked={editingTemplate.enabled}
                  className="rounded"
                />
                <Label htmlFor="edit-enabled" className="text-sm">Enabled</Label>
              </div>
            </div>
          </div>
        )}
      </SettingsDialog>

      {/* Delete Template Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Template"
        description={
          deletingTemplate ? (() => {
            const taskCount = getTemplateTaskCount(deletingTemplate.id);
            
            if (taskCount > 0) {
              return `This template cannot be deleted because it's used by ${taskCount} task${taskCount !== 1 ? 's' : ''}. Please delete or reassign all tasks using this template first.`;
            } else {
              return `Are you sure you want to delete the template "${deletingTemplate.name}"? This action cannot be undone.`;
            }
          })() : undefined
        }
        onConfirm={() => deletingTemplate && canDeleteTemplate(deletingTemplate) ? deleteItem(deletingTemplate.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingTemplate || !canDeleteTemplate(deletingTemplate)}
        entityName="template"
        entityData={deletingTemplate}
        renderEntityPreview={renderTemplatePreview}
      />
    </SettingsLayout>
  );
}

export default Templates;