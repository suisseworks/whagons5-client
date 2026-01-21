import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboardList, faPlus, faFileAlt, faTags, faChartBar, faSpinner, faExclamationTriangle, faCheckCircle, faClock, faShieldAlt, faFilePdf, faTrash, faInfoCircle, faLock } from "@fortawesome/free-solid-svg-icons";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { useLanguage } from "@/providers/LanguageProvider";

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
  const isPrivate = (props.data as any)?.is_private === true;
  const isEnabled = (props.data as any)?.enabled !== false; // Default to true if not set

  return (
    <div className="flex items-center h-full space-x-2">
      <FontAwesomeIcon
        icon={faFileAlt}
        className="w-4 h-4 text-gray-300"
      />
      <div className="flex flex-col justify-center flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`leading-tight ${!isEnabled ? 'line-through opacity-60' : ''}`}>{templateName}</span>
          {isPrivate && (
            <FontAwesomeIcon
              icon={faLock}
              className="w-3 h-3 text-muted-foreground"
              title="Private template"
            />
          )}
        </div>
        {description ? (
          <span className="text-xs text-muted-foreground leading-snug line-clamp-2">{description}</span>
        ) : null}
      </div>
    </div>
  );
};

function Templates() {
  const dispatch = useDispatch();
  const { t } = useLanguage();
  const tt = (key: string, fallback: string) => t(`settings.templates.${key}`, fallback);
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
  const [isSummaryDialogOpen, setIsSummaryDialogOpen] = useState(false);
  const [summaryTemplate, setSummaryTemplate] = useState<Template | null>(null);
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
    setFormError,
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
    name: '',
    description: '',
    instructions: '',
    category_id: '',
    priority_id: '',
    sla_id: '',
    approval_id: '',
    default_spot_id: '',
    spots_not_applicable: false,
    expected_duration: '',
    enabled: true,
    is_private: false
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    instructions: '',
    category_id: '',
    priority_id: '',
    sla_id: '',
    approval_id: '',
    default_spot_id: '',
    spots_not_applicable: false,
    expected_duration: '',
    enabled: true,
    is_private: false
  });


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
        name: editingTemplate.name || '',
        description: (editingTemplate as any).description || '',
        instructions: (editingTemplate as any).instructions || '',
        category_id: categoryId?.toString() || '',
        priority_id: validPriorityId,
        sla_id: (editingTemplate as any).sla_id?.toString() || '',
        approval_id: (editingTemplate as any).approval_id?.toString() || '',
        default_spot_id: (editingTemplate as any).default_spot_id?.toString() || '',
        spots_not_applicable: (editingTemplate as any).spots_not_applicable === true,
        expected_duration: (editingTemplate as any).expected_duration != null ? String((editingTemplate as any).expected_duration) : '',
        enabled: (editingTemplate as any).enabled !== false, // Default to true if not set
        is_private: (editingTemplate as any).is_private === true
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
  const secondsToHHMM = (totalSeconds: number | null | undefined) => {
    if (totalSeconds == null || !Number.isFinite(totalSeconds) || Number(totalSeconds) <= 0) return '—';
    const totalMinutes = Math.floor(Number(totalSeconds) / 60);
    return minutesToHHMM(totalMinutes);
  };
  const getTemplateTaskCount = (templateId: number) => {
    return tasks.filter((task: Task) => task.template_id === templateId).length;
  };

  const canDeleteTemplate = (template: Template) => {
    return getTemplateTaskCount(template.id) === 0;
  };

  const openSummary = useCallback((template: Template) => {
    setSummaryTemplate(template);
    setIsSummaryDialogOpen(true);
  }, []);

  const handleCellValueChanged = useCallback(async (event: any) => {
    if (!event?.colDef?.field || !event?.data) return;
    const field = event.colDef.field;
    const id = event?.data?.id;
    if (!id) return;
    if (field === 'sla_id') {
      const raw = event?.newValue as string | number | null | undefined;
      const value = raw === '' || raw === null || raw === undefined ? null : Number(raw);
      await updateItem(id, { sla_id: value } as any);
    }
  }, [updateItem]);

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

  const usageCount = useMemo(() => {
    const tid = Number(summaryTemplate?.id);
    if (!Number.isFinite(tid)) return 0;
    return (tasks as any[]).filter((t: any) => Number((t as any).template_id) === tid).length;
  }, [summaryTemplate, tasks]);

  const summaryDefaultUsers = useMemo(() => {
    const tid = Number(summaryTemplate?.id);
    if (!Number.isFinite(tid)) return [];
    const defaultIds = (summaryTemplate as any)?.default_user_ids || [];
    return (users as any[]).filter((u: any) => defaultIds.includes(u.id));
  }, [summaryTemplate, users]);

  // Compute available category IDs for filter (only categories that have templates)
  const availableCategoryIds = useMemo(() => {
    const categoryIds = new Set<number>();
    templates.forEach((template: Template) => {
      const categoryId = template.category_id;
      if (categoryId != null && categoryId !== undefined && !isNaN(Number(categoryId))) {
        const numId = Number(categoryId);
        if (numId > 0) {
          categoryIds.add(numId);
        }
      }
    });
    // Sort by category name for better UX
    return Array.from(categoryIds).sort((a, b) => {
      const catA = (categories as any[]).find((c: any) => Number(c.id) === a);
      const catB = (categories as any[]).find((c: any) => Number(c.id) === b);
      const nameA = catA?.name || '';
      const nameB = catB?.name || '';
      return nameA.localeCompare(nameB);
    });
  }, [templates, categories]);

  const renderSlaSummary = (slaId: string | number | null) => {
    const id = Number(slaId);
    if (!id || isNaN(id)) return null;
    const sla = slaById.get(id);
    if (!sla) return null;

    return (
      <div className="bg-muted/30 rounded-md p-3 text-sm space-y-2 border">
        <div className="font-medium flex items-center gap-2 text-primary">
          <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
          <span>{tt('dialogs.create.fields.slaConfig', 'SLA Configuration')}</span>
        </div>
        {sla.description && <div className="text-muted-foreground text-xs">{sla.description}</div>}
        <div className="flex flex-wrap gap-2 mt-2">
           <Badge variant="secondary" className="text-xs">{tt('dialogs.create.fields.slaResponse', 'Response')}: {secondsToHHMM((sla as any).response_time)}</Badge>
           <Badge variant="secondary" className="text-xs">{tt('dialogs.create.fields.slaResolution', 'Resolution')}: {secondsToHHMM((sla as any).resolution_time)}</Badge>
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
          <span>{tt('dialogs.create.fields.approvalProcess', 'Approval Process')}</span>
        </div>
        {approval.description && <div className="text-muted-foreground text-xs">{approval.description}</div>}
        <div className="flex flex-wrap gap-2 mt-2">
           <Badge variant="secondary" className="text-xs">{approval.approval_type === 'SEQUENTIAL' ? tt('dialogs.create.fields.approvalSequential', 'Sequential') : tt('dialogs.create.fields.approvalParallel', 'Parallel')}</Badge>
           <Badge variant="secondary" className="text-xs">{tt('dialogs.create.fields.approvalTrigger', 'Trigger')}: {approval.trigger_type?.replace(/_/g, ' ').toLowerCase()}</Badge>
           {approval.require_all && <Badge variant="outline" className="text-xs">{tt('dialogs.create.fields.approvalRequiresAll', 'Requires All')}</Badge>}
        </div>
      </div>
    );
  };



  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: tt('grid.columns.name', 'Template Name'),
      flex: 2,
      minWidth: 250,
      cellRenderer: TemplateNameCellRenderer
    },
    {
      field: 'summary',
      headerName: '',
      width: 70,
      suppressMovable: true,
      cellRenderer: (params: ICellRendererParams) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          data-grid-stop-row-click="true"
          onPointerDown={(e) => {
            // Prevent AG Grid from treating this as a row click (which would open Edit)
            e.preventDefault();
            e.stopPropagation();
            // Radix/AG Grid can listen above React; stop the native event too
            (e.nativeEvent as any)?.stopImmediatePropagation?.();
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.nativeEvent as any)?.stopImmediatePropagation?.();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            (e.nativeEvent as any)?.stopImmediatePropagation?.();
            openSummary(params.data as Template);
          }}
          title={tt('grid.columns.summary', 'Summary')}
          aria-label={tt('grid.columns.summary', 'Summary')}
        >
          <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 text-muted-foreground" />
        </Button>
      ),
    },
    // Description removed per migration
    {
      field: 'category_id',
      headerName: tt('grid.columns.category', 'Category'),
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
      filter: 'agSetColumnFilter',
      filterParams: {
        values: availableCategoryIds,
        valueFormatter: (params: any) => {
          // Display category name in filter dropdown
          if (params.value == null || params.value === undefined || isNaN(Number(params.value))) {
            return '';
          }
          const categoryId = Number(params.value);
          const category = (categories as any[]).find((c: any) => Number(c.id) === categoryId);
          return category?.name || `Category ${categoryId}`;
        },
        searchType: 'match',
        suppressSorting: true,
        suppressSelectAll: true,
        defaultToNothingSelected: true
      }
    },
    {
      field: 'priority_id',
      headerName: tt('grid.columns.priority', 'Priority'),
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
      headerName: tt('grid.columns.sla', 'SLA'),
      flex: 1,
      minWidth: 160,
      editable: true,
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: () => {
        const options = Array.from(slaById.entries()).map(([id, sla]) => ({
          value: String(id),
          text: sla?.name || `${sla?.response_time ?? '?'} / ${sla?.resolution_time ?? '?'} min`,
        }));
        const values = [''].concat(options.map(o => o.value));
        return {
          values,
          formatValue: (val: string) => {
            const match = options.find(o => o.value === val);
            return match?.text || val || '';
          }
        } as any;
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
      headerName: tt('grid.columns.approval', 'Approval'),
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
      headerName: tt('grid.columns.expectedDuration', 'Expected Duration'),
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
      field: 'actions',
      headerName: tt('grid.columns.actions', 'Actions'),
      width: 100,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [categories, priorityById, slaById, approvalById, spotById, handleEdit, handleDeleteTemplate, availableCategoryIds]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); // Clear any previous errors
    
    try {
      // Validate required fields
      if (!createFormData.name?.trim()) {
        const errorMsg = tt('validation.nameRequired', 'Template name is required');
        setFormError(errorMsg);
        return;
      }
      if (!createFormData.category_id) {
        const errorMsg = tt('validation.categoryRequired', 'Please select a category');
        setFormError(errorMsg);
        return;
      }

      const templateData: any = {
        name: createFormData.name.trim(),
        description: createFormData.description || null,
        category_id: parseInt(createFormData.category_id),
        priority_id: createFormData.priority_id ? parseInt(createFormData.priority_id) : null,
        sla_id: createFormData.sla_id ? parseInt(createFormData.sla_id) : null,
        approval_id: createFormData.approval_id ? parseInt(createFormData.approval_id) : null,
        default_spot_id: createFormData.spots_not_applicable ? null : (createFormData.default_spot_id ? parseInt(createFormData.default_spot_id) : null),
        spots_not_applicable: createFormData.spots_not_applicable,
        default_user_ids: (Array.isArray(createDefaultUserValues) && createDefaultUserValues.length > 0) ? createDefaultUserValues.map(id => Number(id)) : null,
        instructions: createFormData.instructions || null,
        expected_duration: (() => { const n = parseInt(createFormData.expected_duration || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
        enabled: createFormData.enabled,
        is_private: createFormData.is_private
      };

      await createItem(templateData);

      // Clear any previous error messages after successful creation
      (window as any).__settings_error = null;

      // approvals logic removed

      // Reset form after successful creation
      setCreateFormData({
        name: '',
        description: '',
        instructions: '',
        category_id: '',
        priority_id: '',
        sla_id: '',
        approval_id: '',
        default_spot_id: '',
        spots_not_applicable: false,
        expected_duration: '',
        enabled: true,
        is_private: false
      });
      setCreateDefaultUserValues([]);
      // approvals state removed
    } catch (err: any) {
      // Handle any unexpected errors
      const errorMsg = err?.message || tt('validation.genericError', 'An error occurred while creating the template');
      setFormError(errorMsg);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null); // Clear any previous errors
    
    if (!editingTemplate) return;

    try {
      // Validate required fields
      if (!editFormData.name?.toString()?.trim()) {
        const errorMsg = tt('validation.nameRequired', 'Template name is required');
        setFormError(errorMsg);
        return;
      }
      if (!editFormData.category_id) {
        const errorMsg = tt('validation.categoryRequired', 'Please select a category');
        setFormError(errorMsg);
        return;
      }

      const updates: any = {
        name: editFormData.name.trim(),
        description: editFormData.description || null,
        category_id: parseInt(editFormData.category_id),
        priority_id: editFormData.priority_id ? parseInt(editFormData.priority_id) : null,
        sla_id: editFormData.sla_id ? parseInt(editFormData.sla_id) : null,
        approval_id: editFormData.approval_id ? parseInt(editFormData.approval_id) : null,
        default_spot_id: editFormData.spots_not_applicable ? null : (editFormData.default_spot_id ? parseInt(editFormData.default_spot_id) : null),
        spots_not_applicable: editFormData.spots_not_applicable,
        default_user_ids: (Array.isArray(editDefaultUserValues) && editDefaultUserValues.length > 0) ? editDefaultUserValues.map(id => Number(id)) : null,
        instructions: editFormData.instructions || null,
        expected_duration: (() => { const n = parseInt(editFormData.expected_duration || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
        enabled: editFormData.enabled,
        is_private: editFormData.is_private
      };

      await updateItem(editingTemplate.id, updates);

      // Clear any previous error messages after successful update
      (window as any).__settings_error = null;

      // approvals logic removed
    } catch (err: any) {
      console.error('Edit template submit failed:', err);
      // Handle validation errors and API errors
      const errorMsg = err?.message || tt('validation.genericError', 'An error occurred while updating the template');
      setFormError(errorMsg);
    }
  };

  // Fallback: direct save callable from any tab (bypasses form submit quirks)
  const saveEditsDirect = async () => {
    if (!editingTemplate) return;
    try {
      const updates: any = {
        name: editFormData.name || '',
        description: editFormData.description ?? null,
        category_id: editFormData.category_id ? parseInt(editFormData.category_id) : (editingTemplate as any).category_id,
        priority_id: editFormData.priority_id ? parseInt(editFormData.priority_id) : ((editingTemplate as any).priority_id ?? null),
        sla_id: editFormData.sla_id ? parseInt(editFormData.sla_id) : ((editingTemplate as any).sla_id ?? null),
        approval_id: editFormData.approval_id ? parseInt(editFormData.approval_id) : ((editingTemplate as any).approval_id ?? null),
        default_spot_id: editFormData.spots_not_applicable ? null : (editFormData.default_spot_id ? parseInt(editFormData.default_spot_id) : ((editingTemplate as any).default_spot_id ?? null)),
        spots_not_applicable: editFormData.spots_not_applicable,
        default_user_ids: (Array.isArray(editDefaultUserValues) && editDefaultUserValues.length > 0) ? editDefaultUserValues.map(id => Number(id)) : null,
        instructions: editFormData.instructions ?? null,
        expected_duration: (() => { const n = parseInt(editFormData.expected_duration || ''); return Number.isFinite(n) && n > 0 ? n : 0; })(),
        enabled: editFormData.enabled,
        is_private: editFormData.is_private
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
      title={tt('title', 'Templates')}
      description={tt('description', 'Manage task templates for faster task creation and standardized workflows')}
      icon={faClipboardList}
      iconColor="#3b82f6"
      search={{
        placeholder: tt('search.placeholder', 'Search templates...'),
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: tt('loading', 'Loading templates...')
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <Button 
          onClick={() => setIsCreateDialogOpen(true)} 
          size="default"
          className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          {tt('header.addTemplate', 'Add Template')}
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
                <span>{tt('tabs.templates', 'Templates')}</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage={tt('grid.noRows', 'No templates found')}
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
                <span>{tt('tabs.statistics', 'Statistics')}</span>
              </div>
            ),
            content: (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                {statsLoading ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
                    <p className="text-sm text-muted-foreground">{tt('stats.calculating', 'Calculating statistics...')}</p>
                  </div>
                ) : statistics ? (
                  <div className="space-y-4">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{statistics.totalTemplates}</div>
                            <div className="text-xs text-muted-foreground mt-1">{tt('stats.totalTemplates', 'Total Templates')}</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{statistics.urgentTasksCount}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faExclamationTriangle} className="w-3 h-3" />
                              {tt('stats.urgentTasks', 'Urgent Tasks')}
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
                              {tt('stats.withApprovals', 'With Approvals')}
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
                              {tt('stats.recentTasks', 'Recent Tasks')}
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
                          <CardTitle className="text-sm">{tt('stats.mostUsed.title', 'Most Used Templates')}</CardTitle>
                          <CardDescription className="text-xs">{tt('stats.mostUsed.description', 'Top templates by task count')}</CardDescription>
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
                                  name: tt('stats.mostUsed.tasks', 'Tasks')
                                },
                                yAxis: {
                                  type: 'category',
                                  data: statistics.mostUsedTemplates.map(item => item.template.name).reverse(),
                                  axisLabel: {
                                    formatter: (value: string) => value.length > 20 ? value.substring(0, 20) + '...' : value
                                  }
                                },
                                series: [{
                                  name: tt('stats.mostUsed.tasksCreated', 'Tasks Created'),
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
                              {tt('stats.mostUsed.empty', 'No template usage data available')}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Templates by Category Chart */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">{tt('stats.byCategory.title', 'Templates by Category')}</CardTitle>
                          <CardDescription className="text-xs">{tt('stats.byCategory.description', 'Distribution across categories')}</CardDescription>
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
                                  name: tt('stats.byCategory.templates', 'Templates'),
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
                              {tt('stats.byCategory.empty', 'No category data available')}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Tasks Over Time Chart */}
                    {statistics.tasksOverTime.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">{tt('stats.overTime.title', 'Tasks Created Over Time')}</CardTitle>
                          <CardDescription className="text-xs">{tt('stats.overTime.description', 'Last 30 days of template-based task creation')}</CardDescription>
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
                                name: tt('stats.overTime.tasks', 'Tasks')
                              },
                              series: [{
                                name: tt('stats.overTime.tasksCreated', 'Tasks Created'),
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
                          <CardTitle className="text-sm">{tt('stats.latest.title', 'Latest Tasks from Templates')}</CardTitle>
                          <CardDescription className="text-xs">{tt('stats.latest.description', 'Most recently created tasks using templates')}</CardDescription>
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
                                      {tt('stats.latest.template', 'Template')}: {template?.name || 'Unknown'} • {dayjs(task.created_at).format('MMM DD, YYYY HH:mm')}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="ml-2">
                                    {getTemplateTaskCount(task.template_id || 0)} {tt('stats.latest.total', 'total')}
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
                            <div className="text-xs text-muted-foreground mt-1">{tt('stats.withDefaultSpot', 'With Default Spot')}</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold">{statistics.withDefaultUsers}</div>
                            <div className="text-xs text-muted-foreground mt-1">{tt('stats.withDefaultUsers', 'With Default Users')}</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold">{statistics.withExpectedDuration}</div>
                            <div className="text-xs text-muted-foreground mt-1">{tt('stats.withExpectedDuration', 'With Expected Duration')}</div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <p className="text-sm text-muted-foreground">{tt('stats.clickToLoad', 'Click the Statistics tab to load statistics')}</p>
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

      {/* Summary Dialog */}
      <Dialog open={isSummaryDialogOpen} onOpenChange={(open) => { setIsSummaryDialogOpen(open); if (!open) setSummaryTemplate(null); }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FontAwesomeIcon icon={faInfoCircle} className="text-sky-600 w-4 h-4" />
              {summaryTemplate?.name || tt('summary.title', 'Template summary')}
            </DialogTitle>
            <DialogDescription>
              {summaryTemplate?.description || tt('summary.description', 'Overview of template configuration')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.category', 'Category')}</div>
              <div className="font-medium">
                {(() => {
                  const c = (categories as any[]).find((cat: any) => Number(cat.id) === Number((summaryTemplate as any)?.category_id));
                  return c?.name || '—';
                })()}
              </div>
            </div>
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.priority', 'Priority')}</div>
              <div className="font-medium">
                {priorityById.get(Number((summaryTemplate as any)?.priority_id))?.name || '—'}
              </div>
            </div>
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.sla', 'SLA')}</div>
              <div className="font-medium">
                {(() => {
                  const s = slaById.get(Number((summaryTemplate as any)?.sla_id));
                  if (!s) return '—';
                  return s.name || `${s.response_time ?? '?'} / ${s.resolution_time ?? '?'} min`;
                })()}
              </div>
            </div>
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.approval', 'Approval')}</div>
              <div className="font-medium">
                {(() => {
                  const a = approvalById.get(Number((summaryTemplate as any)?.approval_id));
                  return a?.name || '—';
                })()}
              </div>
            </div>
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.defaultSpot', 'Default Spot')}</div>
              <div className="font-medium">
                {(() => {
                  const s = spotById.get(Number((summaryTemplate as any)?.default_spot_id));
                  return s?.name || '—';
                })()}
              </div>
            </div>
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.defaultUsers', 'Default Users')}</div>
              <div className="font-medium">
                {summaryDefaultUsers.length > 0
                  ? summaryDefaultUsers.map((u: any) => u.name || `User #${u.id}`).join(', ')
                  : '—'}
              </div>
            </div>
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.expectedDuration', 'Expected Duration')}</div>
              <div className="font-medium">
                {summaryTemplate?.expected_duration ? `${summaryTemplate.expected_duration} min (${minutesToHHMM(summaryTemplate.expected_duration)})` : '—'}
              </div>
            </div>
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.usage', 'Usage')}</div>
              <div className="font-medium">{usageCount}</div>
            </div>
            <div className="p-3 border rounded-lg space-y-1">
              <div className="text-xs text-muted-foreground">{tt('summary.status', 'Status')}</div>
              <div className="font-medium">
                <Badge variant={(summaryTemplate as any)?.enabled ? 'default' : 'outline'}>
                  {(summaryTemplate as any)?.enabled ? tt('summary.enabled', 'Enabled') : tt('summary.disabled', 'Disabled')}
                </Badge>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
              name: '',
              description: '',
              instructions: '',
              category_id: '',
              priority_id: '',
              sla_id: '',
              approval_id: '',
              default_spot_id: '',
              spots_not_applicable: false,
              expected_duration: '',
              enabled: true,
              is_private: false
            });
            setCreateDefaultUserValues([]);
          }
        }}
        type="create"
        title={tt('dialogs.create.title', 'Add New Template')}
        description={tt('dialogs.create.description', 'Create a new task template to standardize your workflows.')}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
      <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
          <FontAwesomeIcon icon={faClipboardList} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{tt('dialogs.create.helper.title', 'Create a template')}</p>
          <p className="text-xs text-muted-foreground">
            {tt('dialogs.create.helper.description', 'Set the basics, defaults, and rules. You can assign approvals, SLA, default spot and users.')}
          </p>
        </div>
      </div>
        <div className="max-h-[75vh] overflow-y-auto pr-1">
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="defaults">Defaults</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
        <div className="grid gap-4 min-h-[320px]">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">{tt('dialogs.create.fields.name', 'Name *')}</Label>
            <Input 
              id="name" 
              name="name" 
              value={createFormData.name}
              onChange={(e) => setCreateFormData(prev => ({ ...prev, name: e.target.value }))}
              className="col-span-3" 
              required 
            />
          </div>
          <div className="grid grid-cols-4 items-start gap-4">
            <Label htmlFor="description" className="text-right pt-2">{tt('dialogs.create.fields.description', 'Description')}</Label>
            <textarea 
              id="description" 
              name="description" 
              value={createFormData.description}
              onChange={(e) => setCreateFormData(prev => ({ ...prev, description: e.target.value }))}
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
            placeholder={tt('dialogs.create.fields.priorityNone', 'None')}
            options={[
              { value: 'none', label: tt('dialogs.create.fields.priorityNone', 'None') },
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
            <div className="grid gap-4 min-h-[320px]">
              <SelectField
                id="sla"
                label={tt('dialogs.create.fields.sla', 'SLA')}
                value={createFormData.sla_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                placeholder={tt('dialogs.create.fields.slaNone', 'None')}
                options={[
                  { value: 'none', label: tt('dialogs.create.fields.slaNone', 'None') },
                  ...Array.from(slaById.entries()).map(([id, sla]) => ({
                    value: String(id),
                    label: sla.name || `${sla.response_time ?? '?'} / ${sla.resolution_time ?? '?' } min`
                  }))
                ]}
              />
              {renderSlaSummary(createFormData.sla_id)}
              <SelectField
                id="approval"
                label={tt('dialogs.create.fields.approval', 'Approval')}
                value={createFormData.approval_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                placeholder={tt('dialogs.create.fields.approvalNone', 'None')}
                options={[
                  { value: 'none', label: tt('dialogs.create.fields.approvalNone', 'None') },
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
            <div className="grid gap-4 min-h-[320px]">
              <CheckboxField 
                id="spots_not_applicable" 
                label={tt('dialogs.create.fields.spotsNotApplicable', 'Spots Not Applicable')}
                checked={createFormData.spots_not_applicable}
                onChange={(checked) => {
                  setCreateFormData(prev => ({ 
                    ...prev, 
                    spots_not_applicable: checked,
                    default_spot_id: checked ? '' : prev.default_spot_id // Clear spot if spots not applicable
                  }));
                }}
                description={tt('dialogs.create.fields.spotsNotApplicableDesc', 'When enabled, tasks created from this template will not require a location/spot')}
              />
              {!createFormData.spots_not_applicable && (
                <SelectField
                  id="default_spot_id"
                  label={tt('dialogs.create.fields.defaultSpot', 'Default Spot')}
                  value={createFormData.default_spot_id}
                  onChange={(value) => setCreateFormData(prev => ({ ...prev, default_spot_id: value }))}
                  placeholder={tt('dialogs.create.fields.defaultSpotNone', 'None')}
                  options={(spots as any[]).map((s: any) => ({ value: s.id.toString(), label: s.name }))}
                />
              )}
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">{tt('dialogs.create.fields.defaultUsers', 'Default Users')}</Label>
                <div className="col-span-3">
                  <MultiSelect
                    options={userOptions}
                    onValueChange={setCreateDefaultUserValues}
                    defaultValue={createDefaultUserValues}
                    placeholder={tt('dialogs.create.fields.defaultUsersPlaceholder', 'Select default users...')}
                    maxCount={5}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="expected_duration" className="text-right">{tt('dialogs.create.fields.expectedDuration', 'Expected Duration (min)')}</Label>
                <Input 
                  id="expected_duration" 
                  name="expected_duration" 
                  type="number" 
                  min="0" 
                  step="1" 
                  value={createFormData.expected_duration}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, expected_duration: e.target.value }))}
                  placeholder={tt('dialogs.create.fields.expectedDurationPlaceholder', 'e.g. 90')} 
                  className="col-span-3" 
                />
              </div>
              <div className="grid grid-cols-4 items-start gap-4">
                <Label htmlFor="instructions" className="text-right pt-2">{tt('dialogs.create.fields.instructions', 'Instructions')}</Label>
                <textarea 
                  id="instructions" 
                  name="instructions" 
                  value={createFormData.instructions}
                  onChange={(e) => setCreateFormData(prev => ({ ...prev, instructions: e.target.value }))}
                  className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[120px]" 
                  placeholder={tt('dialogs.create.fields.instructionsPlaceholder', 'Enter detailed instructions...')} 
                />
              </div>
              <CheckboxField 
                id="enabled" 
                name="enabled" 
                label={tt('dialogs.create.fields.status', 'Status')} 
                checked={createFormData.enabled}
                onChange={(checked) => setCreateFormData(prev => ({ ...prev, enabled: checked }))}
                description={tt('dialogs.create.fields.enabled', 'Enabled')} 
              />
              <CheckboxField 
                id="is_private" 
                label={tt('dialogs.create.fields.privateTemplate', 'Private Template')}
                checked={createFormData.is_private}
                onChange={(checked) => setCreateFormData(prev => ({ ...prev, is_private: checked }))}
                description={tt('dialogs.create.fields.privateTemplateDesc', 'Private templates can only be used by the team that owns the category')}
              />
            </div>
          </TabsContent>
          
        </Tabs>
        </div>
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
              name: '',
              description: '',
              instructions: '',
              category_id: '',
              priority_id: '',
              sla_id: '',
              approval_id: '',
              default_spot_id: '',
              spots_not_applicable: false,
              expected_duration: '',
              enabled: true,
              is_private: false
            });
            setEditDefaultUserValues([]);
          }
        }}
        type="edit"
        title={tt('dialogs.edit.title', 'Edit Template')}
        description={editingTemplate ? (
          <span>
            {tt('dialogs.edit.editing', 'Editing')}: <span className="font-medium text-foreground">{editingTemplate.name}</span>
          </span>
        ) : tt('dialogs.edit.description', 'Update the template information.')}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
      submitDisabled={isSubmitting || !editingTemplate}
      footerActions={editingTemplate ? (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          onClick={() => editingTemplate && handleDeleteTemplate(editingTemplate)}
          disabled={isSubmitting}
          title={tt('dialogs.edit.delete', 'Delete')}
          aria-label={tt('dialogs.edit.delete', 'Delete')}
        >
          <FontAwesomeIcon icon={faTrash} />
        </Button>
      ) : undefined}
      >
      <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
          <FontAwesomeIcon icon={faClipboardList} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{tt('dialogs.edit.helper.title', 'Edit template')}</p>
          <p className="text-xs text-muted-foreground">
            {tt('dialogs.edit.helper.description', 'Update details, defaults, and rules. Approvals, SLA, and defaults can be changed here.')}
          </p>
        </div>
      </div>
        {editingTemplate && (
          <div className="max-h-[75vh] overflow-y-auto pr-1">
          <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{tt('dialogs.edit.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="defaults">{tt('dialogs.edit.tabs.defaults', 'Defaults')}</TabsTrigger>
            <TabsTrigger value="rules">{tt('dialogs.edit.tabs.rules', 'Rules')}</TabsTrigger>
            <TabsTrigger value="compliance">{tt('dialogs.edit.tabs.compliance', 'Compliance')}</TabsTrigger>
          </TabsList>
            <TabsContent value="general">
          <div className="grid gap-4 min-h-[320px]">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">{tt('dialogs.edit.fields.name', 'Name *')}</Label>
              <Input
                id="edit-name"
                name="name"
                value={editFormData.name}
                onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="edit-description" className="text-right pt-2">{tt('dialogs.edit.fields.description', 'Description')}</Label>
              <textarea
                id="edit-description"
                name="description"
                value={editFormData.description}
                onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[80px]"
              />
            </div>
            <SelectField
              id="edit-category"
              label={tt('dialogs.edit.fields.category', 'Category')}
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
              placeholder={tt('dialogs.edit.fields.categoryPlaceholder', 'Select Category')}
              options={categories.map((category: Category) => ({
                value: category.id.toString(),
                label: category.name
              }))}
            />
            {/* Team removed per migration */}
            <SelectField
              id="edit-priority"
              label={tt('dialogs.edit.fields.priority', 'Priority')}
              value={editFormData.priority_id || 'none'}
              onChange={(value) => setEditFormData(prev => ({ ...prev, priority_id: value === 'none' ? '' : value }))}
              placeholder={tt('dialogs.edit.fields.priorityNone', 'None')}
              options={[
                { value: 'none', label: tt('dialogs.edit.fields.priorityNone', 'None') },
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
              <div className="grid gap-4 min-h-[320px]">
                <SelectField
                  id="edit-sla"
                  label={tt('dialogs.edit.fields.sla', 'SLA')}
                  value={editFormData.sla_id}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                  placeholder={tt('dialogs.edit.fields.slaNone', 'None')}
                  options={[{ value: 'none', label: tt('dialogs.edit.fields.slaNone', 'None') }, ...Array.from(slaById.entries()).map(([id, sla]) => ({ value: id.toString(), label: sla.name || `${sla.response_time ?? '?'} / ${sla.resolution_time ?? '?' } min` }))]}
                />
                {renderSlaSummary(editFormData.sla_id)}
                <SelectField
                  id="edit-approval"
                  label={tt('dialogs.edit.fields.approval', 'Approval')}
                  value={editFormData.approval_id}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                  placeholder={tt('dialogs.edit.fields.approvalNone', 'None')}
                  options={[{ value: 'none', label: tt('dialogs.edit.fields.approvalNone', 'None') }, ...((approvals as Approval[]) || []).map((a: Approval) => ({ value: a.id.toString(), label: a.name }))]}
                />
                {renderApprovalSummary(editFormData.approval_id)}
              </div>
            </TabsContent>
            <TabsContent value="compliance">
              <div className="grid gap-4 min-h-[320px] content-start">
                <div className="flex justify-between items-center pb-2 border-b">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faShieldAlt} className="text-blue-600" />
                    <h3 className="font-medium">{tt('dialogs.edit.compliance.title', 'Compliance & ISO')}</h3>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleDownloadSOP}>
                    <FontAwesomeIcon icon={faFilePdf} className="mr-2 text-red-500" />
                    {tt('dialogs.edit.compliance.generateSOP', 'Generate SOP')}
                  </Button>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label>{tt('dialogs.edit.compliance.linkRequirement', 'Link Requirement')}</Label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <SelectField
                          id="requirement-select"
                          label="" // No label needed inside flex
                          value={selectedRequirement}
                          onChange={setSelectedRequirement}
                          placeholder={tt('dialogs.edit.compliance.selectRequirement', 'Select ISO Requirement...')}
                          options={requirements.map((r: any) => ({
                            value: String(r.id),
                            label: `${r.clause_number} ${r.title}`
                          }))}
                        />
                      </div>
                      <Button type="button" onClick={handleAddMapping} disabled={!selectedRequirement}>
                        {tt('dialogs.edit.compliance.link', 'Link')}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{tt('dialogs.edit.compliance.linkedRequirements', 'Linked Requirements')}</Label>
                    {templateMappings.length === 0 ? (
                      <div className="text-sm text-muted-foreground p-4 border border-dashed rounded-md text-center">
                        {tt('dialogs.edit.compliance.noRequirements', 'No requirements linked to this template.')}
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
              <div className="grid gap-4 min-h-[320px]">
                <CheckboxField 
                  id="edit-spots_not_applicable" 
                  label={tt('dialogs.edit.fields.spotsNotApplicable', 'Spots Not Applicable')}
                  checked={editFormData.spots_not_applicable}
                  onChange={(checked) => {
                    setEditFormData(prev => ({ 
                      ...prev, 
                      spots_not_applicable: checked,
                      default_spot_id: checked ? '' : prev.default_spot_id // Clear spot if spots not applicable
                    }));
                  }}
                  description={tt('dialogs.edit.fields.spotsNotApplicableDesc', 'When enabled, tasks created from this template will not require a location/spot')}
                />
                {!editFormData.spots_not_applicable && (
                  <SelectField 
                    id="edit-default-spot" 
                    label={tt('dialogs.edit.fields.defaultSpot', 'Default Spot')}
                    value={editFormData.default_spot_id} 
                    onChange={(value) => setEditFormData(prev => ({ ...prev, default_spot_id: value }))} 
                    placeholder={tt('dialogs.edit.fields.defaultSpotNone', 'None')} 
                    options={(spots as any[]).map((s: any) => ({ value: s.id.toString(), label: s.name }))} 
                  />
                )}
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">{tt('dialogs.edit.fields.defaultUsers', 'Default Users')}</Label>
                  <div className="col-span-3">
                    <MultiSelect
                      options={userOptions}
                      onValueChange={setEditDefaultUserValues}
                      defaultValue={editDefaultUserValues}
                      placeholder={tt('dialogs.edit.fields.defaultUsersPlaceholder', 'Select default users...')}
                      maxCount={5}
                      className="w-full"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-expected_duration" className="text-right">{tt('dialogs.edit.fields.expectedDuration', 'Expected Duration (min)')}</Label>
                  <Input 
                    id="edit-expected_duration" 
                    name="expected_duration" 
                    type="number" 
                    min="0" 
                    step="1" 
                    value={editFormData.expected_duration}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, expected_duration: e.target.value }))}
                    className="col-span-3" 
                  />
                </div>
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label htmlFor="edit-instructions" className="text-right pt-2">{tt('dialogs.edit.fields.instructions', 'Instructions')}</Label>
                  <textarea 
                    id="edit-instructions" 
                    name="instructions" 
                    value={editFormData.instructions}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, instructions: e.target.value }))}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent min-h-[120px]" 
                    placeholder={tt('dialogs.edit.fields.instructionsPlaceholder', 'Enter detailed instructions...')} 
                  />
                </div>
                <CheckboxField id="edit-enabled" label={tt('dialogs.edit.fields.enabled', 'Enabled')} checked={editFormData.enabled} onChange={(checked) => setEditFormData(prev => ({ ...prev, enabled: checked }))} description={tt('dialogs.edit.fields.enabledDesc', 'Enable this template')} />
                <CheckboxField 
                  id="edit-is_private" 
                  label={tt('dialogs.edit.fields.privateTemplate', 'Private Template')}
                  checked={editFormData.is_private}
                  onChange={(checked) => setEditFormData(prev => ({ ...prev, is_private: checked }))}
                  description={tt('dialogs.edit.fields.privateTemplateDesc', 'Private templates can only be used by the team that owns the category')}
                />
              </div>
            </TabsContent>
            
          </Tabs>
          </div>
        )}
      </SettingsDialog>

      {/* Delete Template Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tt('dialogs.delete.title', 'Delete Template')}
        description={
          deletingTemplate ? (() => {
            const taskCount = getTemplateTaskCount(deletingTemplate.id);
            
            if (taskCount > 0) {
              return tt('dialogs.delete.cannotDelete', 'This template cannot be deleted because it\'s used by {count} task{plural}. Please delete or reassign all tasks using this template first.')
                .replace('{count}', String(taskCount))
                .replace('{plural}', taskCount !== 1 ? 's' : '');
            } else {
              return tt('dialogs.delete.confirm', 'Are you sure you want to delete the template "{name}"? This action cannot be undone.')
                .replace('{name}', deletingTemplate.name);
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