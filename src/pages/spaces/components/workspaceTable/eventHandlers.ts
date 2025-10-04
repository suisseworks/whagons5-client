// Event handling utilities for WorkspaceTable

import { TaskEvents } from '@/store/eventEmiters/taskEvents';

export interface EventHandlerRefs {
  refreshGrid: () => Promise<void>;
  workspaceId: string;
}

export const setupTaskEventHandlers = (refs: EventHandlerRefs) => {
  const { refreshGrid, workspaceId } = refs;

  console.log(`Setting up task event handlers for workspace: ${workspaceId}`);

  const unsubscribeCreated = TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, (data) => {
    console.log('Task created, refreshing grid:', data);
    refreshGrid();
  });

  const unsubscribeUpdated = TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, (data) => {
    console.log('Task updated, refreshing grid:', data);
    refreshGrid();
  });

  const unsubscribeDeleted = TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, (data) => {
    console.log('Task deleted, refreshing grid:', data);
    refreshGrid();
  });

  const unsubscribeBulkUpdate = TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, () => {
    console.log('Bulk task update, refreshing grid');
    refreshGrid();
  });

  const unsubscribeInvalidate = TaskEvents.on(TaskEvents.EVENTS.CACHE_INVALIDATE, () => {
    console.log('Cache invalidated, refreshing grid');
    refreshGrid();
  });

  // Return cleanup function
  return () => {
    console.log(`Cleaning up task event handlers for workspace: ${workspaceId}`);
    unsubscribeCreated();
    unsubscribeUpdated();
    unsubscribeDeleted();
    unsubscribeBulkUpdate();
    unsubscribeInvalidate();
  };
};
