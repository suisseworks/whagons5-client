'use client';

import { useCallback, useMemo, useState, useRef, useEffect, lazy, Suspense, forwardRef, useImperativeHandle } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { updateTaskAsync } from '@/store/reducers/tasksSlice';
import { iconService } from '@/database/iconService';
import { buildWorkspaceColumns } from './workspaceTable/columns';

// Import abstracted utilities
import { loadAgGridModules, createDefaultColDef, createGridOptions } from './workspaceTable/agGridSetup';
import {
  getUserInitials,
  getUserDisplayName,
  getUsersFromIds,
  formatDueDate
} from './workspaceTable/userUtils';
import { GRID_CONSTANTS, createLoadingSpinner, createGridContainer } from './workspaceTable/gridConfig';
import { setupTaskEventHandlers } from './workspaceTable/eventHandlers';
import {
  useGridReduxState,
  useDerivedGridState,
  useGridModeDecision,
  useMetadataLoadedFlags
} from './workspaceTable/gridState';
import {
  createStatusMap,
  createPriorityMap,
  createSpotMap,
  createUserMap,
  createCategoryToGroup,
  createTransitionsByGroupFrom,
  createFilteredPriorities
} from './workspaceTable/mappers';
const ALLOWED_FILTER_KEYS = new Set(['status_id', 'priority_id', 'spot_id']);

const sanitizeFilterModel = (model: any): any => {
  if (!model || typeof model !== 'object') return {};
  const cleaned: any = {};
  for (const key of Object.keys(model)) {
    if (ALLOWED_FILTER_KEYS.has(key)) cleaned[key] = model[key];
  }
  return cleaned;
};

const normalizeFilterModelForQuery = (raw: any): any => {
  const fm = sanitizeFilterModel(raw);
  if (fm.status_id) {
    const st = { ...fm.status_id } as any;
    const rawValues: any[] = Array.isArray(st.values) ? st.values : [];
    const hasNonNumeric = rawValues.some((v) => isNaN(Number(v)));
    st.values = hasNonNumeric ? rawValues.map((v) => String(v)) : rawValues.map((v) => Number(v));
    fm.status_id = st;
  }
  for (const key of ['priority_id', 'spot_id']) {
    if (fm[key]) {
      const st = { ...fm[key] } as any;
      const rawValues: any[] = Array.isArray(st.values) ? st.values : [];
      st.values = rawValues.map((v) => Number(v));
      fm[key] = st;
    }
  }
  return fm;
};
import { buildGetRows } from './workspaceTable/dataSource';

// Lazy load AgGridReact component
const AgGridReact = lazy(() => import('ag-grid-react').then(module => ({ default: module.AgGridReact }))) as any;


export type WorkspaceTableHandle = {
  clearFilters: () => void;
  hasFilters: () => boolean;
  setFilterModel: (model: any) => void;
  getFilterModel: () => any;
};

