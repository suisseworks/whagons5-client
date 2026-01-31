import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiagramProject, faPlus, faChartBar, faSpinner, faExclamationTriangle, faCheckCircle, faClock, faUsers, faLayerGroup, faTrash, faEye, faEyeSlash, faGaugeHigh } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Workspace, Task, Category } from "@/store/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  TextField,
  SelectField,
  PreviewField
} from "../../components";
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { useLanguage } from "@/providers/LanguageProvider";
import { useAuth } from "@/providers/AuthProvider";
import { actionsApi } from "@/api/whagonsActionsApi";

// Custom cell renderer for workspace name with color indicator
const WorkspaceNameCellRenderer = (props: ICellRendererParams) => {
  const workspace = props.data as Workspace;
  const name = props.value;
  const color = workspace.color || '#6B7280';
  const iconClass = workspace.icon || 'fas fa-folder';

  return (
    <div className="flex items-center h-full space-x-3">
      <div 
        className="w-8 h-8 min-w-[2rem] rounded-lg flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        <i className={iconClass}></i>
      </div>
      <div className="flex flex-col justify-center">
        <span className="leading-tight">{name}</span>
        {workspace.description ? (
          <span className="text-xs text-muted-foreground leading-snug line-clamp-1">{workspace.description}</span>
        ) : null}
      </div>
    </div>
  );
};

