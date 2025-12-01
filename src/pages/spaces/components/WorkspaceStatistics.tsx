import { useState, useEffect, useCallback, useRef } from "react";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle, faCheckCircle, faTasks } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Task, Category, Team, Workspace } from "@/store/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { Badge } from "@/components/ui/badge";
import { DuckTaskCache } from "@/store/database/DuckTaskCache";
import { TaskEvents } from "@/store/eventEmiters/taskEvents";

interface WorkspaceStatisticsProps {
  workspaceId: string | undefined;
}

type WorkspaceStats = {
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
};

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
  const [statistics, setStatistics] = useState<WorkspaceStats | null>(null);

  const isCalculatingRef = useRef(false);
  const lastCalculatedWorkspaceRef = useRef<string | undefined>(undefined);
  const [workspaceTasks, setWorkspaceTasks] = useState<Task[]>([]);

  // Helper to fetch tasks for current workspace
  const fetchTasksForWorkspace = useCallback(async () => {
      try {
        console.log('WorkspaceStatistics - ===== LOADING TASKS =====');
        console.log('WorkspaceStatistics - workspaceId:', workspaceId, 'type:', typeof workspaceId);
        
        // Initialize DuckDB-backed task cache
        await DuckTaskCache.init();
        
        // Build query filter
        const query: any = { startRow: 0, endRow: 10000 }; // Get all tasks (bounded)
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
        const result = await DuckTaskCache.queryForAgGrid(query);
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
  }, [workspaceId]);

  // Load tasks on mount and when workspaceId changes
  useEffect(() => {
    fetchTasksForWorkspace();
  }, [fetchTasksForWorkspace]);

  // Listen to task events to keep statistics fresh
  useEffect(() => {
    const debouncedReloadRef = { t: 0 as any };
    const scheduleReload = () => {
      // simple debounce ~150ms
      if (debouncedReloadRef.t) clearTimeout(debouncedReloadRef.t);
      debouncedReloadRef.t = setTimeout(() => {
        fetchTasksForWorkspace();
      }, 150);
    };
    const offCreated = TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, scheduleReload);
    const offUpdated = TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, scheduleReload);
    const offDeleted = TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, scheduleReload);
    const offBulk = TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, scheduleReload);
    const offInvalidate = TaskEvents.on(TaskEvents.EVENTS.CACHE_INVALIDATE, scheduleReload);
    return () => {
      try { offCreated(); offUpdated(); offDeleted(); offBulk(); offInvalidate(); } catch {}
      if (debouncedReloadRef.t) clearTimeout(debouncedReloadRef.t);
    };
  }, [fetchTasksForWorkspace]);

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
    
    // Ensure priorities and statuses are loaded (they're needed for urgent/overdue calculations)
    const prioritiesArray = Array.isArray(priorities) ? priorities : [];
    const statusesArray = Array.isArray(statuses) ? statuses : [];
    
    if (prioritiesArray.length === 0 || statusesArray.length === 0) {
      console.log('WorkspaceStatistics - Waiting for priorities/statuses to load...', {
        priorities: prioritiesArray.length,
        statuses: statusesArray.length
      });
      // Don't block if we have tasks but no priorities/statuses - we'll calculate what we can
      // But log a warning for debugging
      if (workspaceTasks.length > 0) {
        console.warn('WorkspaceStatistics - Calculating with missing priorities/statuses. Urgent/overdue counts may be inaccurate.');
      }
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
      console.log('WorkspaceStatistics - statuses.length:', statusesArray.length);
      console.log('WorkspaceStatistics - priorities.length:', prioritiesArray.length);
      console.log('WorkspaceStatistics - Sample status:', statusesArray[0]);
      console.log('WorkspaceStatistics - Sample priority:', prioritiesArray[0]);
      console.log('WorkspaceStatistics - Sample category:', (categories as any[])[0]);
      
      // Get workspace categories first (for filtering)
      const workspaceCategories = workspaceId && workspaceId !== 'all' && Array.isArray(categories)
        ? categories.filter((c: Category) => Number(c.workspace_id) === Number(workspaceId))
        : (Array.isArray(categories) ? categories : []);
      
      console.log('WorkspaceStatistics - workspaceCategories.length:', workspaceCategories.length);
      console.log('WorkspaceStatistics - workspaceId:', workspaceId);
      
      // Tasks by status (with actual status names)
      const statusCounts = new Map<number, { name: string; count: number; color?: string }>();
      workspaceTasks.forEach((task: Task) => {
        const statusId = Number(task.status_id);
        if (!Number.isFinite(statusId)) return;
        // Normalize both IDs to numbers for comparison
        const status = statusesArray.find((s: any) => Number(s.id) === statusId) || null;
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
        const priorityId = Number(task.priority_id);
        if (!Number.isFinite(priorityId)) return;
        // Normalize both IDs to numbers for comparison
        const priority = prioritiesArray.find((p: any) => Number(p.id) === priorityId) || null;
        if (priority) {
          const existing = priorityCounts.get(priorityId);
          priorityCounts.set(priorityId, {
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
      // First, let's debug what we have
      console.log('WorkspaceStatistics - === URGENT TASKS DEBUG ===');
      console.log('WorkspaceStatistics - Total tasks:', workspaceTasks.length);
      console.log('WorkspaceStatistics - Priorities available:', prioritiesArray.length);
      if (prioritiesArray.length > 0) {
        console.log('WorkspaceStatistics - Sample priorities:', prioritiesArray.slice(0, 5).map((p: any) => ({ 
          id: p.id, 
          name: p.name, 
          level: p.level,
          color: p.color 
        })));
      }
      
      // Check tasks with priority_id
      const tasksWithPriorityId = workspaceTasks.filter((t: Task) => {
        const pid = Number(t.priority_id);
        return Number.isFinite(pid) && pid > 0;
      });
      console.log('WorkspaceStatistics - Tasks with valid priority_id:', tasksWithPriorityId.length);
      if (tasksWithPriorityId.length > 0) {
        console.log('WorkspaceStatistics - Sample tasks with priority:', tasksWithPriorityId.slice(0, 5).map((t: Task) => ({
          id: t.id,
          priority_id: t.priority_id,
          name: t.name?.substring(0, 30)
        })));
      }
      
      const urgentTasks = workspaceTasks.filter((task: Task) => {
        const priorityId = Number(task.priority_id);
        if (!Number.isFinite(priorityId) || priorityId <= 0) return false;
        
        const priority = prioritiesArray.find((p: any) => Number(p.id) === priorityId) || null;
        if (!priority) {
          return false;
        }
        
        // Check priority level (if level >= 4, consider urgent)
        // Also check if level is in top 2-3 priorities (assuming levels 1-5 or 1-10 scale)
        const levelNum = priority.level != null && Number.isFinite(priority.level) ? Number(priority.level) : null;
        if (levelNum != null) {
          // If level >= 4 out of 5, or level >= 7 out of 10, consider urgent
          // Also check if it's in the top 20% of priorities (assuming max level is 5 or 10)
          if (levelNum >= 4) {
            return true;
          }
        }
        // Check priority name for urgent keywords (case-insensitive)
        if (priority.name) {
          const nameLower = String(priority.name).toLowerCase().trim();
          if (nameLower.includes('urgent') || 
              nameLower.includes('critical') || 
              nameLower.includes('high') ||
              nameLower === 'high' ||
              nameLower === 'urgent' ||
              nameLower === 'critical') {
            return true;
          }
        }
        return false;
      });
      const urgentTasksCount = urgentTasks.length;
      console.log('WorkspaceStatistics - Urgent tasks found:', urgentTasksCount);
      if (urgentTasksCount > 0) {
        console.log('WorkspaceStatistics - Urgent task details:', urgentTasks.slice(0, 10).map(t => {
          const p = prioritiesArray.find((p: any) => Number(p.id) === Number(t.priority_id));
          return { 
            id: t.id, 
            priority_id: t.priority_id, 
            priority_name: p?.name,
            priority_level: p?.level,
            name: t.name?.substring(0, 30)
          };
        }));
      } else {
        console.log('WorkspaceStatistics - No urgent tasks found. Checking why...');
        if (tasksWithPriorityId.length > 0 && prioritiesArray.length > 0) {
          // Show what priorities we have vs what tasks have
          const taskPriorityIds = new Set(tasksWithPriorityId.map(t => Number(t.priority_id)));
          const availablePriorityIds = new Set(prioritiesArray.map((p: any) => Number(p.id)));
          console.log('WorkspaceStatistics - Task priority IDs:', Array.from(taskPriorityIds).slice(0, 10));
          console.log('WorkspaceStatistics - Available priority IDs:', Array.from(availablePriorityIds).slice(0, 10));
          console.log('WorkspaceStatistics - Priority details:', prioritiesArray.map((p: any) => ({
            id: p.id,
            name: p.name,
            level: p.level,
            levelType: typeof p.level,
            isUrgent: (p.level != null && Number.isFinite(p.level) && Number(p.level) >= 4) || (p.name?.toLowerCase().includes('urgent') || p.name?.toLowerCase().includes('critical') || p.name?.toLowerCase().includes('high'))
          })));
          // Specifically check priority 7 since all tasks use it
          const priority7 = prioritiesArray.find((p: any) => Number(p.id) === 7);
          if (priority7) {
            console.log('WorkspaceStatistics - Priority 7 details:', {
              id: priority7.id,
              name: priority7.name,
              level: priority7.level,
              levelType: typeof priority7.level,
              levelAsNumber: Number(priority7.level),
              isLevel4OrHigher: priority7.level != null && Number.isFinite(priority7.level) && Number(priority7.level) >= 4,
              nameIncludesUrgent: priority7.name?.toLowerCase().includes('urgent'),
              nameIncludesCritical: priority7.name?.toLowerCase().includes('critical'),
              nameIncludesHigh: priority7.name?.toLowerCase().includes('high'),
              fullObject: priority7
            });
          }
        }
      }
      console.log('WorkspaceStatistics - === END URGENT DEBUG ===');

      // Overdue tasks
      console.log('WorkspaceStatistics - === OVERDUE TASKS DEBUG ===');
      console.log('WorkspaceStatistics - Total tasks:', workspaceTasks.length);
      console.log('WorkspaceStatistics - Statuses available:', statusesArray.length);
      
      // Check tasks with due_date
      const tasksWithDueDate = workspaceTasks.filter((t: Task) => {
        const dd = t.due_date;
        return dd != null && dd !== '' && dd !== 'null' && dd !== 'undefined';
      });
      console.log('WorkspaceStatistics - Tasks with due_date:', tasksWithDueDate.length);
      if (tasksWithDueDate.length > 0) {
        console.log('WorkspaceStatistics - Sample tasks with due_date:', tasksWithDueDate.slice(0, 5).map((t: Task) => ({
          id: t.id,
          due_date: t.due_date,
          due_date_type: typeof t.due_date,
          status_id: t.status_id,
          name: t.name?.substring(0, 30)
        })));
      }
      
      const now = new Date();
      const nowDateOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      console.log('WorkspaceStatistics - Current date (date only):', nowDateOnly.toISOString().split('T')[0]);
      
      const overdueTasks = workspaceTasks.filter((task: Task) => {
        if (!task.due_date) return false;
        
        // Handle different date formats (string, Date object, timestamp)
        let dueDate: Date;
        try {
          const dueDateValue = task.due_date as any;
          if (dueDateValue instanceof Date) {
            dueDate = dueDateValue;
          } else if (typeof dueDateValue === 'string') {
            // Try parsing as ISO string
            dueDate = new Date(dueDateValue);
          } else if (typeof dueDateValue === 'number') {
            // Timestamp
            dueDate = new Date(dueDateValue);
          } else {
            return false;
          }
          
          // Check if date is valid
          if (isNaN(dueDate.getTime())) {
            return false;
          }
          
          // Only count as overdue if due date is in the past AND task is not completed
          const statusId = Number(task.status_id);
          if (Number.isFinite(statusId)) {
            const status = statusesArray.find((s: any) => Number(s.id) === statusId) || null;
            // Don't count completed tasks as overdue
            if (status?.action === 'FINISHED' || status?.semantic_type === 'completed' || (status as any)?.final === true) {
              return false;
            }
          }
          
          // Compare dates (ignore time, just compare date portion)
          // Count as overdue if due date is today or in the past
          const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          const isOverdue = dueDateOnly <= nowDateOnly;
          
          return isOverdue;
        } catch (e) {
          console.warn('WorkspaceStatistics - Error parsing due_date:', task.due_date, 'for task:', task.id, e);
          return false;
        }
      });
      const overdueTasksCount = overdueTasks.length;
      console.log('WorkspaceStatistics - Overdue tasks found:', overdueTasksCount);
      if (overdueTasksCount > 0) {
        console.log('WorkspaceStatistics - Overdue task details:', overdueTasks.slice(0, 10).map(t => {
          const s = statusesArray.find((s: any) => Number(s.id) === Number(t.status_id));
          return { 
            id: t.id, 
            due_date: t.due_date,
            due_date_parsed: new Date(t.due_date as string).toISOString().split('T')[0],
            status_id: t.status_id,
            status_name: s?.name,
            status_action: s?.action,
            name: t.name?.substring(0, 30)
          };
        }));
      } else {
        console.log('WorkspaceStatistics - No overdue tasks found. Checking why...');
        if (tasksWithDueDate.length > 0) {
          // Show what dates we have
          const sampleDates = tasksWithDueDate.slice(0, 10).map(t => {
            try {
              // Handle timestamp format (number in milliseconds)
              let d: Date;
              if (typeof t.due_date === 'number') {
                d = new Date(t.due_date);
              } else if (typeof t.due_date === 'string') {
                d = new Date(t.due_date);
              } else {
                d = new Date(t.due_date as any);
              }
              const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
              const isPast = dOnly < nowDateOnly;
              const s = statusesArray.find((s: any) => Number(s.id) === Number(t.status_id));
              const isCompleted = s?.action === 'FINISHED' || s?.semantic_type === 'completed' || (s as any)?.final === true;
              return {
                id: t.id,
                due_date: t.due_date,
                due_date_type: typeof t.due_date,
                parsed: dOnly.toISOString().split('T')[0],
                nowDate: nowDateOnly.toISOString().split('T')[0],
                isPast,
                isCompleted,
                status: s?.name,
                status_action: s?.action
              };
            } catch (e) {
              return { id: t.id, due_date: t.due_date, error: String(e) };
            }
          });
          console.log('WorkspaceStatistics - Sample due dates analysis:', sampleDates);
          
          // Check if there are any tasks with dates in the past
          const pastDueTasks = tasksWithDueDate.filter(t => {
            try {
              let d: Date;
              if (typeof t.due_date === 'number') {
                d = new Date(t.due_date);
              } else {
                d = new Date(t.due_date as string);
              }
              const dOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
              return dOnly < nowDateOnly;
            } catch {
              return false;
            }
          });
          console.log('WorkspaceStatistics - Tasks with past due dates:', pastDueTasks.length);
        }
      }
      console.log('WorkspaceStatistics - === END OVERDUE DEBUG ===');

      // Completed tasks
      const completedTasksCount = workspaceTasks.filter((task: Task) => {
        const statusId = Number(task.status_id);
        if (!Number.isFinite(statusId)) return false;
        const status = Array.isArray(statuses) ? statuses.find((s: any) => Number(s.id) === statusId) : null;
        if (!status) return false;
        // Check multiple ways a task can be considered completed
        const action = String(status.action || '').toUpperCase();
        const semanticType = String(status.semantic_type || '').toLowerCase();
        const isFinal = (status as any)?.final === true;
        return action === 'FINISHED' || action === 'DONE' || semanticType === 'completed' || semanticType === 'done' || isFinal;
      }).length;

      // Tasks with approvals
      const tasksWithApprovalsCount = workspaceTasks.filter((task: Task) => 
        task.approval_id !== null && task.approval_id !== undefined
      ).length;

      // Latest tasks
      const latestTasks = [...workspaceTasks]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10);

      // Tasks by category (using workspaceCategories defined earlier)
      const categoryCounts = new Map<number, number>();
      workspaceTasks.forEach((task: Task) => {
        const catId = Number(task.category_id);
        if (!Number.isFinite(catId)) return;
        categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
      });

      const tasksByCategory = Array.from(categoryCounts.entries())
        .map(([categoryId, count]) => {
          // Normalize both IDs to numbers for comparison - use workspaceCategories instead of all categories
          const category = Array.isArray(workspaceCategories) ? workspaceCategories.find((c: Category) => Number(c.id) === categoryId) : null;
          // Fallback to all categories if not found in workspace categories (for edge cases)
          const fallbackCategory = !category && Array.isArray(categories) ? categories.find((c: Category) => Number(c.id) === categoryId) : null;
          return { category: category || fallbackCategory, count };
        })
        .filter((item): item is { category: Category; count: number } => item.category !== null && item.category !== undefined)
        .sort((a, b) => b.count - a.count);

      // Recent task types (categories from latest tasks)
      const recentTaskTypesMap = new Map<number, number>();
      latestTasks.forEach((task: Task) => {
        const catId = Number(task.category_id);
        if (!Number.isFinite(catId)) return;
        recentTaskTypesMap.set(catId, (recentTaskTypesMap.get(catId) || 0) + 1);
      });

      const recentTaskTypes = Array.from(recentTaskTypesMap.entries())
        .map(([categoryId, count]) => {
          // Normalize both IDs to numbers for comparison - use workspaceCategories instead of all categories
          const category = Array.isArray(workspaceCategories) ? workspaceCategories.find((c: Category) => Number(c.id) === categoryId) : null;
          // Fallback to all categories if not found in workspace categories (for edge cases)
          const fallbackCategory = !category && Array.isArray(categories) ? categories.find((c: Category) => Number(c.id) === categoryId) : null;
          return { category: category || fallbackCategory, count };
        })
        .filter((item): item is { category: Category; count: number } => item.category !== null && item.category !== undefined)
        .sort((a, b) => b.count - a.count);

      // Most active users (by task assignment)
      const userTaskCounts = new Map<number, number>();
      workspaceTasks.forEach((task: Task) => {
        if (task.user_ids && Array.isArray(task.user_ids)) {
          task.user_ids.forEach((userId: number | string) => {
            const uid = Number(userId);
            if (!Number.isFinite(uid)) return;
            userTaskCounts.set(uid, (userTaskCounts.get(uid) || 0) + 1);
          });
        }
      });

      const mostActiveUsers = Array.from(userTaskCounts.entries())
        .map(([userId, taskCount]) => {
          // Normalize both IDs to numbers for comparison
          const user = Array.isArray(users) ? users.find((u: any) => Number(u.id) === userId) : null;
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
        const templateId = Number(task.template_id);
        if (!Number.isFinite(templateId)) return;
        templateUsage.set(templateId, (templateUsage.get(templateId) || 0) + 1);
      });

      const mostUsedTemplates = Array.from(templateUsage.entries())
        .map(([templateId, count]) => {
          // Normalize both IDs to numbers for comparison
          const template = Array.isArray(templates) ? templates.find((t: any) => Number(t.id) === templateId) : null;
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
        const spotId = Number(task.spot_id);
        if (!Number.isFinite(spotId)) return;
        spotTaskCounts.set(spotId, (spotTaskCounts.get(spotId) || 0) + 1);
      });

      const tasksBySpot = Array.from(spotTaskCounts.entries())
        .map(([spotId, count]) => {
          // Normalize both IDs to numbers for comparison
          const spot = Array.isArray(spots) ? spots.find((s: any) => Number(s.id) === spotId) : null;
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
  }, [workspaceId, workspaceTasks, calculateStatistics]); // eslint-disable-line react-hooks-exhaustive-deps

  const renderStatCard = (
    title: string,
    value: React.ReactNode,
    icon: any,
    accentClass?: string
  ) => (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center">
          <div className={`text-2xl font-bold ${accentClass || ''}`}>{value}</div>
          <div className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
            <FontAwesomeIcon icon={icon} className="w-3 h-3" />
            {title}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderSkeletonLayout = () => {
    const SkeletonStatCard = (key: string) => (
      <Card key={key}>
        <CardContent className="pt-6">
          <div className="text-center animate-pulse space-y-2">
            <div className="h-6 w-16 mx-auto bg-muted rounded" />
            <div className="h-3 w-20 mx-auto bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );

    const SkeletonChartCard = (key: string) => (
      <Card key={key}>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-28 bg-muted rounded" />
            <div className="h-3 w-40 bg-muted rounded" />
          </div>
        </CardHeader>
        <CardContent className="h-64">
          <div className="h-full w-full bg-muted/60 rounded animate-pulse" />
        </CardContent>
      </Card>
    );

    const SkeletonListCard = (key: string) => (
      <Card key={key}>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div key={`${key}-item-${idx}`} className="animate-pulse flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );

    return (
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, idx) => SkeletonStatCard(`stat-skeleton-${idx}`))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => SkeletonChartCard(`chart-skeleton-${idx}`))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, idx) => SkeletonListCard(`list-skeleton-${idx}`))}
          </div>
        </div>
      </div>
    );
  };

  const [showRealContent, setShowRealContent] = useState(false);

  useEffect(() => {
    if (!statistics) {
      setShowRealContent(false);
      return;
    }
    const timeout = setTimeout(() => setShowRealContent(true), 220);
    return () => clearTimeout(timeout);
  }, [statistics]);

  if (!statistics || !showRealContent) {
    return renderSkeletonLayout();
  }

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {renderStatCard('Total Tasks', statistics.totalTasks, faTasks)}
          {renderStatCard('Completed', statistics.completedTasksCount, faCheckCircle, 'text-green-600')}
          {renderStatCard('Urgent Tasks', statistics.urgentTasksCount, faExclamationTriangle, 'text-orange-600')}
          {renderStatCard('Overdue Tasks', statistics.overdueTasksCount, faExclamationTriangle, 'text-red-600')}
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
                  const categoryId = Number(task.category_id);
                  const category = Number.isFinite(categoryId) 
                    ? (categories as Category[]).find((c: Category) => Number(c.id) === categoryId)
                    : null;
                  const statusId = Number(task.status_id);
                  const status = Number.isFinite(statusId)
                    ? (statuses as any[]).find((s: any) => Number(s.id) === statusId)
                    : null;
                  return (
                    <div key={task.id} className="flex items-center justify-between p-2 border rounded-md hover:bg-accent/50">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{task.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {category?.name || 'Uncategorized'} • {dayjs(task.created_at).format('MMM DD, YYYY HH:mm')}
                        </div>
                      </div>
                      <Badge variant="outline" className="ml-2">
                        {status?.name || `Status ${statusId}`}
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

