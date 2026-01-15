/**
 * Hook for handling grid ready callback
 */

import { useCallback } from 'react';
import { buildGetRows } from '../grid/dataSource';

export function useGridReady(opts: {
  useClientSide: boolean;
  getRows: ReturnType<typeof buildGetRows>;
  refreshGrid: () => void;
  applyStoredColumnOrder: (columnApi?: any) => void;
  suppressPersistRef: React.MutableRefObject<boolean>;
  onFiltersChanged?: (active: boolean) => void;
  onReady?: () => void;
}) {
  const {
    useClientSide,
    getRows,
    refreshGrid,
    applyStoredColumnOrder,
    suppressPersistRef,
    onFiltersChanged,
    onReady,
  } = opts;

  return useCallback((params: any) => {
    onFiltersChanged?.(!!params.api.isAnyFilterPresent?.());

    suppressPersistRef.current = true;
    try {
      const currentSort = params.api.getSortModel?.() || [];
      if (currentSort.length === 0) {
        params.api.setSortModel([{ colId: 'created_at', sort: 'desc' }]);
      }
    } catch {}

    if (!useClientSide) {
      // Set sort again to ensure it's applied (in case the first call didn't work)
      try {
        const sortModel = params.api.getSortModel?.() || [];
        if (sortModel.length === 0 || !sortModel.some((s: any) => s.colId === 'created_at')) {
          params.api.setSortModel([{ colId: 'created_at', sort: 'desc' }]);
        }
      } catch {}
      
      const ds = { rowCount: undefined, getRows };
      params.api.setGridOption('datasource', ds);
      console.log('[WT Filters] onGridReady refreshing infinite cache');
      params.api.refreshInfiniteCache();
    } else {
      console.log('[WT Filters] onGridReady client-side refresh');
      // Ensure sort is set before refreshing
      try {
        const sortModel = params.api.getSortModel?.() || [];
        if (sortModel.length === 0 || !sortModel.some((s: any) => s.colId === 'created_at')) {
          params.api.setSortModel([{ colId: 'created_at', sort: 'desc' }]);
        }
      } catch {}
      refreshGrid();
    }

    applyStoredColumnOrder(params.columnApi);

    setTimeout(() => {
      suppressPersistRef.current = false;
    }, 0);

    try { onReady?.(); } catch {}
  }, [getRows, useClientSide, onFiltersChanged, refreshGrid, applyStoredColumnOrder, suppressPersistRef, onReady]);
}
