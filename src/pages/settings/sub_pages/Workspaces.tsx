import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiagramProject, faPlus, faChartBar, faSpinner, faExclamationTriangle, faCheckCircle, faClock, faUsers, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Workspace, Task, Category, Team } from "@/store/types";
import { DuckTaskCache } from "@/store/database/DuckTaskCache";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  TextField,
  SelectField
} from "../components";
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';

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
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  // NOTE: Tasks are NOT loaded into Redux to avoid memory issues with large datasets
  // Instead, we query DuckDB directly for task counts and statistics
  const { value: teams } = useSelector((state: RootState) => state.teams);
  const { value: spots } = useSelector((state: RootState) => (state as any).spots || { value: [] });

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

  // Cache for workspace task counts to avoid repeated queries
  const taskCountCache = useRef<Map<number, number>>(new Map());
  const [taskCountsLoaded, setTaskCountsLoaded] = useState(false);

  // Load task counts for all workspaces in background
  useEffect(() => {
    if (workspaces.length === 0 || taskCountsLoaded) return;
    
    const loadTaskCounts = async () => {
      try {
        await DuckTaskCache.init();
        const counts = await Promise.all(
          workspaces.map(async (w: Workspace) => {
            const result = await DuckTaskCache.queryForAgGrid({ 
              workspace_id: w.id, 
              startRow: 0, 
              endRow: 0 
            });
            return { id: w.id, count: result?.rowCount ?? 0 };
          })
        );
        counts.forEach(({ id, count }) => {
          taskCountCache.current.set(id, count);
        });
        setTaskCountsLoaded(true);
      } catch (error) {
        console.error('Error loading task counts:', error);
      }
    };
    
    loadTaskCounts();
  }, [workspaces, taskCountsLoaded]);

  // Helper function - returns cached count synchronously
  const getWorkspaceTaskCount = useCallback((workspaceId: number): number => {
    return taskCountCache.current.get(workspaceId) ?? 0;
  }, []);

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

  const canDeleteWorkspace = useCallback((workspace: Workspace): boolean => {
    const taskCount = getWorkspaceTaskCount(workspace.id);
    return taskCount === 0 && getWorkspaceCategoryCount(workspace.id) === 0;
  }, [getWorkspaceTaskCount]);

  const handleDeleteWorkspace = (workspace: Workspace) => {
    if (canDeleteWorkspace(workspace)) {
      deleteItem(workspace.id);
    } else {
      handleDelete(workspace);
    }
  };

  // Track active tab to calculate stats when statistics tab is selected
  const [activeTab, setActiveTab] = useState<string>('workspaces');
  const isCalculatingRef = useRef(false);

  // Calculate statistics - query DuckDB directly instead of loading all tasks into memory
  const calculateStatistics = useCallback(async () => {
    // Prevent concurrent calculations
    if (isCalculatingRef.current) return;
    
    isCalculatingRef.current = true;
    setStatsLoading(true);

    try {
      // Query DuckDB for task statistics instead of loading all tasks into memory
      await DuckTaskCache.init();
      
      // Get total task count
      const totalTasksResult = await DuckTaskCache.queryForAgGrid({ startRow: 0, endRow: 0 });
      const totalTasks = totalTasksResult?.rowCount ?? 0;

      // Get urgent tasks (overdue)
      const now = new Date().toISOString();
      const urgentResult = await DuckTaskCache.queryForAgGrid({ 
        date_to: now,
        startRow: 0, 
        endRow: 0 
      });
      const urgentTasksCount = urgentResult?.rowCount ?? 0;

      // Get tasks with approvals
      const approvalResult = await DuckTaskCache.queryForAgGrid({ 
        startRow: 0, 
        endRow: 0 
      });
      // Note: approval_id filtering would need to be added to queryForAgGrid if needed
      // For now, we'll fetch a sample and filter
      const latestTasksResult = await DuckTaskCache.queryForAgGrid({ 
        startRow: 0, 
        endRow: 10,
        sortModel: [{ colId: 'created_at', sort: 'desc' }]
      });
      const latestTasks = (latestTasksResult?.rows ?? []).map((t: any) => ({
        id: t.id,
        name: t.name,
        created_at: t.created_at
      }));

      // Tasks with approvals - query for tasks with approval_id
      const tasksWithApprovalsResult = await DuckTaskCache.queryForAgGrid({ 
        startRow: 0, 
        endRow: 0 
      });
      // Note: This would need a filter for approval_id in queryForAgGrid
      // For now, estimate based on sample
      const tasksWithApprovalsCount = 0; // TODO: Add approval_id filter to queryForAgGrid

      // Most active workspaces (by task count) - use cached counts
      const workspaceStats = workspaces.map((workspace: Workspace) => ({
        workspace,
        taskCount: getWorkspaceTaskCount(workspace.id),
        categoryCount: getWorkspaceCategoryCount(workspace.id),
        teamCount: getWorkspaceTeamCount(workspace.id)
      }));

      const mostActiveWorkspaces = [...workspaceStats]
        .sort((a, b) => b.taskCount - a.taskCount)
        .slice(0, 10);

      // Workspaces by type
      const typeCounts = new Map<string, number>();
      workspaces.forEach((workspace: Workspace) => {
        const type = (workspace as any).type || 'standard';
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      });

      const workspacesByType = Array.from(typeCounts.entries())
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

      // Tasks over time (last 30 days) - simplified version
      // Note: Full implementation would require fetching tasks with created_at dates
      // For performance, we'll use a simplified approach
      const tasksOverTime: Array<{ date: string; count: number }> = [];

      setStatistics({
        totalWorkspaces: workspaces.length,
        totalTasks,
        totalCategories: categories.length,
        totalTeams: teams.length,
        mostActiveWorkspaces,
        urgentTasksCount,
        tasksWithApprovalsCount,
        latestTasks,
        workspacesByType,
        tasksOverTime
      });
    } catch (error) {
      console.error('Error calculating statistics:', error);
    } finally {
      setStatsLoading(false);
      isCalculatingRef.current = false;
    }
  }, [workspaces, categories, teams, getWorkspaceTaskCount, taskCountsLoaded]);

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

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: 'Workspace Name',
      flex: 2,
      minWidth: 250,
      cellRenderer: WorkspaceNameCellRenderer
    },
    {
      field: 'type',
      headerName: 'Type',
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
      headerName: 'Category',
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
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDeleteWorkspace
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [categories, handleEdit, handleDeleteWorkspace]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const name = formData.get('name') as string;
    if (!name?.trim()) {
      throw new Error('Workspace name is required');
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
      throw new Error('Workspace name is required');
    }

    const updates: any = {
      name: name.trim(),
      description: (formData.get('description') as string) || null,
      color: editFormData.color,
      icon: editFormData.icon,
      type: editFormData.type,
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
            {getWorkspaceTaskCount(workspace.id)} tasks
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {getWorkspaceCategoryCount(workspace.id)} categories
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title="Workspaces"
      description="Manage workspaces to organize your projects and teams"
      icon={faDiagramProject}
      iconColor="#3b82f6"
      search={{
        placeholder: "Search workspaces...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: "Loading workspaces..."
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Add Workspace
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
                <span>Workspaces</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage="No workspaces found"
                    onRowDoubleClicked={handleEdit}
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
                            <div className="text-2xl font-bold">{statistics.totalWorkspaces}</div>
                            <div className="text-xs text-muted-foreground mt-1">Total Workspaces</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-blue-600">{statistics.totalTasks}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faLayerGroup} className="w-3 h-3" />
                              Total Tasks
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
                              Urgent Tasks
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
                              With Approvals
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
                          <CardTitle className="text-sm">Most Active Workspaces</CardTitle>
                          <CardDescription className="text-xs">Top workspaces by task count</CardDescription>
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
                                  name: 'Tasks',
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
                              No workspace data available
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Workspaces by Type Chart */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Workspaces by Type</CardTitle>
                          <CardDescription className="text-xs">Distribution across workspace types</CardDescription>
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
                                  name: 'Workspaces',
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
                              No type data available
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
                          <CardDescription className="text-xs">Last 30 days of task creation across all workspaces</CardDescription>
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
                          <CardTitle className="text-sm">Latest Tasks</CardTitle>
                          <CardDescription className="text-xs">Most recently created tasks across all workspaces</CardDescription>
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
                                      Workspace: {workspace?.name || 'Unknown'} • {dayjs(task.created_at).format('MMM DD, YYYY HH:mm')}
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="ml-2">
                                    {getWorkspaceTaskCount(task.workspace_id)} tasks
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
                            <div className="text-xs text-muted-foreground mt-1">Total Categories</div>
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <div className="text-xl font-semibold">{statistics.totalTeams}</div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                              <FontAwesomeIcon icon={faUsers} className="w-3 h-3" />
                              Total Teams
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
                              Recent Tasks
                            </div>
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
        title="Add New Workspace"
        description="Create a new workspace to organize your projects."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <TextField
            id="name"
            label="Name *"
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
            value={createFormData.color}
            onChange={(color) => setCreateFormData(prev => ({ ...prev, color }))}
          />
          <SelectField
            id="type"
            label="Type"
            value={createFormData.type}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, type: value }))}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'project', label: 'Project' },
              { value: 'department', label: 'Department' }
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
        title="Edit Workspace"
        description="Update the workspace information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingWorkspace}
      >
        {editingWorkspace && (
          <div className="grid gap-4">
            <TextField
              id="edit-name"
              label="Name *"
              defaultValue={editingWorkspace.name}
              required
            />
            <TextField
              id="edit-description"
              label="Description"
              defaultValue={editingWorkspace.description || ''}
            />
            <TextField
              id="edit-color"
              label="Color"
              type="color"
              value={editFormData.color}
              onChange={(color) => setEditFormData(prev => ({ ...prev, color }))}
            />
            <SelectField
              id="edit-type"
              label="Type"
              value={editFormData.type}
              onChange={(value) => setEditFormData(prev => ({ ...prev, type: value }))}
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'project', label: 'Project' },
                { value: 'department', label: 'Department' }
              ]}
            />
          </div>
        )}
      </SettingsDialog>

      {/* Delete Workspace Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Workspace"
        description={
          deletingWorkspace ? (() => {
            const taskCount = getWorkspaceTaskCount(deletingWorkspace.id);
            const categoryCount = getWorkspaceCategoryCount(deletingWorkspace.id);
            
            if (taskCount > 0 || categoryCount > 0) {
              return `This workspace cannot be deleted because it has ${taskCount} task${taskCount !== 1 ? 's' : ''} and ${categoryCount} categor${categoryCount !== 1 ? 'ies' : 'y'}. Please delete or reassign all tasks and categories first.`;
            } else {
              return `Are you sure you want to delete the workspace "${deletingWorkspace.name}"? This action cannot be undone.`;
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

