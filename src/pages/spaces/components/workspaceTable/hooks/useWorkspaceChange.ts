/**
 * Hook for handling workspace changes
 */

import { useEffect, useState } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';

export interface UseWorkspaceChangeReturn {
  error: string | null;
}

export function useWorkspaceChange(opts: {
  workspaceId: string;
  modulesLoaded: boolean;
  gridRef: React.RefObject<any>;
  refreshGrid: () => void;
  exitEditMode: (api?: any) => void;
}): UseWorkspaceChangeReturn {
  const { workspaceId, modulesLoaded, gridRef, refreshGrid, exitEditMode } = opts;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAndRefresh = async () => {
      if (!modulesLoaded) return;
      
      // Clear any previous errors
      setError(null);
      
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

        // Refresh grid after checking
        // Note: Sync stream (DataManager) handles task cache updates automatically
        if (gridRef.current?.api) {
          refreshGrid();
        }
      } catch (error: any) {
        const errorMessage = `[useWorkspaceChange] Error during workspace change check for workspace ${workspaceId}`;
        const errorDetails = error?.message || error?.toString() || 'Unknown error';
        
        console.error(errorMessage, {
          workspaceId,
          error: errorDetails,
          stack: error?.stack,
          response: error?.response?.data,
        });
        
        setError(errorMessage);
        
        // Still try to refresh grid even if check failed
        if (gridRef.current?.api) {
          refreshGrid();
        }
      }
    };
    
    checkAndRefresh();
  }, [workspaceId, refreshGrid, modulesLoaded, exitEditMode, gridRef]);

  return { error };
}
