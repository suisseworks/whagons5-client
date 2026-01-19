// Hook to track newly created tasks for animation purposes
import { useCallback, useEffect, useRef, useState } from 'react';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';

/**
 * Tracks newly created task IDs for animations
 * This allows us to apply CSS animations to rows when they're added
 */
export function useNewTaskAnimation() {
  const [newTaskIds, setNewTaskIds] = useState<Set<number>>(new Set());
  const timeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map());
  // Use refs to track IDs for immediate access without stale closures
  const newTaskIdsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const unsubscribeCreated = TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, (data: any) => {
      // Handle different data structures: task object, task ID, or nested data
      let taskId = data?.id || data?.ID || data?.Id || data;
      
      // If data is an object with nested id, try that too
      if (typeof data === 'object' && data !== null && !taskId) {
        taskId = (data as any).task?.id || (data as any).task?.ID;
      }
      
      // Handle both number and string IDs
      const id = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
      
      if (id && (typeof id === 'number' || !isNaN(id))) {
        const numericId = typeof id === 'number' ? id : parseInt(String(id), 10);
        
        // Clear any existing timeout for this ID (in case it was already added)
        const existingTimeout = timeoutRefs.current.get(numericId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
        }
        
        // Add the new task ID to both state and ref
        setNewTaskIds(prev => {
          const next = new Set(prev).add(numericId);
          newTaskIdsRef.current = next;
          return next;
        });

        // Remove it after animation completes (1.5 seconds to be safe)
        const timeout = setTimeout(() => {
          setNewTaskIds(prev => {
            const next = new Set(prev);
            next.delete(numericId);
            newTaskIdsRef.current = next;
            return next;
          });
          timeoutRefs.current.delete(numericId);
        }, 1500);

        timeoutRefs.current.set(numericId, timeout);
      }
    });

    return () => {
      unsubscribeCreated();
      // Clear all timeouts on cleanup
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  // Use useCallback to ensure stable reference, but check ref for latest values
  const isNewTask = useCallback((taskId: number | string | undefined) => {
    if (!taskId) return false;
    const id = typeof taskId === 'string' ? parseInt(taskId, 10) : taskId;
    if (typeof id !== 'number' || isNaN(id)) return false;
    return newTaskIdsRef.current.has(id);
  }, []);

  return {
    isNewTask,
    newTaskIds, // Expose state so components can react to changes
  };
}
