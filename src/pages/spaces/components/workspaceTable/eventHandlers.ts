// Event handling utilities for WorkspaceTable

import { TaskEvents } from '@/store/eventEmiters/taskEvents';

export interface EventHandlerRefs {
  refreshGrid: () => Promise<void>;
  workspaceId: string;
}

export const setupTaskEventHandlers = (refs: EventHandlerRefs) => {
  const { refreshGrid, workspaceId } = refs;

  console.log(`Setting up task event handlers for workspace: ${workspaceId}`);

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
    console.log('Task created, refreshing grid:', data);
    debouncedRefresh();
  });

  const unsubscribeUpdated = TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, (data) => {
    console.log('Task updated, refreshing grid:', data);
    debouncedRefresh();
  });

  const unsubscribeDeleted = TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, (data) => {
    console.log('Task deleted, refreshing grid:', data);
    debouncedRefresh();
  });

  const unsubscribeBulkUpdate = TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, () => {
    console.log('Bulk task update, refreshing grid');
    // Only refresh if we're viewing shared tasks or all workspaces
    // This prevents unnecessary refreshes when viewing a specific workspace
    if (workspaceId === 'shared' || workspaceId === 'all') {
      debouncedRefresh();
    }
  });

  const unsubscribeInvalidate = TaskEvents.on(TaskEvents.EVENTS.CACHE_INVALIDATE, () => {
    console.log('Cache invalidated, refreshing grid');
    debouncedRefresh();
  });

  // Return cleanup function
  return () => {
    console.log(`Cleaning up task event handlers for workspace: ${workspaceId}`);
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
