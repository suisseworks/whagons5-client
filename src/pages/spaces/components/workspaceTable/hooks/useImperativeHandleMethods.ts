/**
 * Hook for imperative handle methods (exposed via ref)
 */

import { useImperativeHandle } from 'react';
import { WorkspaceTableHandle } from '../types';

export function useImperativeHandleMethods(
  ref: React.ForwardedRef<WorkspaceTableHandle>,
  opts: {
    gridRef: React.RefObject<any>;
    applyFilterModelToGrid: (opts: { api: any; model: any; onFiltersChanged?: (active: boolean) => void; onAfterApplied?: () => void }) => void;
    refreshGrid: () => void;
    onFiltersChanged?: (active: boolean) => void;
  }
) {
  const { gridRef, applyFilterModelToGrid, refreshGrid, onFiltersChanged } = opts;

  useImperativeHandle(ref, () => ({
    clearFilters: () => {
      if (!gridRef.current?.api) return;
      applyFilterModelToGrid({
        api: gridRef.current.api,
        model: null,
        onFiltersChanged,
        onAfterApplied: refreshGrid,
      });
    },
    hasFilters: () => {
      try {
        return !!gridRef.current?.api?.isAnyFilterPresent();
      } catch { return false; }
    },
    setFilterModel: (model: any) => {
      if (!gridRef.current?.api) return;
      applyFilterModelToGrid({
        api: gridRef.current.api,
        model,
        onFiltersChanged,
        onAfterApplied: refreshGrid,
      });
    },
    getFilterModel: () => {
      try {
        // AG Grid's filter model is the single source of truth for the UI & modal
        return gridRef.current?.api?.getFilterModel?.() || {};
      } catch { return {}; }
    },
    clearSelection: () => {
      try {
        gridRef.current?.api?.deselectAll?.();
      } catch {
        // ignore
      }
    },
  }), [refreshGrid, onFiltersChanged, gridRef, applyFilterModelToGrid]);
}
