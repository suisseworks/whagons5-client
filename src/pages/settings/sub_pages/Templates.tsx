import { useMemo, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faPlus, faFileAlt, faTags } from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";
import { Template, Task, Category } from "@/store/types";
import { iconService } from '@/database/iconService';
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
  SelectField,
  CheckboxField
} from "../components";
  import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { MultiSelect } from "@/components/ui/multi-select";

// Custom component for async icon loading in Templates
const CategoryIconRenderer = ({ iconClass }: { iconClass?: string }) => {
  const [icon, setIcon] = useState<any>(faTags);

  useEffect(() => {
    const loadIcon = async () => {
      if (!iconClass) {
        setIcon(faTags);
        return;
      }

      try {
        const parts = iconClass.split(' ');
        const last = parts[parts.length - 1]; // Get the last part (hat-wizard)
        const loadedIcon = await iconService.getIcon(last);
        setIcon(loadedIcon || faTags);
      } catch (error) {
        console.error('Error loading category icon:', error);
        setIcon(faTags);
      }
    };

    loadIcon();
  }, [iconClass]);

  return <FontAwesomeIcon icon={icon} className="w-3.5 h-3.5 mr-1" />;
};

// Custom cell renderer for template name with description (no icon)
const TemplateNameCellRenderer = (props: ICellRendererParams) => {
  const templateName = props.value;
  const description = (props.data as any)?.description as string | undefined;

  return (
    <div className="flex items-center h-full space-x-2">
      <FontAwesomeIcon
        icon={faFileAlt}
        className="w-4 h-4 text-gray-300"
      />
      <div className="flex flex-col justify-center">
        <span className="leading-tight">{templateName}</span>
        {description ? (
          <span className="text-xs text-muted-foreground leading-snug line-clamp-2">{description}</span>
        ) : null}
      </div>
    </div>
  );
};