const WorkspaceTable = forwardRef<WorkspaceTableHandle, {
  rowCache: React.MutableRefObject<Map<string, { rows: any[]; rowCount: number }>>;
  workspaceId: string;
  searchText?: string;
  onFiltersChanged?: (active: boolean) => void;
  onSelectionChanged?: (selectedIds: number[]) => void;
  rowHeight?: number;
  groupBy?: 'none' | 'spot_id' | 'status_id' | 'priority_id';
  collapseGroups?: boolean;
  onReady?: () => void;
  onModeChange?: (info: { useClientSide: boolean; totalFiltered: number }) => void;
}>(({
  rowCache,
  workspaceId,
  searchText = '',
  onFiltersChanged,
  onSelectionChanged,
  rowHeight,
  groupBy = 'none',
  collapseGroups = true,
  onReady,
  onModeChange,
}, ref): React.ReactNode => {
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const gridRef = useRef<any>(null);
  // Refs to avoid stale closures so we can refresh cache without rebinding datasource
  const searchRef = useRef<string>(searchText);
  useEffect(() => { searchRef.current = searchText; }, [searchText]);
  const workspaceRef = useRef<string>(workspaceId);
  useEffect(() => { workspaceRef.current = workspaceId; }, [workspaceId]);

  // Load modules on component mount
  useEffect(() => {
    loadAgGridModules()
      .then(() => {
        setModulesLoaded(true);
      })
      .catch(console.error);
  }, []);

  // Redux state management
  const dispatch = useDispatch<AppDispatch>();
  const reduxState = useGridReduxState();
  const derivedState = useDerivedGridState(reduxState, { workspaceId, searchText });

  // State for status icons
  const [statusIcons, setStatusIcons] = useState<{ [key: string]: any }>({});
  const [defaultStatusIcon, setDefaultStatusIcon] = useState<any>(null);

  // Extract state from abstracted hooks
  const { statuses, priorities, spots, users, categories, statusTransitions } = reduxState;
  const { defaultCategoryId } = derivedState;
  const metadataLoadedFlags = useMetadataLoadedFlags(reduxState);

  // Load default status icon
  useEffect(() => {
    const loadDefaultIcon = async () => {
      try {
        const icon = await iconService.getIcon('circle');
        setDefaultStatusIcon(icon);
      } catch (error) {
        console.error('Error loading default status icon:', error);
        // Set a fallback icon
        setDefaultStatusIcon('fa-circle');
      }
    };
    loadDefaultIcon();
  }, []);

  // Function to get status icon similar to AppSidebar
  const getStatusIcon = useCallback((iconName?: string) => {
    if (!iconName || typeof iconName !== 'string') {
      return defaultStatusIcon;
    }

    // Parse FontAwesome class format to get the actual icon name
    let parsedIconName = iconName;

    // Handle FontAwesome class format (fas fa-icon-name, far fa-icon-name, etc.)
    const faClassMatch = iconName.match(/^(fas|far|fal|fat|fab|fad|fass)\s+fa-(.+)$/);
    if (faClassMatch) {
      parsedIconName = faClassMatch[2]; // Return just the icon name part
    } else if (iconName.startsWith('fa-')) {
      // Handle fa-prefix format (fa-icon-name -> icon-name)
      parsedIconName = iconName.substring(3);
    }

    return statusIcons[parsedIconName] || defaultStatusIcon;
  }, [statusIcons, defaultStatusIcon]);

  const globalStatuses = useMemo(() => {
    // Statuses are global now; no per-category filtering
    return statuses;
  }, [statuses]);

  // Load status icons when statuses change
  useEffect(() => {
    const loadStatusIcons = async () => {
      if (!globalStatuses || globalStatuses.length === 0) return;

      const iconNames = globalStatuses
        .map((status: any) => status.icon)
        .filter(Boolean);

      if (iconNames.length > 0) {
        try {
          const icons = await iconService.loadIcons(iconNames);
          setStatusIcons(icons);
        } catch (error) {
          console.error('Error loading status icons:', error);
        }
      }
    };

    loadStatusIcons();
  }, [globalStatuses]);

  // Create mapping objects using abstracted utilities
  const statusMap = useMemo(() => createStatusMap(globalStatuses), [globalStatuses]);
  const categoryToGroup = useMemo(() => createCategoryToGroup(categories), [categories]);
  const transitionsByGroupFrom = useMemo(() => createTransitionsByGroupFrom(statusTransitions), [statusTransitions]);
  const priorityMap = useMemo(() => createPriorityMap(priorities), [priorities]);
  const spotMap = useMemo(() => createSpotMap(spots), [spots]);
  const userMap = useMemo(() => createUserMap(users), [users]);
  const filteredPriorities = useMemo(() => createFilteredPriorities(priorities, defaultCategoryId), [priorities, defaultCategoryId]);

  // Refs for data access in callbacks
  const statusMapRef = useRef(statusMap);
  useEffect(() => { statusMapRef.current = statusMap; }, [statusMap]);
  const priorityMapRef = useRef(priorityMap);
  useEffect(() => { priorityMapRef.current = priorityMap; }, [priorityMap]);
  const spotMapRef = useRef(spotMap);
  useEffect(() => { spotMapRef.current = spotMap; }, [spotMap]);
  const userMapRef = useRef(userMap);
  useEffect(() => { userMapRef.current = userMap; }, [userMap]);
  const globalStatusesRef = useRef(globalStatuses);
  useEffect(() => { globalStatusesRef.current = globalStatuses; }, [globalStatuses]);

  const getAllowedNextStatuses = useCallback((task: any): number[] => {
    const groupId = categoryToGroup.get(Number(task.category_id));
    if (!groupId) return [];
    const byFrom = transitionsByGroupFrom.get(groupId);
    if (!byFrom) return [];
    const set = byFrom.get(Number(task.status_id));
    return set ? Array.from(set.values()) : [];
  }, [categoryToGroup, transitionsByGroupFrom]);

  const getDoneStatusId = useCallback((): number | undefined => {
    const statusesArr = globalStatusesRef.current || [];
    const byAction = statusesArr.find((s: any) => String((s as any).action || '').toUpperCase() === 'DONE');
    if (byAction?.id != null) return Number(byAction.id);
    const byName = statusesArr.find((s: any) => String((s as any).name || '').toLowerCase().includes('done'));
    if (byName?.id != null) return Number(byName.id);
    return undefined;
  }, []);

  const handleChangeStatus = useCallback(async (task: any, toStatusId: number): Promise<boolean> => {
    if (!task || Number(task.status_id) === Number(toStatusId)) return true;
    try {
      await dispatch(updateTaskAsync({ id: Number(task.id), updates: { status_id: Number(toStatusId) } })).unwrap();
      return true;
    } catch (e) {
      console.warn('Status change failed', e);
      return false;
    }
  }, [dispatch]);

  // Hybrid mode: client-side when filtered row count is small enough
  const [useClientSide, setUseClientSide] = useState(false);
  const [clientRows, setClientRows] = useState<any[]>([]);

  // Use abstracted grid mode decision
  const decideMode = useGridModeDecision(workspaceId, searchText);

  useEffect(() => {
    const runDecision = async () => {
      // Force client-side mode when grouping is enabled (row grouping unsupported in Infinite Row Model)
      if (groupBy && groupBy !== 'none') {
        setUseClientSide(true);
        try {
          if (!TasksCache.initialized) await TasksCache.init();
          const baseParams: any = { search: searchText };
          if (workspaceId !== 'all') baseParams.workspace_id = workspaceId;
          const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
          const totalFiltered = countResp?.rowCount ?? 0;
          const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: totalFiltered });
          setClientRows(rowsResp?.rows || []);
          try { onModeChange?.({ useClientSide: true, totalFiltered }); } catch {}
        } catch (e) {
          console.warn('Failed to load client-side rows for grouping', e);
          setClientRows([]);
        }
        return;
      }

      const result = await decideMode();
      setUseClientSide(result.useClientSide);
      try { onModeChange?.(result); } catch {}
      if (result.useClientSide && result.totalFiltered > 0) {
        try {
          if (!TasksCache.initialized) await TasksCache.init();

          // Build minimal params equivalent to the grid query
          const baseParams: any = { search: searchText };
          if (workspaceId !== 'all') baseParams.workspace_id = workspaceId;

          const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: result.totalFiltered });
          setClientRows(rowsResp?.rows || []);
        } catch (e) {
          console.warn('Failed to load client-side rows', e);
          setClientRows([]);
          setUseClientSide(false);
        }
      } else {
        setClientRows([]);
      }
    };
    runDecision();
  }, [workspaceId, searchText, decideMode, groupBy]);


  // Removed on-mount loads; AuthProvider hydrates core slices

  // When statuses are loaded/updated, refresh the Status column cells to replace #id with names
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['status_id'], force: true, suppressFlash: true });
    }
  }, [statusMap]);

  // Refresh other columns when their metadata resolves
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['user_ids'], force: true, suppressFlash: true });
    }
  }, [metadataLoadedFlags.usersLoaded]);

  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['priority_id'], force: true, suppressFlash: true });
    }
  }, [priorityMap]);

  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['spot_id'], force: true, suppressFlash: true });
    }
  }, [spotMap]);

  const columnDefs = useMemo(() => buildWorkspaceColumns({
    getUserDisplayName,
    getUserInitials,
    getStatusIcon,
    getAllowedNextStatuses,
    handleChangeStatus,
    statusesLoaded: metadataLoadedFlags.statusesLoaded,
    priorityMap,
    prioritiesLoaded: metadataLoadedFlags.prioritiesLoaded,
    filteredPriorities,
    statusMap,
    usersLoaded: metadataLoadedFlags.usersLoaded,
    getUsersFromIds,
    formatDueDate,
    spotMap,
    spotsLoaded: metadataLoadedFlags.spotsLoaded,
    userMap,
    getDoneStatusId,
    groupField: (useClientSide && groupBy !== 'none') ? groupBy : undefined,
  } as any), [
    statusMap, priorityMap, spotMap, userMap,
    getStatusIcon, formatDueDate, getAllowedNextStatuses, handleChangeStatus,
    metadataLoadedFlags.statusesLoaded, metadataLoadedFlags.prioritiesLoaded,
    metadataLoadedFlags.spotsLoaded, metadataLoadedFlags.usersLoaded,
    filteredPriorities, getUsersFromIds, useClientSide, groupBy
  ]);
  const defaultColDef = useMemo(() => createDefaultColDef(), []);

  // Initialize filter persistence helpers
  const suppressPersistRef = useRef(false);

  // Group column and row styles must be defined before any conditional return to preserve hook order
  const autoGroupColumnDef = useMemo(() => ({
    headerName: groupBy === 'status_id' ? 'Status' : groupBy === 'priority_id' ? 'Priority' : 'Location',
    minWidth: 220,
    cellRendererParams: {
      suppressCount: false,
    },
  }), [groupBy]);

  const getRowStyle = useCallback((params: any) => {
    if (params?.node?.group) return undefined;
    const prId = Number(params?.data?.priority_id);
    const prMeta = priorityMapRef.current[prId];
    const color = prMeta?.color;
    if (!color) return undefined;
    return { borderLeft: `4px solid ${color}` } as React.CSSProperties;
  }, []);

  // Re-apply or clear grouping when controls change
  useEffect(() => {
    const api = gridRef.current?.api;
    const colApi = gridRef.current?.columnApi;
    if (!api) return;

    // In infinite mode, ensure grouping is cleared visually
    if (!useClientSide) {
      try {
        api.setGridOption('autoGroupColumnDef', undefined as any);
        colApi?.setRowGroupColumns([]);
        api.setColumnDefs(columnDefs as any);
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
        api.refreshClientSideRowModel?.('everything');
      }
    } catch {}
  }, [autoGroupColumnDef, collapseGroups, groupBy, columnDefs, useClientSide]);

  const getRows = useMemo(
    () =>
      buildGetRows(TasksCache, {
        rowCache,
        workspaceRef,
        searchRef,
        statusMapRef,
        priorityMapRef,
        spotMapRef,
        userMapRef,
        normalizeFilterModelForQuery,
      }),
    [rowCache, workspaceRef, searchRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef]
  );

  // Function to refresh the grid
  const refreshGrid = useCallback(async () => {
    if (!modulesLoaded || !gridRef.current?.api) return;
    console.log('[WT Filters] refreshGrid: mode =', useClientSide ? 'client' : 'infinite');

    if (suppressPersistRef.current) {
      console.log('[WT Filters] Skipping refresh while restoring filters');
      return;
    }

    suppressPersistRef.current = true;

    if (useClientSide) {
      try {
        if (!TasksCache.initialized) await TasksCache.init();
        const baseParams: any = { search: searchRef.current };
        if (workspaceRef.current !== 'all') baseParams.workspace_id = workspaceRef.current;
        baseParams.__statusMap = statusMapRef.current;
        baseParams.__priorityMap = priorityMapRef.current;
        baseParams.__spotMap = spotMapRef.current;
        baseParams.__userMap = userMapRef.current;
        const activeFm = gridRef.current.api.getFilterModel?.() || {};
        const normalizedFm = normalizeFilterModelForQuery(activeFm);
        baseParams.filterModel = normalizedFm;
        console.log('[WT Filters] refreshGrid client-side baseParams.filterModel:', normalizedFm);
        const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
        const totalFiltered = countResp?.rowCount ?? 0;
        const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: totalFiltered });
        const rows = rowsResp?.rows || [];
        setClientRows(rows);
        gridRef.current.api.setGridOption('rowData', rows);
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
  }, [modulesLoaded, rowCache, useClientSide, searchRef, workspaceRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef]);

  // Clear cache and refresh grid when workspaceId changes
  useEffect(() => {
    if (gridRef.current?.api && modulesLoaded) {
      console.log(`Workspace changed to ${workspaceId}, clearing cache and refreshing grid`);
      refreshGrid();
    }
  }, [workspaceId, refreshGrid, modulesLoaded]);

  // Refresh when global search text changes
  useEffect(() => {
    if (gridRef.current?.api && modulesLoaded) {
      refreshGrid();
    }
  }, [searchText, modulesLoaded, refreshGrid]);

  // Set up task event handlers using abstracted utility
  useEffect(() => {
    const cleanup = setupTaskEventHandlers({ refreshGrid, workspaceId });
    return cleanup;
  }, [refreshGrid, workspaceId]);

  const onGridReady = useCallback((params: any) => {
    onFiltersChanged?.(!!params.api.isAnyFilterPresent?.());

    suppressPersistRef.current = true;

    if (!useClientSide) {
      const ds = { rowCount: undefined, getRows };
      params.api.setGridOption('datasource', ds);
      console.log('[WT Filters] onGridReady refreshing infinite cache');
      params.api.refreshInfiniteCache();
    } else {
      console.log('[WT Filters] onGridReady client-side refresh');
      refreshGrid();
    }

    setTimeout(() => {
      suppressPersistRef.current = false;
    }, 0);

    try { onReady?.(); } catch {}
  }, [getRows, useClientSide, onFiltersChanged, refreshGrid]);

  // Expose imperative methods
  useImperativeHandle(ref, () => ({
    clearFilters: () => {
      if (!gridRef.current?.api) return;
      gridRef.current.api.setFilterModel(null);
      onFiltersChanged?.(false);
      refreshGrid();
    },
    hasFilters: () => {
      try {
        return !!gridRef.current?.api?.isAnyFilterPresent();
      } catch { return false; }
    },
    setFilterModel: (model: any) => {
      if (!gridRef.current?.api) return;
      gridRef.current.api.setFilterModel(model || null);
      onFiltersChanged?.(!!gridRef.current.api.isAnyFilterPresent?.());
      refreshGrid();
    },
    getFilterModel: () => {
      try { return gridRef.current?.api?.getFilterModel?.() || {}; } catch { return {}; }
    }
  }), [refreshGrid, onFiltersChanged]);

  // Show loading spinner while modules are loading
  if (!modulesLoaded) {
    return createLoadingSpinner();
  }

  const gridOptions = createGridOptions(useClientSide, clientRows, collapseGroups);

  

  return createGridContainer(
    <Suspense fallback={<div>Loading AgGridReact...</div>}>
      <AgGridReact
        key={`rm-${useClientSide ? 'client' : 'infinite'}-${workspaceId}-${groupBy}-${collapseGroups ? 1 : 0}`}
        ref={gridRef}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowHeight={rowHeight ?? GRID_CONSTANTS.ROW_HEIGHT}
        headerHeight={GRID_CONSTANTS.HEADER_HEIGHT}
        rowBuffer={GRID_CONSTANTS.ROW_BUFFER}
        {...gridOptions}
        autoGroupColumnDef={(useClientSide && groupBy !== 'none') ? autoGroupColumnDef : undefined}
        rowSelection={'multiple'}
        suppressRowClickSelection={true}
        getRowStyle={getRowStyle}
        onGridReady={onGridReady}
        onFirstDataRendered={() => {
          if (!gridRef.current?.api) return;
          onFiltersChanged?.(!!gridRef.current.api.isAnyFilterPresent?.());
          const count = gridRef.current.api.getDisplayedRowCount?.() ?? 0;
          if (count === 0) gridRef.current.api.showNoRowsOverlay?.(); else gridRef.current.api.hideOverlay?.();
        }}
        onFilterChanged={(e: any) => {
          if (suppressPersistRef.current) return;
          onFiltersChanged?.(!!e.api.isAnyFilterPresent?.());
          const count = e.api.getDisplayedRowCount?.() ?? 0;
          if (count === 0) e.api.showNoRowsOverlay?.(); else e.api.hideOverlay?.();
        }}
        onModelUpdated={(e: any) => {
          const api = e.api;
          const count = api.getDisplayedRowCount?.() ?? 0;
          if (count === 0) api.showNoRowsOverlay?.(); else api.hideOverlay?.();
        }}
        onSelectionChanged={(e: any) => {
          if (!onSelectionChanged) return;
          try {
            const rows = e.api.getSelectedRows?.() || [];
            const ids = rows.map((r: any) => Number(r.id)).filter((n: any) => Number.isFinite(n));
            onSelectionChanged(ids);
          } catch { onSelectionChanged([] as number[]); }
        }}
        animateRows={true}
        suppressColumnVirtualisation={true}
        suppressNoRowsOverlay={false}
        loading={false}
      />
    </Suspense>
  );
});

export default WorkspaceTable; 