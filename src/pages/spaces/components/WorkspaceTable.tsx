'use client';

import { useCallback, useMemo, useState, useRef, useEffect, lazy, Suspense, forwardRef, useImperativeHandle } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { updateTaskAsync } from '@/store/reducers/tasksSlice';
import { iconService } from '@/database/iconService';
import { buildWorkspaceColumns } from './workspaceTable/columns';
import { genericActions } from '@/store/genericSlices';

// Import abstracted utilities
import { loadAgGridModules, createDefaultColDef, createGridOptions } from './workspaceTable/agGridSetup';
import {
  getUserDisplayName,
  getUsersFromIds,
  formatDueDate
} from './workspaceTable/userUtils';
import { GRID_CONSTANTS, createLoadingSpinner, createGridContainer } from './workspaceTable/gridConfig';
import { setupTaskEventHandlers } from './workspaceTable/eventHandlers';
import {
  useGridReduxState,
  useDerivedGridState,
  useMetadataLoadedFlags
} from './workspaceTable/gridState';
import {
  createStatusMap,
  createPriorityMap,
  createSpotMap,
  createUserMap,
  createCategoryToGroup,
  createTransitionsByGroupFrom,
  createFilteredPriorities,
  createTagMap
} from './workspaceTable/mappers';
const ALLOWED_FILTER_KEYS = new Set(['status_id', 'priority_id', 'spot_id', 'name', 'description', 'due_date']);

const sanitizeFilterModel = (model: any): any => {
  if (!model || typeof model !== 'object') return {};
  const cleaned: any = {};
  for (const key of Object.keys(model)) {
    if (ALLOWED_FILTER_KEYS.has(key)) cleaned[key] = model[key];
  }
  return cleaned;
};

