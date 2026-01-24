import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setPresets, setFilterModel, setSearchText } from '@/store/reducers/uiStateSlice';
import { listPresets, listPinnedPresets, savePreset } from '@/pages/spaces/components/workspaceTable/utils/filterPresets';
import type { AppDispatch } from '@/store/store';

export function useWorkspaceFilters(params: {
  workspaceKey: string;
  currentUser: any;
  filtersOpen: boolean;
  tableRef: { current: { getFilterModel?: () => any; setFilterModel?: (model: any) => void; clearSelection?: () => void } | null };
}) {
  const { workspaceKey, currentUser, filtersOpen, tableRef } = params;
  const dispatch = useDispatch<AppDispatch>();

  // Initialize common presets if they don't exist
  useEffect(() => {
    const currentUserId = Number((currentUser as any)?.id);
    if (!Number.isFinite(currentUserId)) return;
    const all = listPresets(workspaceKey);
    
    const today = new Date().toISOString().split('T')[0];
    const commonPresets = [
      { name: 'My tasks', model: { user_ids: { filterType: 'set', values: [currentUserId] } } },
      { name: 'Overdue', model: { due_date: { filterType: 'date', type: 'dateBefore', filter: today } } },
      { name: 'Due today', model: { due_date: { filterType: 'date', type: 'equals', filter: today } } },
    ];
    
    const existingNames = new Set(all.map(p => p.name.toLowerCase()));
    let needsUpdate = false;
    
    for (const preset of commonPresets) {
      if (!existingNames.has(preset.name.toLowerCase())) {
        savePreset({ name: preset.name, workspaceScope: workspaceKey, model: preset.model });
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      const quick = listPinnedPresets(workspaceKey).slice(0, 4);
      const updatedAll = listPresets(workspaceKey);
      dispatch(setPresets({ quickPresets: quick, allPresets: updatedAll }));
    }
  }, [workspaceKey, currentUser, dispatch]);

  // Load quick presets scoped to workspace
  useEffect(() => {
    try {
      const quick = listPinnedPresets(workspaceKey).slice(0, 4);
      const all = listPresets(workspaceKey);
      dispatch(setPresets({ quickPresets: quick, allPresets: all }));
    } catch {
      dispatch(setPresets({ quickPresets: [], allPresets: [] }));
    }
  }, [workspaceKey, filtersOpen, dispatch]);

  // Persist and restore search text globally
  useEffect(() => {
    const key = `wh_workspace_search_global`;
    try {
      const saved = localStorage.getItem(key);
      if (saved != null) {
        dispatch(setSearchText(saved));
      }
    } catch {}
  }, [dispatch]);

  // Listen for filter apply events from Header component
  useEffect(() => {
    const handleFilterApply = (event: CustomEvent<{ filterModel: any; clearSearch?: boolean }>) => {
      if (tableRef.current) {
        const filterModel = event.detail.filterModel || null;
        tableRef.current.setFilterModel?.(filterModel);
        dispatch(setFilterModel(filterModel));
        const key = `wh_workspace_filters_${workspaceKey}`;
        try {
          if (filterModel) {
            localStorage.setItem(key, JSON.stringify(filterModel));
          } else {
            localStorage.removeItem(key);
          }
        } catch {}
        if (event.detail.clearSearch) {
          dispatch(setSearchText(''));
        }
      }
    };
    window.addEventListener('workspace-filter-apply', handleFilterApply as EventListener);
    return () => {
      window.removeEventListener('workspace-filter-apply', handleFilterApply as EventListener);
    };
  }, [workspaceKey, dispatch, tableRef]);

  const handleTableReady = () => {
    const key = `wh_workspace_filters_${workspaceKey}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved && tableRef.current) {
        const model = JSON.parse(saved);
        tableRef.current.setFilterModel?.(model);
      }
    } catch {}
  };

  return { handleTableReady };
}
