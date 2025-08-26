import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faClipboardList,
  faArrowLeft,
  faPlus,
  faEdit,
  faTrash,
  faSpinner,
  faClock,
  faExclamationTriangle,
  faFileAlt
} from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from '@/store/genericSlices';
import { getTasksFromIndexedDB } from "@/store/reducers/tasksSlice";
import { Template } from "@/store/types";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

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
        className="w-4 h-4 text-blue-500"
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
      className={isEnabled ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-gray-100 text-gray-800 hover:bg-gray-100"}
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

// Custom cell renderer for actions
const ActionsCellRenderer = (props: ICellRendererParams & { onEdit: (template: Template) => void; onDelete: (template: Template) => void }) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onEdit(props.data);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onDelete(props.data);
  };

  return (
    <div className="flex items-center space-x-2 h-full">
      <Button 
        size="sm" 
        variant="outline"
        onClick={handleEdit}
        className="p-1 h-7 w-7"
      >
        <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
      </Button>
      <Button 
        size="sm" 
        variant="destructive"
        onClick={handleDelete}
        className="p-1 h-7 w-7"
      >
        <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
      </Button>
    </div>
  );
};

function Templates() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const gridRef = useRef<AgGridReact>(null);
  
  // Redux state
  const { value: templates, loading, error } = useSelector((state: RootState) => state.templates);
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: teams } = useSelector((state: RootState) => state.teams);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  
  const [rowData, setRowData] = useState<Template[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    team_id: '',
    workspace_id: 1,
    default_priority: 2,
    default_duration: 60,
    instructions: '',
    enabled: true
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    team_id: '',
    workspace_id: 1,
    default_priority: 2,
    default_duration: 60,
    instructions: '',
    enabled: true
  });

  // Get task count for a template
  const getTemplateTaskCount = useCallback((templateId: number) => {
    return tasks.filter(task => task.template_id === templateId).length;
  }, [tasks]);

  // Handle edit template
  const handleEditTemplate = useCallback((template: Template) => {
    setEditingTemplate(template);
    setEditFormData({
      name: template.name,
      description: template.description || '',
      category_id: template.category_id.toString(),
      team_id: template.team_id.toString(),
      workspace_id: template.workspace_id,
      default_priority: template.default_priority,
      default_duration: template.default_duration,
      instructions: template.instructions || '',
      enabled: template.enabled
    });
    // Note: clearError not available in generic slices
    setIsEditDialogOpen(true);
  }, [dispatch]);

  // Handle delete template
  const handleDeleteTemplate = useCallback((template: Template) => {
    setDeletingTemplate(template);
    // Note: clearError not available in generic slices
    setIsDeleteDialogOpen(true);
  }, [dispatch]);

  // Handle close delete dialog
  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingTemplate(null);
    // Note: clearError not available in generic slices
  };

  // Delete template with validation
  const deleteTemplate = async () => {
    if (!deletingTemplate) return;
    
    const taskCount = getTemplateTaskCount(deletingTemplate.id);
    if (taskCount > 0) {
      // This should not happen as the dialog already shows the count
      // But adding extra validation just in case
      return;
    }
    
    try {
      setIsSubmitting(true);
      await dispatch(genericActions.templates.removeAsync(deletingTemplate.id)).unwrap();
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting template:', error);
    } finally {
      setIsSubmitting(false);
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
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
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
      cellRenderer: (params: ICellRendererParams) => ActionsCellRenderer({...params, onEdit: handleEditTemplate, onDelete: handleDeleteTemplate}),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [categories, teams, handleEditTemplate, handleDeleteTemplate]);

  // Load templates from Redux store
  useEffect(() => {
    dispatch(genericActions.templates.getFromIndexedDB());
  }, [dispatch]);

  // Load categories from Redux store
  useEffect(() => {
    dispatch(genericActions.categories.getFromIndexedDB());
  }, [dispatch]);

  // Load teams from Redux store
  useEffect(() => {
    dispatch(genericActions.teams.getFromIndexedDB());
  }, [dispatch]);

  // Load tasks from Redux store
  useEffect(() => {
    dispatch(getTasksFromIndexedDB());
  }, [dispatch]);

  // Update rowData when templates change
  useEffect(() => {
    setRowData(templates);
  }, [templates]);

  // Create new template via Redux
  const createTemplate = async () => {
    try {
      setIsSubmitting(true);
      
      const templateData: Omit<Template, 'id' | 'created_at' | 'updated_at'> = {
        name: formData.name,
        description: formData.description || null,
        category_id: parseInt(formData.category_id),
        team_id: parseInt(formData.team_id),
        workspace_id: formData.workspace_id,
        default_priority: formData.default_priority,
        default_duration: formData.default_duration,
        instructions: formData.instructions || null,
        enabled: formData.enabled,
        deleted_at: null
      };
      
      await dispatch(genericActions.templates.addAsync(templateData)).unwrap();
      
      // Reset form and close dialog
      setFormData({
        name: '',
        description: '',
        category_id: '',
        team_id: '',
        workspace_id: 1,
        default_priority: 2,
        default_duration: 60,
        instructions: '',
        enabled: true
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating template:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing template via Redux
  const updateTemplate = async () => {
    if (!editingTemplate) return;
    
    try {
      setIsSubmitting(true);
      
      const updates: Partial<Template> = {
        name: editFormData.name,
        description: editFormData.description || null,
        category_id: parseInt(editFormData.category_id),
        team_id: parseInt(editFormData.team_id),
        workspace_id: editFormData.workspace_id,
        default_priority: editFormData.default_priority,
        default_duration: editFormData.default_duration,
        instructions: editFormData.instructions || null,
        enabled: editFormData.enabled
      };
      
      await dispatch(genericActions.templates.updateAsync({
        id: editingTemplate.id,
        updates
      })).unwrap();
      
      // Reset form and close dialog
      setEditFormData({
        name: '',
        description: '',
        category_id: '',
        team_id: '',
        workspace_id: 1,
        default_priority: 2,
        default_duration: 60,
        instructions: '',
        enabled: true
      });
      setEditingTemplate(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating template:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTemplate = () => {
    // Reset form data when opening dialog
    setFormData({
      name: '',
      description: '',
      category_id: '',
      team_id: '',
      workspace_id: 1,
      default_priority: 2,
      default_duration: 60,
      instructions: '',
      enabled: true
    });
    // Clear any existing errors
    // Note: clearError not available in generic slices
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      createTemplate();
    }
  };

  const handleEditFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editFormData.name.trim()) {
      updateTemplate();
    }
  };

  const handleBackClick = () => {
    navigate('/settings');
  };

  const handleSearch = (value: string) => {
    const lowerCaseValue = value.toLowerCase();
    if (lowerCaseValue === '') {
      setRowData(templates);
    } else {
      const filteredData = templates.filter((template) => {
        const category = categories.find(c => c.id === template.category_id);
        const team = teams.find(t => t.id === template.team_id);
        const priority = PRIORITY_MAP[template.default_priority as keyof typeof PRIORITY_MAP];
        
        return template.name?.toLowerCase().includes(lowerCaseValue) ||
               template.description?.toLowerCase().includes(lowerCaseValue) ||
               template.instructions?.toLowerCase().includes(lowerCaseValue) ||
               category?.name?.toLowerCase().includes(lowerCaseValue) ||
               team?.name?.toLowerCase().includes(lowerCaseValue) ||
               priority?.label?.toLowerCase().includes(lowerCaseValue);
      });
      setRowData(filteredData);
    }
  };

  const onGridReady = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (gridRef.current?.api) {
        gridRef.current.api.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <button 
              onClick={handleBackClick}
              className="flex items-center space-x-1 hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
              <span>Settings</span>
            </button>
            <span>»</span>
            <span className="text-foreground">Templates</span>
          </nav>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faClipboardList} className="text-blue-500 text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            <span>Loading templates...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <button 
              onClick={handleBackClick}
              className="flex items-center space-x-1 hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
              <span>Settings</span>
            </button>
            <span>»</span>
            <span className="text-foreground">Templates</span>
          </nav>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faClipboardList} className="text-blue-500 text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => dispatch(genericActions.templates.getFromIndexedDB())} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <button 
            onClick={handleBackClick}
            className="flex items-center space-x-1 hover:text-foreground transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <span>»</span>
          <span className="text-foreground">Templates</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <FontAwesomeIcon icon={faClipboardList} className="text-blue-500 text-2xl" />
              <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
            </div>
            <p className="text-muted-foreground">
              Manage task templates for faster task creation and standardized workflows
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddTemplate} className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span>Add Template</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add New Template</DialogTitle>
                <DialogDescription>
                  Create a new task template to standardize your workflows.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">
                      Category
                    </Label>
                    <select
                      id="category"
                      value={formData.category_id}
                      onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                      className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="team" className="text-right">
                      Team
                    </Label>
                    <select
                      id="team"
                      value={formData.team_id}
                      onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                      className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      required
                    >
                      <option value="">Select Team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="priority" className="text-right">
                      Default Priority
                    </Label>
                    <select
                      id="priority"
                      value={formData.default_priority}
                      onChange={(e) => setFormData({ ...formData, default_priority: parseInt(e.target.value) })}
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
                    <Label htmlFor="duration" className="text-right">
                      Default Duration (min)
                    </Label>
                    <Input
                      type="number"
                      id="duration"
                      value={formData.default_duration}
                      onChange={(e) => setFormData({ ...formData, default_duration: parseInt(e.target.value) || 0 })}
                      className="col-span-3"
                      min="1"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="instructions" className="text-right pt-2">
                      Instructions
                    </Label>
                    <textarea
                      id="instructions"
                      value={formData.instructions}
                      onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                      className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
                      placeholder="Enter detailed instructions for tasks created from this template..."
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="enabled" className="text-right">
                      Status
                    </Label>
                    <div className="col-span-3 flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="enabled"
                        checked={formData.enabled}
                        onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="enabled" className="text-sm">
                        {formData.enabled ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  {error && (
                    <div className="text-sm text-destructive mb-2 text-left">
                      {error}
                    </div>
                  )}
                  <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                    {isSubmitting ? (
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    ) : (
                      <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    )}
                    {isSubmitting ? 'Adding...' : 'Add Template'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Template Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Template</DialogTitle>
                <DialogDescription>
                  Update the template information.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditFormSubmit} className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="edit-name"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="edit-description"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-category" className="text-right">
                      Category
                    </Label>
                    <select
                      id="edit-category"
                      value={editFormData.category_id}
                      onChange={(e) => setEditFormData({ ...editFormData, category_id: e.target.value })}
                      className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      required
                    >
                      <option value="">Select Category</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-team" className="text-right">
                      Team
                    </Label>
                    <select
                      id="edit-team"
                      value={editFormData.team_id}
                      onChange={(e) => setEditFormData({ ...editFormData, team_id: e.target.value })}
                      className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                      required
                    >
                      <option value="">Select Team</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-priority" className="text-right">
                      Default Priority
                    </Label>
                    <select
                      id="edit-priority"
                      value={editFormData.default_priority}
                      onChange={(e) => setEditFormData({ ...editFormData, default_priority: parseInt(e.target.value) })}
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
                    <Label htmlFor="edit-duration" className="text-right">
                      Default Duration (min)
                    </Label>
                    <Input
                      type="number"
                      id="edit-duration"
                      value={editFormData.default_duration}
                      onChange={(e) => setEditFormData({ ...editFormData, default_duration: parseInt(e.target.value) || 0 })}
                      className="col-span-3"
                      min="1"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="edit-instructions" className="text-right pt-2">
                      Instructions
                    </Label>
                    <textarea
                      id="edit-instructions"
                      value={editFormData.instructions}
                      onChange={(e) => setEditFormData({ ...editFormData, instructions: e.target.value })}
                      className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
                      placeholder="Enter detailed instructions for tasks created from this template..."
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-enabled" className="text-right">
                      Status
                    </Label>
                    <div className="col-span-3 flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="edit-enabled"
                        checked={editFormData.enabled}
                        onChange={(e) => setEditFormData({ ...editFormData, enabled: e.target.checked })}
                        className="rounded"
                      />
                      <Label htmlFor="edit-enabled" className="text-sm">
                        {editFormData.enabled ? 'Enabled' : 'Disabled'}
                      </Label>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  {error && (
                    <div className="text-sm text-destructive mb-2 text-left">
                      {error}
                    </div>
                  )}
                  <Button type="submit" disabled={isSubmitting || !editFormData.name.trim()}>
                    {isSubmitting ? (
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    ) : (
                      <FontAwesomeIcon icon={faEdit} className="mr-2" />
                    )}
                    {isSubmitting ? 'Updating...' : 'Update Template'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Template Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={handleCloseDeleteDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faTrash} className="text-destructive" />
                  <span>Delete Template</span>
                </DialogTitle>
                <DialogDescription>
                  {deletingTemplate && (() => {
                    const taskCount = getTemplateTaskCount(deletingTemplate.id);
                    
                    if (taskCount > 0) {
                      return (
                        <div className="space-y-2">
                          <p>This template cannot be deleted because it's used by {taskCount} task{taskCount !== 1 ? 's' : ''}.</p>
                          <p className="text-sm text-muted-foreground">
                            Please delete or reassign all tasks using this template before attempting to delete it.
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="space-y-2">
                          <p>Are you sure you want to delete the template "{deletingTemplate.name}"?</p>
                          <p className="text-sm text-muted-foreground">
                            This action cannot be undone.
                          </p>
                        </div>
                      );
                    }
                  })()}
                </DialogDescription>
              </DialogHeader>
              
              {deletingTemplate && (
                <div className="py-4">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <FontAwesomeIcon 
                        icon={faFileAlt} 
                        className="w-5 h-5 text-blue-500"
                      />
                      <div>
                        <div className="font-medium">{deletingTemplate.name}</div>
                        <div className="text-sm text-muted-foreground">{deletingTemplate.description}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge 
                            variant="outline" 
                            style={{ 
                              borderColor: PRIORITY_MAP[deletingTemplate.default_priority as keyof typeof PRIORITY_MAP]?.color,
                              color: PRIORITY_MAP[deletingTemplate.default_priority as keyof typeof PRIORITY_MAP]?.color 
                            }}
                          >
                            {PRIORITY_MAP[deletingTemplate.default_priority as keyof typeof PRIORITY_MAP]?.label}
                          </Badge>
                          <Badge 
                            variant={deletingTemplate.enabled ? "default" : "secondary"} 
                            className={`text-xs ${deletingTemplate.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                          >
                            {deletingTemplate.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {getTemplateTaskCount(deletingTemplate.id)} task{getTemplateTaskCount(deletingTemplate.id) !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                {error && (
                  <div className="text-sm text-destructive mb-2 text-left">
                    {error}
                  </div>
                )}
                <Button variant="outline" onClick={handleCloseDeleteDialog}>
                  Cancel
                </Button>
                {deletingTemplate && getTemplateTaskCount(deletingTemplate.id) === 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={deleteTemplate}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    ) : (
                      <FontAwesomeIcon icon={faTrash} className="mr-2" />
                    )}
                    {isSubmitting ? 'Deleting...' : 'Delete Template'}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      {/* Search and Grid */}
      <div className="space-y-4">
        <Input
          placeholder="Search templates..."
          className="w-full max-w-md"
          onChange={(e) => handleSearch(e.target.value)}
        />
        
        <div className="ag-theme-quartz h-[400px] w-full">
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={colDefs}
            onGridReady={onGridReady}
            suppressColumnVirtualisation={true}
            animateRows={true}
            rowHeight={50}
            headerHeight={40}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true
            }}
            noRowsOverlayComponent={() => (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No templates found</p>
              </div>
            )}
          />
        </div>
      </div>

      <Separator />

      {/* Stats Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Template Statistics</CardTitle>
          <CardDescription>Overview of your template management</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{templates.length}</div>
              <div className="text-sm text-muted-foreground">Total Templates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {templates.filter(template => template.enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">Enabled Templates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {templates.filter(template => !template.enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">Disabled Templates</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Templates;

