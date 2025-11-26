import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faPlus, faFileAlt, faTags, faChartBar, faSpinner, faExclamationTriangle, faCheckCircle, faClock, faShieldAlt, faFilePdf, faTrash } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Template, Task, Category, Approval } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import { iconService } from '@/database/iconService';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UrlTabs } from "@/components/ui/url-tabs";
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
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';

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
  const dispatch = useDispatch();
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: priorities } = useSelector((state: RootState) => state.priorities);
  const { value: slas } = useSelector((state: RootState) => state.slas);
  const { value: approvals } = useSelector((state: RootState) => (state as any).approvals || { value: [] });
  const { value: requirements } = useSelector((state: RootState) => (state as any).complianceRequirements || { value: [] });
  const { value: mappings } = useSelector((state: RootState) => (state as any).complianceMappings || { value: [] });
  const { value: spots } = useSelector((state: RootState) => (state as any).spots || { value: [] });
  const { value: users } = useSelector((state: RootState) => (state as any).users || { value: [] });
  // State for default users (using string IDs for MultiSelect)
  const [createDefaultUserValues, setCreateDefaultUserValues] = useState<string[]>([]);
  const [editDefaultUserValues, setEditDefaultUserValues] = useState<string[]>([]);

  // Statistics state
  const [statsLoading, setStatsLoading] = useState(false);
  const [statistics, setStatistics] = useState<{
    totalTemplates: number;
    withDefaultSpot: number;
    withDefaultUsers: number;
    withExpectedDuration: number;
    mostUsedTemplates: Array<{ template: Template; count: number }>;
    urgentTasksCount: number;
    tasksWithApprovalsCount: number;
    latestTasks: Task[];
    templatesByCategory: Array<{ category: Category; count: number }>;
    tasksOverTime: Array<{ date: string; count: number }>;
  } | null>(null);

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

  // Local state for form values
  const [createFormData, setCreateFormData] = useState({
    category_id: '',
    priority_id: '',
    sla_id: '',
    approval_id: '',
    default_spot_id: '',
    spots_not_applicable: false,
    expected_duration: '',
    enabled: true
  });

  const [editFormData, setEditFormData] = useState({
    category_id: '',
    priority_id: '',
    sla_id: '',
    approval_id: '',
    default_spot_id: '',
    spots_not_applicable: false,
    expected_duration: '',
    enabled: true
  });

  useEffect(() => {
    dispatch(genericActions.complianceRequirements.fetchFromAPI());
    dispatch(genericActions.complianceMappings.fetchFromAPI());
  }, [dispatch]);

  useEffect(() => {
    if (isEditDialogOpen && editingTemplate) {
      const ids = Array.isArray((editingTemplate as any).default_user_ids)
        ? (editingTemplate as any).default_user_ids.map((id: number) => String(id))
        : [];
      setEditDefaultUserValues(ids);

      // Validate that priority belongs to category (safety check)
      const categoryId = editingTemplate.category_id;
      const priorityId = (editingTemplate as any).priority_id;
      let validPriorityId = priorityId?.toString() || '';
      
      if (categoryId && priorityId) {
        const categoryPriorities = (priorities as any[]).filter((p: any) => p.category_id === categoryId);
        const isValidPriority = categoryPriorities.find((p: any) => p.id === priorityId);
        if (!isValidPriority) {
          // Priority doesn't belong to category, reset it
          validPriorityId = '';
        }
      }

      // Set form data values
      setEditFormData({
        category_id: categoryId?.toString() || '',
        priority_id: validPriorityId,
        sla_id: (editingTemplate as any).sla_id?.toString() || '',
        approval_id: (editingTemplate as any).approval_id?.toString() || '',
        default_spot_id: (editingTemplate as any).default_spot_id?.toString() || '',
        spots_not_applicable: (editingTemplate as any).spots_not_applicable === true,
        expected_duration: (editingTemplate as any).expected_duration != null ? String((editingTemplate as any).expected_duration) : '',
        enabled: (editingTemplate as any).enabled !== false // Default to true if not set
      });
    }
  }, [isEditDialogOpen, editingTemplate, priorities]);

  // Compliance Handlers
  const [selectedRequirement, setSelectedRequirement] = useState('');

  const templateMappings = useMemo(() => {
    if (!editingTemplate) return [];
    return mappings.filter((m: any) => 
      m.mapped_entity_type === 'App\\Models\\Template\\Template' && 
      Number(m.mapped_entity_id) === Number(editingTemplate.id)
    );
  }, [mappings, editingTemplate]);

  const handleAddMapping = async () => {
    if (!selectedRequirement || !editingTemplate) return;
    try {
      await dispatch(genericActions.complianceMappings.addAsync({
        requirement_id: selectedRequirement,
        entity_type: 'template',
        entity_id: editingTemplate.id,
        justification: 'Mapped via Template Settings'
      }) as any);
      setSelectedRequirement('');
    } catch (error) {
      console.error('Failed to add mapping:', error);
    }
  };

  const handleRemoveMapping = async (mappingId: number) => {
    try {
      await dispatch(genericActions.complianceMappings.removeAsync(mappingId) as any);
    } catch (error) {
      console.error('Failed to remove mapping:', error);
    }
  };

  const handleDownloadSOP = () => {
    if (!editingTemplate) return;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const token = localStorage.getItem('token'); // Assuming token is stored here
    
    // Construct URL with auth token if needed, or handle via a fetch with blob
    // For simplicity, assuming browser handles download with a direct link if auth allows or via signed URL
    // Since API is protected, we might need to fetch blob.
    
    fetch(`${baseUrl}/compliance/documents/sop/${editingTemplate.id}/download`, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/pdf'
        }
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `SOP-${editingTemplate.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    })
    .catch(err => console.error('SOP Download failed', err));
  };

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

  // Track active tab to calculate stats when statistics tab is selected
  const [activeTab, setActiveTab] = useState<string>('templates');
  const isCalculatingRef = useRef(false);

  // Calculate statistics
  const calculateStatistics = useCallback(async () => {
    // Prevent concurrent calculations
    if (isCalculatingRef.current) return;
    
    isCalculatingRef.current = true;
    setStatsLoading(true);
    
    // Simulate async calculation (in case of large datasets)
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      const templateTasks = (tasks as Task[]).filter((task: Task) => task.template_id !== null);
      
      // Most used templates
      const templateUsage = new Map<number, number>();
      templateTasks.forEach((task: Task) => {
        if (task.template_id) {
          templateUsage.set(task.template_id, (templateUsage.get(task.template_id) || 0) + 1);
        }
      });
      
      const mostUsedTemplates = Array.from(templateUsage.entries())
        .map(([templateId, count]) => ({
          template: templates.find((t: Template) => t.id === templateId)!,
          count
        }))
        .filter(item => item.template)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Urgent tasks (high priority level - assuming level 4+ is urgent, or check priority name)
      const urgentTasksCount = templateTasks.filter((task: Task) => {
        const priority = (priorities as any[]).find((p: any) => p.id === task.priority_id);
        if (priority?.level && priority.level >= 4) return true;
        if (priority?.name) {
          const nameLower = priority.name.toLowerCase();
          return nameLower.includes('urgent') || nameLower.includes('critical') || nameLower.includes('high');
        }
        return false;
      }).length;

      // Tasks with approvals
      const tasksWithApprovalsCount = templateTasks.filter((task: Task) => 
        task.approval_id !== null && task.approval_id !== undefined
      ).length;

      // Latest tasks (last 10)
      const latestTasks = [...templateTasks]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      // Templates by category
      const categoryCounts = new Map<number, number>();
      templates.forEach((template: Template) => {
        const catId = template.category_id;
        categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
      });

      const templatesByCategory = Array.from(categoryCounts.entries())
        .map(([categoryId, count]) => ({
          category: (categories as Category[]).find((c: Category) => c.id === categoryId)!,
          count
        }))
        .filter(item => item.category)
        .sort((a, b) => b.count - a.count);

      // Tasks over time (last 30 days)
      const now = dayjs();
      const tasksOverTimeMap = new Map<string, number>();
      
      templateTasks.forEach((task: Task) => {
        const date = dayjs(task.created_at).format('YYYY-MM-DD');
        tasksOverTimeMap.set(date, (tasksOverTimeMap.get(date) || 0) + 1);
      });

      const tasksOverTime = Array.from(tasksOverTimeMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // Last 30 days

      setStatistics({
        totalTemplates: templates.length,
        withDefaultSpot: templates.filter((t: any) => t.default_spot_id).length,
        withDefaultUsers: templates.filter((t: any) => Array.isArray(t.default_user_ids) && t.default_user_ids.length > 0).length,
        withExpectedDuration: templates.filter((t: any) => (t.expected_duration ?? 0) > 0).length,
        mostUsedTemplates,
        urgentTasksCount,
        tasksWithApprovalsCount,
        latestTasks,
        templatesByCategory,
        tasksOverTime
      });
    } catch (error) {
      console.error('Error calculating statistics:', error);
    } finally {
      setStatsLoading(false);
      isCalculatingRef.current = false;
    }
  }, [templates, tasks, priorities, categories]);

  useEffect(() => {
    // Reset statistics when switching away from statistics tab
    if (activeTab !== 'statistics') {
      setStatistics(null);
      return;
    }
    
    // Calculate statistics when switching to statistics tab
    if (activeTab === 'statistics' && !isCalculatingRef.current) {
      setStatistics(null); // Clear old stats first
      calculateStatistics();
    }
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Filter priorities by selected category (for create form)
  // Show category priorities first, fall back to global priorities if none exist
  const createCategoryPriorities = useMemo(() => {
    if (!createFormData.category_id) return [];
    const categoryId = parseInt(createFormData.category_id);
    const categoryPriorities = (priorities as any[]).filter((p: any) => p.category_id === categoryId);
    // If no category priorities exist, show global priorities (category_id is null)
    if (categoryPriorities.length === 0) {
      return (priorities as any[]).filter((p: any) => p.category_id === null || p.category_id === undefined);
    }
    return categoryPriorities;
  }, [priorities, createFormData.category_id]);

  // Filter priorities by selected category (for edit form)
  // Show category priorities first, fall back to global priorities if none exist
  const editCategoryPriorities = useMemo(() => {
    if (!editFormData.category_id) return [];
    const categoryId = parseInt(editFormData.category_id);
    const categoryPriorities = (priorities as any[]).filter((p: any) => p.category_id === categoryId);
    // If no category priorities exist, show global priorities (category_id is null)
    if (categoryPriorities.length === 0) {
      return (priorities as any[]).filter((p: any) => p.category_id === null || p.category_id === undefined);
    }
    return categoryPriorities;
  }, [priorities, editFormData.category_id]);

  const slaById = useMemo(() => {
    const map = new Map<number, any>();
    (slas as any[]).forEach((s: any) => map.set(Number(s.id), s));
    return map;
  }, [slas]);

  const approvalById = useMemo(() => {
    const map = new Map<number, any>();
    (approvals as any[]).forEach((a: any) => map.set(Number(a.id), a));
    return map;
  }, [approvals]);

  const spotById = useMemo(() => {
    const map = new Map<number, any>();
    (spots as any[]).forEach((s: any) => map.set(Number(s.id), s));
    return map;
  }, [spots]);

  const renderSlaSummary = (slaId: string | number | null) => {
    const id = Number(slaId);
    if (!id || isNaN(id)) return null;
    const sla = slaById.get(id);
    if (!sla) return null;

    return (
      <div className="bg-muted/30 rounded-md p-3 text-sm space-y-2 border">
        <div className="font-medium flex items-center gap-2 text-primary">
          <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
          <span>SLA Configuration</span>
        </div>
        {sla.description && <div className="text-muted-foreground text-xs">{sla.description}</div>}
        <div className="flex flex-wrap gap-2 mt-2">
           <Badge variant="secondary" className="text-xs">Target: {minutesToHHMM(sla.target_duration)}</Badge>
        </div>
      </div>
    );
  };

  const renderApprovalSummary = (approvalId: string | number | null) => {
    const id = Number(approvalId);
    if (!id || isNaN(id)) return null;
    const approval = approvalById.get(id);
    if (!approval) return null;

    return (
      <div className="bg-muted/30 rounded-md p-3 text-sm space-y-2 border">
        <div className="font-medium flex items-center gap-2 text-primary">
          <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3" />
          <span>Approval Process</span>
        </div>
        {approval.description && <div className="text-muted-foreground text-xs">{approval.description}</div>}
        <div className="flex flex-wrap gap-2 mt-2">
           <Badge variant="secondary" className="text-xs">{approval.approval_type === 'SEQUENTIAL' ? 'Sequential' : 'Parallel'}</Badge>
           <Badge variant="secondary" className="text-xs">Trigger: {approval.trigger_type?.replace(/_/g, ' ').toLowerCase()}</Badge>
           {approval.require_all && <Badge variant="outline" className="text-xs">Requires All</Badge>}
        </div>
      </div>
    );
  };



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
      field: 'approval_id',
      headerName: 'Approval',
      flex: 1,
      minWidth: 160,
      cellRenderer: (params: ICellRendererParams) => {
        const aid = Number(params.value);
        const a = approvalById.get(aid);
        if (!a) return <span className="text-muted-foreground">—</span>;
        return <span>{a.name}</span>;
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
  ], [categories, priorityById, slaById, approvalById, spotById, handleEdit, handleDeleteTemplate]);

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
      approval_id: createFormData.approval_id ? parseInt(createFormData.approval_id) : null,
      default_spot_id: createFormData.spots_not_applicable ? null : (createFormData.default_spot_id ? parseInt(createFormData.default_spot_id) : null),
      spots_not_applicable: createFormData.spots_not_applicable,
      default_user_ids: (Array.isArray(createDefaultUserValues) && createDefaultUserValues.length > 0) ? createDefaultUserValues.map(id => Number(id)) : null,
      instructions,
      expected_duration: (() => { const n = parseInt(expectedDurationRaw || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
      enabled
    };

    await createItem(templateData);

    // Clear any previous error messages after successful creation
    (window as any).__settings_error = null;

    // approvals logic removed

    // Reset form after successful creation
    setCreateFormData({
      category_id: '',
      priority_id: '',
      sla_id: '',
      approval_id: '',
      default_spot_id: '',
      spots_not_applicable: false,
      expected_duration: '',
      enabled: true
    });
    setCreateDefaultUserValues([]);
    // approvals state removed
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
      approval_id: editFormData.approval_id ? parseInt(editFormData.approval_id) : null,
      default_spot_id: editFormData.spots_not_applicable ? null : (editFormData.default_spot_id ? parseInt(editFormData.default_spot_id) : null),
      spots_not_applicable: editFormData.spots_not_applicable,
      default_user_ids: (Array.isArray(editDefaultUserValues) && editDefaultUserValues.length > 0) ? editDefaultUserValues.map(id => Number(id)) : null,
      instructions,
      expected_duration: (() => { const n = parseInt(expectedDurationRaw || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
      enabled: editFormData.enabled
    };

    await updateItem(editingTemplate.id, updates);

    // Clear any previous error messages after successful update
    (window as any).__settings_error = null;

    // approvals logic removed
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
        approval_id: editFormData.approval_id ? parseInt(editFormData.approval_id) : ((editingTemplate as any).approval_id ?? null),
        default_spot_id: editFormData.spots_not_applicable ? null : (editFormData.default_spot_id ? parseInt(editFormData.default_spot_id) : ((editingTemplate as any).default_spot_id ?? null)),
        spots_not_applicable: editFormData.spots_not_applicable,
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
      headerActions={
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Add Template
        </Button>
      }
    >
      <UrlTabs
        tabs={[
          {
            value: "templates",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faClipboardList} className="w-4 h-4" />
                <span>Templates</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage="No templates found"
                    onRowDoubleClicked={handleEdit}
                    onCellValueChanged={handleCellValueChanged}
                  />
                </div>
              </div>
            )
          },
          {
            value: "statistics",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faChartBar} className="w-4 h-4" />
                <span>Statistics</span>
              </div>
            ),
            content: (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                {statsLoading ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
                    <p className="text-sm text-muted-foreground">Calculating statistics...</p>
                  </div>
                ) : statistics ? (
                  <div className="space-y-4">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{statistics.totalTemplates}</div>
                            <div className="text-xs text-muted-foreground mt-1">Total Templates</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{statistics.urgentTasksCount}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faExclamationTriangle} className="w-3 h-3" />
                              Urgent Tasks
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{statistics.tasksWithApprovalsCount}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3" />
                              With Approvals
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{statistics.latestTasks.length}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                              Recent Tasks
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Most Used Templates Chart */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Most Used Templates</CardTitle>
                          <CardDescription className="text-xs">Top templates by task count</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {statistics.mostUsedTemplates.length > 0 ? (
                            <ReactECharts
                              option={{
                                tooltip: {
                                  trigger: 'axis',
                                  axisPointer: { type: 'shadow' }
                                },
                                grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                                xAxis: {
                                  type: 'value',
                                  name: 'Tasks'
                                },
                                yAxis: {
                                  type: 'category',
                                  data: statistics.mostUsedTemplates.map(item => item.template.name).reverse(),
                                  axisLabel: {
                                    formatter: (value: string) => value.length > 20 ? value.substring(0, 20) + '...' : value
                                  }
                                },
                                series: [{
                                  name: 'Tasks Created',
                                  type: 'bar',
                                  data: statistics.mostUsedTemplates.map(item => item.count).reverse(),
                                  itemStyle: {
                                    color: '#3b82f6'
                                  }
                                }]
                              }}
                              style={{ height: '300px' }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                              No template usage data available
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Templates by Category Chart */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Templates by Category</CardTitle>
                          <CardDescription className="text-xs">Distribution across categories</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {statistics.templatesByCategory.length > 0 ? (
                            <ReactECharts
                              option={{
                                tooltip: {
                                  trigger: 'item',
                                  formatter: '{b}: {c} ({d}%)'
                                },
                                legend: {
                                  orient: 'vertical',
                                  left: 'left',
                                  textStyle: { fontSize: 11 }
                                },
                                series: [{
                                  name: 'Templates',
                                  type: 'pie',
                                  radius: ['40%', '70%'],
                                  avoidLabelOverlap: false,
                                  itemStyle: {
                                    borderRadius: 8,
                                    borderColor: '#fff',
                                    borderWidth: 2
                                  },
                                  label: {
                                    show: true,
                                    formatter: '{b}: {c}'
                                  },
                                  emphasis: {
                                    label: {
                                      show: true,
                                      fontSize: 14,
                                      fontWeight: 'bold'
                                    }
                                  },
                                  data: statistics.templatesByCategory.map(item => ({
                                    value: item.count,
                                    name: item.category.name
                                  }))
                                }]
                              }}
                              style={{ height: '300px' }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                              No category data available
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Tasks Over Time Chart */}
                    {statistics.tasksOverTime.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Tasks Created Over Time</CardTitle>
                          <CardDescription className="text-xs">Last 30 days of template-based task creation</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ReactECharts
                            option={{
                              tooltip: {
                                trigger: 'axis',
                                formatter: (params: any) => {
                                  const param = params[0];
                                  return `${param.axisValue}<br/>${param.marker}${param.seriesName}: ${param.value}`;
                                }
                              },
                              grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
                              xAxis: {
                                type: 'category',
                                data: statistics.tasksOverTime.map(item => dayjs(item.date).format('MMM DD')),
                                axisLabel: {
                                  rotate: 45,
                                  fontSize: 10
                                }
                              },
                              yAxis: {
                                type: 'value',
                                name: 'Tasks'
                              },
                              series: [{
                                name: 'Tasks Created',
                                type: 'line',
                                smooth: true,
                                data: statistics.tasksOverTime.map(item => item.count),
                                areaStyle: {
                                  color: {
                                    type: 'linear',
                                    x: 0,
                                    y: 0,
                                    x2: 0,
                                    y2: 1,
                                    colorStops: [
                                      { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                                      { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
                                    ]
                                  }
                                },
                                itemStyle: {
                                  color: '#3b82f6'
                                },
                                lineStyle: {
                                  color: '#3b82f6',
                                  width: 2
                                }
                              }]
                            }}
                            style={{ height: '300px' }}
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Latest Tasks List */}
                    {statistics.latestTasks.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Latest Tasks from Templates</CardTitle>
                          <CardDescription className="text-xs">Most recently created tasks using templates</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {statistics.latestTasks.map((task: Task) => {
                              const template = templates.find((t: Template) => t.id === task.template_id);
                              return (
                                <div key={task.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-accent/50">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{task.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      Template: {template?.name || 'Unknown'} • {dayjs(task.created_at).format('MMM DD, YYYY HH:mm')}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="ml-2">
                                    {getTemplateTaskCount(task.template_id || 0)} total
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Additional Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold">{statistics.withDefaultSpot}</div>
                            <div className="text-xs text-muted-foreground mt-1">With Default Spot</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold">{statistics.withDefaultUsers}</div>
                            <div className="text-xs text-muted-foreground mt-1">With Default Users</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold">{statistics.withExpectedDuration}</div>
                            <div className="text-xs text-muted-foreground mt-1">With Expected Duration</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <p className="text-sm text-muted-foreground">Click the Statistics tab to load statistics</p>
                  </div>
                )}
              </div>
            )
          }
        ]}
        defaultValue="templates"
        basePath="/settings/templates"
        className="h-full flex flex-col"
        onValueChange={setActiveTab}
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
              spots_not_applicable: false,
              expected_duration: '',
              enabled: true
            });
            setCreateDefaultUserValues([]);
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
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
        <div className="grid gap-4 min-h-[480px]">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <Input id="name" name="name" className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">Description</Label>
            <textarea 
              id="description" 
              name="description" 
              className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]" 
            />
          </div>
          <SelectField
            id="category"
            label="Category"
            value={createFormData.category_id}
            onChange={(value) => {
              setCreateFormData(prev => {
                const newCategoryId = value;
                const newCategoryPriorities = newCategoryId 
                  ? (priorities as any[]).filter((p: any) => p.category_id === parseInt(newCategoryId))
                  : [];
                const currentPriority = prev.priority_id ? (priorities as any[]).find((p: any) => p.id === parseInt(prev.priority_id)) : null;
                const isCurrentPriorityGlobal = currentPriority && (currentPriority.category_id === null || currentPriority.category_id === undefined);
                
                // If category has priorities, reset if current priority doesn't belong to category
                // If category has no priorities, keep global priority if current is global
                let shouldResetPriority = false;
                if (prev.priority_id) {
                  if (newCategoryPriorities.length > 0) {
                    // Category has priorities - reset if current priority is not in category
                    shouldResetPriority = !newCategoryPriorities.find((p: any) => p.id === parseInt(prev.priority_id));
                  } else {
                    // Category has no priorities - reset if current priority is not global
                    shouldResetPriority = !isCurrentPriorityGlobal;
                  }
                }
                
                return {
                  ...prev,
                  category_id: value,
                  priority_id: shouldResetPriority ? '' : prev.priority_id
                };
              });
            }}
            placeholder="Select Category"
            options={categories.map((category: Category) => ({
              value: category.id.toString(),
              label: category.name
            }))}
          />
          <SelectField
            id="priority"
            label="Priority"
            value={createFormData.priority_id || 'none'}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, priority_id: value === 'none' ? '' : value }))}
            placeholder="None"
            options={[
              { value: 'none', label: 'None' },
              ...createCategoryPriorities.map((priority: any) => ({
                value: priority.id.toString(),
                label: priority.name,
                color: priority.color || '#6b7280'
              }))
            ]}
          />
        </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[480px]">
              <SelectField
                id="sla"
                label="SLA"
                value={createFormData.sla_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                placeholder="None"
                options={[
                  { value: 'none', label: 'None' },
                  ...Array.from(slaById.entries()).map(([id, sla]) => ({
                    value: String(id),
                    label: sla.name || `${sla.response_time ?? '?'} / ${sla.resolution_time ?? '?' } min`
                  }))
                ]}
              />
              {renderSlaSummary(createFormData.sla_id)}
              <SelectField
                id="approval"
                label="Approval"
                value={createFormData.approval_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                placeholder="None"
                options={[
                  { value: 'none', label: 'None' },
                  ...((approvals as any[]) || []).map((a: any) => ({
                    value: String(a.id),
                    label: a.name
                  }))
                ]}
              />
              {renderApprovalSummary(createFormData.approval_id)}
            </div>
          </TabsContent>
          <TabsContent value="defaults">
            <div className="grid gap-4 min-h-[480px]">
              <CheckboxField 
                id="spots_not_applicable" 
                label="Spots Not Applicable" 
                checked={createFormData.spots_not_applicable}
                onChange={(checked) => {
                  setCreateFormData(prev => ({ 
                    ...prev, 
                    spots_not_applicable: checked,
                    default_spot_id: checked ? '' : prev.default_spot_id // Clear spot if spots not applicable
                  }));
                }}
                description="When enabled, tasks created from this template will not require a location/spot"
              />
              {!createFormData.spots_not_applicable && (
                <SelectField
                  id="default_spot_id"
                  label="Default Spot"
                  value={createFormData.default_spot_id}
                  onChange={(value) => setCreateFormData(prev => ({ ...prev, default_spot_id: value }))}
                  placeholder="None"
                  options={(spots as any[]).map((s: any) => ({ value: s.id.toString(), label: s.name }))}
                />
              )}
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
              spots_not_applicable: false,
              expected_duration: '',
              enabled: true
            });
            setEditDefaultUserValues([]);
          }
        }}
        type="edit"
        title="Edit Template"
        description={editingTemplate ? (
          <span>
            Editing: <span className="font-medium text-foreground">{editingTemplate.name}</span>
          </span>
        ) : "Update the template information."}
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
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
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
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-description" className="text-right pt-2">Description</Label>
              <textarea
                id="edit-description"
                name="description"
                defaultValue={(editingTemplate as any).description || ''}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
              />
            </div>
            <SelectField
              id="edit-category"
              label="Category"
              value={editFormData.category_id}
              onChange={(value) => {
                setEditFormData(prev => {
                  const newCategoryId = value;
                  const newCategoryPriorities = newCategoryId 
                    ? (priorities as any[]).filter((p: any) => p.category_id === parseInt(newCategoryId))
                    : [];
                  const currentPriority = prev.priority_id ? (priorities as any[]).find((p: any) => p.id === parseInt(prev.priority_id)) : null;
                  const isCurrentPriorityGlobal = currentPriority && (currentPriority.category_id === null || currentPriority.category_id === undefined);
                  
                  // If category has priorities, reset if current priority doesn't belong to category
                  // If category has no priorities, keep global priority if current is global
                  let shouldResetPriority = false;
                  if (prev.priority_id) {
                    if (newCategoryPriorities.length > 0) {
                      // Category has priorities - reset if current priority is not in category
                      shouldResetPriority = !newCategoryPriorities.find((p: any) => p.id === parseInt(prev.priority_id));
                    } else {
                      // Category has no priorities - reset if current priority is not global
                      shouldResetPriority = !isCurrentPriorityGlobal;
                    }
                  }
                  
                  return {
                    ...prev,
                    category_id: value,
                    priority_id: shouldResetPriority ? '' : prev.priority_id
                  };
                });
              }}
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
              value={editFormData.priority_id || 'none'}
              onChange={(value) => setEditFormData(prev => ({ ...prev, priority_id: value === 'none' ? '' : value }))}
              placeholder="None"
              options={[
                { value: 'none', label: 'None' },
                ...editCategoryPriorities.map((priority: any) => ({
                  value: priority.id.toString(),
                  label: priority.name,
                  color: priority.color || '#6b7280'
                }))
              ]}
            />
          </div>
            </TabsContent>
            <TabsContent value="rules">
              <div className="grid gap-4 min-h-[480px]">
                <SelectField
                  id="edit-sla"
                  label="SLA"
                  value={editFormData.sla_id}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                  placeholder="None"
                  options={[{ value: 'none', label: 'None' }, ...Array.from(slaById.entries()).map(([id, sla]) => ({ value: id.toString(), label: sla.name || `${sla.response_time ?? '?'} / ${sla.resolution_time ?? '?' } min` }))]}
                />
                {renderSlaSummary(editFormData.sla_id)}
                <SelectField
                  id="edit-approval"
                  label="Approval"
                  value={editFormData.approval_id}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                  placeholder="None"
                  options={[{ value: 'none', label: 'None' }, ...((approvals as Approval[]) || []).map((a: Approval) => ({ value: a.id.toString(), label: a.name }))]}
                />
                {renderApprovalSummary(editFormData.approval_id)}
              </div>
            </TabsContent>
            <TabsContent value="compliance">
              <div className="grid gap-4 min-h-[480px] content-start">
                <div className="flex justify-between items-center pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faShieldAlt} className="text-blue-600" />
                    <h3 className="font-medium">Compliance & ISO</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadSOP}>
                    <FontAwesomeIcon icon={faFilePdf} className="mr-2 text-red-500" />
                    Generate SOP
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>Link Requirement</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SelectField
                          id="requirement-select"
                          label="" // No label needed inside flex
                          value={selectedRequirement}
                          onChange={setSelectedRequirement}
                          placeholder="Select ISO Requirement..."
                          options={requirements.map((r: any) => ({
                            value: String(r.id),
                            label: `${r.clause_number} ${r.title}`
                          }))}
                        />
                      </div>
                      <Button type="button" onClick={handleAddMapping} disabled={!selectedRequirement}>
                        Link
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Linked Requirements</Label>
                    {templateMappings.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md text-center">
                        No requirements linked to this template.
                      </div>
                    ) : (
                      <div className="border rounded-md divide-y">
                        {templateMappings.map((m: any) => {
                          const req = requirements.find((r: any) => r.id === m.requirement_id);
                          return (
                            <div key={m.id} className="p-3 flex justify-between items-center hover:bg-accent/50">
                              <div>
                                <div className="font-medium text-sm">
                                  {req ? `${req.clause_number} ${req.title}` : `Requirement ${m.requirement_id}`}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {req?.description}
                                </div>
                              </div>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => handleRemoveMapping(m.id)}
                                className="text-red-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="defaults">
              <div className="grid gap-4 min-h-[480px]">
                <CheckboxField 
                  id="edit-spots_not_applicable" 
                  label="Spots Not Applicable" 
                  checked={editFormData.spots_not_applicable}
                  onChange={(checked) => {
                    setEditFormData(prev => ({ 
                      ...prev, 
                      spots_not_applicable: checked,
                      default_spot_id: checked ? '' : prev.default_spot_id // Clear spot if spots not applicable
                    }));
                  }}
                  description="When enabled, tasks created from this template will not require a location/spot"
                />
                {!editFormData.spots_not_applicable && (
                  <SelectField 
                    id="edit-default-spot" 
                    label="Default Spot" 
                    value={editFormData.default_spot_id} 
                    onChange={(value) => setEditFormData(prev => ({ ...prev, default_spot_id: value }))} 
                    placeholder="None" 
                    options={(spots as any[]).map((s: any) => ({ value: s.id.toString(), label: s.name }))} 
                  />
                )}
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