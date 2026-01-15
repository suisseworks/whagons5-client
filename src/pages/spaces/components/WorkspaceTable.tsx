'use client';

import { useCallback, useMemo, useState, useRef, useEffect, lazy, Suspense, forwardRef, useImperativeHandle } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '@/store/store';
import { updateTaskAsync, removeTaskAsync, restoreTaskAsync } from '@/store/reducers/tasksSlice';
import { DeleteTaskDialog } from '@/components/tasks/DeleteTaskDialog';
import toast from 'react-hot-toast';
import { iconService } from '@/database/iconService';
import { buildWorkspaceColumns } from './workspaceTable/columns';
import { useAuth } from '@/providers/AuthProvider';
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
const ALLOWED_FILTER_KEYS = new Set(['status_id', 'priority_id', 'spot_id', 'user_ids', 'tag_ids', 'name', 'description', 'due_date']);

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
  for (const key of ['status_id', 'priority_id', 'spot_id', 'user_ids', 'tag_ids']) {
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
  for (const key of ['priority_id', 'spot_id', 'user_ids', 'tag_ids']) {
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
  const [emptyOverlayVisible, setEmptyOverlayVisible] = useState(false);

  // Overlay is controlled by the datasource (see workspaceTable/dataSource.ts)
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
  const { user } = useAuth();

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

  const userColorSyncOnce = useRef(false);

  // Debug: surface user color coverage to help trace IndexedDB/API hydration
  useEffect(() => {
    if (Array.isArray(reduxState.users) && reduxState.users.length > 0) {
      const withColor = reduxState.users.filter((u: any) => u?.color && String(u.color).trim() !== '');
      const withoutColor = reduxState.users.filter((u: any) => !u?.color || String(u.color).trim() === '');
      try {
        // Only log in development to avoid exposing sensitive user info in production
        if (process.env.NODE_ENV === 'development') {
          console.log('[wh:user-colors]', {
            total: reduxState.users.length,
            withColor: withColor.length,
            withoutColor: withoutColor.length,
            sampleWithout: withoutColor.slice(0, 5).map((u: any) => ({ id: u?.id, name: u?.name, color: u?.color }))
          });
        }
      } catch { /* ignore logging errors */ }

      // If we detect users without color, force a fresh fetch to refresh IndexedDB/Redux
      if (!userColorSyncOnce.current && withoutColor.length > 0) {
        userColorSyncOnce.current = true;
        try {
          dispatch((genericActions as any).users.fetchFromAPI?.());
        } catch { /* ignore */ }
      }
    }
  }, [reduxState.users, dispatch]);

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
    slas,
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
  // Ensure user metadata is hydrated so owner avatars reflect configured colors
  useEffect(() => {
    dispatch((genericActions as any).users.getFromIndexedDB());
    dispatch((genericActions as any).users.fetchFromAPI?.());
  }, [dispatch]);
  const slaMap = useMemo(() => {
    const map: Record<number, any> = {};
    (slas || []).forEach((s: any) => {
      if (s?.id != null) map[Number(s.id)] = s;
    });
    return map;
  }, [slas]);

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
    // Block status changes only when an approval exists and is pending or rejected
    const needsApproval = !!task?.approval_id;
    const normalizedApprovalStatus = String(task?.approval_status || '').toLowerCase().trim();
    const isPendingApproval = needsApproval && normalizedApprovalStatus === 'pending';
    const isRejectedApproval = needsApproval && normalizedApprovalStatus === 'rejected';
    if (isPendingApproval || isRejectedApproval) {
      try {
        window.dispatchEvent(new CustomEvent('wh:notify', {
          detail: {
            type: 'warning',
            title: 'Approval required',
            message: isRejectedApproval
              ? 'Status cannot be changed because the approval was rejected.'
              : 'This task cannot start until the approval is completed.',
          }
        }));
      } catch {
        console.warn('Task status change blocked: approval pending or rejected');
      }
      return false;
    }
    try {
      await dispatch(updateTaskAsync({ id: Number(task.id), updates: { status_id: Number(toStatusId) } })).unwrap();
      return true;
    } catch (e: any) {
      console.warn('Status change failed', e);
      // Show toast notification for errors
      const errorMessage = e?.message || e?.response?.data?.message || 'Failed to change task status';
      const isPermissionError = e?.response?.status === 403 || errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('unauthorized');
      
      if (isPermissionError) {
        toast.error('You do not have permission to change task status.', { duration: 5000 });
      } else {
        toast.error(errorMessage, { duration: 5000 });
      }
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

  // Load taskTags, tags, notes, attachments, custom field values on mount so they're available for display
  useEffect(() => {
    dispatch(genericActions.taskTags.getFromIndexedDB());
    dispatch(genericActions.tags.getFromIndexedDB());
    dispatch(genericActions.taskNotes.getFromIndexedDB());
    dispatch(genericActions.taskAttachments.getFromIndexedDB());
    dispatch(genericActions.approvalApprovers.getFromIndexedDB());
    dispatch(genericActions.taskApprovalInstances.getFromIndexedDB());
    dispatch(genericActions.taskCustomFieldValues.getFromIndexedDB());
    // Fetch custom field values from API to ensure we have the latest data (needed for cost column display)
    dispatch(genericActions.taskCustomFieldValues.fetchFromAPI());
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

  // Refresh config column when approval metadata changes so pending/active badges update
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['config'], force: true, suppressFlash: true });
    }
  }, [approvalMap, approvalApprovers, stableTaskApprovalInstances]);

  // Refresh other columns when their metadata resolves
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['user_ids'], force: true, suppressFlash: true });
    }
  }, [metadataLoadedFlags.usersLoaded, users, userMap]);

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

  // Refresh custom field columns when taskCustomFieldValues change
  useEffect(() => {
    if (gridRef.current?.api && taskCustomFieldValues && taskCustomFieldValues.length > 0) {
      // Refresh all columns that start with 'cf_' (custom field columns)
      const allColumns = gridRef.current.api.getAllColumns?.() || [];
      const customFieldColumns = allColumns
        .filter((col: any) => col?.getColId?.()?.startsWith('cf_'))
        .map((col: any) => col.getColId());
      if (customFieldColumns.length > 0) {
        gridRef.current.api.refreshCells({ columns: customFieldColumns, force: true, suppressFlash: true });
      }
    }
  }, [taskCustomFieldValues]);

  // Determine current density to decide whether to show row descriptions
  const [rowDensity, setRowDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try { return (localStorage.getItem('wh_workspace_density') as any) || 'comfortable'; } catch { return 'comfortable'; }
  });
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    try {
      const key = `wh_workspace_column_order_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return [];
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
    const allDefault = ['id', 'name', 'config', 'notes', 'status_id', 'priority_id', 'user_ids', 'due_date', 'spot_id', 'created_at'];
    try {
      const key = `wh_workspace_columns_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) return allDefault;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        // Always ensure "name" and "id" columns stay visible
        return Array.from(new Set(['name', 'id', ...parsed]));
      }
    } catch {
      // ignore
    }
    return allDefault;
  });

  // Reload preferences when workspace changes
  useEffect(() => {
    try {
      const key = `wh_workspace_column_order_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          const normalized = Array.from(new Set(parsed));
          setColumnOrder(['id', ...normalized.filter((c) => c !== 'id')]);
        } else {
          setColumnOrder([]);
        }
      } else {
        setColumnOrder([]);
      }
    } catch {
      setColumnOrder([]);
    }

    const allDefault = ['id', 'name', 'config', 'notes', 'status_id', 'priority_id', 'user_ids', 'due_date', 'spot_id', 'created_at'];
    try {
      const key = `wh_workspace_columns_${workspaceId || 'all'}`;
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      if (!raw) {
        setVisibleColumns(['id', ...allDefault.filter((c) => c !== 'id')]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        setVisibleColumns(Array.from(new Set(['name', 'id', ...parsed])));
      } else {
        setVisibleColumns(['id', ...allDefault.filter((c) => c !== 'id')]);
      }
    } catch {
      setVisibleColumns(['id', ...allDefault.filter((c) => c !== 'id')]);
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
          setVisibleColumns(Array.from(new Set(['name', 'id', ...next])));
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

  const persistColumnOrder = useCallback((orderedIds: string[]) => {
    if (!orderedIds || orderedIds.length === 0) return;
    const normalized = Array.from(new Set(orderedIds));
    const withIdFirst = ['id', ...normalized.filter((c) => c !== 'id')];
    setColumnOrder(withIdFirst);
    try {
      const key = `wh_workspace_column_order_${workspaceRef.current || 'all'}`;
      localStorage.setItem(key, JSON.stringify(withIdFirst));
    } catch {
      // ignore storage errors
    }
  }, []);

  const applyStoredColumnOrder = useCallback((colApi?: any) => {
    const api = colApi || gridRef.current?.columnApi;
    if (!api) return;
    const order = (columnOrder || []);
    if (!order || order.length === 0) return;
    try {
      const ordered = ['id', ...order.filter((c) => c !== 'id')];
      const state = ordered.map((colId, idx) => ({ colId, order: idx }));
      api.applyColumnState({ state, applyOrder: true });
    } catch {
      // ignore apply errors
    }
  }, [columnOrder]);

  const handleColumnOrderChanged = useCallback((colApi?: any) => {
    const api = colApi || gridRef.current?.columnApi;
    if (!api) return;
    try {
      const state = api.getColumnState?.() || [];
      if (!Array.isArray(state)) return;
      const ordered = state
        .filter((s: any) => s?.colId)
        .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
        .map((s: any) => String(s.colId));
      if (ordered.length === 0) return;
      persistColumnOrder(ordered);
    } catch {
      // ignore
    }
  }, [persistColumnOrder]);

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
        setEmptyOverlayVisible,
      }),
    [rowCache, workspaceRef, searchRef, statusMapRef, priorityMapRef, spotMapRef, userMapRef, tagMapRef, taskTagsRef, setEmptyOverlayVisible]
  );

  // Reset empty overlay when workspace/search changes; datasource will set it once it knows rowCount.
  useEffect(() => {
    setEmptyOverlayVisible(false);
  }, [workspaceId, searchText]);

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

  // Refresh approvals when a decision is recorded
  useEffect(() => {
    const handler = () => {
      dispatch(genericActions.taskApprovalInstances.fetchFromAPI());
      dispatch(genericActions.taskApprovalInstances.getFromIndexedDB());
      // Also refresh tasks so approval_status reflects latest decision
      refreshGrid();
      try { gridRef.current?.api?.refreshCells({ force: true }); } catch {}
      try { gridRef.current?.api?.refreshInfiniteCache(); } catch {}
    };
    window.addEventListener('wh:approvalDecision:success' as any, handler as any);
    return () => window.removeEventListener('wh:approvalDecision:success' as any, handler as any);
  }, [dispatch, refreshGrid]);

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<{ id: number; name?: string } | null>(null);

  // Delete handler used by action menus (placed after refreshGrid to avoid TDZ)
  const handleDeleteTask = useCallback(async (taskId: number, taskName?: string) => {
    if (!Number.isFinite(taskId)) return;
    
    // Get task data from grid if available
    let taskData: { id: number; name?: string } = { id: taskId };
    try {
      const api = gridRef.current?.api;
      if (api) {
        api.forEachNode((node) => {
          if (node.data?.id === taskId) {
            taskData = { id: taskId, name: node.data?.name || taskName };
          }
        });
      }
    } catch (e) {
      // Fallback to provided name or ID
      taskData = { id: taskId, name: taskName };
    }

    setTaskToDelete(taskData);
    setDeleteDialogOpen(true);
  }, []);

  // Confirm delete action
  const confirmDelete = useCallback(async () => {
    if (!taskToDelete) return;
    
    const taskId = taskToDelete.id;
    const taskName = taskToDelete.name;
    
    setDeleteDialogOpen(false);
    
    // Store toast ID to dismiss on error
    let successToastId: string | undefined;
    
    try {
      await dispatch(removeTaskAsync(taskId)).unwrap();
      
      // Show success toast with undo option
      successToastId = toast.success(
        (t) => (
          <div className="flex flex-col gap-1">
            <div className="font-semibold">Task deleted</div>
            <div className="text-sm opacity-90">
              {taskName ? `"${taskName}" has been deleted.` : "Task has been deleted."}
            </div>
            <button
              onClick={async () => {
                toast.dismiss(t.id);
                const restoreToast = toast.loading("Restoring task...");
                try {
                  await dispatch(restoreTaskAsync(taskId)).unwrap();
                  toast.dismiss(restoreToast);
                  toast.success(
                    taskName ? `"${taskName}" has been restored.` : "Task has been restored.",
                    { duration: 5000 }
                  );
                  refreshGrid();
                } catch (error: any) {
                  toast.dismiss(restoreToast);
                  const errorMessage = error?.message || error?.response?.data?.message || "Could not restore the task.";
                  toast.error(errorMessage, { duration: 5000 });
                }
              }}
              className="text-left text-sm font-medium underline underline-offset-4 hover:no-underline mt-1"
            >
              Undo
            </button>
          </div>
        ),
        { duration: 8000 }
      );
      
      refreshGrid();
    } catch (error: any) {
      // Dismiss success toast if it was shown (shouldn't happen, but just in case)
      if (successToastId) {
        toast.dismiss(successToastId);
      }
      
      const errorMessage = error?.message || error?.response?.data?.message || error?.toString() || "Failed to delete task";
      const status = error?.response?.status || error?.status;
      
      // Check if it's a permission error (403)
      if (status === 403 || errorMessage.includes("permission") || errorMessage.includes("unauthorized")) {
        toast.error("You do not have permission to delete this task.", { duration: 5000 });
      } else {
        toast.error(errorMessage, { duration: 5000 });
      }
    } finally {
      setTaskToDelete(null);
    }
  }, [taskToDelete, dispatch, refreshGrid]);

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
    customFields,
    taskNotes,
    taskAttachments,
    approvalApprovers,
    currentUserId: user?.id,
    onDeleteTask: handleDeleteTask,
    onLogTask: (id: number) => console.info('Log action selected (placeholder) for task', id),
    slaMap,
  } as any), [
    statusMap, priorityMap, spotMap, userMap, tagMap, taskTags,
    getStatusIcon, formatDueDate, getAllowedNextStatuses, handleChangeStatus,
    metadataLoadedFlags.statusesLoaded, metadataLoadedFlags.prioritiesLoaded,
    metadataLoadedFlags.spotsLoaded, metadataLoadedFlags.usersLoaded,
    filteredPriorities, getUsersFromIds, useClientSide, groupBy, categoryMap, rowDensity, tagDisplayMode,
    approvalMap, approvalApprovers, stableTaskApprovalInstances, user?.id, slas, slaMap,
    visibleColumns, workspaceCustomFields, taskCustomFieldValueMap, customFields, taskNotes, taskAttachments, handleDeleteTask,
  ]);
  const defaultColDef = useMemo(() => createDefaultColDef(), []);

  // Re-apply stored order when column definitions change (e.g., toggling visibility)
  useEffect(() => {
    applyStoredColumnOrder();
  }, [columnDefs, applyStoredColumnOrder]);

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

  const getContextMenuItems = useCallback((params: any) => {
    const row = params?.node?.data;
    const id = Number(row?.id);
    const items: any[] = [];

    if (row && Number.isFinite(id)) {
      items.push({
        name: 'Delete task',
        action: () => handleDeleteTask(id),
        cssClasses: ['wh-context-danger'],
      });
      items.push({
        name: 'Log (placeholder)',
        action: () => console.info('Log action selected (placeholder) for task', id),
      });
      items.push('separator');
    }

    if (params?.defaultItems) {
      items.push(...params.defaultItems);
    } else {
      items.push('copy', 'copyWithHeaders', 'paste');
    }

    return items;
  }, [handleDeleteTask]);

  // Clear cache and refresh grid when workspaceId changes
  useEffect(() => {
    const checkAndRefresh = async () => {
      if (!modulesLoaded) return;
      
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
        
        console.log(`[WorkspaceTable] Workspace changed to ${workspaceId}, found ${taskCount} tasks in cache`);
        
        // If no tasks found and we're viewing a specific workspace (not 'all'), 
        // try fetching from API to ensure cache is up to date
        if (taskCount === 0 && workspaceId !== 'all' && workspaceId !== 'shared') {
          console.log(`[WorkspaceTable] No tasks found for workspace ${workspaceId}, fetching from API...`);
          try {
            await TasksCache.fetchTasks();
            console.log(`[WorkspaceTable] Fetch completed, refreshing grid...`);
          } catch (fetchError) {
            console.warn(`[WorkspaceTable] Failed to fetch tasks from API:`, fetchError);
          }
        }
        
        // Refresh grid after checking/fetching
        if (gridRef.current?.api) {
          refreshGrid();
        }
      } catch (error) {
        console.error(`[WorkspaceTable] Error checking workspace tasks:`, error);
        // Still try to refresh grid even if check failed
        if (gridRef.current?.api) {
          refreshGrid();
        }
      }
    };
    
    checkAndRefresh();
  }, [workspaceId, refreshGrid, modulesLoaded]);

  // Refresh when global search text changes
  useEffect(() => {
    if (gridRef.current?.api && modulesLoaded) {
      refreshGrid();
    }
  }, [searchText, modulesLoaded, refreshGrid]);

  // IMPORTANT: Do NOT call refreshGrid() on reference-data changes.
  // That clears the row cache + refreshes infinite cache and can cause the grid to blink repeatedly during startup
  // as reference tables hydrate. We already refresh specific columns via refreshCells() effects above.

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

    applyStoredColumnOrder(params.columnApi);

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

  // We keep phantom rows in infinite model, so AG Grid's built-in "no rows" overlay cannot be relied on.
  // Render our own overlay layer controlled by datasource rowCount instead.

  const gridOptions = createGridOptions(useClientSide, clientRows, collapseGroups);

  

  return createGridContainer(
    <Suspense fallback={createLoadingSpinner()}>
      <div className="relative h-full w-full">
        {emptyOverlayVisible ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 24,
              pointerEvents: 'none',
            }}
          >
            <div style={{ textAlign: 'center', maxWidth: 520 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="190" height="190" viewBox="0 0 24 24" style={{ opacity: 0.18 }}>
                  <path fill="currentColor" d="M19 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4l3 3l3-3h4a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12H16.17L12 19.17L7.83 15H5V5h14v10z"/>
                  <path fill="currentColor" d="M7 7h10v2H7V7zm0 4h7v2H7v-2z"/>
                </svg>
              </div>
              <div style={{ fontSize: 20, fontWeight: 650, letterSpacing: '-0.01em', opacity: 0.9, marginBottom: 6 }}>
                No tasks to show
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.4, opacity: 0.65 }}>
                This workspace is empty, or you don’t have access to its tasks.
              </div>
            </div>
          </div>
        ) : null}

        <AgGridReact
          key={`rm-${useClientSide ? 'client' : 'infinite'}-${workspaceId}-${groupBy}-${collapseGroups ? 1 : 0}-${rowHeight ?? GRID_CONSTANTS.ROW_HEIGHT}`}
          ref={gridRef}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={rowHeight ?? GRID_CONSTANTS.ROW_HEIGHT}
          headerHeight={GRID_CONSTANTS.HEADER_HEIGHT}
          rowBuffer={GRID_CONSTANTS.ROW_BUFFER}
          {...gridOptions}
          suppressContextMenu={false}
          getContextMenuItems={getContextMenuItems}
          autoGroupColumnDef={(useClientSide && groupBy !== 'none') ? autoGroupColumnDef : undefined}
          rowSelection={{ 
            mode: 'multiRow', 
            enableClickSelection: false,
            checkboxes: true,
            headerCheckbox: true,
            columnWidth: 44,
            checkboxLocation: 'first',
            pinned: 'left'
          }}
          getRowStyle={getRowStyle}
          onGridReady={onGridReady}
          onFirstDataRendered={() => {
            if (!gridRef.current?.api) return;
            onFiltersChanged?.(!!gridRef.current.api.isAnyFilterPresent?.());
          }}
          onFilterChanged={(e: any) => {
            if (suppressPersistRef.current) return;
            onFiltersChanged?.(!!e.api.isAnyFilterPresent?.());
            try {
              const key = `wh_workspace_filters_${workspaceRef.current || 'all'}`;
              const gm = e.api.getFilterModel?.() || {};
              externalFilterModelRef.current = gm;
              if (debugFilters.current) {
                console.log('[WT Filters] onFilterChanged - grid filterModel:', JSON.stringify(gm, null, 2));
              }
              if (gm && Object.keys(gm).length > 0) {
                localStorage.setItem(key, JSON.stringify(gm));
              }
            } catch {}
            if (!useClientSide) {
              refreshGrid();
            }
          }}
        onSelectionChanged={(e: any) => {
          if (!onSelectionChanged) return;
          try {
            const rows = e.api.getSelectedRows?.() || [];
            const ids = rows.map((r: any) => Number(r.id)).filter((n: any) => Number.isFinite(n));
            onSelectionChanged(ids);
          } catch { onSelectionChanged([] as number[]); }
        }}
        onRowClicked={(e: any) => {
          // Don't open edit task if click was on status column or checkbox column
          const target = e?.event?.target as HTMLElement;
          if (target) {
            const statusCell = target.closest('.ag-cell[col-id="status_id"]');
            const checkboxCell = target.closest('.ag-cell[col-id="ag-Grid-SelectionColumn"]');
            if (statusCell || checkboxCell) {
              return; // Ignore clicks on status or checkbox columns
            }
          }
          // Also check the column property if available
          if (e?.column?.colId === 'status_id' || e?.column?.colId === 'ag-Grid-SelectionColumn') {
            return; // Ignore clicks on status or checkbox columns
          }
          // Call the handler if provided
          if (onRowDoubleClicked && e?.data) {
            onRowDoubleClicked(e.data);
          }
        }}
        onColumnMoved={(e: any) => {
          if (e?.finished === false) return;
          handleColumnOrderChanged(e?.columnApi);
        }}
        onColumnPinned={(e: any) => {
          handleColumnOrderChanged(e?.columnApi);
        }}
        onColumnVisible={(e: any) => {
          handleColumnOrderChanged(e?.columnApi);
        }}
        animateRows={false}
        suppressColumnVirtualisation={false}
        suppressNoRowsOverlay={false}
        loading={false}
        suppressScrollOnNewData={true}
        suppressAnimationFrame={false}
        />
      </div>
      
      <DeleteTaskDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        taskName={taskToDelete?.name}
      />
    </Suspense>
  );
});

export default WorkspaceTable; 