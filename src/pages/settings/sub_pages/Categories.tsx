import { useState, useMemo, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTags,
  faPlus,
  faCubes,
  faChartBar,
  faTrash,
  faPen,
  faUsers
} from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from '@/store/genericSlices';
import { Category, Task, Team, StatusTransitionGroup, Sla, Approval } from "@/store/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { iconService } from '@/database/iconService';
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  IconPicker,
  CategoryFieldsManager,
  CategoryReportingTeamsManager,
  TextField,
  SelectField,
  CheckboxField
} from "../components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { useLanguage } from "@/providers/LanguageProvider";
import { celebrateTaskCompletion } from "@/utils/confetti";

// Form data interface for edit form
interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  icon: string;
  enabled: boolean;
  team_id: string;
  workspace_id: string;
  sla_id: string;
  approval_id: string;
  status_transition_group_id: string;
  celebration_effect: string;
}

// Custom cell renderer for category name with icon
const CategoryNameCellRenderer = (props: ICellRendererParams) => {
  const [icon, setIcon] = useState<any>(faTags);
  const categoryIcon = props.data?.icon;
  const categoryColor = props.data?.color || '#6B7280';
  const categoryName = props.value;

  useEffect(() => {
    const loadIcon = async () => {
      if (!categoryIcon) {
        setIcon(faTags);
        return;
      }

      try {
        // Parse FontAwesome icon class (e.g., "fas fa-hat-wizard")
        const iconClasses = categoryIcon.split(' ');
        const iconName = iconClasses[iconClasses.length - 1]; // Get the last part (hat-wizard)

        // Use iconService to load the icon dynamically
        const loadedIcon = await iconService.getIcon(iconName);
        setIcon(loadedIcon || faTags);
      } catch (error) {
        console.error('Error loading category icon:', error);
        setIcon(faTags);
      }
    };

    loadIcon();
  }, [categoryIcon]);

  return (
    <div className="flex items-center space-x-3 h-full">
      <FontAwesomeIcon
        icon={icon}
        className="w-4 h-4"
        style={{ color: categoryColor }}
      />
      <div className="flex flex-col leading-tight">
        <span className={!props.data?.enabled ? "line-through text-muted-foreground" : undefined}>{categoryName}</span>
        {props.data?.description ? (
          <span className={`text-xs truncate ${!props.data?.enabled ? "line-through text-muted-foreground" : "text-muted-foreground"}`}>{props.data.description}</span>
        ) : null}
      </div>
    </div>
  );
};

