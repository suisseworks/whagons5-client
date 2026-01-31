import type { Task, Status } from '@/store/types';

export function groupTasksByStatus(
  tasks: Task[],
  statuses: Status[]
): Record<number, Task[]> {
  const grouped: Record<number, Task[]> = {};

  // Initialize all status groups
  statuses.forEach((status) => {
    grouped[status.id] = [];
  });

  // Group tasks
  tasks.forEach((task) => {
    if (grouped[task.status_id]) {
      grouped[task.status_id].push(task);
    }
  });

  return grouped;
}

export function sortStatuses(statuses: Status[]): Status[] {
  return [...statuses].sort((a, b) => {
    // Initial statuses first
    if (a.initial && !b.initial) return -1;
    if (!a.initial && b.initial) return 1;

    // Then by action type
    const actionOrder: Record<string, number> = {
      'NONE': 1,
      'WORKING': 2,
      'PAUSED': 3,
      'FINISHED': 4,
    };

    const orderA = actionOrder[a.action] || 0;
    const orderB = actionOrder[b.action] || 0;

    return orderA - orderB;
  });
}

export function calculateTaskMetrics(tasks: Task[]) {
  const now = new Date();
  
  return {
    total: tasks.length,
    overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < now).length,
    dueToday: tasks.filter(t => {
      if (!t.due_date) return false;
      const dueDate = new Date(t.due_date);
      return dueDate.toDateString() === now.toDateString();
    }).length,
    unassigned: tasks.filter(t => !t.user_ids || t.user_ids.length === 0).length,
  };
}