// Normalize a filter model for AG Grid's internal expectations (string keys for set filters)
const normalizeFilterModelForGrid = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return {};
  const fm = sanitizeFilterModel(raw);
  for (const key of ['status_id', 'priority_id', 'spot_id']) {
    if (fm[key]) {
      const st = { ...fm[key] } as any;
      if ((st as any).filterType === 'set') {
        const rawValues: any[] = Array.isArray(st.values) ? st.values : [];
        st.values = rawValues.map((v) => String(v));
        fm[key] = st;
      }
    }
  }
  return fm;
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
  // Text/date filters pass through unchanged
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
  onRowDoubleClicked?: (task: any) => void;
  rowHeight?: number;
  groupBy?: 'none' | 'spot_id' | 'status_id' | 'priority_id';
  collapseGroups?: boolean;
  onReady?: () => void;
  onModeChange?: (info: { useClientSide: boolean; totalFiltered: number }) => void;
  tagDisplayMode?: 'icon' | 'icon-text';
}>(({
  rowCache,
  workspaceId,
  searchText = '',
  onFiltersChanged,
  onSelectionChanged,
  onRowDoubleClicked,
  rowHeight,
  groupBy = 'none',
  collapseGroups = true,
  onReady,
  onModeChange,
  tagDisplayMode = 'icon-text',
}, ref): React.ReactNode => {
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const gridRef = useRef<any>(null);
  const externalFilterModelRef = useRef<any>({});
  const debugFilters = useRef<boolean>(false);
  const lastDoubleClickRef = useRef<{ rowId: any; timestamp: number } | null>(null);
  useEffect(() => {
    try { debugFilters.current = localStorage.getItem('wh-debug-filters') === 'true'; } catch { debugFilters.current = false; }
  }, []);
  // Preload any saved filter model so effects that reset columnDefs can reapply it
  // even before onGridReady/onReady run.
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
  const {
    statuses,
    priorities,
    spots,
    users,
    categories,
    statusTransitions,
    approvals,
    approvalApprovers,
    taskApprovalInstances,
    tags,
    taskTags,
    customFields,
    categoryCustomFields,
    taskCustomFieldValues,
    taskNotes,
    taskAttachments,
  } = reduxState as any;
  const { defaultCategoryId, workspaceNumericId, isAllWorkspaces } = derivedState as any;
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
  const tagMap = useMemo(() => createTagMap(tags), [tags]);
  const taskTagsMap = useMemo(() => {
    const m = new Map<number, number[]>();
    for (const tt of taskTags || []) {
      const ttid = Number((tt as any).task_id);
      const tagId = Number((tt as any).tag_id);
      if (!Number.isFinite(ttid) || !Number.isFinite(tagId)) continue;
      const arr = m.get(ttid);
      if (arr) arr.push(tagId); else m.set(ttid, [tagId]);
    }
    return m;
  }, [taskTags]);
  const categoryMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const c of categories || []) {
      const id = Number((c as any).id);
      if (Number.isFinite(id)) m[id] = { id, name: (c as any).name, color: (c as any).color, icon: (c as any).icon };
    }
    return m;
  }, [categories]);

  // Workspace-scoped custom fields (category-based)
  const workspaceCustomFields = useMemo(() => {
    if (!categories || categories.length === 0 || !customFields || customFields.length === 0) return [] as any[];

    const allowedCategoryIds = new Set<number>();
    for (const c of categories as any[]) {
      const cid = Number((c as any).id);
      const wsId = Number((c as any).workspace_id);
      if (!Number.isFinite(cid)) continue;
      if (isAllWorkspaces || workspaceNumericId == null || wsId === workspaceNumericId) {
        allowedCategoryIds.add(cid);
      }
    }

    if (allowedCategoryIds.size === 0) return [] as any[];

    const byId: Record<number, { field: any; categories: any[] }> = {};

    for (const link of (categoryCustomFields || []) as any[]) {
      const catId = Number((link as any).category_id);
      const fieldId = Number((link as any).field_id);
      if (!allowedCategoryIds.has(catId) || !Number.isFinite(fieldId)) continue;
      const field = (customFields as any[]).find((f: any) => Number(f.id) === fieldId);
      if (!field) continue;
      const cat = categoryMap[catId];
      if (!byId[fieldId]) {
        byId[fieldId] = { field, categories: [] };
      }
      if (cat) byId[fieldId].categories.push(cat);
    }

    return Object.entries(byId).map(([fid, data]) => ({
      fieldId: Number(fid),
      field: (data as any).field,
      categories: (data as any).categories,
    }));
  }, [categories, customFields, categoryCustomFields, categoryMap, workspaceNumericId, isAllWorkspaces]);

  // Map of (task_id, field_id) -> custom field value for fast lookup
  const taskCustomFieldValueMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const v of (taskCustomFieldValues || []) as any[]) {
      const taskId = Number((v as any).task_id);
      // Backend column is field_id; fallback to custom_field_id if present
      const fieldId = Number((v as any).field_id ?? (v as any).custom_field_id);
      if (!Number.isFinite(taskId) || !Number.isFinite(fieldId)) continue;
      m.set(`${taskId}:${fieldId}`, v);
    }
    return m;
  }, [taskCustomFieldValues]);

  const approvalMap = useMemo(() => {
    const m: Record<number, any> = {};
    for (const a of approvals || []) {
      const id = Number((a as any).id);
      if (Number.isFinite(id)) m[id] = a;
    }
    return m;
  }, [approvals]);

  // Memoize taskApprovalInstances to prevent unnecessary column rebuilds
  const stableTaskApprovalInstances = useMemo(() => taskApprovalInstances, [taskApprovalInstances]);

  // Refs for data access in callbacks
  const statusMapRef = useRef(statusMap);
  useEffect(() => { statusMapRef.current = statusMap; }, [statusMap]);
  const priorityMapRef = useRef(priorityMap);
  useEffect(() => { priorityMapRef.current = priorityMap; }, [priorityMap]);
  const spotMapRef = useRef(spotMap);
  useEffect(() => { spotMapRef.current = spotMap; }, [spotMap]);
  const userMapRef = useRef(userMap);
  useEffect(() => { userMapRef.current = userMap; }, [userMap]);
  const tagMapRef = useRef(tagMap);
  useEffect(() => { tagMapRef.current = tagMap; }, [tagMap]);
  const taskTagsRef = useRef(taskTags);
  useEffect(() => { taskTagsRef.current = taskTags; }, [taskTags]);
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

  useEffect(() => {
    const run = async () => {
      // When grouping is enabled we must use client-side row model
      if (groupBy && groupBy !== 'none') {
        setUseClientSide(true);
        try {
          if (!TasksCache.initialized) await TasksCache.init();
          const baseParams: any = { search: searchText };
          if (workspaceId !== 'all') baseParams.workspace_id = workspaceId;
          baseParams.__statusMap = statusMapRef.current;
          baseParams.__priorityMap = priorityMapRef.current;
          baseParams.__spotMap = spotMapRef.current;
          baseParams.__userMap = userMapRef.current;
          baseParams.__tagMap = tagMapRef.current;
          baseParams.__taskTags = taskTagsRef.current;
          baseParams.sortModel = [{ colId: 'created_at', sort: 'desc' }];
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

      // No grouping: always use infinite row model to avoid client-side filter quirks
      setUseClientSide(false);
      setClientRows([]);
      try { onModeChange?.({ useClientSide: false, totalFiltered: 0 }); } catch {}
    };
    run();
  }, [workspaceId, searchText, groupBy, onModeChange, statusMapRef, priorityMapRef, spotMapRef, userMapRef, tagMapRef, taskTagsRef]);

  // Load taskTags, tags, notes, attachments on mount so they're available for display
  useEffect(() => {
    dispatch(genericActions.taskTags.getFromIndexedDB());
    dispatch(genericActions.tags.getFromIndexedDB());
    dispatch(genericActions.taskNotes.getFromIndexedDB());
    dispatch(genericActions.taskAttachments.getFromIndexedDB());
    dispatch(genericActions.approvalApprovers.getFromIndexedDB());
    dispatch(genericActions.taskApprovalInstances.getFromIndexedDB());
    // Optionally fetch from API to ensure we have the latest data
    // dispatch(genericActions.taskTags.fetchFromAPI());
    // dispatch(genericActions.tags.fetchFromAPI());
    // dispatch(genericActions.taskNotes.fetchFromAPI());
    // dispatch(genericActions.taskAttachments.fetchFromAPI());
    // dispatch(genericActions.approvalApprovers.fetchFromAPI());
    // dispatch(genericActions.taskApprovalInstances.fetchFromAPI());
  }, [dispatch]);

  // Removed on-mount loads; AuthProvider hydrates core slices

  // When statuses are loaded/updated, refresh the Status column cells to replace #id with names
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['status_id'], force: true, suppressFlash: true });
    }
  }, [statusMap]);

  // Refresh name column when taskTags or tags load/update to show tags
  useEffect(() => {
    if (gridRef.current?.api && taskTags.length > 0) {
      gridRef.current.api.refreshCells({ columns: ['name'], force: true, suppressFlash: true });
    }
  }, [taskTags, tagMap]);

  // Refresh config column (notes/attachments) when they change
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['config'], force: true, suppressFlash: true });
    }
  }, [taskNotes, taskAttachments]);

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

  // Determine current density to decide whether to show row descriptions
  const [rowDensity, setRowDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try { return (localStorage.getItem('wh_workspace_density') as any) || 'comfortable'; } catch { return 'comfortable'; }
  });

  // Listen for density changes
  useEffect(() => {
    const handler = (e: any) => {
      const v = e?.detail as any;
      if (v === 'compact' || v === 'comfortable' || v === 'spacious') setRowDensity(v);
    };
    window.addEventListener('wh:rowDensityChanged', handler);
    return () => window.removeEventListener('wh:rowDensityChanged', handler);
  }, []);

  // Column visibility preferences (per-workspace, persisted in localStorage)
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const allDefault = ['name', 'config', 'notes', 'status_id', 'priority_id', 'user_ids', 'due_date', 'spot_id', 'created_at'];
    try {
      const key = `wh_workspace_columns_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) return allDefault;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        // Always ensure "name" column stays visible
        return Array.from(new Set(['name', ...parsed]));
      }
    } catch {
      // ignore
    }
    return allDefault;
  });

  // Reload preferences when workspace changes
  useEffect(() => {
    const allDefault = ['name', 'config', 'notes', 'status_id', 'priority_id', 'user_ids', 'due_date', 'spot_id', 'created_at'];
    try {
      const key = `wh_workspace_columns_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) {
        setVisibleColumns(allDefault);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        setVisibleColumns(Array.from(new Set(['name', ...parsed])));
      } else {
        setVisibleColumns(allDefault);
      }
    } catch {
      setVisibleColumns(allDefault);
    }
  }, [workspaceId]);

  // Listen for settings changes from the Workspace Settings "Display" tab
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<any>;
      const detail = custom.detail || {};
      if (!detail) return;
      // If a specific workspaceId is provided, respect it; otherwise apply to "all"
      const targetId = detail.workspaceId ?? 'all';
      const currentId = workspaceRef.current || 'all';
      if (String(targetId) !== String(currentId)) return;
      if (Array.isArray(detail.visibleColumns)) {
        const next = detail.visibleColumns.filter((x: any) => typeof x === 'string');
        if (next.length > 0) {
          setVisibleColumns(Array.from(new Set(['name', ...next])));
        }
      }
    };

    try {
      window.addEventListener('wh:workspaceColumnsChanged' as any, handler as any);
    } catch {
      // no-op (SSR)
    }

    return () => {
      try {
        window.removeEventListener('wh:workspaceColumnsChanged' as any, handler as any);
      } catch {
        // ignore
      }
    };
  }, []);

  const columnDefs = useMemo(() => buildWorkspaceColumns({
    getUserDisplayName,
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
    categoryMap,
    showDescriptions: rowDensity !== 'compact',
    density: rowDensity,
    approvalMap,
    taskApprovalInstances: stableTaskApprovalInstances,
    tagMap,
    taskTags,
    taskTagsMap,
    tagDisplayMode,
    visibleColumns,
    workspaceCustomFields,
    taskCustomFieldValueMap,
    taskNotes,
    taskAttachments,
    approvalApprovers,
  } as any), [
    statusMap, priorityMap, spotMap, userMap, tagMap, taskTags,
    getStatusIcon, formatDueDate, getAllowedNextStatuses, handleChangeStatus,
    metadataLoadedFlags.statusesLoaded, metadataLoadedFlags.prioritiesLoaded,
    metadataLoadedFlags.spotsLoaded, metadataLoadedFlags.usersLoaded,
    filteredPriorities, getUsersFromIds, useClientSide, groupBy, categoryMap, rowDensity, tagDisplayMode,
    approvalMap, approvalApprovers, stableTaskApprovalInstances,
    visibleColumns, workspaceCustomFields, taskCustomFieldValueMap, taskNotes, taskAttachments,
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

  const getRowStyle = useCallback((_params: any) => {
    // Remove decorative left color bar to keep focus on the new status-colored priority initial
    return undefined;
  }, []);

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
        // If grid lost filters, re-apply from saved external model
        const saved = externalFilterModelRef.current || {};
        if (!api.isAnyFilterPresent?.() && saved && Object.keys(saved).length > 0) {
          api.setFilterModel(saved);
        }
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
        const saved = externalFilterModelRef.current || {};
        if (!api.isAnyFilterPresent?.() && saved && Object.keys(saved).length > 0) {
          api.setFilterModel(saved);
        }
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
        const saved = externalFilterModelRef.current || {};
        if (!api.isAnyFilterPresent?.() && saved && Object.keys(saved).length > 0) {
          api.setFilterModel(saved);
        }
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
        tagMapRef,
        taskTagsRef,
        externalFilterModelRef,
        normalizeFilterModelForQuery,
      }),
    [rowCache, workspaceRef, searchRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, tagMapRef, taskTagsRef]
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
        baseParams.__tagMap = tagMapRef.current;
        baseParams.__taskTags = taskTagsRef.current;
        // Let AG Grid handle column filters in client-side mode; only apply search/workspace here.
        const sortModel = gridRef.current.api.getSortModel?.() || [];
        if (sortModel.length > 0) {
          baseParams.sortModel = sortModel;
        } else {
          baseParams.sortModel = [{ colId: 'created_at', sort: 'desc' }];
        }

        const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
        const totalFiltered = countResp?.rowCount ?? 0;
        const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: totalFiltered });
        const rows = rowsResp?.rows || [];
        if (debugFilters.current) {
          console.log('[WT Filters] client-side refresh rows=', rows.length, 'totalFiltered=', totalFiltered);
        }

        setClientRows(rows);
        gridRef.current.api.setGridOption('rowData', rows);
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
  }, [modulesLoaded, rowCache, useClientSide, searchRef, workspaceRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, tagMapRef, taskTagsRef]);

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

  // When reference data (statuses, priorities, spots, users, tags, categories, customFields) changes, refresh the grid
  // This ensures that when someone updates a status/priority/etc in settings, the grid shows the updated data
  useEffect(() => {
    if (gridRef.current?.api && modulesLoaded) {
      // Refresh the grid to pick up changes in reference data
      refreshGrid();
    }
  }, [statuses, priorities, spots, users, tags, categories, customFields, categoryCustomFields, modulesLoaded, refreshGrid]);

  // Set up task event handlers using abstracted utility
  useEffect(() => {
    const cleanup = setupTaskEventHandlers({ refreshGrid, workspaceId });
    return cleanup;
  }, [refreshGrid, workspaceId]);

  const onGridReady = useCallback((params: any) => {
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
      externalFilterModelRef.current = {};
      onFiltersChanged?.(false);
      // Also clear any persisted filters for this workspace so the
      // datasource doesn't keep applying an invisible filter
      try {
        const key = `wh_workspace_filters_${workspaceRef.current || 'all'}`;
        localStorage.removeItem(key);
      } catch {}
      refreshGrid();
    },
    hasFilters: () => {
      try {
        return !!gridRef.current?.api?.isAnyFilterPresent();
      } catch { return false; }
    },
    setFilterModel: (model: any) => {
      if (!gridRef.current?.api) return;
      // If model is null/undefined, this is a request to CLEAR all filters
      if (!model) {
        externalFilterModelRef.current = {};
        try { if (debugFilters.current) console.log('[WT] setFilterModel CLEAR'); } catch {}

        gridRef.current.api.setFilterModel(null);
        onFiltersChanged?.(false);

        // Clear persisted filters for this workspace
        try {
          const key = `wh_workspace_filters_${workspaceRef.current || 'all'}`;
          localStorage.removeItem(key);
        } catch {}

        refreshGrid();
        return;
      }

   
      const gridModel = normalizeFilterModelForGrid(model);
      // Keep external model in sync with what AG Grid actually sees
      externalFilterModelRef.current = gridModel;
      try { if (debugFilters.current) console.log('[WT] setFilterModel external=', externalFilterModelRef.current); } catch {}

      gridRef.current.api.setFilterModel(Object.keys(gridModel).length > 0 ? gridModel : null);

      onFiltersChanged?.(!!gridRef.current.api.isAnyFilterPresent?.());
      try {
        const key = `wh_workspace_filters_${workspaceRef.current || 'all'}`;
        // Persist exactly the external model so Workspace and datasource
        // see the same canonical filter definition
        localStorage.setItem(key, JSON.stringify(model));
        if (debugFilters.current) console.log('[WT] persisted model=', model);
      } catch {}
      refreshGrid();
    },
    getFilterModel: () => {
      try {
        // AG Grid's filter model is the single source of truth for the UI & modal
        return gridRef.current?.api?.getFilterModel?.() || {};
      } catch { return {}; }
    }
  }), [refreshGrid, onFiltersChanged]);

  // Show loading spinner while modules are loading
  if (!modulesLoaded) {
    return createLoadingSpinner();
  }

  const gridOptions = createGridOptions(useClientSide, clientRows, collapseGroups);

  

  return createGridContainer(
    <Suspense fallback={createLoadingSpinner()}>
      <AgGridReact
        key={`rm-${useClientSide ? 'client' : 'infinite'}-${workspaceId}-${groupBy}-${collapseGroups ? 1 : 0}-${rowHeight ?? GRID_CONSTANTS.ROW_HEIGHT}`}
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
          try {
            const key = `wh_workspace_filters_${workspaceRef.current || 'all'}`;
            const gm = e.api.getFilterModel?.() || {};
            // Keep externalFilterModelRef in sync with AG Grid so datasource
            // and modal both see the same canonical model.
            externalFilterModelRef.current = gm;
            if (debugFilters.current) {
              console.log('[WT Filters] onFilterChanged - grid filterModel:', JSON.stringify(gm, null, 2));
            }
            // Persist only when there is an active model; do not remove the saved
            // filter on incidental empty events (those can happen during grid resets).
            if (gm && Object.keys(gm).length > 0) {
              localStorage.setItem(key, JSON.stringify(gm));
            }
          } catch {}
          // Only refresh if not in client-side mode (client-side mode handles filtering internally)
          // or if suppressPersistRef is false (meaning this is a user-initiated filter change)
          if (!useClientSide) {
            refreshGrid();
          }
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
        onRowDoubleClicked={(e: any) => {
          // Don't open edit task if double click was on status column
          const target = e?.event?.target as HTMLElement;
          if (target) {
            const cellElement = target.closest('[col-id="status_id"]');
            const statusCell = target.closest('.ag-cell[col-id="status_id"]');
            if (cellElement || statusCell) {
              return; // Ignore double clicks on status column
            }
          }
          // Also check the column property if available
          if (e?.column?.colId === 'status_id') {
            return; // Ignore double clicks on status column
          }
          // Call the handler if provided
          if (onRowDoubleClicked && e?.data) {
            onRowDoubleClicked(e.data);
          }
        }}
        onCellDoubleClicked={(e: any) => {
          // Fallback: handle double click at cell level if row-level doesn't work
          // Only process if it's not the status column
          if (e?.column?.colId === 'status_id') {
            return; // Ignore double clicks on status column
          }
          // Prevent multiple calls for the same row (onCellDoubleClicked fires for each cell)
          const rowId = e?.data?.id;
          const now = Date.now();
          if (lastDoubleClickRef.current && lastDoubleClickRef.current.rowId === rowId && now - lastDoubleClickRef.current.timestamp < 100) {
            return; // Already handled this row's double-click
          }
          lastDoubleClickRef.current = { rowId, timestamp: now };
          // Call the handler if provided
          if (onRowDoubleClicked && e?.data) {
            onRowDoubleClicked(e.data);
          }
        }}
        onRowClicked={(_e: any) => {
          // Prevent single click from doing anything (we only want double click)
          // But still allow row selection
        }}
        animateRows={false}
        suppressColumnVirtualisation={false}
        suppressNoRowsOverlay={false}
        loading={false}
        suppressScrollOnNewData={true}
        suppressAnimationFrame={false}
      />
    </Suspense>
  );
});

export default WorkspaceTable; 