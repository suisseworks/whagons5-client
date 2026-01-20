import React, { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { removeTaskAsync, restoreTaskAsync } from '@/store/reducers/tasksSlice';
import toast from 'react-hot-toast';
import { useLanguage } from '@/providers/LanguageProvider';

/**
 * Hook for managing task deletion with undo functionality
 */
export const useTaskDeletion = (gridRef: React.MutableRefObject<any>, refreshGrid: () => void) => {
  const { t } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: number; name?: string } | null>(null);

  const handleDeleteTask = useCallback(async (taskId: number, taskName?: string) => {
    if (!Number.isFinite(taskId)) return;

    // Get task data from grid if available
    let taskData: { id: number; name?: string } = { id: taskId };
    try {
      const api = gridRef.current?.api;
      if (api) {
        api.forEachNode((node: any) => {
          if (node.data?.id === taskId) {
            taskData = { id: taskId, name: node.data?.name || taskName };
          }
        });
      }
    } catch (e) {
      // Fallback to provided name or ID
      taskData = { id: taskId, name: taskName };
    }

    setTaskToDelete(taskData);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!taskToDelete) return;

    const taskId = taskToDelete.id;
    const taskName = taskToDelete.name;

    setDeleteDialogOpen(false);

    // Store toast ID to dismiss on error
    let successToastId: string | undefined;

    try {
      await dispatch(removeTaskAsync(taskId)).unwrap();

      // Show success toast with undo option
      successToastId = toast.success(
        (t) => (
          <div className="flex flex-col gap-1">
            <div className="font-semibold">Task deleted</div>
            <div className="text-sm opacity-90">
              {taskName ? `"${taskName}" has been deleted.` : "Task has been deleted."}
            </div>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                const restoreToast = toast.loading("Restoring task...");
                try {
                  await dispatch(restoreTaskAsync(taskId)).unwrap();
                  toast.dismiss(restoreToast);
                  toast.success(
                    taskName ? `"${taskName}" has been restored.` : "Task has been restored.",
                    { duration: 5000 }
                  );
                  refreshGrid();
                } catch (error: any) {
                  toast.dismiss(restoreToast);
                  const errorMessage = error?.message || error?.response?.data?.message || "Could not restore the task.";
                  toast.error(errorMessage, { duration: 5000 });
                }
              }}
              className="text-left text-sm font-medium underline underline-offset-4 hover:no-underline mt-1"
            >
              Undo
            </button>
          </div>
        ),
        { duration: 8000 }
      );

      refreshGrid();
    } catch (error: any) {
      // Dismiss success toast if it was shown (shouldn't happen, but just in case)
      if (successToastId) {
        toast.dismiss(successToastId);
      }

      const errorMessage = error?.message || error?.response?.data?.message || error?.toString() || "Failed to delete task";
      const status = error?.response?.status || error?.status;

      // 403 errors are now handled by API interceptor, only show other errors
      if (status !== 403) {
        toast.error(errorMessage, { duration: 5000 });
      }
    } finally {
      setTaskToDelete(null);
    }
  }, [taskToDelete, dispatch, refreshGrid]);

  return {
    deleteDialogOpen,
    setDeleteDialogOpen,
    taskToDelete,
    handleDeleteTask,
    confirmDelete,
  };
};
