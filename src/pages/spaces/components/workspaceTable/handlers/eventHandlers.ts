// Event handling utilities for WorkspaceTable

import { TaskEvents } from '@/store/eventEmiters/taskEvents';

export interface EventHandlerRefs {
  refreshGrid: () => Promise<void>;
  workspaceId: string;
}

export const setupTaskEventHandlers = (refs: EventHandlerRefs) => {
  const { refreshGrid, workspaceId } = refs;

  // Debounce refresh calls to prevent rapid-fire refreshes
  let refreshTimeout: NodeJS.Timeout | null = null;
  const debouncedRefresh = () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
    }
    refreshTimeout = setTimeout(() => {
      refreshGrid();
      refreshTimeout = null;
    }, 100); // 100ms debounce
  };

  const unsubscribeCreated = TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, (data) => {
    debouncedRefresh();
  });

  const unsubscribeUpdated = TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, (data) => {
    debouncedRefresh();
  });

  const unsubscribeDeleted = TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, (data) => {
    debouncedRefresh();
  });

  const unsubscribeBulkUpdate = TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, () => {
    // Only refresh if we're viewing shared tasks or all workspaces
    // This prevents unnecessary refreshes when viewing a specific workspace
    if (workspaceId === 'shared' || workspaceId === 'all') {
      debouncedRefresh();
    }
  });

  const unsubscribeInvalidate = TaskEvents.on(TaskEvents.EVENTS.CACHE_INVALIDATE, () => {
    debouncedRefresh();
  });

  // Return cleanup function
  return () => {
    if (refreshTimeout) {
      clearTimeout(refreshTimeout);
      refreshTimeout = null;
    }
    unsubscribeCreated();
    unsubscribeUpdated();
    unsubscribeDeleted();
    unsubscribeBulkUpdate();
    unsubscribeInvalidate();
  };
};
