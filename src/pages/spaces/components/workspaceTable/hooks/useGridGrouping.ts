/**
 * Hook for managing grid grouping configuration
 */

import { useEffect, useMemo } from 'react';

export function useGridGrouping(opts: {
  gridRef: React.RefObject<any>;
  useClientSide: boolean;
  groupBy: 'none' | 'spot_id' | 'status_id' | 'priority_id';
  collapseGroups: boolean;
  columnDefs: any[];
  externalFilterModelRef: React.MutableRefObject<any>;
  ensureFiltersApplied: (api: any) => void;
}) {
  const {
    gridRef,
    useClientSide,
    groupBy,
    collapseGroups,
    columnDefs,
    externalFilterModelRef,
    ensureFiltersApplied,
  } = opts;

  const autoGroupColumnDef = useMemo(() => ({
    headerName: groupBy === 'status_id' ? 'Status' : groupBy === 'priority_id' ? 'Priority' : 'Location',
    minWidth: 220,
    cellRendererParams: {
      suppressCount: false,
    },
  }), [groupBy]);

  useEffect(() => {
    const api = gridRef.current?.api;
    const colApi = gridRef.current?.columnApi;
    if (!api) return;

    const currentFilterModel = api.getFilterModel?.() || {};

    // In infinite mode, ensure grouping is cleared visually
    if (!useClientSide) {
      try {
        api.setGridOption('autoGroupColumnDef', undefined as any);
        colApi?.setRowGroupColumns([]);
        api.setColumnDefs(columnDefs as any);
        if (currentFilterModel && Object.keys(currentFilterModel).length > 0) {
          api.setFilterModel(currentFilterModel);
          externalFilterModelRef.current = currentFilterModel;
        }
        ensureFiltersApplied(api);
      } catch {}
      return;
    }

    // Client-side mode: apply or clear
    try {
      if (groupBy === 'none') {
        api.setGridOption('autoGroupColumnDef', undefined as any);
        colApi?.setRowGroupColumns([]);
        // show hidden group columns if previously hidden
        colApi?.setColumnVisible('spot_id', true);
        colApi?.setColumnVisible('status_id', true);
        colApi?.setColumnVisible('priority_id', true);
        api.setColumnDefs(columnDefs as any);
        if (currentFilterModel && Object.keys(currentFilterModel).length > 0) {
          api.setFilterModel(currentFilterModel);
          externalFilterModelRef.current = currentFilterModel;
        }
        ensureFiltersApplied(api);
        api.refreshClientSideRowModel?.('everything');
      } else {
        api.setGridOption('autoGroupColumnDef', autoGroupColumnDef);
        api.setGridOption('groupDefaultExpanded', collapseGroups ? 0 : 1);
        // Explicitly set the grouped column to ensure switch takes effect
        const field = groupBy;
        colApi?.setRowGroupColumns([field]);
        // hide the grouped column to avoid duplication
        colApi?.setColumnVisible('spot_id', field !== 'spot_id');
        colApi?.setColumnVisible('status_id', field !== 'status_id');
        colApi?.setColumnVisible('priority_id', field !== 'priority_id');
        api.setColumnDefs(columnDefs as any);
        if (currentFilterModel && Object.keys(currentFilterModel).length > 0) {
          api.setFilterModel(currentFilterModel);
          externalFilterModelRef.current = currentFilterModel;
        }
        ensureFiltersApplied(api);
        api.refreshClientSideRowModel?.('everything');
      }
    } catch {}
  }, [autoGroupColumnDef, collapseGroups, groupBy, columnDefs, useClientSide, gridRef, externalFilterModelRef, ensureFiltersApplied]);

  return { autoGroupColumnDef };
}
