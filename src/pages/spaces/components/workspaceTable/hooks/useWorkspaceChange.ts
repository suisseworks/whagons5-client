/**
 * Hook for handling workspace changes
 */

import { useEffect } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';

export function useWorkspaceChange(opts: {
  workspaceId: string;
  modulesLoaded: boolean;
  gridRef: React.RefObject<any>;
  refreshGrid: () => void;
  exitEditMode: (api?: any) => void;
}) {
  const { workspaceId, modulesLoaded, gridRef, refreshGrid, exitEditMode } = opts;

  useEffect(() => {
    const checkAndRefresh = async () => {
      if (!modulesLoaded) return;
      
      // Exit edit mode when workspace changes
      exitEditMode(gridRef.current?.api);
      
      try {
        // Ensure cache is initialized
        await TasksCache.init();
        
        // Check if we have tasks for this workspace in cache
        const baseParams: any = {};
        if (workspaceId !== 'all' && workspaceId !== 'shared') {
          baseParams.workspace_id = workspaceId;
        }
        if (workspaceId === 'shared') {
          baseParams.shared_with_me = true;
        }
        
        const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
        const taskCount = countResp?.rowCount ?? 0;
        
        // If no tasks found and we're viewing a specific workspace (not 'all'), 
        // try fetching from API to ensure cache is up to date
        if (taskCount === 0 && workspaceId !== 'all' && workspaceId !== 'shared') {
          try {
            await TasksCache.fetchTasks();
          } catch (fetchError) {
            // Silently fail - cache will be updated on next validation
          }
        }
        
        // Refresh grid after checking/fetching
        if (gridRef.current?.api) {
          refreshGrid();
        }
      } catch (error) {
        // Silently handle errors - grid will refresh anyway
        // Still try to refresh grid even if check failed
        if (gridRef.current?.api) {
          refreshGrid();
        }
      }
    };
    
    checkAndRefresh();
  }, [workspaceId, refreshGrid, modulesLoaded, exitEditMode, gridRef]);
}