function Workspaces() {
  const { t } = useLanguage();
  const tw = (key: string, fallback: string) => t(`settings.workspaces.${key}`, fallback);
  const { user, refetchUser, updateUser } = useAuth();
  const location = useLocation();
  
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: teams } = useSelector((state: RootState) => state.teams);
  
  // Get hidden workspace IDs from user settings
  const hiddenWorkspaceIds = useMemo(() => {
    const settings = (user as any)?.settings as any | undefined;
    return new Set((settings?.hiddenWorkspaces || []) as number[]);
  }, [user]);
  
  // Local optimistic state for immediate UI updates
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<Set<number> | null>(null);
  const isTogglingRef = useRef<Set<number>>(new Set());
  const lastUpdateRef = useRef<Set<number> | null>(null);
  
  // Use optimistic state if available, otherwise fall back to user settings
  const effectiveHiddenIds = optimisticHiddenIds ?? hiddenWorkspaceIds;
  
  // Toggle workspace visibility with optimistic updates
  const handleToggleWorkspaceVisibility = useCallback(async (workspaceId: number, e?: React.MouseEvent) => {
    console.log('Toggle visibility clicked for workspace:', workspaceId);
    
    // Prevent any default behavior or event propagation
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Prevent multiple simultaneous toggles for the same workspace
    if (isTogglingRef.current.has(workspaceId)) {
      console.log('Already toggling, ignoring');
      return;
    }
    
    if (!user) {
      console.warn('Cannot toggle workspace visibility: user not loaded');
      return;
    }
    
    try {
      // Mark as toggling
      isTogglingRef.current.add(workspaceId);
      
      // Optimistically update UI immediately
      const currentHidden = new Set(effectiveHiddenIds);
      const wasHidden = currentHidden.has(workspaceId);
      
      console.log('Current state - isHidden:', wasHidden, 'effectiveHiddenIds:', Array.from(effectiveHiddenIds));
      
      if (wasHidden) {
        currentHidden.delete(workspaceId);
      } else {
        currentHidden.add(workspaceId);
      }
      
      const newHiddenSet = new Set(currentHidden);
      
      console.log('New state - hiddenWorkspaces:', Array.from(newHiddenSet));
      
      // Store the expected state for later comparison
      lastUpdateRef.current = newHiddenSet;
      
      // Update optimistic state immediately
      setOptimisticHiddenIds(newHiddenSet);
      console.log('Optimistic state updated');
      
      const newSettings = {
        ...(((user as any).settings || {}) as any),
        hiddenWorkspaces: Array.from(newHiddenSet),
      };
      
      // Update server
      console.log('Sending API request with settings:', newSettings);
      const response = await actionsApi.patch('/users/me', { settings: newSettings });
      console.log('API request successful', response.data);
      
      // Verify the response contains the updated settings
      const updatedUser = response?.data?.data || response?.data;
      console.log('API response user data:', updatedUser);
      console.log('API response settings:', updatedUser?.settings);
      
      if ((updatedUser as any)?.settings?.hiddenWorkspaces) {
        const serverHiddenSet = new Set((((updatedUser as any).settings?.hiddenWorkspaces) || []) as number[]);
        console.log('Server returned hiddenWorkspaces:', Array.from(serverHiddenSet));
        
        // Verify it matches what we sent
        if (serverHiddenSet.size === newHiddenSet.size && 
            Array.from(serverHiddenSet).every(id => newHiddenSet.has(id))) {
          console.log('✅ Server response matches our update');
        } else {
          console.warn('⚠️ Server response does not match our update!', {
            sent: Array.from(newHiddenSet),
            received: Array.from(serverHiddenSet)
          });
        }
      } else {
        console.warn('⚠️ API response does not include hiddenWorkspaces in settings');
        console.log('Full response:', JSON.stringify(response?.data, null, 2));
      }
      
      // Update user state directly from API response without full refetch
      // This avoids the blank screen flash
      if (updatedUser) {
        updateUser(updatedUser);
        console.log('User state updated directly from API response (no refresh)');
      } else {
        // Fallback: if response doesn't have user data, do a silent background refetch
        setTimeout(async () => {
          try {
            await refetchUser();
            console.log('User state updated from background refetch');
          } catch (refetchError) {
            console.warn('Failed to refetch user, but API update succeeded:', refetchError);
          }
        }, 1000); // Delay to avoid immediate refresh
      }
    } catch (error: any) {
      console.error('Failed to update workspace visibility:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      
      // Revert optimistic update on error
      setOptimisticHiddenIds(null);
      lastUpdateRef.current = null;
      
      // Show error without causing page refresh
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      console.error('Error message:', errorMessage);
      // Use a non-blocking error notification instead of alert
      // alert() can sometimes cause issues, so we'll just log it for now
      // You can replace this with a toast notification if available
      alert(`Failed to update workspace visibility: ${errorMessage}`);
    } finally {
      // Remove from toggling set
      isTogglingRef.current.delete(workspaceId);
    }
  }, [user, effectiveHiddenIds, updateUser]);
  
  // Clear optimistic state when user data updates and matches our optimistic state
  
  useEffect(() => {
    if (optimisticHiddenIds && (user as any)?.settings?.hiddenWorkspaces && lastUpdateRef.current) {
      const serverHiddenSet = new Set((((user as any).settings?.hiddenWorkspaces) || []) as number[]);
      const expectedSet = lastUpdateRef.current;
      
      // Only clear if server state matches our expected state
      const setsMatch = serverHiddenSet.size === expectedSet.size && 
          Array.from(serverHiddenSet).every(id => expectedSet.has(id)) &&
          Array.from(expectedSet).every(id => serverHiddenSet.has(id));
      
      if (setsMatch) {
        console.log('Server state matches optimistic state, clearing optimistic state');
        setOptimisticHiddenIds(null);
        lastUpdateRef.current = null;
      } else {
        console.log('Server state does not match optimistic state yet', {
          optimistic: Array.from(optimisticHiddenIds),
          expected: Array.from(expectedSet),
          server: Array.from(serverHiddenSet)
        });
      }
    }
  }, [user, optimisticHiddenIds]);

  // Statistics state
  const [statsLoading, setStatsLoading] = useState(false);
  const [statistics, setStatistics] = useState<{
    totalWorkspaces: number;
    totalTasks: number;
    totalCategories: number;
    totalTeams: number;
    mostActiveWorkspaces: Array<{ workspace: Workspace; taskCount: number; categoryCount: number; teamCount: number }>;
    urgentTasksCount: number;
    tasksWithApprovalsCount: number;
    latestTasks: Task[];
    workspacesByType: Array<{ type: string; count: number }>;
    tasksOverTime: Array<{ date: string; count: number }>;
  } | null>(null);

  // Use shared state management
  const {
    items: workspaces,
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
    editingItem: editingWorkspace,
    deletingItem: deletingWorkspace,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Workspace>({
    entityName: 'workspaces',
    searchFields: ['name', 'description']
  });

  // Local state for form values
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    icon: 'fas fa-folder',
    type: 'standard',
    category_id: null as number | null
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    icon: 'fas fa-folder',
    type: 'standard',
    category_id: null as number | null
  });

  useEffect(() => {
    if (isEditDialogOpen && editingWorkspace) {
      setEditFormData({
        name: editingWorkspace.name || '',
        description: editingWorkspace.description || '',
        color: editingWorkspace.color || '#3b82f6',
        icon: editingWorkspace.icon || 'fas fa-folder',
        type: (editingWorkspace as any).type || 'standard',
        category_id: editingWorkspace.category_id || null
      });
    }
  }, [isEditDialogOpen, editingWorkspace]);

  // Helper functions
  const getWorkspaceTaskCount = (workspaceId: number) => {
    return tasks.filter((task: Task) => task.workspace_id === workspaceId).length;
  };

  const getWorkspaceCategoryCount = (workspaceId: number) => {
    return categories.filter((category: Category) => category.workspace_id === workspaceId).length;
  };

  const getWorkspaceTeamCount = (workspaceId: number) => {
    // Teams might be stored as JSON array in workspace.teams
    const workspace = workspaces.find((w: Workspace) => w.id === workspaceId);
    if (workspace && Array.isArray((workspace as any).teams)) {
      return (workspace as any).teams.length;
    }
    // Fallback: count teams that might be associated with workspace
    return 0;
  };

  const canDeleteWorkspace = (workspace: Workspace) => {
    return getWorkspaceTaskCount(workspace.id) === 0 && getWorkspaceCategoryCount(workspace.id) === 0;
  };

  const handleDeleteWorkspace = (workspace: Workspace) => {
    if (canDeleteWorkspace(workspace)) {
      deleteItem(workspace.id);
    } else {
      handleDelete(workspace);
    }
  };

  const handleDeleteFromEdit = () => {
    if (editingWorkspace) {
      setIsEditDialogOpen(false);
      handleDeleteWorkspace(editingWorkspace);
    }
  };

  // Track active tab to calculate stats when statistics tab is selected
  // Read from URL to ensure proper sync
  const getActiveTabFromUrl = useCallback(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabFromUrl = urlParams.get('tab');
    if (tabFromUrl === 'statistics') return 'statistics';
    if (tabFromUrl === 'dashboard') return 'dashboard';
    return 'workspaces';
  }, [location.search]);
  
  const [activeTab, setActiveTab] = useState<string>(getActiveTabFromUrl());
  const isCalculatingRef = useRef(false);

  // Update activeTab when URL changes
  useEffect(() => {
    const tabFromUrl = getActiveTabFromUrl();
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [location.search, getActiveTabFromUrl, activeTab]);

  // Calculate statistics
  const calculateStatistics = useCallback(async () => {
    // Prevent concurrent calculations
    if (isCalculatingRef.current) {
      console.log('Statistics calculation already in progress, skipping...');
      return;
    }
    
    // Ensure we have data arrays (they might be undefined initially)
    const workspacesArray = Array.isArray(workspaces) ? workspaces : [];
    const tasksArray = Array.isArray(tasks) ? tasks : [];
    const categoriesArray = Array.isArray(categories) ? categories : [];
    const teamsArray = Array.isArray(teams) ? teams : [];
    
    console.log('Starting statistics calculation...', {
      workspacesCount: workspacesArray.length,
      tasksCount: tasksArray.length,
      categoriesCount: categoriesArray.length,
      teamsCount: teamsArray.length
    });
    
    isCalculatingRef.current = true;
    setStatsLoading(true);
    
    // Simulate async calculation
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      // Most active workspaces (by task count)
      const workspaceStats = workspacesArray.map((workspace: Workspace) => ({
        workspace,
        taskCount: tasksArray.filter((task: Task) => task.workspace_id === workspace.id).length,
        categoryCount: categoriesArray.filter((category: Category) => category.workspace_id === workspace.id).length,
        teamCount: (() => {
          const workspaceObj = workspacesArray.find((w: Workspace) => w.id === workspace.id);
          if (workspaceObj && Array.isArray((workspaceObj as any).teams)) {
            return (workspaceObj as any).teams.length;
          }
          return 0;
        })()
      }));

      const mostActiveWorkspaces = [...workspaceStats]
        .sort((a, b) => b.taskCount - a.taskCount)
        .slice(0, 10);

      // Urgent tasks across all workspaces
      const urgentTasksCount = tasksArray.filter((task: Task) => {
        // Check if task is urgent based on priority or due date
        const dueDate = task.due_date ? new Date(task.due_date) : null;
        const now = new Date();
        if (dueDate && dueDate < now) return true; // Overdue
        
        // Check priority level if available
        // This would require priorities data
        return false;
      }).length;

      // Tasks with approvals
      const tasksWithApprovalsCount = tasksArray.filter((task: Task) => 
        task.approval_id !== null && task.approval_id !== undefined
      ).length;

      // Latest tasks (last 10)
      const latestTasks = [...tasksArray]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      // Workspaces by type
      const typeCounts = new Map<string, number>();
      workspacesArray.forEach((workspace: Workspace) => {
        const type = (workspace as any).type || 'standard';
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      });

      const workspacesByType = Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Tasks over time (last 30 days)
      const tasksOverTimeMap = new Map<string, number>();
      
      tasksArray.forEach((task: Task) => {
        const date = dayjs(task.created_at).format('YYYY-MM-DD');
        tasksOverTimeMap.set(date, (tasksOverTimeMap.get(date) || 0) + 1);
      });

      const tasksOverTime = Array.from(tasksOverTimeMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30); // Last 30 days

      const statsData = {
        totalWorkspaces: workspacesArray.length,
        totalTasks: tasksArray.length,
        totalCategories: categoriesArray.length,
        totalTeams: teamsArray.length,
        mostActiveWorkspaces,
        urgentTasksCount,
        tasksWithApprovalsCount,
        latestTasks,
        workspacesByType,
        tasksOverTime
      };
      
      console.log('Statistics calculated successfully:', statsData);
      setStatistics(statsData);
    } catch (error) {
      console.error('Error calculating statistics:', error);
      setStatsLoading(false);
      isCalculatingRef.current = false;
    } finally {
      setStatsLoading(false);
      isCalculatingRef.current = false;
    }
  }, [workspaces, tasks, categories, teams]);

  useEffect(() => {
    console.log('Tab change detected:', { activeTab, loading, isCalculating: isCalculatingRef.current });
    
    // Reset statistics when switching away from statistics tab
    if (activeTab !== 'statistics') {
      setStatistics(null);
      return;
    }
    
    // Calculate statistics when switching to statistics tab
    // Only calculate if not already loading and data is available
    if (activeTab === 'statistics' && !isCalculatingRef.current && !loading) {
      console.log('Triggering statistics calculation...');
      setStatistics(null); // Clear old stats first
      calculateStatistics();
    } else if (activeTab === 'statistics' && loading) {
      console.log('Waiting for data to load before calculating statistics...');
    } else if (activeTab === 'statistics' && isCalculatingRef.current) {
      console.log('Statistics calculation already in progress...');
    }
  }, [activeTab, calculateStatistics, loading]);

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: tw('grid.columns.name', 'Workspace Name'),
      flex: 2,
      minWidth: 250,
      cellRenderer: WorkspaceNameCellRenderer
    },
    {
      field: 'type',
      headerName: tw('grid.columns.type', 'Type'),
      flex: 1,
      minWidth: 120,
      valueGetter: (params) => (params.data as any)?.type || 'standard',
      cellRenderer: (params: ICellRendererParams) => {
        const type = params.value || 'standard';
        return <Badge variant="outline">{type}</Badge>;
      }
    },
    {
      field: 'category_id',
      headerName: tw('grid.columns.category', 'Category'),
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: ICellRendererParams) => {
        const categoryId = Number(params.value);
        if (!categoryId) return <span className="text-muted-foreground">—</span>;
        const category = (categories as Category[]).find((c: Category) => c.id === categoryId);
        return <span>{category?.name || `Category ${categoryId}`}</span>;
      }
    },
    {
      field: 'visibility',
      headerName: tw('grid.columns.visibility', 'Visibility'),
      width: 100,
      cellRenderer: (params: ICellRendererParams) => {
        const workspace = params.data as Workspace;
        const workspaceId = Number(workspace.id);
        const isHidden = effectiveHiddenIds.has(workspaceId);
        return (
          <div className="flex items-center justify-center h-full w-full">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-accent transition-colors cursor-pointer"
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
                console.log('Button clicked for workspace:', workspaceId);
                handleToggleWorkspaceVisibility(workspaceId, e);
              }}
              disabled={!user}
              title={isHidden ? tw('grid.actions.show', 'Show workspace') : tw('grid.actions.hide', 'Hide workspace')}
            >
              <FontAwesomeIcon 
                icon={isHidden ? faEyeSlash : faEye} 
                className={isHidden ? "text-muted-foreground" : "text-primary"}
              />
            </Button>
          </div>
        );
      },
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right',
      suppressMovable: true,
      cellStyle: { display: 'flex', alignItems: 'center', justifyContent: 'center' }
    }
  ], [categories, effectiveHiddenIds, handleToggleWorkspaceVisibility, user, tw]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const name = formData.get('name') as string;
    if (!name?.trim()) {
      throw new Error(tw('validation.nameRequired', 'Workspace name is required'));
    }

    const workspaceData: any = {
      name: name.trim(),
      description: (formData.get('description') as string) || null,
      color: createFormData.color,
      icon: createFormData.icon,
      type: createFormData.type,
      category_id: createFormData.category_id
    };

    await createItem(workspaceData);

    setCreateFormData({
      name: '',
      description: '',
      color: '#3b82f6',
      icon: 'fas fa-folder',
      type: 'standard',
      category_id: null
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace) return;

    const formData = new FormData(e.target as HTMLFormElement);
    const name = (formData.get('name') as string) || editingWorkspace.name;
    
    if (!name?.trim()) {
      throw new Error(tw('validation.nameRequired', 'Workspace name is required'));
    }

    const updates: any = {
      name: name.trim(),
      description: (formData.get('description') as string) || null,
      color: editFormData.color,
      icon: editFormData.icon,
      category_id: editFormData.category_id
    };

    await updateItem(editingWorkspace.id, updates);
  };

  // Render entity preview for delete dialog
  const renderWorkspacePreview = (workspace: Workspace) => (
    <div className="flex items-center space-x-3">
      <div 
        className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
        style={{ backgroundColor: workspace.color || '#3b82f6' }}
      >
        <i className={workspace.icon || 'fas fa-folder'}></i>
      </div>
      <div>
        <div className="font-medium">{workspace.name}</div>
        <div className="text-sm text-muted-foreground">{workspace.description}</div>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-xs text-muted-foreground">
            {getWorkspaceTaskCount(workspace.id)} {tw('dialogs.delete.preview.tasks', 'tasks')}
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {getWorkspaceCategoryCount(workspace.id)} {tw('dialogs.delete.preview.categories', 'categories')}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title={tw('title', 'Workspaces')}
      description={tw('description', 'Manage workspaces to organize your projects and teams')}
      icon={faDiagramProject}
      iconColor="#3b82f6"
      search={{
        placeholder: tw('search.placeholder', 'Search workspaces...'),
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: tw('loading', 'Loading workspaces...')
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <Button 
          onClick={() => setIsCreateDialogOpen(true)} 
          size="default"
          className="bg-primary/80 backdrop-blur-sm text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          {tw('header.addWorkspace', 'Add Workspace')}
        </Button>
      }
    >
      <UrlTabs
        tabs={[
          {
            value: "workspaces",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faDiagramProject} className="w-4 h-4" />
                <span>{tw('tabs.workspaces', 'Workspaces')}</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage={tw('grid.noRows', 'No workspaces found')}
                    onRowDoubleClicked={handleEdit}
                    gridOptions={{
                      suppressRowClickSelection: true,
                      suppressCellFocus: true
                    }}
                  />
                </div>
              </div>
            )
          },
          {
            value: "dashboard",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faGaugeHigh} className="w-4 h-4" />
                <span>{tw('tabs.dashboard', 'Dashboard')}</span>
              </div>
            ),
            content: (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">{tw('dashboard.title', 'Dashboard')}</CardTitle>
                    <CardDescription>{tw('dashboard.comingSoon', 'Coming Soon')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center py-8">
                      <p className="text-muted-foreground text-sm">
                        {tw('dashboard.description', 'Dashboard features will be available soon.')}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          },
          {
            value: "statistics",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faChartBar} className="w-4 h-4" />
                <span>{tw('tabs.statistics', 'Statistics')}</span>
              </div>
            ),
            content: (
              <div className="flex-1 min-h-0 overflow-auto p-4">
                {statsLoading ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
                    <p className="text-sm text-muted-foreground">{tw('stats.calculating', 'Calculating statistics...')}</p>
                  </div>
                ) : statistics ? (
                  <div className="space-y-4">
                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold">{statistics.totalWorkspaces}</div>
                            <div className="text-xs text-muted-foreground mt-1">{tw('stats.totalWorkspaces', 'Total Workspaces')}</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{statistics.totalTasks}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faLayerGroup} className="w-3 h-3" />
                              {tw('stats.totalTasks', 'Total Tasks')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-orange-600">{statistics.urgentTasksCount}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faExclamationTriangle} className="w-3 h-3" />
                              {tw('stats.urgentTasks', 'Urgent Tasks')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{statistics.tasksWithApprovalsCount}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3" />
                              {tw('stats.withApprovals', 'With Approvals')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Most Active Workspaces Chart */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">{tw('stats.mostActive.title', 'Most Active Workspaces')}</CardTitle>
                          <CardDescription className="text-xs">{tw('stats.mostActive.description', 'Top workspaces by task count')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {statistics.mostActiveWorkspaces.length > 0 ? (
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
                                  data: statistics.mostActiveWorkspaces.map(item => item.workspace.name).reverse(),
                                  axisLabel: {
                                    formatter: (value: string) => value.length > 20 ? value.substring(0, 20) + '...' : value
                                  }
                                },
                                series: [{
                                  name: tw('stats.mostActive.tasks', 'Tasks'),
                                  type: 'bar',
                                  data: statistics.mostActiveWorkspaces.map(item => item.taskCount).reverse(),
                                  itemStyle: {
                                    color: '#3b82f6'
                                  }
                                }]
                              }}
                              style={{ height: '300px' }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                              {tw('stats.mostActive.empty', 'No workspace data available')}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Workspaces by Type Chart */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">{tw('stats.byType.title', 'Workspaces by Type')}</CardTitle>
                          <CardDescription className="text-xs">{tw('stats.byType.description', 'Distribution across workspace types')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          {statistics.workspacesByType.length > 0 ? (
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
                                  name: tw('stats.byType.workspaces', 'Workspaces'),
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
                                  data: statistics.workspacesByType.map(item => ({
                                    value: item.count,
                                    name: item.type
                                  }))
                                }]
                              }}
                              style={{ height: '300px' }}
                            />
                          ) : (
                            <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                              {tw('stats.byType.empty', 'No type data available')}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    {/* Tasks Over Time Chart */}
                    {statistics.tasksOverTime.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">{tw('stats.overTime.title', 'Tasks Created Over Time')}</CardTitle>
                          <CardDescription className="text-xs">{tw('stats.overTime.description', 'Last 30 days of task creation across all workspaces')}</CardDescription>
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
                                name: tw('stats.overTime.tasksCreated', 'Tasks Created'),
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
                          <CardTitle className="text-sm">{tw('stats.latest.title', 'Latest Tasks')}</CardTitle>
                          <CardDescription className="text-xs">{tw('stats.latest.description', 'Most recently created tasks across all workspaces')}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {statistics.latestTasks.map((task: Task) => {
                              const workspace = workspaces.find((w: Workspace) => w.id === task.workspace_id);
                              return (
                                <div key={task.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-accent/50">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium">{task.name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {tw('stats.latest.workspace', 'Workspace')}: {workspace?.name || 'Unknown'} • {dayjs(task.created_at).format('MMM DD, YYYY HH:mm')}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="ml-2">
                                    {getWorkspaceTaskCount(task.workspace_id)} {tw('stats.latest.tasks', 'tasks')}
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
                            <div className="text-xl font-semibold">{statistics.totalCategories}</div>
                            <div className="text-xs text-muted-foreground mt-1">{tw('stats.totalCategories', 'Total Categories')}</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold">{statistics.totalTeams}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faUsers} className="w-3 h-3" />
                              {tw('stats.totalTeams', 'Total Teams')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold">{statistics.latestTasks.length}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                              {tw('stats.recentTasks', 'Recent Tasks')}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
                    <p className="text-sm text-muted-foreground">{tw('stats.clickToLoad', 'Click the Statistics tab to load statistics')}</p>
                  </div>
                )}
              </div>
            )
          }
        ]}
        defaultValue="workspaces"
        basePath="/settings/workspaces"
        className="h-full flex flex-col"
        onValueChange={setActiveTab}
      />

      {/* Create Workspace Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            setCreateFormData({
              name: '',
              description: '',
              color: '#3b82f6',
              icon: 'fas fa-folder',
              type: 'standard',
              category_id: null
            });
          }
        }}
        type="create"
        title={tw('dialogs.create.title', 'Add New Workspace')}
        description={tw('dialogs.create.description', 'Create a new workspace to organize your projects.')}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <TextField
            id="name"
            label={tw('dialogs.create.fields.name', 'Name *')}
            defaultValue=""
            required
          />
          <TextField
            id="description"
            label={tw('dialogs.create.fields.description', 'Description')}
            defaultValue=""
          />
          <TextField
            id="color"
            label={tw('dialogs.create.fields.color', 'Color')}
            type="color"
            value={createFormData.color}
            onChange={(color) => setCreateFormData(prev => ({ ...prev, color }))}
          />
          <SelectField
            id="type"
            label={tw('dialogs.create.fields.type', 'Type')}
            value={createFormData.type}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, type: value }))}
            options={[
              { value: 'standard', label: tw('dialogs.create.fields.typeStandard', 'Standard') },
              { value: 'project', label: tw('dialogs.create.fields.typeProject', 'Project') },
              { value: 'department', label: tw('dialogs.create.fields.typeDepartment', 'Department') }
            ]}
          />
        </div>
      </SettingsDialog>

      {/* Edit Workspace Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            setEditFormData({
              name: '',
              description: '',
              color: '#3b82f6',
              icon: 'fas fa-folder',
              type: 'standard',
              category_id: null
            });
          }
        }}
        type="edit"
        title={tw('dialogs.edit.title', 'Edit Workspace')}
        description={tw('dialogs.edit.description', 'Update the workspace information.')}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingWorkspace}
        footerActions={
          editingWorkspace ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={handleDeleteFromEdit}
              disabled={isSubmitting}
              title={tw('dialogs.delete.title', 'Delete Workspace')}
              aria-label={tw('dialogs.delete.title', 'Delete Workspace')}
            >
              <FontAwesomeIcon icon={faTrash} />
            </Button>
          ) : undefined
        }
      >
        {editingWorkspace && (
          <div className="grid gap-4">
            <TextField
              id="edit-name"
              label={tw('dialogs.edit.fields.name', 'Name *')}
              defaultValue={editingWorkspace.name}
              required
              readOnly={(editingWorkspace as any).type === 'DEFAULT'}
            />
            <TextField
              id="edit-description"
              label={tw('dialogs.edit.fields.description', 'Description')}
              defaultValue={editingWorkspace.description || ''}
            />
            <TextField
              id="edit-color"
              label={tw('dialogs.edit.fields.color', 'Color')}
              type="color"
              value={editFormData.color}
              onChange={(color) => setEditFormData(prev => ({ ...prev, color }))}
            />
            <PreviewField label={tw('dialogs.edit.fields.type', 'Type')}>
              <Badge variant="outline">
                {(() => {
                  const type = (editingWorkspace as any).type || editFormData.type || 'standard';
                  if (type === 'DEFAULT' || type === 'default') {
                    return tw('dialogs.edit.fields.typeDefault', 'Default');
                  } else if (type === 'PROJECT' || type === 'project') {
                    return tw('dialogs.edit.fields.typeProject', 'Project');
                  } else if (type === 'department') {
                    return tw('dialogs.edit.fields.typeDepartment', 'Department');
                  } else if (type === 'standard') {
                    return tw('dialogs.edit.fields.typeStandard', 'Standard');
                  }
                  return type;
                })()}
              </Badge>
            </PreviewField>
          </div>
        )}
      </SettingsDialog>

      {/* Delete Workspace Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tw('dialogs.delete.title', 'Delete Workspace')}
        description={
          deletingWorkspace ? (() => {
            const taskCount = getWorkspaceTaskCount(deletingWorkspace.id);
            const categoryCount = getWorkspaceCategoryCount(deletingWorkspace.id);
            
            if (taskCount > 0 || categoryCount > 0) {
              return tw('dialogs.delete.cannotDelete', 'This workspace cannot be deleted because it has {taskCount} task{taskPlural} and {categoryCount} categor{categoryPlural}. Please delete or reassign all tasks and categories first.')
                .replace('{taskCount}', String(taskCount))
                .replace('{taskPlural}', taskCount !== 1 ? 's' : '')
                .replace('{categoryCount}', String(categoryCount))
                .replace('{categoryPlural}', categoryCount !== 1 ? 'ies' : 'y');
            } else {
              return tw('dialogs.delete.confirm', 'Are you sure you want to delete the workspace "{name}"? This action cannot be undone.')
                .replace('{name}', deletingWorkspace.name);
            }
          })() : undefined
        }
        onConfirm={() => deletingWorkspace && canDeleteWorkspace(deletingWorkspace) ? deleteItem(deletingWorkspace.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingWorkspace || !canDeleteWorkspace(deletingWorkspace)}
        entityName="workspace"
        entityData={deletingWorkspace}
        renderEntityPreview={renderWorkspacePreview}
      />
    </SettingsLayout>
  );
}

export default Workspaces;

