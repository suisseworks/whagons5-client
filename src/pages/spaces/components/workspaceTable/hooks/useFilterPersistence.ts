import { useRef, useEffect, useCallback } from 'react';
import { normalizeFilterModelForGrid } from '../utils/filterUtils';

/**
 * Hook for persisting and restoring filter state from localStorage
 */
export const useFilterPersistence = (workspaceId: string) => {
  const externalFilterModelRef = useRef<any>({});
  const debugFilters = useRef<boolean>(false);
  const suppressPersistRef = useRef(false);

  // Initialize debug flag
  useEffect(() => {
    try {
      debugFilters.current = localStorage.getItem('wh-debug-filters') === 'true';
    } catch {
      debugFilters.current = false;
    }
  }, []);

  // Preload saved filter model
  useEffect(() => {
    try {
      const key = `wh_workspace_filters_${(workspaceId || 'all')}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        externalFilterModelRef.current = normalizeFilterModelForGrid(parsed);
      } else {
        externalFilterModelRef.current = {};
      }
    } catch {
      externalFilterModelRef.current = {};
    }
  }, [workspaceId]);

  const persistFilterModel = useCallback((model: any) => {
    if (suppressPersistRef.current) return;
    
    try {
      const key = `wh_workspace_filters_${workspaceId || 'all'}`;
      if (debugFilters.current) {
        console.log('[WT] persisted model=', model);
      }
      if (model && Object.keys(model).length > 0) {
        localStorage.setItem(key, JSON.stringify(model));
      } else {
        localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
  }, [workspaceId]);

  const clearPersistedFilters = useCallback(() => {
    try {
      const key = `wh_workspace_filters_${workspaceId || 'all'}`;
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  }, [workspaceId]);

  /**
   * Apply a filter model to AG Grid and keep refs + persistence in sync.
   * This centralizes logic that was previously duplicated across WorkspaceTable.
   */
  const applyFilterModelToGrid = useCallback((params: {
    api: any;
    model: any; // null => clear
    onFiltersChanged?: (active: boolean) => void;
    onAfterApplied?: () => void; // e.g. refresh grid
  }) => {
    const api = params.api;
    if (!api) return;

    // Prevent persistence loops while we mutate the grid filter model
    suppressPersistRef.current = true;
    try {
      // If model is null/undefined, this is a request to CLEAR all filters
      if (!params.model) {
        externalFilterModelRef.current = {};
        api.setFilterModel(null);
        try {
          params.onFiltersChanged?.(false);
        } catch {
          // ignore
        }
        clearPersistedFilters();
        try {
          params.onAfterApplied?.();
        } catch {
          // ignore
        }
        return;
      }

      const gridModel = normalizeFilterModelForGrid(params.model);
      externalFilterModelRef.current = gridModel;
      try {
        if (debugFilters.current) console.log('[WT] applyFilterModelToGrid model=', gridModel);
      } catch {
        // ignore
      }

      api.setFilterModel(Object.keys(gridModel).length > 0 ? gridModel : null);
      try {
        params.onFiltersChanged?.(!!api.isAnyFilterPresent?.());
      } catch {
        // ignore
      }

      // Persist what the grid actually sees (single source of truth)
      persistFilterModel(gridModel);
      try {
        params.onAfterApplied?.();
      } catch {
        // ignore
      }
    } finally {
      // Release suppression on next tick to allow user-driven changes to persist
      setTimeout(() => {
        suppressPersistRef.current = false;
      }, 0);
    }
  }, [clearPersistedFilters, persistFilterModel]);

  /**
   * Sync external ref + persistence from the grid's current filter model.
   * Intended for AG Grid `onFilterChanged` handler.
   */
  const handleGridFilterChanged = useCallback((params: {
    api: any;
    onFiltersChanged?: (active: boolean) => void;
  }) => {
    if (suppressPersistRef.current) return;
    const api = params.api;
    if (!api) return;

    try {
      const gm = api.getFilterModel?.() || {};
      externalFilterModelRef.current = gm;
      try {
        if (debugFilters.current) {
          console.log('[WT] handleGridFilterChanged gridModel=', JSON.stringify(gm, null, 2));
        }
      } catch {
        // ignore
      }
      persistFilterModel(gm);
      try {
        params.onFiltersChanged?.(!!api.isAnyFilterPresent?.());
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }, [persistFilterModel]);

  /**
   * If the grid has no active filters but we have an external remembered model,
   * re-apply it to the grid (prevents "filters lost" regressions).
   */
  const ensureFiltersApplied = useCallback((api: any) => {
    if (!api) return;
    try {
      const saved = externalFilterModelRef.current || {};
      const hasSaved = saved && Object.keys(saved).length > 0;
      if (!hasSaved) return;
      if (!api.isAnyFilterPresent?.()) {
        suppressPersistRef.current = true;
        api.setFilterModel(saved);
        setTimeout(() => {
          suppressPersistRef.current = false;
        }, 0);
      }
    } catch {
      // ignore
    }
  }, []);

  return {
    externalFilterModelRef,
    debugFilters,
    suppressPersistRef,
    persistFilterModel,
    clearPersistedFilters,
    applyFilterModelToGrid,
    handleGridFilterChanged,
    ensureFiltersApplied,
  };
};
