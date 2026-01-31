import type { Task, Status, Priority, Category, Team, User } from '@/store/types';

export interface KanbanColumnProps {
  status: Status;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
}

export interface KanbanCardProps {
  task: Task;
  onClick: () => void;
}

export interface KanbanBoardProps {
  workspaceId?: string;
}

export interface KanbanFilters {
  categories: number[];
  statuses: number[];
  priorities: number[];
  teams: number[];
  search: string;
}

export interface KanbanViewMode {
  mode: 'compact' | 'detailed';
  groupBy: 'none' | 'priority' | 'team' | 'assignee';
}

export interface ColumnConfig {
  status_id: number;
  wip_limit?: number;
  warn_threshold?: number;
}

export interface KanbanPreferences {
  viewMode: 'compact' | 'detailed';
  filters: KanbanFilters;
  groupBy: 'none' | 'priority' | 'team' | 'assignee';
  columnOrder?: number[];
}
