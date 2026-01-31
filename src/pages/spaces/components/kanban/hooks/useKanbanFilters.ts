import { useMemo } from 'react';
import type { Task } from '@/store/types';
import type { KanbanFilters } from '../types/kanban.types';

export function useKanbanFilters(tasks: Task[], filters: KanbanFilters) {
  return useMemo(() => {
    return tasks.filter((task) => {
      // Filter by search
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesName = task.name.toLowerCase().includes(searchLower);
        const matchesDescription = task.description?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      // Filter by categories
      if (filters.categories.length > 0 && task.category_id) {
        if (!filters.categories.includes(task.category_id)) {
          return false;
        }
      }

      // Filter by statuses
      if (filters.statuses.length > 0 && task.status_id) {
        if (!filters.statuses.includes(task.status_id)) {
          return false;
        }
      }

      // Filter by priorities
      if (filters.priorities.length > 0 && task.priority_id) {
        if (!filters.priorities.includes(task.priority_id)) {
          return false;
        }
      }

      // Filter by teams
      if (filters.teams.length > 0 && task.team_id) {
        if (!filters.teams.includes(task.team_id)) {
          return false;
        }
      }

      return true;
    });
  }, [tasks, filters]);
}
