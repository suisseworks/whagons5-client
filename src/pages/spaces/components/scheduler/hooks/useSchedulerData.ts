import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import type { SchedulerResource, SchedulerEvent } from "../types/scheduler";

interface User {
  id: number;
  name: string;
  email?: string;
  url_picture?: string | null;
  color?: string | null;
}

interface Team {
  id: number;
  name: string;
  color?: string | null;
}

interface UserTeam {
  id: number;
  user_id: number;
  team_id: number;
}

interface Task {
  id: number;
  name: string;
  start_date?: string | null;
  due_date?: string | null;
  expected_duration?: number | null;
  user_ids?: number[];
  priority_id?: number | null;
  status_id?: number | null;
  category_id?: number | null;
  workspace_id: number;
}

export function useSchedulerData(workspaceId: string | undefined) {
  // Fetch users, teams, and userTeams from Redux
  const users = useSelector((state: RootState) => (state.users as any)?.value ?? []) as User[];
  const teams = useSelector((state: RootState) => (state.teams as any)?.value ?? []) as Team[];
  const userTeams = useSelector((state: RootState) => (state.userTeams as any)?.value ?? []) as UserTeam[];
  const tasks = useSelector((state: RootState) => (state.tasks as any)?.value ?? []) as Task[];

  // Get loading states from Redux
  const usersLoading = useSelector((state: RootState) => (state.users as any)?.loading ?? false);
  const teamsLoading = useSelector((state: RootState) => (state.teams as any)?.loading ?? false);
  const tasksLoading = useSelector((state: RootState) => (state.tasks as any)?.loading ?? false);
  const loading = usersLoading || teamsLoading || tasksLoading;

  // Transform users to scheduler resources
  const resources = useMemo<SchedulerResource[]>(() => {
    if (!workspaceId) return [];

    // Filter users that belong to this workspace (via teams or direct assignment)
    // For now, we'll include all users. In a real scenario, you'd filter by workspace membership
    const workspaceTasks = tasks.filter((t) => String(t.workspace_id) === workspaceId);
    const assignedUserIds = new Set<number>();
    
    workspaceTasks.forEach((task) => {
      if (task.user_ids) {
        task.user_ids.forEach((id) => assignedUserIds.add(id));
      }
    });

    // Get team info for each user
    const userTeamMap = new Map<number, Team>();
    userTeams.forEach((ut) => {
      const team = teams.find((t) => t.id === ut.team_id);
      if (team) {
        userTeamMap.set(ut.user_id, team);
      }
    });

    // Transform to scheduler resources
    return users
      .filter((user) => assignedUserIds.has(user.id) || userTeams.some((ut) => ut.user_id === user.id))
      .map((user) => {
        const team = userTeamMap.get(user.id);
        
        // Debug: Log avatar URL
        if (user.url_picture) {
          console.log(`[Scheduler] User ${user.name} avatar:`, user.url_picture);
        }
        
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          avatar: user.url_picture || undefined,
          teamId: team?.id,
          teamName: team?.name,
          color: user.color || undefined,
        };
      });
  }, [users, teams, userTeams, tasks, workspaceId]);

  // Transform tasks to scheduler events
  const events = useMemo<SchedulerEvent[]>(() => {
    if (!workspaceId) return [];

    const workspaceTasks = tasks.filter((t) => String(t.workspace_id) === workspaceId);
    const schedulerEvents: SchedulerEvent[] = [];
    
    console.log('[useSchedulerData] Processing tasks:', {
      totalTasks: tasks.length,
      workspaceTasks: workspaceTasks.length,
      workspaceId,
    });

    let skippedTasks = 0;
    workspaceTasks.forEach((task) => {
      if (!task.start_date || !task.user_ids || task.user_ids.length === 0) {
        skippedTasks++;
        console.log('[useSchedulerData] Skipping task (missing start_date or user_ids):', {
          id: task.id,
          name: task.name,
          start_date: task.start_date,
          due_date: task.due_date,
          user_ids: task.user_ids,
          workspace_id: task.workspace_id,
          hasStartDate: !!task.start_date,
          hasUserIds: !!task.user_ids,
          userIdsLength: task.user_ids?.length || 0,
        });
        return; // Skip tasks without start date or user assignments
      }

      const startDate = new Date(task.start_date);
      let endDate: Date;

      if (task.due_date) {
        endDate = new Date(task.due_date);
      } else if (task.expected_duration) {
        // Calculate end date from expected duration (assuming duration is in minutes)
        endDate = new Date(startDate.getTime() + task.expected_duration * 60000);
      } else {
        // Default to 1 hour if no duration specified
        endDate = new Date(startDate.getTime() + 3600000);
      }

      // Create one event per user assignment
      task.user_ids.forEach((userId) => {
        const event = {
          id: task.id * 10000 + userId, // Unique ID combining task and user
          resourceId: userId,
          name: task.name,
          startDate,
          endDate,
          color: getEventColor(task.priority_id, task.status_id),
          taskId: task.id,
          priorityId: task.priority_id || undefined,
          statusId: task.status_id || undefined,
          categoryId: task.category_id || undefined,
        };
        schedulerEvents.push(event);
        
        // Debug: Log task being converted to event
        if (workspaceTasks.length <= 5) { // Only log for small task sets
          console.log('[useSchedulerData] Created event for task:', {
            taskId: task.id,
            taskName: task.name,
            userId,
            startDate,
            endDate,
          });
        }
      });
    });
    
    console.log('[useSchedulerData] Generated events:', {
      eventsCount: schedulerEvents.length,
      skippedTasks,
    });

    return schedulerEvents;
  }, [tasks, workspaceId]);

  // Check if data is loading from Redux state
  const isLoading = useSelector((state: RootState) => {
    const tasksState = (state.tasks as any);
    const usersState = (state.users as any);
    return (tasksState?.loading === true) || (usersState?.loading === true);
  });

  return {
    resources,
    events,
    loading: isLoading ?? false,
  };
}

// Helper function to get event color based on priority/status
function getEventColor(priorityId: number | null | undefined, statusId: number | null | undefined): string {
  // Default colors - these should ideally come from priority/status data
  if (priorityId) {
    // Map priority IDs to colors (this should be configurable)
    const priorityColors: Record<number, string> = {
      1: "#ef4444", // High priority - red
      2: "#f59e0b", // Medium priority - orange
      3: "#10b981", // Low priority - green
    };
    return priorityColors[priorityId] || "#6366f1";
  }
  
  return "#6366f1"; // Default blue
}
