/**
 * Hook for grid refresh logic
 */

import { useCallback } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { refreshClientSideGrid } from '../grid/dataSource';

export function useGridRefresh(opts: {
  modulesLoaded: boolean;
  gridRef: React.RefObject<any>;
  useClientSide: boolean;
  rowCache: React.MutableRefObject<Map<string, { rows: any[]; rowCount: number }>>;
  searchRef: React.MutableRefObject<string>;
  workspaceRef: React.MutableRefObject<string>;
  statusMapRef: React.MutableRefObject<any>;
  priorityMapRef: React.MutableRefObject<any>;
  spotMapRef: React.MutableRefObject<any>;
  userMapRef: React.MutableRefObject<any>;
  tagMapRef: React.MutableRefObject<any>;
  taskTagsRef: React.MutableRefObject<any>;
  suppressPersistRef: React.MutableRefObject<boolean>;
  debugFilters: React.MutableRefObject<boolean>;
  setClientRows: (rows: any[]) => void;
}) {
  const {
    modulesLoaded,
    gridRef,
    useClientSide,
    rowCache,
    searchRef,
    workspaceRef,
    statusMapRef,
    priorityMapRef,
    spotMapRef,
    userMapRef,
    tagMapRef,
    taskTagsRef,
    suppressPersistRef,
    debugFilters,
    setClientRows,
  } = opts;

  const refreshGrid = useCallback(async () => {
    if (!modulesLoaded || !gridRef.current?.api) return;

    if (suppressPersistRef.current) {
      return;
    }

    suppressPersistRef.current = true;

    if (useClientSide) {
      try {
        if (!TasksCache.initialized) await TasksCache.init();
        const sortModel = gridRef.current.api.getSortModel?.() || [{ colId: 'created_at', sort: 'desc' }];
        const { rows, totalFiltered } = await refreshClientSideGrid(gridRef.current.api, TasksCache, {
          search: searchRef.current,
          workspaceRef,
          statusMapRef,
          priorityMapRef,
          spotMapRef,
          userMapRef,
          tagMapRef,
          taskTagsRef,
          sortModel,
        });

        setClientRows(rows);
        gridRef.current.api.refreshClientSideRowModel?.('everything');
      } catch (e) {
        console.warn('refreshGrid (client-side) failed', e);
      }
    } else {
      rowCache.current.clear();
      gridRef.current.api.refreshInfiniteCache();
    }

    setTimeout(() => {
      suppressPersistRef.current = false;
    }, 0);
  }, [modulesLoaded, rowCache, useClientSide, searchRef, workspaceRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, tagMapRef, taskTagsRef, suppressPersistRef, debugFilters, setClientRows, gridRef]);

  return refreshGrid;
}
