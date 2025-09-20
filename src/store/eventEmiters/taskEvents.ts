// Task event system for updating table from external components
export class TaskEvents {
  private static listeners: Map<string, ((data: any) => void)[]> = new Map();

  // Subscribe to task events
  static on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  // Emit task events
  static emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  // Pre-defined event types
  static readonly EVENTS = {
    TASK_CREATED: 'task:created',
    TASK_UPDATED: 'task:updated', 
    TASK_DELETED: 'task:deleted',
    TASKS_BULK_UPDATE: 'tasks:bulk_update',
    CACHE_INVALIDATE: 'cache:invalidate'
  } as const;
} 