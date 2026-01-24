import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TasksCache } from '@/store/indexedDB/TasksCache';

export function useWorkspaceTaskDialog() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const taskIdFromUrl = searchParams.get('taskId');
  
  const [openCreateTask, setOpenCreateTask] = useState(false);
  const [openEditTask, setOpenEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Handle opening task from URL parameter (from notifications)
  useEffect(() => {
    if (!taskIdFromUrl) return;

    (async () => {
      try {
        if (!TasksCache.initialized) await TasksCache.init();
        
        const taskId = Number(taskIdFromUrl);
        if (!Number.isFinite(taskId)) return;

        const task = await TasksCache.getTask(String(taskId));
        if (task) {
          setSelectedTask(task);
          setOpenEditTask(true);

          const newSearchParams = new URLSearchParams(location.search);
          newSearchParams.delete('taskId');
          const newSearch = newSearchParams.toString();
          const newUrl = location.pathname + (newSearch ? `?${newSearch}` : '');
          navigate(newUrl, { replace: true });
        }
      } catch (error) {
        console.error('Failed to open task from URL:', error);
      }
    })();
  }, [taskIdFromUrl, location.pathname, location.search, navigate]);

  const handleOpenTaskDialog = (task: any) => {
    setSelectedTask(task);
    (window as any).__taskDialogClickTime = performance.now();
    setOpenEditTask(true);
  };

  return {
    openCreateTask,
    setOpenCreateTask,
    openEditTask,
    setOpenEditTask,
    selectedTask,
    setSelectedTask,
    handleOpenTaskDialog,
  };
}