// Simple badge renderer to show whether a category is enabled
const EnabledCellRenderer = ({ value }: ICellRendererParams & { t: (key: string, fallback: string) => string }) => {
  const isEnabled = Boolean(value);
  const { t } = useLanguage();
  const tc = (key: string, fallback: string) => t(`settings.categories.${key}`, fallback);

  return (
    <Badge
      variant={isEnabled ? "default" : "secondary"}
      className={`text-xs ${isEnabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
    >
      {isEnabled ? tc('grid.values.enabled', 'Enabled') : tc('grid.values.disabled', 'Disabled')}
    </Badge>
  );
};

type CategoryActionsRendererParams = {
  onManageFields: (category: Category) => void;
  getFieldCount: (categoryId: number) => number;
};

const CategoryActionsCellRenderer = (
  props: ICellRendererParams & CategoryActionsRendererParams
) => {
  const { data, onManageFields, getFieldCount } = props;
  const { t } = useLanguage();
  const tc = (key: string, fallback: string) => t(`settings.categories.${key}`, fallback);
  if (!data) return null;
  const category = data as Category;
  const id = Number(category.id);
  const count = getFieldCount(id);
  const label = count > 0 ? tc('grid.actions.fieldsWithCount', `Fields (${count})`).replace('{count}', String(count)) : tc('grid.actions.fields', 'Fields');

  const handleClick = (
    handler: (category: Category) => void,
    event: React.MouseEvent
  ) => {
    event.preventDefault();
    event.stopPropagation();
    // Radix/AG Grid can listen above React; stop the native event too
    (event.nativeEvent as any)?.stopImmediatePropagation?.();
    handler(category);
  };

  return (
    <div className="flex w-full justify-end">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
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
          onClick={(event) => handleClick(onManageFields, event)}
          className="inline-flex h-8 items-center gap-1 rounded-full border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.12)] transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
        >
          <FontAwesomeIcon icon={faCubes} className="h-3 w-3 text-slate-500" />
          {label}
        </button>
      </div>
    </div>
  );
};

function Categories() {
  const dispatch = useDispatch<AppDispatch>();
  const { t } = useLanguage();
  const tc = (key: string, fallback: string) => t(`settings.categories.${key}`, fallback);
  const { value: teams } = useSelector((state: RootState) => state.teams) as { value: Team[] };
  const { value: tasks } = useSelector((state: RootState) => state.tasks) as { value: Task[] };
  const { value: categoryCustomFields } = useSelector((state: RootState) => state.categoryCustomFields) as { value: any[] };
  const statusTransitionGroups = useSelector((s: RootState) => (s as any).statusTransitionGroups.value) as StatusTransitionGroup[];
  const slasState = useSelector((state: RootState) => (state as any).slas) as { value?: Sla[] } | undefined;
  const slas: Sla[] = slasState?.value ?? [];
  const approvalsState = useSelector((state: RootState) => (state as any).approvals) as { value?: Approval[] } | undefined;
  const approvals: Approval[] = approvalsState?.value ?? [];
  const workspacesState = useSelector((state: RootState) => (state as any).workspaces) as { value?: any[] } | undefined;
  const workspaces: any[] = workspacesState?.value ?? [];

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
    setFormError,
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

 

  // Form state for create dialog
  const [createFormData, setCreateFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: 'fas fa-tags',
    enabled: true,
    team_id: '',
    workspace_id: '',
    sla_id: '',
    approval_id: '',
    status_transition_group_id: '',
    celebration_effect: ''
  });

  // Form state for edit dialog
  const [editFormData, setEditFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: 'fas fa-tags',
    enabled: true,
    team_id: '',
    workspace_id: '',
    sla_id: '',
    approval_id: '',
    status_transition_group_id: '',
    celebration_effect: ''
  });

  // Reporting teams state - now comes directly from category's reporting_team_ids
  const [savingReportingTeams, setSavingReportingTeams] = useState(false);
  const [reportingTeamsError, setReportingTeamsError] = useState<string | null>(null);

  // Load reporting teams from category directly
  const loadReportingTeamsForEdit = useCallback(() => {
    if (!editingCategory) return;
    setSelectedReportingTeamIds(editingCategory.reporting_team_ids || []);
    setReportingTeamsError(null);
  }, [editingCategory]);

  // Update edit form data when editing category changes
  useEffect(() => {
    if (editingCategory) {
      setEditFormData({
        name: editingCategory.name || '',
        description: editingCategory.description || '',
        color: editingCategory.color || '#4ECDC4',
        icon: editingCategory.icon || 'fas fa-tags',
        enabled: editingCategory.enabled ?? true,
        team_id: editingCategory.team_id?.toString() || '',
        workspace_id: (editingCategory as any).workspace_id?.toString() || '',
        sla_id: editingCategory.sla_id?.toString() || '',
        approval_id: (editingCategory as any).approval_id?.toString?.() || '',
        status_transition_group_id: editingCategory.status_transition_group_id?.toString() || '',
        celebration_effect: editingCategory.celebration_effect || ''
      });
      // Load reporting teams when editing category changes - dispatch Redux action
      loadReportingTeamsForEdit();
    }
  }, [editingCategory, loadReportingTeamsForEdit]);

  // Handle toggle team for reporting teams
  const handleToggleReportingTeam = (teamId: number) => {
    setSelectedReportingTeamIds(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  // Save reporting teams - uses category update
  const handleSaveReportingTeams = async () => {
    if (!editingCategory) return;
    setSavingReportingTeams(true);
    setReportingTeamsError(null);
    try {
      await dispatch(genericActions.categories.updateAsync({
        id: editingCategory.id,
        updates: { reporting_team_ids: selectedReportingTeamIds }
      })).unwrap();
    } catch (e: any) {
      console.error('Error saving reporting teams', e);
      setReportingTeamsError(e?.message || 'Failed to save reporting teams');
    } finally {
      setSavingReportingTeams(false);
    }
  };

  // Manage Fields dialog state
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false);
  const [fieldsCategory, setFieldsCategory] = useState<Category | null>(null);

  // Manage Reporting Teams dialog state
  const [isReportingTeamsDialogOpen, setIsReportingTeamsDialogOpen] = useState(false);
  const [reportingTeamsCategory, setReportingTeamsCategory] = useState<Category | null>(null);
  
  // Reporting teams state for inline tab (temporary UI state synced with Redux)
  const [selectedReportingTeamIds, setSelectedReportingTeamIds] = useState<number[]>([]);

  // Sync selectedReportingTeamIds when editingCategory changes
  useEffect(() => {
    if (editingCategory) {
      setSelectedReportingTeamIds(editingCategory.reporting_team_ids || []);
      setReportingTeamsError(null);
    }
  }, [editingCategory]);

  const assignmentCountByCategory = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    (categoryCustomFields as any[]).forEach((a) => {
      const cid = Number((a as any)?.category_id ?? (a as any)?.categoryId);
      if (!Number.isFinite(cid)) return;
      map[cid] = (map[cid] || 0) + 1;
    });
    return map;
  }, [categoryCustomFields]);

  const openManageFields = (category: Category) => {
    setFieldsCategory(category);
    setIsFieldsDialogOpen(true);
  };

  const closeManageFields = () => {
    setIsFieldsDialogOpen(false);
    setFieldsCategory(null);
  };

  const openManageReportingTeams = (category: Category) => {
    setReportingTeamsCategory(category);
    setIsReportingTeamsDialogOpen(true);
  };

  const closeManageReportingTeams = () => {
    setIsReportingTeamsDialogOpen(false);
    setReportingTeamsCategory(null);
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

  const handleDeleteFromEdit = () => {
    if (!editingCategory) return;
    setIsEditDialogOpen(false);
    handleDeleteCategory(editingCategory);
  };

  // Derived statistics for charts
  const enabledCategoriesCount = useMemo(
    () => categories.filter((cat: Category) => cat.enabled).length,
    [categories]
  );

  const disabledCategoriesCount = useMemo(
    () => categories.filter((cat: Category) => !cat.enabled).length,
    [categories]
  );

  const tasksByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    (tasks as Task[]).forEach((task: Task) => {
      const cid = task.category_id;
      if (!cid) return;
      counts.set(cid, (counts.get(cid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([categoryId, count]) => {
        const category = categories.find((c: Category) => c.id === categoryId);
        return category ? { category, count } : null;
      })
      .filter(
        (item): item is { category: Category; count: number } => !!item
      )
      .sort((a, b) => b.count - a.count);
  }, [tasks, categories]);

  const categoriesByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    categories.forEach((cat: Category) => {
      const tid = (cat as any).team_id as number | null | undefined;
      if (!tid) return;
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([teamId, count]) => {
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? { team, count } : null;
      })
      .filter(
        (item): item is { team: Team; count: number } => !!item
      )
      .sort((a, b) => b.count - a.count);
  }, [categories, teams]);

  const tasksOverTime = useMemo(() => {
    const map = new Map<string, number>();
    (tasks as Task[]).forEach((task: Task) => {
      if (!task.created_at) return;
      const date = dayjs(task.created_at).format("YYYY-MM-DD");
      map.set(date, (map.get(date) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [tasks]);

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: tc('grid.columns.categoryName', 'Category Name'),
      flex: 4,
      minWidth: 350,
      cellRenderer: CategoryNameCellRenderer
    },
    // Description column removed; description now shown under name
    // Fields column removed per request
    {
      field: 'team_id',
      headerName: tc('grid.columns.team', 'Team'),
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => {
        const teamId = params.value;

        if (!teamId) {
          return <span className="text-muted-foreground">{tc('grid.values.noTeam', 'No Team')}</span>;
        }

        const team = teams.find((t: any) => t.id === teamId);

        return (
          <div className="flex items-center space-x-2">
            <div 
              className="w-6 h-6 min-w-[1.5rem] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
              style={{ backgroundColor: team?.color ?? '#6B7280' }}
            >
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
      field: 'sla_id',
      headerName: tc('grid.columns.sla', 'SLA'),
      flex: 1.2,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams) => {
        const slaId = params.value as number | null | undefined;
        if (!slaId) {
          return '' as any;
        }
        const sla = slas.find((s: Sla) => s.id === Number(slaId));
        return <span>{sla?.name || `SLA ${slaId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'approval_id',
      headerName: tc('grid.columns.approval', 'Approval'),
      flex: 1.2,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams) => {
        const approvalId = params.value as number | null | undefined;
        if (!approvalId) {
          return '' as any;
        }
        const approval = approvals.find((a: Approval) => a.id === Number(approvalId));
        return <span>{approval?.name || `Approval ${approvalId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'status_transition_group_id',
      headerName: tc('grid.columns.statusTransitionGroup', 'Status Transition Group'),
      flex: 1.5,
      minWidth: 200,
      cellRenderer: (params: ICellRendererParams) => {
        const groupId = params.value as number | null | undefined;
        if (!groupId) {
          return <span className="text-muted-foreground">{tc('grid.values.unassigned', 'Unassigned')}</span>;
        }
        const group = statusTransitionGroups.find((g: any) => g.id === Number(groupId));
        return <span>{group?.name || `Group ${groupId}`}</span>;
      },
      sortable: true,
      filter: true
    },
    {
      field: 'enabled',
      headerName: tc('grid.columns.status', 'Status'),
      flex: 0.8,
      minWidth: 120,
      cellRenderer: (params: ICellRendererParams) => <EnabledCellRenderer {...params} t={t} />,
      sortable: true,
      filter: true
    },
    {
      headerName: tc('grid.columns.actions', 'Actions'),
      colId: 'actions',
      minWidth: 240,
      suppressSizeToFit: true,
      cellRenderer: CategoryActionsCellRenderer,
      cellRendererParams: {
        onManageFields: openManageFields,
        getFieldCount: (id: number) => assignmentCountByCategory[Number(id)] || 0
      },
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [teams, slas, approvals, statusTransitionGroups, handleEdit, assignmentCountByCategory, openManageFields, tc, t]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Clear any previous errors
      setFormError(null);

      if (!createFormData.team_id) {
        const errorMessage = tc('validation.teamRequired', 'Please select a team for this category.');
        setFormError(errorMessage);
        return;
      }
      
      // Determine status_transition_group_id - use selected one or default
      let statusTransitionGroupId: number;
      if (!createFormData.status_transition_group_id) {
        if (statusTransitionGroups.length === 0) {
          const errorMessage = tc('validation.transitionGroupNotAvailable', 'No status transition groups are available. Please create a status transition group first.');
          setFormError(errorMessage);
          return;
        }
        // Find default group or use first available
        const defaultGroup = statusTransitionGroups.find((g: StatusTransitionGroup) => g.is_default);
        statusTransitionGroupId = defaultGroup ? defaultGroup.id : statusTransitionGroups[0].id;
      } else {
        statusTransitionGroupId = parseInt(createFormData.status_transition_group_id);
      }

      const categoryData = {
        name: createFormData.name,
        description: createFormData.description,
        color: createFormData.color,
        icon: createFormData.icon,
        enabled: createFormData.enabled,
        team_id: parseInt(createFormData.team_id),
        workspace_id: createFormData.workspace_id ? parseInt(createFormData.workspace_id) : 1,
        sla_id: createFormData.sla_id ? parseInt(createFormData.sla_id) : null,
        approval_id: createFormData.approval_id ? parseInt(createFormData.approval_id) : null,
        status_transition_group_id: statusTransitionGroupId,
        celebration_effect: createFormData.celebration_effect || null,
        deleted_at: null
      };
      await createItem(categoryData);

      // Reset form after successful creation
      setCreateFormData({
        name: '',
        description: '',
        color: '#4ECDC4',
        icon: 'fas fa-tags',
        enabled: true,
        team_id: '',
        workspace_id: '',
        sla_id: '',
        approval_id: '',
        status_transition_group_id: '',
        celebration_effect: ''
      });
    } catch (err: any) {
      // Errors from createItem are already handled by useSettingsState
      // This catch is for any unexpected errors
      const errorMessage = err?.message || tc('validation.genericError', 'An error occurred while creating the category.');
      setFormError(errorMessage);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;

    const updates = {
      name: editFormData.name,
      description: editFormData.description,
      color: editFormData.color,
      icon: editFormData.icon,
      enabled: editFormData.enabled,
      team_id: editFormData.team_id ? parseInt(editFormData.team_id) : 0,
      workspace_id: editFormData.workspace_id ? parseInt(editFormData.workspace_id) : 1,
      sla_id: editFormData.sla_id ? parseInt(editFormData.sla_id) : null,
      approval_id: editFormData.approval_id ? parseInt(editFormData.approval_id) : null,
      status_transition_group_id: editFormData.status_transition_group_id ? parseInt(editFormData.status_transition_group_id) : undefined,
      reporting_team_ids: selectedReportingTeamIds,
      celebration_effect: editFormData.celebration_effect || null
    };
    await updateItem(editingCategory.id, updates);
  };

  // Render entity preview for delete dialog
  const renderCategoryPreview = (category: Category) => {
    const [icon, setIcon] = useState<any>(faTags);

    useEffect(() => {
      const loadIcon = async () => {
        if (!category.icon) {
          setIcon(faTags);
          return;
        }

        try {
          // Parse FontAwesome icon class (e.g., "fas fa-hat-wizard")
          const iconClasses = category.icon.split(' ');
          const iconName = iconClasses[iconClasses.length - 1]; // Get the last part (hat-wizard)

          // Use iconService to load the icon dynamically
          const loadedIcon = await iconService.getIcon(iconName);
          setIcon(loadedIcon || faTags);
        } catch (error) {
          console.error('Error loading category preview icon:', error);
          setIcon(faTags);
        }
      };

      loadIcon();
    }, [category.icon]);

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
            {category.team_id && (() => {
              const team = teams.find((t: Team) => t.id === category.team_id);
              return (
                <div className="flex items-center space-x-1">
                  <div 
                    className="w-4 h-4 min-w-[1rem] text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
                    style={{ backgroundColor: team?.color ?? '#6B7280' }}
                  >
                    {team?.name?.charAt(0).toUpperCase() || 'T'}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {team?.name || `Team ${category.team_id}`}
                  </span>
                </div>
              );
            })()}
            <Badge
              variant={category.enabled ? "default" : "secondary"}
              className={`text-xs ${category.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
            >
              {category.enabled ? tc('grid.values.enabled', 'Enabled') : tc('grid.values.disabled', 'Disabled')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {getCategoryTaskCount(category.id)} {getCategoryTaskCount(category.id) !== 1 ? tc('preview.tasks', 'tasks') : tc('preview.task', 'task')}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <SettingsLayout
      title={tc('title', 'Categories')}
      description={tc('description', 'Manage task categories and labels for better organization')}
      icon={faTags}
      iconColor="#ef4444"
      loading={{
        isLoading: loading,
        message: tc('loading', 'Loading categories...')
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <div className="flex items-center space-x-2">
          <Link to="/settings/categories/custom-fields">
            <Button variant="outline" className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring">
              {tc('header.manageFields', 'Manage custom fields')}
            </Button>
          </Link>
          <Button 
            onClick={() => setIsCreateDialogOpen(true)}
            size="default"
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4 mr-2" />
            <span>{tc('header.addCategory', 'Add Category')}</span>
          </Button>
        </div>
      }
    >
      <UrlTabs
        tabs={[
          {
            value: "categories",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faTags} className="w-4 h-4" />
                <span>{tc('tabs.categories', 'Categories')}</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage={tc('grid.noRows', 'No categories found')}
                    rowSelection="single"
                    onRowDoubleClicked={(row: any) => handleEdit(row)}
                    gridOptions={{
                      getRowStyle: (params: any) => {
                        const isEnabled = Boolean(params?.data?.enabled);
                        if (!isEnabled) {
                          return { opacity: 0.6 } as any;
                        }
                        return undefined as any;
                      }
                    }}
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
                <span>{tc('tabs.statistics', 'Statistics')}</span>
              </div>
            ),
            content: (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                <div className="space-y-4">
                  {/* Summary cards */}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold">{categories.length}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {tc('stats.cards.total', 'Total Categories')}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">
                            {enabledCategoriesCount}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {tc('stats.cards.enabled', 'Enabled Categories')}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">
                            {disabledCategoriesCount}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {tc('stats.cards.disabled', 'Disabled Categories')}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Charts row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {tc('stats.charts.tasksByCategory.title', 'Tasks by Category')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {tc('stats.charts.tasksByCategory.description', 'Distribution of tasks across categories')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {tasksByCategory.length > 0 ? (
                          <ReactECharts
                            option={{
                              tooltip: {
                                trigger: "item",
                                formatter: "{b}: {c} ({d}%)"
                              },
                              legend: {
                                orient: "vertical",
                                left: "left",
                                textStyle: { fontSize: 11 }
                              },
                              series: [
                                {
                                  name: tc('stats.charts.tasksByCategory.series', 'Tasks'),
                                  type: "pie",
                                  radius: ["40%", "70%"],
                                  avoidLabelOverlap: false,
                                  itemStyle: {
                                    borderRadius: 8,
                                    borderColor: "#fff",
                                    borderWidth: 2
                                  },
                                  label: {
                                    show: true,
                                    formatter: "{b}: {c}"
                                  },
                                  emphasis: {
                                    label: {
                                      show: true,
                                      fontSize: 14,
                                      fontWeight: "bold"
                                    }
                                  },
                                  data: tasksByCategory.map((item) => ({
                                    value: item.count,
                                    name: item.category.name,
                                    itemStyle: {
                                      color: item.category.color || "#6b7280"
                                    }
                                  }))
                                }
                              ]
                            }}
                            style={{ height: "300px" }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                            {tc('stats.charts.tasksByCategory.empty', 'No task data available')}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {tc('stats.charts.categoriesByTeam.title', 'Categories by Team')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {tc('stats.charts.categoriesByTeam.description', 'How categories are distributed across teams')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {categoriesByTeam.length > 0 ? (
                          <ReactECharts
                            option={{
                              tooltip: {
                                trigger: "axis",
                                axisPointer: { type: "shadow" }
                              },
                              grid: {
                                left: "3%",
                                right: "4%",
                                bottom: "3%",
                                containLabel: true
                              },
                              xAxis: {
                                type: "value",
                                name: tc('stats.charts.categoriesByTeam.axis', 'Categories')
                              },
                              yAxis: {
                                type: "category",
                                data: categoriesByTeam
                                  .map((item) => item.team.name)
                                  .reverse(),
                                axisLabel: {
                                  formatter: (value: string) =>
                                    value.length > 20
                                      ? value.substring(0, 20) + "..."
                                      : value
                                }
                              },
                              series: [
                                {
                                  name: tc('stats.charts.categoriesByTeam.axis', 'Categories'),
                                  type: "bar",
                                  data: categoriesByTeam
                                    .map((item) => ({
                                      value: item.count,
                                      itemStyle: {
                                        color:
                                          item.team.color || "#3b82f6"
                                      }
                                    }))
                                    .reverse()
                                }
                              ]
                            }}
                            style={{ height: "300px" }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                            {tc('stats.charts.categoriesByTeam.empty', 'No team data available')}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tasks over time */}
                  {tasksOverTime.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-sm">
                          {tc('stats.charts.tasksOverTime.title', 'Tasks Over Time')}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {tc('stats.charts.tasksOverTime.description', 'Last 30 days of task creation across categories')}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <ReactECharts
                          option={{
                            tooltip: {
                              trigger: "axis",
                              formatter: (params: any) => {
                                const param = params[0];
                                return `${param.axisValue}<br/>${param.marker}${param.seriesName}: ${param.value}`;
                              }
                            },
                            grid: {
                              left: "3%",
                              right: "4%",
                              bottom: "3%",
                              containLabel: true
                            },
                            xAxis: {
                              type: "category",
                              data: tasksOverTime.map((item) =>
                                dayjs(item.date).format("MMM DD")
                              ),
                              axisLabel: {
                                rotate: 45,
                                fontSize: 10
                              }
                            },
                            yAxis: {
                              type: "value",
                              name: tc('stats.charts.tasksOverTime.axis', 'Tasks')
                            },
                            series: [
                              {
                                name: tc('stats.charts.tasksOverTime.series', 'Tasks Created'),
                                type: "line",
                                smooth: true,
                                data: tasksOverTime.map(
                                  (item) => item.count
                                ),
                                areaStyle: {
                                  color: {
                                    type: "linear",
                                    x: 0,
                                    y: 0,
                                    x2: 0,
                                    y2: 1,
                                    colorStops: [
                                      {
                                        offset: 0,
                                        color:
                                          "rgba(59, 130, 246, 0.3)"
                                      },
                                      {
                                        offset: 1,
                                        color:
                                          "rgba(59, 130, 246, 0.05)"
                                      }
                                    ]
                                  }
                                },
                                itemStyle: {
                                  color: "#3b82f6"
                                },
                                lineStyle: {
                                  color: "#3b82f6",
                                  width: 2
                                }
                              }
                            ]
                          }}
                          style={{ height: "300px" }}
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )
          }
        ]}
        defaultValue="categories"
        basePath="/settings/categories"
        className="h-full flex flex-col"
      />

      {/* Search Input - Original Location */}
      <div className="mb-4">
        <input
          type="text"
          placeholder={tc('search.placeholder', 'Search categories...')}
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            handleSearch(e.target.value);
          }}
          className="w-full max-w-md px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
        />
      </div>

      {/* Create Category Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title={tc('dialogs.create.title', 'Add New Category')}
        description={tc('dialogs.create.description', 'Add a new category to organize your tasks.')}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
            <FontAwesomeIcon icon={faTags} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{tc('dialogs.create.helper.title', 'Create category')}</p>
            <p className="text-xs text-muted-foreground">
              {tc('dialogs.create.helper.description', 'Set general details and rules (SLA, approval, transitions) across two tabs.')}
            </p>
          </div>
        </div>
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{tc('dialogs.create.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="rules">{tc('dialogs.create.tabs.rules', 'Rules')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[320px]">
              <TextField
                id="name"
                label={tc('fields.name', 'Name')}
                value={createFormData.name}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, name: value }))}
                required
              />
              <TextField
                id="description"
                label={tc('fields.description', 'Description')}
                value={createFormData.description}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, description: value }))}
              />
              <TextField
                id="color"
                label={tc('fields.color', 'Color')}
                type="color"
                value={createFormData.color}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, color: value }))}
              />
              <IconPicker
                id="icon"
                label={tc('fields.icon', 'Icon')}
                value={createFormData.icon}
                onChange={(iconClass) => setCreateFormData(prev => ({ ...prev, icon: iconClass }))}
                color={createFormData.color}
                required
              />
              <SelectField
                id="team"
                label={tc('fields.team', 'Team')}
                value={createFormData.team_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, team_id: value }))}
                placeholder={tc('fields.placeholders.noTeam', 'No Team')}
                options={teams.map((team: Team) => ({
                  value: team.id.toString(),
                  label: team.name
                }))}
                required
              />
              <SelectField
                id="workspace"
                label={tc('fields.workspace', 'Workspace')}
                value={createFormData.workspace_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, workspace_id: value }))}
                placeholder={tc('fields.placeholders.selectWorkspace', 'Select Workspace')}
                options={(workspaces as any[]).filter((w: any) => w.type === 'DEFAULT').map((workspace: any) => ({
                  value: workspace.id.toString(),
                  label: workspace.name
                }))}
                required
              />
              <CheckboxField
                id="enabled"
                label={tc('fields.status', 'Status')}
                checked={createFormData.enabled}
                onChange={(checked) => setCreateFormData(prev => ({ ...prev, enabled: checked }))}
                description={tc('fields.enabled', 'Enabled')}
              />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[320px]">
              <SelectField
                id="sla"
                label={tc('fields.sla', 'SLA')}
                value={createFormData.sla_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                placeholder={tc('fields.placeholders.selectSla', 'Select SLA…')}
                options={[{ value: 'none', label: tc('fields.placeholders.none', 'None') }, ...(slas as Sla[]).map((s: Sla) => ({
                  value: s.id.toString(),
                  label: s.name
                }))]}
              />
              <SelectField
                id="approval"
                label={tc('fields.approval', 'Approval')}
                value={createFormData.approval_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                placeholder={tc('fields.placeholders.selectApproval', 'Select approval…')}
                options={[{ value: 'none', label: tc('fields.placeholders.none', 'None') }, ...(approvals as Approval[]).map((a: Approval) => ({
                  value: a.id.toString(),
                  label: a.name
                }))]}
              />
              <SelectField
                id="status-group"
                label={tc('fields.statusTransitionGroup', 'Status Transition Group')}
                value={createFormData.status_transition_group_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, status_transition_group_id: value }))}
                placeholder={tc('fields.placeholders.selectGroup', 'Select group…')}
                options={statusTransitionGroups.map((g: StatusTransitionGroup) => ({
                  value: g.id.toString(),
                  label: g.name
                }))}
                required
              />
              <SelectField
                id="celebration-effect"
                label={tc('fields.celebrationEffect', 'Task Completion Celebration')}
                value={createFormData.celebration_effect}
                onChange={(value) => {
                  setCreateFormData(prev => ({ ...prev, celebration_effect: value === 'default' ? '' : value }));
                  // Preview selection immediately. "default" previews the global setting.
                  celebrateTaskCompletion(value === 'default' ? null : value);
                }}
                placeholder={tc('fields.placeholders.selectCelebration', 'Select celebration…')}
                options={[
                  { value: 'default', label: tc('fields.placeholders.useGlobalDefault', 'Use Global Default') },
                  { value: 'confetti', label: tc('fields.celebration.confetti', 'Confetti') },
                  { value: 'fireworks', label: tc('fields.celebration.fireworks', 'Fireworks') },
                  { value: 'hearts', label: tc('fields.celebration.hearts', 'Hearts') },
                  { value: 'balloons', label: tc('fields.celebration.balloons', 'Balloons') },
                  { value: 'sparkles', label: tc('fields.celebration.sparkles', 'Sparkles') },
                  { value: 'ribbons', label: tc('fields.celebration.ribbons', 'Ribbons') },
                  { value: 'none', label: tc('fields.celebration.none', 'None') }
                ]}
              />
            </div>
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Edit Category Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title={tc('dialogs.edit.title', 'Edit Category')}
        description={tc('dialogs.edit.description', 'Update the category information.')}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingCategory}
        footerActions={
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={handleDeleteFromEdit}
            disabled={!editingCategory}
            title={tc('dialogs.delete.button', 'Delete')}
            aria-label={tc('dialogs.delete.button', 'Delete')}
          >
            <FontAwesomeIcon icon={faTrash} />
          </Button>
        }
      >
        <div className="rounded-xl bg-gradient-to-r from-sky-50 via-white to-emerald-50 dark:from-sky-900/30 dark:via-slate-900 dark:to-emerald-900/20 border border-sky-100 dark:border-slate-800 px-4 py-3 mb-4 flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/80 dark:bg-slate-800/70 border border-sky-100 dark:border-slate-700 flex items-center justify-center">
            <FontAwesomeIcon icon={faTags} className="text-sky-600 dark:text-sky-300 w-4 h-4" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{tc('dialogs.edit.helper.title', 'Edit category')}</p>
            <p className="text-xs text-muted-foreground">
              {tc('dialogs.edit.helper.description', 'Update details and rules. SLA, approval, and transitions live in the Rules tab.')}
            </p>
          </div>
        </div>
        <Tabs defaultValue="general" className="w-full">
          <TabsList>
            <TabsTrigger value="general">{tc('dialogs.edit.tabs.general', 'General')}</TabsTrigger>
            <TabsTrigger value="rules">{tc('dialogs.edit.tabs.rules', 'Rules')}</TabsTrigger>
            <TabsTrigger value="reporting-teams">{tc('dialogs.edit.tabs.reportingTeams', 'Reporting Teams')}</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 min-h-[320px]">
              <TextField
                id="edit-name"
                label={tc('fields.name', 'Name')}
                value={editFormData.name}
                onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
                required
              />
              <TextField
                id="edit-description"
                label={tc('fields.description', 'Description')}
                value={editFormData.description}
                onChange={(value) => setEditFormData(prev => ({ ...prev, description: value }))}
              />
              <TextField
                id="edit-color"
                label={tc('fields.color', 'Color')}
                type="color"
                value={editFormData.color}
                onChange={(value) => setEditFormData(prev => ({ ...prev, color: value }))}
              />
              <IconPicker
                id="edit-icon"
                label={tc('fields.icon', 'Icon')}
                value={editFormData.icon}
                onChange={(iconClass) => setEditFormData(prev => ({ ...prev, icon: iconClass }))}
                color={editFormData.color}
                required
              />
              <SelectField
                id="edit-team"
                label={tc('fields.team', 'Team')}
                value={editFormData.team_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, team_id: value }))}
                placeholder={tc('fields.placeholders.noTeam', 'No Team')}
                options={teams.map((team: Team) => ({
                  value: team.id.toString(),
                  label: team.name
                }))}
              />
              <SelectField
                id="edit-workspace"
                label={tc('fields.workspace', 'Workspace')}
                value={editFormData.workspace_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, workspace_id: value }))}
                placeholder={tc('fields.placeholders.selectWorkspace', 'Select Workspace')}
                options={(workspaces as any[]).filter((w: any) => w.type === 'DEFAULT').map((workspace: any) => ({
                  value: workspace.id.toString(),
                  label: workspace.name
                }))}
                required
              />
              <CheckboxField
                id="edit-enabled"
                label={tc('fields.status', 'Status')}
                checked={editFormData.enabled}
                onChange={(checked) => setEditFormData(prev => ({ ...prev, enabled: checked }))}
                description={tc('fields.enabled', 'Enabled')}
              />
            </div>
          </TabsContent>
          <TabsContent value="rules">
            <div className="grid gap-4 min-h-[320px]">
              <SelectField
                id="edit-sla"
                label={tc('fields.sla', 'SLA')}
                value={editFormData.sla_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, sla_id: value === 'none' ? '' : value }))}
                placeholder={tc('fields.placeholders.selectSla', 'Select SLA…')}
                options={[{ value: 'none', label: tc('fields.placeholders.none', 'None') }, ...(slas as Sla[]).map((s: Sla) => ({
                  value: s.id.toString(),
                  label: s.name
                }))]}
              />
              <SelectField
                id="edit-approval"
                label={tc('fields.approval', 'Approval')}
                value={editFormData.approval_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, approval_id: value === 'none' ? '' : value }))}
                placeholder={tc('fields.placeholders.selectApproval', 'Select approval…')}
                options={[{ value: 'none', label: tc('fields.placeholders.none', 'None') }, ...(approvals as Approval[]).map((a: Approval) => ({
                  value: a.id.toString(),
                  label: a.name
                }))]}
              />
              <SelectField
                id="edit-status-group"
                label={tc('fields.statusTransitionGroup', 'Status Transition Group')}
                value={editFormData.status_transition_group_id}
                onChange={(value) => setEditFormData(prev => ({ ...prev, status_transition_group_id: value }))}
                placeholder={tc('fields.placeholders.selectGroup', 'Select group…')}
                options={statusTransitionGroups.map((g: StatusTransitionGroup) => ({
                  value: g.id.toString(),
                  label: g.name
                }))}
                required
              />
              <SelectField
                id="edit-celebration-effect"
                label={tc('fields.celebrationEffect', 'Task Completion Celebration')}
                value={editFormData.celebration_effect}
                onChange={(value) => {
                  setEditFormData(prev => ({ ...prev, celebration_effect: value === 'default' ? '' : value }));
                  // Preview selection immediately. "default" previews the global setting.
                  celebrateTaskCompletion(value === 'default' ? null : value);
                }}
                placeholder={tc('fields.placeholders.selectCelebration', 'Select celebration…')}
                options={[
                  { value: 'default', label: tc('fields.placeholders.useGlobalDefault', 'Use Global Default') },
                  { value: 'confetti', label: tc('fields.celebration.confetti', 'Confetti') },
                  { value: 'fireworks', label: tc('fields.celebration.fireworks', 'Fireworks') },
                  { value: 'hearts', label: tc('fields.celebration.hearts', 'Hearts') },
                  { value: 'balloons', label: tc('fields.celebration.balloons', 'Balloons') },
                  { value: 'sparkles', label: tc('fields.celebration.sparkles', 'Sparkles') },
                  { value: 'ribbons', label: tc('fields.celebration.ribbons', 'Ribbons') },
                  { value: 'none', label: tc('fields.celebration.none', 'None') }
                ]}
              />
            </div>
          </TabsContent>
          <TabsContent value="reporting-teams">
            <CategoryReportingTeamsManager
              variant="inline"
              category={editingCategory}
              selectedTeamIds={selectedReportingTeamIds}
              onToggleTeam={handleToggleReportingTeam}
              saving={savingReportingTeams}
              error={reportingTeamsError}
              onSave={handleSaveReportingTeams}
              onReset={loadReportingTeamsForEdit}
              teams={teams}
              hideFooter={true}
            />
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Delete Category Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tc('dialogs.delete.title', 'Delete Category')}
        description={
          deletingCategory ? (() => {
            const taskCount = getCategoryTaskCount(deletingCategory.id);
            
            if (taskCount > 0) {
              return tc('dialogs.delete.restricted', 'This category cannot be deleted because it contains {count} task{plural}. Please reassign or delete all tasks in this category first.')
                .replace('{count}', String(taskCount))
                .replace('{plural}', taskCount !== 1 ? 's' : '');
            } else {
              const hasWorkspace = deletingCategory.workspace_id;
              const baseMessage = tc('dialogs.delete.confirm', 'Are you sure you want to delete the category "{name}"? This action cannot be undone.')
                .replace('{name}', deletingCategory.name);
              
              if (hasWorkspace) {
                const workspaceWarning = tc('dialogs.delete.workspaceWarning', ' Note: The associated workspace will also be deleted.');
                return baseMessage + workspaceWarning;
              }
              
              return baseMessage;
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
      <CategoryReportingTeamsManager
        open={isReportingTeamsDialogOpen}
        onOpenChange={(open) => { if (!open) closeManageReportingTeams(); }}
        category={reportingTeamsCategory}
      />
    </SettingsLayout>
  );
}

export default Categories;