function Templates() {
  const dispatch = useDispatch<AppDispatch>();
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: priorities } = useSelector((state: RootState) => state.priorities);
  const { value: slas } = useSelector((state: RootState) => state.slas);
  const { value: spots } = useSelector((state: RootState) => (state as any).spots || { value: [] });
  const { value: users } = useSelector((state: RootState) => (state as any).users || { value: [] });
  const approvalTemplates = useSelector((state: RootState) => (state as any).approvalTemplates?.value ?? []) as any[];
  // State for default users (using string IDs for MultiSelect)
  const [createDefaultUserValues, setCreateDefaultUserValues] = useState<string[]>([]);
  const [editDefaultUserValues, setEditDefaultUserValues] = useState<string[]>([]);

  // State for approver users (using string IDs for MultiSelect)
  const [createApproverValues, setCreateApproverValues] = useState<string[]>([]);
  const [editApproverValues, setEditApproverValues] = useState<string[]>([]);

  // Convert users to MultiSelectOption format
  const userOptions = useMemo(() => {
    return (users as any[]).map((user: any) => ({
      label: user?.name || user?.email || `User ${user.id}`,
      value: String(user.id)
    }));
  }, [users]);

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
    searchFields: ['name']
  });

  // Approvals (template-level) state
  const [createRequiresApproval, setCreateRequiresApproval] = useState<boolean>(false);
  const [editRequiresApproval, setEditRequiresApproval] = useState<boolean>(false);

  // Local state for form values
  const [createFormData, setCreateFormData] = useState({
    category_id: '',
    priority_id: '',
    sla_id: '',
    default_spot_id: '',
    expected_duration: '',
    enabled: true
  });

  const [editFormData, setEditFormData] = useState({
    category_id: '',
    priority_id: '',
    sla_id: '',
    default_spot_id: '',
    expected_duration: '',
    enabled: true
  });

  const findCategoryApprovalTemplate = useCallback((categoryId: number | null | undefined) => {
    if (!categoryId) return null;
    return approvalTemplates.find((t: any) => Number(t.category_id) === Number(categoryId) && t.is_default);
  }, [approvalTemplates]);

  useEffect(() => {
    if (isEditDialogOpen && editingTemplate) {
      const ids = Array.isArray((editingTemplate as any).default_user_ids)
        ? (editingTemplate as any).default_user_ids.map((id: number) => String(id))
        : [];
      setEditDefaultUserValues(ids);

      // Set form data values
      setEditFormData({
        category_id: editingTemplate.category_id?.toString() || '',
        priority_id: (editingTemplate as any).priority_id?.toString() || '',
        sla_id: (editingTemplate as any).sla_id?.toString() || '',
        default_spot_id: (editingTemplate as any).default_spot_id?.toString() || '',
        expected_duration: (editingTemplate as any).expected_duration != null ? String((editingTemplate as any).expected_duration) : '',
        enabled: (editingTemplate as any).enabled !== false // Default to true if not set
      });

      // Prefill approvals controls from category default approval template
      const currentCatId = editingTemplate.category_id as number | null | undefined;
      const catTpl = findCategoryApprovalTemplate(currentCatId || undefined);
      const approvers = ((catTpl?.template_config?.approvers as any[]) || [])
        .filter((a: any) => (a?.type === 'user' && typeof a?.value === 'number'))
        .map((a: any) => String(a.value));
      setEditRequiresApproval(!!catTpl?.is_active);
      setEditApproverValues(approvers);
    }
  }, [isEditDialogOpen, editingTemplate, findCategoryApprovalTemplate]);

  // Helper functions
  const minutesToHHMM = (totalMinutes: number | null | undefined) => {
    if (totalMinutes == null || !Number.isFinite(totalMinutes) || Number(totalMinutes) <= 0) return '—';
    const hours = Math.floor(Number(totalMinutes) / 60);
    const minutes = Number(totalMinutes) % 60;
    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    return `${hh}:${mm}`;
  };
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

  // Derived maps
  const priorityById = useMemo(() => {
    const map = new Map<number, { name: string; color?: string | null }>();
    (priorities as any[]).forEach((p: any) => map.set(Number(p.id), { name: p.name, color: p.color }));
    return map;
  }, [priorities]);

  const slaById = useMemo(() => {
    const map = new Map<number, any>();
    (slas as any[]).forEach((s: any) => map.set(Number(s.id), s));
    return map;
  }, [slas]);

  const spotById = useMemo(() => {
    const map = new Map<number, any>();
    (spots as any[]).forEach((s: any) => map.set(Number(s.id), s));
    return map;
  }, [spots]);



  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: 'Template Name',
      flex: 2,
      minWidth: 250,
      cellRenderer: TemplateNameCellRenderer
    },
    // Description removed per migration
    {
      field: 'category_id',
      headerName: 'Category',
      flex: 1,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => {
        const categoryId = Number(params.value);
        const category = (categories as any[]).find((c: any) => Number(c.id) === categoryId);
        if (!category) {
          return <span className="text-muted-foreground">Category {categoryId}</span>;
        }
        const bg = category.color || '#6b7280';

        return (
          <div className="flex items-center h-full">
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: bg, color: '#ffffff' }}
            >
              <CategoryIconRenderer iconClass={category.icon} />
              {category.name}
            </span>
          </div>
        );
      },
      sortable: true,
      filter: true
    },
    {
      field: 'priority_id',
      headerName: 'Priority',
      flex: 0.8,
      minWidth: 140,
      cellRenderer: (params: ICellRendererParams) => {
        const pid = Number(params.value);
        const p = priorityById.get(pid);
        if (!p) return <span className="text-muted-foreground">—</span>;
        return (
          <Badge
            variant="outline"
            style={{ borderColor: p.color || '#6b7280', color: p.color || '#6b7280' }}
          >
            {p.name}
          </Badge>
        );
      },
      sortable: true,
      filter: true
    },
    {
      field: 'sla_id',
      headerName: 'SLA',
      flex: 1,
      minWidth: 160,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => {
        const values = [''].concat(Array.from(slaById.keys()).map((id) => String(id)));
        return { values } as any;
      },
      cellRenderer: (params: ICellRendererParams) => {
        const sid = Number(params.value);
        const s = slaById.get(sid);
        if (!s) return <span className="text-muted-foreground">—</span>;
        const label = s.name || `${s.response_time ?? '?'} / ${s.resolution_time ?? '?' } min`;
        return <span>{label}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'expected_duration',
      headerName: 'Expected Duration',
      flex: 0.8,
      minWidth: 170,
      valueFormatter: (params: any) => {
        const v = params.value;
        if (v == null || v === '' || v === 0) return '—';
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) return '—';
        return minutesToHHMM(n) || '—';
      },
      sortable: true,
      filter: true
    },
    {
      field: 'default_spot_id',
      headerName: 'Default Spot',
      flex: 1,
      minWidth: 170,
      cellRenderer: (params: ICellRendererParams) => {
        const sid = Number(params.value);
        if (!sid) return <span className="text-muted-foreground">—</span>;
        const spot = spotById.get(sid);
        return <span>{spot?.name || `Spot ${sid}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'default_user_ids',
      headerName: 'Default Users',
      flex: 0.8,
      minWidth: 160,
      cellRenderer: (params: ICellRendererParams) => {
        const arr = (params.value as any[]) || [];
        if (!Array.isArray(arr) || arr.length === 0) return <span className="text-muted-foreground">—</span>;
        return <Badge variant="secondary">{arr.length} user{arr.length !== 1 ? 's' : ''}</Badge>;
      },
      sortable: false,
      filter: false
    },
    {
      field: 'requires_approval',
      headerName: 'Requires Approval',
      flex: 0.8,
      minWidth: 140,
      cellRenderer: (params: ICellRendererParams) => {
        const categoryId = Number(params.data?.category_id);
        if (!categoryId) return <span className="text-muted-foreground">—</span>;

        const approvalTemplate = findCategoryApprovalTemplate(categoryId);
        const requiresApproval = approvalTemplate?.is_active || false;

        return (
          <Badge variant={requiresApproval ? "default" : "secondary"}>
            {requiresApproval ? 'Yes' : 'No'}
          </Badge>
        );
      },
      sortable: true,
      filter: true,
      valueGetter: (params: any) => {
        const categoryId = Number(params.data?.category_id);
        if (!categoryId) return false;

        const approvalTemplate = findCategoryApprovalTemplate(categoryId);
        return approvalTemplate?.is_active || false;
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDeleteTemplate
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [categories, priorityById, slaById, spotById, handleEdit, handleDeleteTemplate]);

  // Form handlers
  const handleCellValueChanged = useCallback(async (event: any) => {
    const field = event?.colDef?.field;
    if (field !== 'sla_id') return;
    const id = event?.data?.id;
    if (!id) return;
    const raw = event?.newValue as string | number | null | undefined;
    const value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    try {
      await updateItem(id, { sla_id: value } as any);
    } catch (e) {
      // revert UI if needed; AG Grid keeps the edited value, but store will overwrite on refresh
    }
  }, [updateItem]);
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    // Get form values
    const name = formData.get('name') as string;
    const description = (formData.get('description') as string) || null;
    const instructions = (formData.get('instructions') as string) || null;
    const enabled = formData.get('enabled') === 'on';
    const expectedDurationRaw = formData.get('expected_duration') as string;

    // Validate required fields
    if (!name?.trim()) {
      throw new Error('Template name is required');
    }
    if (!createFormData.category_id) {
      throw new Error('Please select a category');
    }

    const templateData: any = {
      name: name.trim(),
      description,
      category_id: parseInt(createFormData.category_id),
      priority_id: createFormData.priority_id ? parseInt(createFormData.priority_id) : null,
      sla_id: createFormData.sla_id ? parseInt(createFormData.sla_id) : null,
      default_spot_id: createFormData.default_spot_id ? parseInt(createFormData.default_spot_id) : null,
      default_user_ids: (Array.isArray(createDefaultUserValues) && createDefaultUserValues.length > 0) ? createDefaultUserValues.map(id => Number(id)) : null,
      instructions,
      expected_duration: (() => { const n = parseInt(expectedDurationRaw || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
      enabled
    };

    await createItem(templateData);

    // Clear any previous error messages after successful creation
    (window as any).__settings_error = null;

    // Upsert category default approval template if requested
    try {
      const categoryId = parseInt(createFormData.category_id);
      if (Number.isFinite(categoryId)) {
        const existing = findCategoryApprovalTemplate(categoryId);
        if (createRequiresApproval) {
          const payload: any = {
            name: `Default approval for category ${categoryId}`,
            category_id: categoryId,
            template_config: {
              approvers: (createApproverValues || []).map((id) => ({ type: 'user', value: Number(id) }))
            },
            is_active: true,
            is_default: true
          };
          if (existing) {
            await dispatch((genericActions as any).approvalTemplates.updateAsync({ id: existing.id, updates: payload }));
          } else {
            await dispatch((genericActions as any).approvalTemplates.addAsync(payload));
          }
        } else if (existing && existing.is_active) {
          await dispatch((genericActions as any).approvalTemplates.updateAsync({ id: existing.id, updates: { is_active: false } }));
        }
      }
    } catch {}

    // Reset form after successful creation
    setCreateFormData({
      category_id: '',
      priority_id: '',
      sla_id: '',
      default_spot_id: '',
      expected_duration: '',
      enabled: true
    });
    setCreateDefaultUserValues([]);
    setCreateApproverValues([]);
    setCreateRequiresApproval(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    try {
    e.preventDefault();
    if (!editingTemplate) return;

    const formData = new FormData(e.target as HTMLFormElement);

    // Get form values
    const name = (formData.get('name') as string) ?? ((editingTemplate as any)?.name ?? '');
    const description = ((formData.get('description') as string) ?? (editingTemplate as any)?.description ?? null) as any;
    const instructions = ((formData.get('instructions') as string) ?? (editingTemplate as any)?.instructions ?? null) as any;
    // enabled state handled via editFormData.enabled
    const expectedDurationRaw = (formData.get('expected_duration') as string) ?? (((editingTemplate as any)?.expected_duration != null) ? String((editingTemplate as any).expected_duration) : '');

    // Validate required fields
    if (!name?.toString()?.trim()) {
      throw new Error('Template name is required');
    }
    if (!editFormData.category_id) {
      throw new Error('Please select a category');
    }

    const updates: any = {
      name: name.trim(),
      description,
      category_id: parseInt(editFormData.category_id),
      priority_id: editFormData.priority_id ? parseInt(editFormData.priority_id) : null,
      sla_id: editFormData.sla_id ? parseInt(editFormData.sla_id) : null,
      default_spot_id: editFormData.default_spot_id ? parseInt(editFormData.default_spot_id) : null,
      default_user_ids: (Array.isArray(editDefaultUserValues) && editDefaultUserValues.length > 0) ? editDefaultUserValues.map(id => Number(id)) : null,
      instructions,
      expected_duration: (() => { const n = parseInt(expectedDurationRaw || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
      enabled: editFormData.enabled
    };

    await updateItem(editingTemplate.id, updates);

    // Clear any previous error messages after successful update
    (window as any).__settings_error = null;

    // Upsert category default approval template if requested
    try {
      const categoryId = parseInt(editFormData.category_id);
      if (Number.isFinite(categoryId)) {
        const existing = findCategoryApprovalTemplate(categoryId);
        if (editRequiresApproval) {
          const payload: any = {
            name: `Default approval for category ${categoryId}`,
            category_id: categoryId,
            template_config: {
              approvers: (editApproverValues || []).map((id) => ({ type: 'user', value: Number(id) }))
            },
            is_active: true,
            is_default: true
          };
          if (existing) {
            await dispatch((genericActions as any).approvalTemplates.updateAsync({ id: existing.id, updates: payload }));
          } else {
            await dispatch((genericActions as any).approvalTemplates.addAsync(payload));
          }
        } else if (existing && existing.is_active) {
          await dispatch((genericActions as any).approvalTemplates.updateAsync({ id: existing.id, updates: { is_active: false } }));
        }
      }
    } catch {}
    } catch (err: any) {
      console.error('Edit template submit failed:', err);
      // Surface a simple error into the dialog footer
      const msg = (err?.message || 'Update failed');
      (window as any).__settings_error = msg;
    }
  };

  // Fallback: direct save callable from any tab (bypasses form submit quirks)
  const saveEditsDirect = async () => {
    if (!editingTemplate) return;
    try {
      const updates: any = {
        name: (editingTemplate as any).name || '',
        description: (editingTemplate as any).description ?? null,
        category_id: editFormData.category_id ? parseInt(editFormData.category_id) : (editingTemplate as any).category_id,
        priority_id: editFormData.priority_id ? parseInt(editFormData.priority_id) : ((editingTemplate as any).priority_id ?? null),
        sla_id: editFormData.sla_id ? parseInt(editFormData.sla_id) : ((editingTemplate as any).sla_id ?? null),
        default_spot_id: editFormData.default_spot_id ? parseInt(editFormData.default_spot_id) : ((editingTemplate as any).default_spot_id ?? null),
        default_user_ids: (Array.isArray(editDefaultUserValues) && editDefaultUserValues.length > 0) ? editDefaultUserValues.map(id => Number(id)) : null,
        instructions: (editingTemplate as any).instructions ?? null,
        expected_duration: (() => { const raw: any = (document.getElementById('edit-expected_duration') as HTMLInputElement | null)?.value; const n = parseInt(raw || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
        enabled: editFormData.enabled
      };
      await updateItem(editingTemplate.id, updates);

      // Clear any previous error messages after successful update
      (window as any).__settings_error = null;
    } catch (err: any) {
      console.error('Direct save failed:', err);
      (window as any).__settings_error = (err?.message || 'Update failed');
    }
  };

  // expose on window for SettingsDialog fallback
  (window as any).saveEditsDirect = saveEditsDirect;

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
              borderColor: priorityById.get((template as any).priority_id)?.color || '#6b7280',
              color: priorityById.get((template as any).priority_id)?.color || '#6b7280'
            }}
          >
            {priorityById.get((template as any).priority_id)?.name || 'Priority'}
          </Badge>
          {((template as any).expected_duration ?? 0) > 0 ? (
            <Badge variant="secondary" className="text-xs">{minutesToHHMM((template as any).expected_duration)}</Badge>
          ) : null}
          {(template as any).default_spot_id && (
            <Badge variant="secondary" className="text-xs">
              {spotById.get((template as any).default_spot_id)?.name || `Spot ${(template as any).default_spot_id}`}
            </Badge>
          )}
          {Array.isArray((template as any).default_user_ids) && (template as any).default_user_ids.length > 0 && (
            <Badge variant="secondary" className="text-xs">{(template as any).default_user_ids.length} users</Badge>
          )}
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
          { label: "With Default Spot", value: templates.filter((t: any) => t.default_spot_id).length },
          { label: "With Default Users", value: templates.filter((t: any) => Array.isArray(t.default_user_ids) && t.default_user_ids.length > 0).length },
          { label: "With Expected Duration", value: templates.filter((t: any) => (t.expected_duration ?? 0) > 0).length }
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
        onRowDoubleClicked={handleEdit}
        onCellValueChanged={handleCellValueChanged}
      />

      {/* Create Template Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (open) {
            // Clear any error messages when opening create dialog
            (window as any).__settings_error = null;
          } else {
            // Reset form data when closing create dialog
            setCreateFormData({
              category_id: '',
              priority_id: '',
              sla_id: '',
              default_spot_id: '',
              expected_duration: '',
              enabled: true
            });
            setCreateDefaultUserValues([]);
            setCreateApproverValues([]);
          }
        }}
        type="create"
        title="Add New Template"
        description="Create a new task template to standardize your workflows."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
        <div className="grid gap-4 min-h-[480px]">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <Input id="name" name="name" className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Input id="description" name="description" className="col-span-3" />
          </div>
          <SelectField
            id="category"
            label="Category"
            value={createFormData.category_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, category_id: value }))}
            placeholder="Select Category"
            options={categories.map((category: Category) => ({
              value: category.id.toString(),
              label: category.name
            }))}
          />
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="priority" className="text-right">Priority</Label>
            <select
              id="priority"
              name="priority_id"
              className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              defaultValue=""
            >
              <option value="">None</option>
              {Array.from(priorityById.entries()).map(([id, priority]) => (
                <option key={id} value={String(id)}>
                  {priority.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="sla" className="text-right">SLA</Label>
            <select
              id="sla"
              name="sla_id"
              className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
              defaultValue=""
            >
              <option value="">None</option>
              {Array.from(slaById.entries()).map(([id, sla]) => (
                <option key={id} value={String(id)}>
                  {sla.name || `${sla.response_time ?? '?'} / ${sla.resolution_time ?? '?' } min`}
                </option>
              ))}
            </select>
          </div>
        </div>
          </TabsContent>
          <TabsContent value="defaults">
            <div className="grid gap-4 min-h-[480px]">
              <SelectField
                id="default_spot_id"
                label="Default Spot"
                value={createFormData.default_spot_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, default_spot_id: value }))}
                placeholder="None"
                options={(spots as any[]).map((s: any) => ({ value: s.id.toString(), label: s.name }))}
              />
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Default Users</Label>
                <div className="col-span-3">
                  <MultiSelect
                    options={userOptions}
                    onValueChange={setCreateDefaultUserValues}
                    defaultValue={createDefaultUserValues}
                    placeholder="Select default users..."
                    maxCount={5}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expected_duration" className="text-right">Expected Duration (min)</Label>
                <Input id="expected_duration" name="expected_duration" type="number" min="0" step="1" placeholder="e.g. 90" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="instructions" className="text-right pt-2">Instructions</Label>
                <textarea id="instructions" name="instructions" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[120px]" placeholder="Enter detailed instructions..." />
              </div>
              <CheckboxField id="enabled" name="enabled" label="Status" defaultChecked={true} description="Enabled" />
            </div>
          </TabsContent>
          <TabsContent value="approvals">
            <div className="grid gap-4 min-h-[480px]">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Requires approval</Label>
                <div className="col-span-3">
                  <div className="flex items-center gap-3">
                    <input id="create-requires-approval" type="checkbox" checked={createRequiresApproval} onChange={(e) => setCreateRequiresApproval(e.target.checked)} />
                    <span className="text-sm text-muted-foreground">Select approvers for tasks that require approval</span>
                  </div>
                </div>
              </div>
              {createRequiresApproval && (
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Approvers</Label>
                  <div className="col-span-3">
                    <MultiSelect
                      options={userOptions}
                      onValueChange={setCreateApproverValues}
                      defaultValue={createApproverValues}
                      placeholder="Select approvers..."
                      maxCount={5}
                      className="w-full"
                    />
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Edit Template Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (open) {
            // Clear any error messages when opening edit dialog
            (window as any).__settings_error = null;
          } else {
            // Reset form data when closing edit dialog
            setEditFormData({
              category_id: '',
              priority_id: '',
              sla_id: '',
              default_spot_id: '',
              expected_duration: '',
              enabled: true
            });
            setEditDefaultUserValues([]);
            setEditApproverValues([]);
          }
        }}
        type="edit"
        title="Edit Template"
        description="Update the template information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingTemplate}
      >
        {editingTemplate && (
          <Tabs defaultValue="general" className="w-full">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="defaults">Defaults</TabsTrigger>
              <TabsTrigger value="approvals">Approvals</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
          <div className="grid gap-4 min-h-[480px]">
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
                defaultValue={(editingTemplate as any).description || ''}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="edit-expected_duration" className="text-right">Expected Duration (min)</Label>
              <Input
                id="edit-expected_duration"
                name="expected_duration"
              type="number"
              min="0"
              step="1"
              defaultValue={(editingTemplate as any).expected_duration != null ? String((editingTemplate as any).expected_duration) : ''}
                className="col-span-3"
              />
            </div>
            <SelectField
              id="edit-category"
              label="Category"
              value={editFormData.category_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, category_id: value }))}
              placeholder="Select Category"
              options={categories.map((category: Category) => ({
                value: category.id.toString(),
                label: category.name
              }))}
            />
            {/* Team removed per migration */}
            <SelectField
              id="edit-priority"
              label="Priority"
              value={editFormData.priority_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, priority_id: value }))}
              placeholder="None"
              options={Array.from(priorityById.entries()).map(([id, priority]) => ({
                value: id.toString(),
                label: priority.name
              }))}
            />
            <SelectField
              id="edit-sla"
              label="SLA"
              value={editFormData.sla_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
              placeholder="None"
              options={[{ value: 'none', label: 'None' }, ...Array.from(slaById.entries()).map(([id, sla]) => ({ value: id.toString(), label: sla.name || `${sla.response_time ?? '?'} / ${sla.resolution_time ?? '?' } min` }))]}
            />
          </div>
            </TabsContent>
            <TabsContent value="defaults">
              <div className="grid gap-4 min-h-[480px]">
                <SelectField id="edit-default-spot" label="Default Spot" value={editFormData.default_spot_id} onChange={(value) => setEditFormData(prev => ({ ...prev, default_spot_id: value }))} placeholder="None" options={(spots as any[]).map((s: any) => ({ value: s.id.toString(), label: s.name }))} />
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">Default Users</Label>
                  <div className="col-span-3">
                    <MultiSelect
                      options={userOptions}
                      onValueChange={setEditDefaultUserValues}
                      defaultValue={editDefaultUserValues}
                      placeholder="Select default users..."
                      maxCount={5}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-expected_duration" className="text-right">Expected Duration (min)</Label>
                  <Input id="edit-expected_duration" name="expected_duration" type="number" min="0" step="1" defaultValue={(editingTemplate as any).expected_duration != null ? String((editingTemplate as any).expected_duration) : ''} className="col-span-3" />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="edit-instructions" className="text-right pt-2">Instructions</Label>
                  <textarea id="edit-instructions" name="instructions" defaultValue={(editingTemplate as any).instructions || ''} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[120px]" placeholder="Enter detailed instructions..." />
                </div>
                <CheckboxField id="edit-enabled" label="Enabled" checked={editFormData.enabled} onChange={(checked) => setEditFormData(prev => ({ ...prev, enabled: checked }))} description="Enable this template" />
              </div>
            </TabsContent>
            <TabsContent value="approvals">
              <div className="grid gap-4 min-h-[480px]">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Requires approval</Label>
                  <div className="col-span-3">
                    <div className="flex items-center gap-3">
                      <input id="edit-requires-approval" type="checkbox" checked={editRequiresApproval} onChange={(e) => setEditRequiresApproval(e.target.checked)} />
                      <span className="text-sm text-muted-foreground">Select approvers for tasks that require approval</span>
                    </div>
                  </div>
                </div>
                {editRequiresApproval && (
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">Approvers</Label>
                    <div className="col-span-3">
                      <MultiSelect
                        options={userOptions}
                        onValueChange={setEditApproverValues}
                        defaultValue={editApproverValues}
                        placeholder="Select approvers..."
                        maxCount={5}
                        className="w-full"
                      />
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
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