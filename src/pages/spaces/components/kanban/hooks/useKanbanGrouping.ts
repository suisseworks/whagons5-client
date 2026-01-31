import { useMemo } from 'react';
import type { Task, Priority, Team, User } from '@/store/types';

export interface TaskGroup {
  id: string | number;
  name: string;
  color?: string;
  tasks: Task[];
}

export function useKanbanGrouping(
  tasks: Task[],
  groupBy: 'none' | 'priority' | 'team' | 'assignee',
  priorities: Priority[],
  teams: Team[],
  users: User[]
): TaskGroup[] {
  return useMemo(() => {
    if (groupBy === 'none') {
      return [{
        id: 'all',
        name: 'All Tasks',
        tasks,
      }];
    }

    if (groupBy === 'priority') {
      const groups: TaskGroup[] = [];
      
      // Group by priority
      priorities.forEach((priority) => {
        const priorityTasks = tasks.filter(task => task.priority_id === priority.id);
        if (priorityTasks.length > 0) {
          groups.push({
            id: priority.id,
            name: priority.name,
            color: priority.color || undefined,
            tasks: priorityTasks,
          });
        }
      });

      // Add ungrouped tasks (no priority)
      const unassignedTasks = tasks.filter(task => !task.priority_id);
      if (unassignedTasks.length > 0) {
        groups.push({
          id: 'no-priority',
          name: 'No Priority',
          tasks: unassignedTasks,
        });
      }

      return groups;
    }

    if (groupBy === 'team') {
      const groups: TaskGroup[] = [];
      
      // Group by team
      teams.forEach((team) => {
        const teamTasks = tasks.filter(task => task.team_id === team.id);
        if (teamTasks.length > 0) {
          groups.push({
            id: team.id,
            name: team.name,
            color: team.color || undefined,
            tasks: teamTasks,
          });
        }
      });

      // Add ungrouped tasks (no team)
      const unassignedTasks = tasks.filter(task => !task.team_id);
      if (unassignedTasks.length > 0) {
        groups.push({
          id: 'no-team',
          name: 'No Team',
          tasks: unassignedTasks,
        });
      }

      return groups;
    }

    if (groupBy === 'assignee') {
      const groups: TaskGroup[] = [];
      
      // Group by assignee (first assigned user)
      users.forEach((user) => {
        const userTasks = tasks.filter(task => 
          task.user_ids && task.user_ids.includes(user.id)
        );
        if (userTasks.length > 0) {
          groups.push({
            id: user.id,
            name: user.name,
            color: user.color || undefined,
            tasks: userTasks,
          });
        }
      });

      // Add unassigned tasks
      const unassignedTasks = tasks.filter(task => 
        !task.user_ids || task.user_ids.length === 0
      );
      if (unassignedTasks.length > 0) {
        groups.push({
          id: 'unassigned',
          name: 'Unassigned',
          tasks: unassignedTasks,
        });
      }

      return groups;
    }

    return [{
      id: 'all',
      name: 'All Tasks',
      tasks,
    }];
  }, [tasks, groupBy, priorities, teams, users]);
}
