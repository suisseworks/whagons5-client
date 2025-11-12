import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faExclamationTriangle, faCheckCircle, faTasks } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Task, Category, Team, Workspace } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { Badge } from "@/components/ui/badge";
import { TasksCache } from "@/store/indexedDB/TasksCache";

interface WorkspaceStatisticsProps {
  workspaceId: string | undefined;
}

function WorkspaceStatistics({ workspaceId }: WorkspaceStatisticsProps) {
  // Debug: Log props
  useEffect(() => {
    console.log('WorkspaceStatistics - Component mounted/updated, workspaceId:', workspaceId);
  }, [workspaceId]);
  
  // Redux state - ensure we get arrays, not undefined
  const categories = useSelector((state: RootState) => (state.categories as any)?.value ?? []) as Category[];
  const teams = useSelector((state: RootState) => (state.teams as any)?.value ?? []) as Team[];
  const workspaces = useSelector((state: RootState) => (state as any).workspaces?.value ?? []) as Workspace[];
  const priorities = useSelector((state: RootState) => (state.priorities as any)?.value ?? []) as any[];
  const statuses = useSelector((state: RootState) => (state.statuses as any)?.value ?? []) as any[];
  const templates = useSelector((state: RootState) => (state as any).templates?.value ?? []) as any[];
  const users = useSelector((state: RootState) => (state as any).users?.value ?? []) as any[];
  const spots = useSelector((state: RootState) => (state as any).spots?.value ?? []) as any[];
  
  // Statistics state
  const [statsLoading, setStatsLoading] = useState(false);
  const [statistics, setStatistics] = useState<{
    totalTasks: number;
    totalCategories: number;
    totalTeams: number;
    urgentTasksCount: number;
    tasksWithApprovalsCount: number;
    overdueTasksCount: number;
    completedTasksCount: number;
    latestTasks: Task[];
    tasksByStatus: Array<{ status: string; statusId: number; count: number; color?: string }>;
    tasksByPriority: Array<{ priority: string; priorityId: number; count: number; color?: string }>;
    tasksOverTime: Array<{ date: string; count: number }>;
    tasksByCategory: Array<{ category: Category; count: number }>;
    recentTaskTypes: Array<{ category: Category; count: number }>;
    mostActiveUsers: Array<{ userId: number; userName: string; taskCount: number }>;
    mostUsedTemplates: Array<{ templateId: number; templateName: string; count: number }>;
    tasksBySpot: Array<{ spotId: number; spotName: string; count: number }>;
  } | null>(null);

  const isCalculatingRef = useRef(false);
  const lastCalculatedWorkspaceRef = useRef<string | undefined>(undefined);
  const [workspaceTasks, setWorkspaceTasks] = useState<Task[]>([]);

  // Load tasks from TasksCache (same as Workspace component)
  useEffect(() => {
    const loadTasks = async () => {
      try {
        console.log('WorkspaceStatistics - ===== LOADING TASKS =====');
        console.log('WorkspaceStatistics - workspaceId:', workspaceId, 'type:', typeof workspaceId);
        console.log('WorkspaceStatistics - TasksCache.initialized:', TasksCache.initialized);
        
        // Initialize cache if needed
        if (!TasksCache.initialized) {
          console.log('WorkspaceStatistics - Initializing TasksCache...');
          await TasksCache.init();
          console.log('WorkspaceStatistics - TasksCache initialized');
        }
        
        // Build query filter
        const query: any = { startRow: 0, endRow: 10000 }; // Get all tasks
        if (workspaceId && workspaceId !== 'all' && workspaceId !== undefined) {
          const wsId = parseInt(workspaceId);
          if (!isNaN(wsId)) {
            query.workspace_id = wsId;
            console.log('WorkspaceStatistics - Filtering by workspace_id:', wsId);
          } else {
            console.log('WorkspaceStatistics - Invalid workspaceId, getting all tasks');
          }
        } else {
          console.log('WorkspaceStatistics - No workspace filter, getting all tasks');
        }
        
        console.log('WorkspaceStatistics - Query:', JSON.stringify(query));
        
        // Query tasks from cache
        const result = await TasksCache.queryTasks(query);
        console.log('WorkspaceStatistics - Query result:', result);
        console.log('WorkspaceStatistics - Result rows:', result?.rows?.length);
        console.log('WorkspaceStatistics - Result rowCount:', result?.rowCount);
        
        const loadedTasks = result?.rows || [];
        
        console.log('WorkspaceStatistics - Loaded tasks count:', loadedTasks.length, 'for workspace:', workspaceId);
        if (loadedTasks.length > 0) {
          console.log('WorkspaceStatistics - Sample task:', loadedTasks[0]);
          console.log('WorkspaceStatistics - Sample task workspace_id:', loadedTasks[0]?.workspace_id);
        } else {
          console.warn('WorkspaceStatistics - NO TASKS LOADED!');
        }
        
        setWorkspaceTasks(loadedTasks);
        console.log('WorkspaceStatistics - ===== TASKS LOADED =====');
      } catch (error) {
        console.error('WorkspaceStatistics - ERROR loading tasks:', error);
        console.error('WorkspaceStatistics - Error stack:', (error as Error).stack);
        setWorkspaceTasks([]);
      }
    };
    
    loadTasks();
  }, [workspaceId]);

  // Calculate statistics
  const calculateStatistics = useCallback(async () => {
    if (isCalculatingRef.current) {
      return;
    }
    
    // Don't calculate if tasks aren't loaded yet
    if (workspaceTasks.length === 0 && statsLoading === false) {
      console.log('WorkspaceStatistics - Waiting for tasks to load...');
      return;
    }
    
    isCalculatingRef.current = true;
    setStatsLoading(true);
    
    // Small delay to show loading state
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      console.log('WorkspaceStatistics - calculateStatistics called');
      console.log('WorkspaceStatistics - workspaceTasks.length:', workspaceTasks.length);
      console.log('WorkspaceStatistics - Sample task:', workspaceTasks[0]);
      console.log('WorkspaceStatistics - categories.length:', (categories as any[]).length);
      console.log('WorkspaceStatistics - statuses.length:', (statuses as any[]).length);
      console.log('WorkspaceStatistics - priorities.length:', (priorities as any[]).length);
      // Tasks by status (with actual status names)
      const statusCounts = new Map<number, { name: string; count: number; color?: string }>();
      workspaceTasks.forEach((task: Task) => {
        const statusId = task.status_id;
        const status = Array.isArray(statuses) ? statuses.find((s: any) => s.id === statusId) : null;
        const statusName = status?.name || `Status ${statusId}`;
        const existing = statusCounts.get(statusId);
        statusCounts.set(statusId, {
          name: statusName,
          count: (existing?.count || 0) + 1,
          color: status?.color || undefined
        });
      });

      const tasksByStatus = Array.from(statusCounts.entries())
        .map(([statusId, data]) => ({ status: data.name, statusId, count: data.count, color: data.color }))
        .sort((a, b) => b.count - a.count);

      // Tasks by priority (with actual priority names and colors)
      const priorityCounts = new Map<number, { name: string; count: number; color?: string }>();
      workspaceTasks.forEach((task: Task) => {
        const priority = Array.isArray(priorities) ? priorities.find((p: any) => p.id === task.priority_id) : null;
        if (priority) {
          const existing = priorityCounts.get(task.priority_id);
          priorityCounts.set(task.priority_id, {
            name: priority.name,
            count: (existing?.count || 0) + 1,
            color: priority.color || undefined
          });
        }
      });

      const tasksByPriority = Array.from(priorityCounts.entries())
        .map(([priorityId, data]) => ({ priority: data.name, priorityId, count: data.count, color: data.color }))
        .sort((a, b) => b.count - a.count);

      // Urgent tasks (high priority)
      const urgentTasksCount = workspaceTasks.filter((task: Task) => {
        const priority = Array.isArray(priorities) ? priorities.find((p: any) => p.id === task.priority_id) : null;
        if (priority?.level && priority.level >= 4) return true;
        if (priority?.name) {
          const nameLower = priority.name.toLowerCase();
          return nameLower.includes('urgent') || nameLower.includes('critical') || nameLower.includes('high');
        }
        return false;
      }).length;

      // Overdue tasks
      const overdueTasksCount = workspaceTasks.filter((task: Task) => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        const now = new Date();
        return dueDate < now;
      }).length;

      // Completed tasks
      const completedTasksCount = workspaceTasks.filter((task: Task) => {
        const status = Array.isArray(statuses) ? statuses.find((s: any) => s.id === task.status_id) : null;
        return status?.action === 'FINISHED' || status?.semantic_type === 'completed' || status?.final === true;
      }).length;

      // Tasks with approvals
      const tasksWithApprovalsCount = workspaceTasks.filter((task: Task) => 
        task.approval_id !== null && task.approval_id !== undefined
      ).length;

      // Latest tasks
      const latestTasks = [...workspaceTasks]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      // Tasks by category
      const categoryCounts = new Map<number, number>();
      workspaceTasks.forEach((task: Task) => {
        const catId = task.category_id;
        categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
      });

      const tasksByCategory = Array.from(categoryCounts.entries())
        .map(([categoryId, count]) => {
          const category = Array.isArray(categories) ? categories.find((c: Category) => c.id === categoryId) : null;
          return { category, count };
        })
        .filter((item): item is { category: Category; count: number } => item.category !== null && item.category !== undefined)
        .sort((a, b) => b.count - a.count);

      // Recent task types (categories from latest tasks)
      const recentTaskTypesMap = new Map<number, number>();
      latestTasks.forEach((task: Task) => {
        const catId = task.category_id;
        recentTaskTypesMap.set(catId, (recentTaskTypesMap.get(catId) || 0) + 1);
      });

      const recentTaskTypes = Array.from(recentTaskTypesMap.entries())
        .map(([categoryId, count]) => {
          const category = Array.isArray(categories) ? categories.find((c: Category) => c.id === categoryId) : null;
          return { category, count };
        })
        .filter((item): item is { category: Category; count: number } => item.category !== null && item.category !== undefined)
        .sort((a, b) => b.count - a.count);

      // Most active users (by task assignment)
      const userTaskCounts = new Map<number, number>();
      workspaceTasks.forEach((task: Task) => {
        if (task.user_ids && Array.isArray(task.user_ids)) {
          task.user_ids.forEach((userId: number) => {
            userTaskCounts.set(userId, (userTaskCounts.get(userId) || 0) + 1);
          });
        }
      });

      const mostActiveUsers = Array.from(userTaskCounts.entries())
        .map(([userId, taskCount]) => {
          const user = Array.isArray(users) ? users.find((u: any) => u.id === userId) : null;
          return {
            userId,
            userName: user?.name || user?.email || `User ${userId}`,
            taskCount
          };
        })
        .filter(item => item.userName)
        .sort((a, b) => b.taskCount - a.taskCount)
        .slice(0, 10);

      // Most used templates
      const templateUsage = new Map<number, number>();
      workspaceTasks.forEach((task: Task) => {
        if (task.template_id) {
          templateUsage.set(task.template_id, (templateUsage.get(task.template_id) || 0) + 1);
        }
      });

      const mostUsedTemplates = Array.from(templateUsage.entries())
        .map(([templateId, count]) => {
          const template = Array.isArray(templates) ? templates.find((t: any) => t.id === templateId) : null;
          return {
            templateId,
            templateName: template?.name || `Template ${templateId}`,
            count
          };
        })
        .filter(item => item.templateName)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Tasks by spot
      const spotTaskCounts = new Map<number, number>();
      workspaceTasks.forEach((task: Task) => {
        if (task.spot_id) {
          spotTaskCounts.set(task.spot_id, (spotTaskCounts.get(task.spot_id) || 0) + 1);
        }
      });

      const tasksBySpot = Array.from(spotTaskCounts.entries())
        .map(([spotId, count]) => {
          const spot = Array.isArray(spots) ? spots.find((s: any) => s.id === spotId) : null;
          return {
            spotId,
            spotName: spot?.name || `Spot ${spotId}`,
            count
          };
        })
        .filter(item => item.spotName)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Tasks over time (last 30 days)
      const tasksOverTimeMap = new Map<string, number>();
      
      workspaceTasks.forEach((task: Task) => {
        const date = dayjs(task.created_at).format('YYYY-MM-DD');
        tasksOverTimeMap.set(date, (tasksOverTimeMap.get(date) || 0) + 1);
      });

      const tasksOverTime = Array.from(tasksOverTimeMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-30);

      // Get workspace categories
      const workspaceCategories = workspaceId && workspaceId !== 'all' && Array.isArray(categories)
        ? categories.filter((c: Category) => c.workspace_id === parseInt(workspaceId))
        : (Array.isArray(categories) ? categories : []);

      // Get workspace teams
      const workspaceTeams = workspaceId && workspaceId !== 'all' && Array.isArray(teams)
        ? teams.filter((t: Team) => {
            // Check if team is associated with workspace
            const workspace = Array.isArray(workspaces) ? workspaces.find((w: Workspace) => w.id === parseInt(workspaceId)) : null;
            if (workspace && Array.isArray((workspace as any).teams)) {
              return (workspace as any).teams.includes(t.id);
            }
            return false;
          })
        : (Array.isArray(teams) ? teams : []);

      const finalStats = {
        totalTasks: workspaceTasks.length,
        totalCategories: workspaceCategories.length,
        totalTeams: workspaceTeams.length,
        urgentTasksCount,
        tasksWithApprovalsCount,
        overdueTasksCount,
        completedTasksCount,
        latestTasks,
        tasksByStatus,
        tasksByPriority,
        tasksOverTime,
        tasksByCategory,
        recentTaskTypes,
        mostActiveUsers,
        mostUsedTemplates,
        tasksBySpot
      };
      
      console.log('WorkspaceStatistics - ===== STATISTICS CALCULATED =====');
      console.log('WorkspaceStatistics - Total tasks:', finalStats.totalTasks);
      console.log('WorkspaceStatistics - Tasks by status:', finalStats.tasksByStatus.length);
      console.log('WorkspaceStatistics - Tasks by category:', finalStats.tasksByCategory.length);
      console.log('WorkspaceStatistics - Final stats:', finalStats);
      
      setStatistics(finalStats);
    } catch (error) {
      console.error('Error calculating statistics:', error);
      // Set empty statistics on error to prevent infinite loading
      setStatistics({
        totalTasks: 0,
        totalCategories: 0,
        totalTeams: 0,
        urgentTasksCount: 0,
        tasksWithApprovalsCount: 0,
        latestTasks: [],
        tasksByStatus: [],
        tasksByPriority: [],
        tasksOverTime: [],
        tasksByCategory: [],
        overdueTasksCount: 0,
        completedTasksCount: 0,
        recentTaskTypes: [],
        mostActiveUsers: [],
        mostUsedTemplates: [],
        tasksBySpot: []
      });
    } finally {
      setStatsLoading(false);
      isCalculatingRef.current = false;
    }
  }, [workspaceTasks, categories, teams, workspaces, priorities, statuses, templates, users, spots]);

  useEffect(() => {
    // Skip if already calculated for this workspace and statistics exist
    if (lastCalculatedWorkspaceRef.current === workspaceId && statistics && workspaceTasks.length > 0) {
      return;
    }
    
    // Don't calculate if already calculating
    if (isCalculatingRef.current) {
      return;
    }
    
    // Reset and calculate for new workspace or if statistics don't exist
    if (lastCalculatedWorkspaceRef.current !== workspaceId) {
      setStatistics(null);
      isCalculatingRef.current = false;
    }
    
    // Only calculate if we have workspaceTasks data
    if (workspaceTasks.length === 0) {
      console.log('WorkspaceStatistics - No tasks available yet, waiting...');
      return;
    }
    
    console.log('WorkspaceStatistics - Triggering calculation with', workspaceTasks.length, 'tasks');
    lastCalculatedWorkspaceRef.current = workspaceId;
    calculateStatistics();
  }, [workspaceId, workspaceTasks, calculateStatistics]); // eslint-disable-line react-hooks/exhaustive-deps

  if (statsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <FontAwesomeIcon icon={faSpinner} className="w-8 h-8 text-muted-foreground animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Calculating statistics...</p>
      </div>
    );
  }

  if (!statistics) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <p className="text-sm text-muted-foreground">Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{statistics.totalTasks}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <FontAwesomeIcon icon={faTasks} className="w-3 h-3" />
                  Total Tasks
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{statistics.completedTasksCount}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3" />
                  Completed
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
                <div className="text-2xl font-bold text-red-600">{statistics.overdueTasksCount}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="w-3 h-3" />
                  Overdue
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row - Pie Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Tasks by Category Pie Chart */}
          {statistics.tasksByCategory.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tasks by Category</CardTitle>
                <CardDescription className="text-xs">Distribution across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: 'item',
                      formatter: '{b}: {c} ({d}%)'
                    },
                    legend: {
                      orient: 'vertical',
                      left: 'left',
                      textStyle: { fontSize: 10 },
                      itemWidth: 12,
                      itemHeight: 8
                    },
                    series: [{
                      name: 'Tasks',
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
                          fontSize: 12,
                          fontWeight: 'bold'
                        }
                      },
                      data: statistics.tasksByCategory.map(item => ({
                        value: item.count,
                        name: item.category.name,
                        itemStyle: {
                          color: item.category.color || '#6b7280'
                        }
                      }))
                    }]
                  }}
                  style={{ height: '300px' }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tasks by Category</CardTitle>
                <CardDescription className="text-xs">Distribution across categories</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No category data available
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tasks by Status Pie Chart */}
          {statistics.tasksByStatus.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tasks by Status</CardTitle>
                <CardDescription className="text-xs">Distribution across statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: 'item',
                      formatter: '{b}: {c} ({d}%)'
                    },
                    legend: {
                      orient: 'vertical',
                      left: 'left',
                      textStyle: { fontSize: 10 },
                      itemWidth: 12,
                      itemHeight: 8
                    },
                    series: [{
                      name: 'Tasks',
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
                          fontSize: 12,
                          fontWeight: 'bold'
                        }
                      },
                      data: statistics.tasksByStatus.map(item => ({
                        value: item.count,
                        name: item.status,
                        itemStyle: {
                          color: item.color || '#6b7280'
                        }
                      }))
                    }]
                  }}
                  style={{ height: '300px' }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Tasks by Status</CardTitle>
                <CardDescription className="text-xs">Distribution across statuses</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No status data available
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Task Types Pie Chart */}
          {statistics.recentTaskTypes.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Task Types</CardTitle>
                <CardDescription className="text-xs">Categories from latest tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: 'item',
                      formatter: '{b}: {c} ({d}%)'
                    },
                    legend: {
                      orient: 'vertical',
                      left: 'left',
                      textStyle: { fontSize: 10 },
                      itemWidth: 12,
                      itemHeight: 8
                    },
                    series: [{
                      name: 'Tasks',
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
                          fontSize: 12,
                          fontWeight: 'bold'
                        }
                      },
                      data: statistics.recentTaskTypes.map(item => ({
                        value: item.count,
                        name: item.category.name,
                        itemStyle: {
                          color: item.category.color || '#6b7280'
                        }
                      }))
                    }]
                  }}
                  style={{ height: '300px' }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Task Types</CardTitle>
                <CardDescription className="text-xs">Categories from latest tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No recent task data available
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tasks by Priority Bar Chart */}
        {statistics.tasksByPriority.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tasks by Priority</CardTitle>
              <CardDescription className="text-xs">Distribution across priority levels</CardDescription>
            </CardHeader>
            <CardContent>
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
                    data: statistics.tasksByPriority.map(item => item.priority).reverse(),
                    axisLabel: {
                      formatter: (value: string) => value.length > 20 ? value.substring(0, 20) + '...' : value
                    }
                  },
                  series: [{
                    name: 'Tasks',
                    type: 'bar',
                    data: statistics.tasksByPriority.map(item => ({
                      value: item.count,
                      itemStyle: {
                        color: item.color || '#3b82f6'
                      }
                    })).reverse()
                  }]
                }}
                style={{ height: '300px' }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tasks by Priority</CardTitle>
              <CardDescription className="text-xs">Distribution across priority levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No priority data available
              </div>
            </CardContent>
          </Card>
        )}

        {/* Most Active Users and Most Used Templates Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Most Active Users Chart */}
          {statistics.mostActiveUsers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Most Active Users</CardTitle>
                <CardDescription className="text-xs">Top users by assigned tasks</CardDescription>
              </CardHeader>
              <CardContent>
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
                      data: statistics.mostActiveUsers.map(item => item.userName).reverse(),
                      axisLabel: {
                        formatter: (value: string) => value.length > 20 ? value.substring(0, 20) + '...' : value
                      }
                    },
                    series: [{
                      name: 'Tasks',
                      type: 'bar',
                      data: statistics.mostActiveUsers.map(item => item.taskCount).reverse(),
                      itemStyle: {
                        color: '#10b981'
                      }
                    }]
                  }}
                  style={{ height: '300px' }}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Most Active Users</CardTitle>
                <CardDescription className="text-xs">Top users by assigned tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No user assignment data available
                </div>
              </CardContent>
            </Card>
          )}

          {/* Most Used Templates Chart */}
          {statistics.mostUsedTemplates.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Most Used Templates</CardTitle>
                <CardDescription className="text-xs">Top templates by task count</CardDescription>
              </CardHeader>
              <CardContent>
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
                      data: statistics.mostUsedTemplates.map(item => item.templateName).reverse(),
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Most Used Templates</CardTitle>
                <CardDescription className="text-xs">Top templates by task count</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  No template usage data available
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Tasks by Spot Chart */}
        {statistics.tasksBySpot.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tasks by Location</CardTitle>
              <CardDescription className="text-xs">Distribution across spots/locations</CardDescription>
            </CardHeader>
            <CardContent>
              <ReactECharts
                option={{
                  tooltip: {
                    trigger: 'item',
                    formatter: '{b}: {c} ({d}%)'
                  },
                  legend: {
                    orient: 'vertical',
                    left: 'left',
                    textStyle: { fontSize: 10 },
                    itemWidth: 12,
                    itemHeight: 8
                  },
                  series: [{
                    name: 'Tasks',
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
                        fontSize: 12,
                        fontWeight: 'bold'
                      }
                    },
                    data: statistics.tasksBySpot.map(item => ({
                      value: item.count,
                      name: item.spotName
                    }))
                  }]
                }}
                style={{ height: '300px' }}
              />
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tasks by Location</CardTitle>
              <CardDescription className="text-xs">Distribution across spots/locations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No location data available
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tasks Over Time Chart */}
        {statistics.tasksOverTime.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tasks Created Over Time</CardTitle>
              <CardDescription className="text-xs">Last 30 days of task creation</CardDescription>
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
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tasks Created Over Time</CardTitle>
              <CardDescription className="text-xs">Last 30 days of task creation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                No time series data available
              </div>
            </CardContent>
          </Card>
        )}

        {/* Latest Tasks List */}
        {statistics.latestTasks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Latest Tasks</CardTitle>
              <CardDescription className="text-xs">Most recently created tasks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {statistics.latestTasks.map((task: Task) => {
                  const category = (categories as Category[]).find((c: Category) => c.id === task.category_id);
                  return (
                    <div key={task.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-accent/50">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{task.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {category?.name || 'Uncategorized'} • {dayjs(task.created_at).format('MMM DD, YYYY HH:mm')}
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {task.status_id}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

export default WorkspaceStatistics;

