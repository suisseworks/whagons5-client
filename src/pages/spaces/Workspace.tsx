import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UrlTabs } from '@/components/ui/url-tabs';
import { ClipboardList, Settings, MessageSquare, FolderPlus, Calendar, Clock, LayoutDashboard, X, Map as MapIcon, CheckCircle2, UserRound, CalendarDays, Flag, BarChart3, Activity, Sparkles, TrendingUp, Trash2 } from 'lucide-react';
import WorkspaceTable, { WorkspaceTableHandle } from '@/pages/spaces/components/WorkspaceTable';
import SettingsComponent from '@/pages/spaces/components/Settings';
import ChatTab from '@/pages/spaces/components/ChatTab';
import ResourcesTab from '@/pages/spaces/components/ResourcesTab';
import CalendarViewTab from '@/pages/spaces/components/CalendarViewTab';
import SchedulerViewTab from '@/pages/spaces/components/SchedulerViewTab';
import TaskBoardTab from '@/pages/spaces/components/TaskBoardTab';
import MapViewTab from '@/pages/spaces/components/MapViewTab';
import WorkspaceStatistics from '@/pages/spaces/components/WorkspaceStatistics';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '@/store';
import {
  setFilterModel,
  setSearchText,
  setGroupBy,
  setCollapseGroups,
  setPresets,
  selectSearchText,
  selectGroupBy,
  selectCollapseGroups,
} from '@/store/reducers/uiStateSlice';
import { Button } from '@/components/ui/button';
import TaskDialog from '@/pages/spaces/components/TaskDialog';
import { motion } from 'motion/react';
import { TAB_ANIMATION, getWorkspaceTabInitialX } from '@/config/tabAnimation';
import FilterBuilderDialog from '@/pages/spaces/components/FilterBuilderDialog';
import { listPresets, listPinnedPresets, savePreset } from '@/pages/spaces/components/workspaceTable/utils/filterPresets';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';
import TaskNotesModal from '@/pages/spaces/components/TaskNotesModal';
import { useLanguage } from '@/providers/LanguageProvider';
import { removeTaskAsync } from '@/store/reducers/tasksSlice';
import { DeleteTaskDialog } from '@/components/tasks/DeleteTaskDialog';
import toast from 'react-hot-toast';
import type { AppDispatch } from '@/store/store';

const WORKSPACE_TAB_PATHS = {
  grid: '',
  calendar: '/calendar',
  scheduler: '/scheduler',
  map: '/map',
  board: '/board',
  settings: '/settings',
  statistics: '/statistics'
} as const;

type WorkspaceTabKey = keyof typeof WORKSPACE_TAB_PATHS;
const DEFAULT_TAB_SEQUENCE: WorkspaceTabKey[] = ['grid', 'calendar', 'scheduler', 'map', 'board', 'statistics', 'settings'];

export const Workspace = () => {
  const { t } = useLanguage();
  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const navigate = useNavigate();

  // Extract workspace ID from the current path
  const getWorkspaceIdFromPath = (pathname: string): string | undefined => {
    const match = pathname.match(/\/workspace\/([^/?]+)/);
    return match ? match[1] : undefined;
  };

  const id = getWorkspaceIdFromPath(location.pathname);
  const workspaceBasePath = `/workspace/${id || 'all'}`.replace(/\/+$/, '');
  const isAllWorkspaces = location.pathname === '/workspace/all' || id === 'all';
  
  // Helper function to get current tab from URL (matches UrlTabs logic)
  const getCurrentTabFromUrl = (): WorkspaceTabKey => {
    const normalizedBase = workspaceBasePath;
    if (location.pathname.startsWith(normalizedBase)) {
      const rest = location.pathname.slice(normalizedBase.length) || '';
      const entries = Object.entries(WORKSPACE_TAB_PATHS) as Array<[WorkspaceTabKey, string]>;
      entries.sort((a, b) => (b[1].length || 0) - (a[1].length || 0));
      for (const [key, value] of entries) {
        const val = value || '';
        if (val === '' && (rest === '' || rest === '/')) {
          return key;
        } else if (rest === val || rest.replace(/\/$/, '') === val.replace(/\/$/, '') || rest.startsWith(val.endsWith('/') ? val : `${val}/`)) {
          return key;
        }
      }
    }
    return 'grid';
  };

  // Initialize tab state from URL to prevent incorrect animation on mount
  const initialTab = getCurrentTabFromUrl();
  const [activeTab, setActiveTab] = useState<WorkspaceTabKey>(initialTab);
  const [prevActiveTab, setPrevActiveTab] = useState<WorkspaceTabKey>(initialTab);

  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());
  const tableRef = useRef<WorkspaceTableHandle | null>(null);

  // Redux UI state selectors
  const searchText = useSelector(selectSearchText);
  const groupBy = useSelector(selectGroupBy);
  const collapseGroups = useSelector(selectCollapseGroups);

  const allowedTabOrder = DEFAULT_TAB_SEQUENCE;
  const resolvedOrder = useMemo(() => buildTabSequence(allowedTabOrder), [allowedTabOrder]);
  const primaryTabValue = resolvedOrder[0] || 'grid';
  const invalidWorkspaceRoute = !id && !isAllWorkspaces;
  const invalidWorkspaceId = !isAllWorkspaces && id !== undefined && isNaN(Number(id));
  const [showClearFilters, setShowClearFilters] = useState(false);
  const [openCreateTask, setOpenCreateTask] = useState(false);
  const [openEditTask, setOpenEditTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [rightPanel, setRightPanel] = useState<'chat' | 'resources' | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('wh_workspace_right_panel_w');
      return saved ? Math.max(280, Math.min(640, parseInt(saved, 10))) : 384; // default 384px (w-96)
    } catch {
      return 384;
    }
  });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartX, setResizeStartX] = useState<number | null>(null);
  const [resizeStartWidth, setResizeStartWidth] = useState<number | null>(null);
  const toggleRightPanel = (panel: 'chat' | 'resources') => {
    setRightPanel((prev) => (prev === panel ? null : panel));
  };

  // Display options - workspace-specific
  const [showHeaderKpis, setShowHeaderKpis] = useState<boolean>(() => {
    try {
      const key = `wh_workspace_show_kpis_${id || 'all'}`;
      const saved = localStorage.getItem(key);
      return saved == null ? true : saved === 'true';
    } catch { return true; }
  });
  const [tagDisplayMode, setTagDisplayMode] = useState<'icon' | 'icon-text'>(() => {
    try {
      const key = `wh_workspace_tag_display_mode_${id || 'all'}`;
      const saved = localStorage.getItem(key);
      return (saved === 'icon' || saved === 'icon-text') ? saved : 'icon-text';
    } catch { return 'icon-text'; }
  });
  const [visibleTabs, setVisibleTabs] = useState<string[]>(() => {
    const defaultTabs = ['grid', 'calendar', 'scheduler', 'map', 'board'];
    try {
      const key = `wh_workspace_visible_tabs_${id || 'all'}`;
      const raw = localStorage.getItem(key);
      if (!raw) return defaultTabs;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
        // Always ensure grid is included
        return Array.from(new Set(['grid', ...parsed]));
      }
    } catch {
      // ignore
    }
    return defaultTabs;
  });
  useEffect(() => {
    // Update when workspace changes
    try {
      const key = `wh_workspace_show_kpis_${id || 'all'}`;
      const saved = localStorage.getItem(key);
      setShowHeaderKpis(saved == null ? true : saved === 'true');
    } catch {}
    try {
      const key = `wh_workspace_tag_display_mode_${id || 'all'}`;
      const saved = localStorage.getItem(key);
      setTagDisplayMode((saved === 'icon' || saved === 'icon-text') ? saved : 'icon-text');
    } catch {}
    try {
      const key = `wh_workspace_visible_tabs_${id || 'all'}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
          setVisibleTabs(Array.from(new Set(['grid', ...parsed])));
        }
      } else {
        setVisibleTabs(['grid', 'calendar', 'scheduler', 'map', 'board']);
      }
    } catch {}
  }, [id]);
  useEffect(() => {
    const handler = (e: any) => {
      const eventWorkspaceId = e?.detail?.workspaceId || 'all';
      const currentWorkspaceId = id || 'all';
      // Only update if the event is for the current workspace
      if (eventWorkspaceId === currentWorkspaceId) {
        const v = e?.detail?.showKpis;
        if (typeof v === 'boolean') setShowHeaderKpis(v);
        const tagMode = e?.detail?.tagDisplayMode;
        if (tagMode === 'icon' || tagMode === 'icon-text') setTagDisplayMode(tagMode);
      }
    };
    window.addEventListener('wh:displayOptionsChanged', handler as any);
    return () => window.removeEventListener('wh:displayOptionsChanged', handler as any);
  }, [id]);
  useEffect(() => {
    const handler = (e: any) => {
      const eventWorkspaceId = e?.detail?.workspaceId || 'all';
      const currentWorkspaceId = id || 'all';
      // Only update if the event is for the current workspace
      if (eventWorkspaceId === currentWorkspaceId) {
        const tabs = e?.detail?.visibleTabs;
        if (Array.isArray(tabs) && tabs.every((x) => typeof x === 'string')) {
          setVisibleTabs(Array.from(new Set(['grid', ...tabs])));
        }
      }
    };
    window.addEventListener('wh:workspaceTabsChanged', handler as any);
    return () => window.removeEventListener('wh:workspaceTabsChanged', handler as any);
  }, [id]);


  useEffect(() => {
    try {
      localStorage.setItem('wh_workspace_right_panel_w', String(rightPanelWidth));
    } catch {}
  }, [rightPanelWidth]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      if (resizeStartX == null || resizeStartWidth == null) return;
      const dx = resizeStartX - e.clientX; // moving left increases width
      const next = Math.max(280, Math.min(640, resizeStartWidth + dx));
      setRightPanelWidth(next);
      e.preventDefault();
    };
    const handleUp = () => {
      setIsResizing(false);
      setResizeStartX(null);
      setResizeStartWidth(null);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing, resizeStartX, resizeStartWidth]);


  // Row density (affects grid row height)
  const [rowDensity, setRowDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try {
      return (localStorage.getItem('wh_workspace_density') as any) || 'spacious';
    } catch { return 'compact'; }
  });
  const computedRowHeight = rowDensity === 'compact' ? 40 : rowDensity === 'comfortable' ? 68 : 110;
  useEffect(() => {
    try { localStorage.setItem('wh_workspace_density', rowDensity); } catch {}
  }, [rowDensity]);
  // Listen for external density changes (from Settings screen)
  useEffect(() => {
    const handler = (e: any) => {
      const v = e?.detail as any;
      if (v === 'compact' || v === 'comfortable' || v === 'spacious') setRowDensity(v);
    };
    window.addEventListener('wh:rowDensityChanged', handler);
    return () => window.removeEventListener('wh:rowDensityChanged', handler);
  }, []);

  // Selected tasks (for bulk actions)
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  // Handle delete of selected tasks
  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    
    setDeleteDialogOpen(false);
    const taskCount = selectedIds.length;
    const taskIds = [...selectedIds];
    
    // Clear selection immediately
    setSelectedIds([]);
    tableRef.current?.clearSelection?.();
    
    // Delete all selected tasks
    const deletePromises = taskIds.map(taskId => 
      dispatch(removeTaskAsync(taskId)).unwrap().catch((error: any) => {
        console.error(`Failed to delete task ${taskId}:`, error);
        return { error, taskId };
      })
    );
    
    const results = await Promise.allSettled(deletePromises);
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value?.error));
    const succeeded = results.filter(r => r.status === 'fulfilled' && !r.value?.error);
    
    if (succeeded.length > 0) {
      toast.success(
        succeeded.length === taskCount
          ? `Deleted ${succeeded.length} task${succeeded.length > 1 ? 's' : ''}`
          : `Deleted ${succeeded.length} of ${taskCount} task${taskCount > 1 ? 's' : ''}`,
        { duration: 5000 }
      );
    }
    
    if (failed.length > 0) {
      toast.error(
        `Failed to delete ${failed.length} task${failed.length > 1 ? 's' : ''}`,
        { duration: 5000 }
      );
    }
  };
  
  // Metadata for filters
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  const users = useSelector((s: RootState) => (s as any).users.value as any[]);
  const tags = useSelector((s: RootState) => (s as any).tags.value as any[]);
  const currentUser = useSelector((s: RootState) => (s as any).auth?.user);
  // Load groupBy and collapseGroups from localStorage when workspace changes
  useEffect(() => {
    if (!id && !isAllWorkspaces) return;
    const workspaceId = id || 'all';
    try {
      const groupKey = `wh_workspace_group_by_${workspaceId}`;
      const collapseKey = `wh_workspace_group_collapse_${workspaceId}`;
      const savedGroup = localStorage.getItem(groupKey) as any;
      const savedCollapse = localStorage.getItem(collapseKey);
      if (savedGroup) {
        dispatch(setGroupBy(savedGroup));
      }
      if (savedCollapse !== null) {
        dispatch(setCollapseGroups(savedCollapse === 'true'));
      }
    } catch {}
  }, [id, isAllWorkspaces, dispatch]);

  // Listen for filter apply events from Header component
  useEffect(() => {
    const handleFilterApply = (event: CustomEvent<{ filterModel: any; clearSearch?: boolean }>) => {
      if (tableRef.current) {
        const filterModel = event.detail.filterModel || null;
        tableRef.current.setFilterModel(filterModel);
        dispatch(setFilterModel(filterModel));
        const key = `wh_workspace_filters_${id || 'all'}`;
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
  }, [id, dispatch]);

  // Listen for filter dialog open events from Header component
  useEffect(() => {
    const handleFilterDialogOpen = () => {
      setFiltersOpen(true);
    };
    window.addEventListener('workspace-filter-dialog-open', handleFilterDialogOpen as EventListener);
    return () => {
      window.removeEventListener('workspace-filter-dialog-open', handleFilterDialogOpen as EventListener);
    };
  }, []);

  // Derived status groupings for stats
  const doneStatusId = (statuses || []).find((s: any) => String((s as any).action || '').toUpperCase() === 'FINISHED')?.id
    ?? (statuses || []).find((s: any) => String((s as any).action || '').toUpperCase() === 'DONE')?.id
    ?? (statuses || []).find((s: any) => String((s as any).name || '').toLowerCase().includes('done'))?.id;
  const workingStatusIds: number[] = (statuses || [])
    .filter((s: any) => String((s as any).action || '').toUpperCase() === 'WORKING')
    .map((s: any) => Number((s as any).id))
    .filter((n: number) => Number.isFinite(n));

  // Header stats
  const [stats, setStats] = useState<{ total: number; inProgress: number; completedToday: number; trend: number[]; loading: boolean }>({
    total: 0,
    inProgress: 0,
    completedToday: 0,
    trend: [],
    loading: true
  });
  const isInitialLoadRef = useRef(true);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Only set loading state on initial load, preserve values during updates
        if (isInitialLoadRef.current) {
          setStats((s) => ({ ...s, loading: true }));
        }
        if (!TasksCache.initialized) await TasksCache.init();
        const base: any = {};
        const ws = isAllWorkspaces ? undefined : id;
        if (ws) base.workspace_id = ws;

        const totalResp = await TasksCache.queryTasks({ ...base, startRow: 0, endRow: 0 });
        const total = totalResp?.rowCount ?? 0;

        let inProgress = 0;
        if (workingStatusIds.length > 0) {
          for (const sid of workingStatusIds) {
            const r = await TasksCache.queryTasks({ ...base, status_id: sid, startRow: 0, endRow: 0 });
            inProgress += r?.rowCount ?? 0;
          }
        }

        let completedToday = 0;
        let trend: number[] = [];
        if (doneStatusId != null) {
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const r = await TasksCache.queryTasks({ ...base, status_id: Number(doneStatusId), updated_after: midnight.toISOString(), startRow: 0, endRow: 0 });
          completedToday = r?.rowCount ?? 0;

          // Build a 7-day completion trend (including today)
          const sevenDaysAgo = new Date(midnight);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
          const trendResp = await TasksCache.queryTasks({ ...base, updated_after: sevenDaysAgo.toISOString() });
          const trendRows: any[] = (trendResp as any)?.rows ?? [];
          trend = Array.from({ length: 7 }, (_, idx) => {
            const dayStart = new Date(sevenDaysAgo);
            dayStart.setDate(dayStart.getDate() + idx);
            const dayEnd = new Date(dayStart);
            dayEnd.setDate(dayEnd.getDate() + 1);
            return trendRows.filter((t: any) => Number(t.status_id) === Number(doneStatusId) && new Date(t.updated_at) >= dayStart && new Date(t.updated_at) < dayEnd).length;
          });
        }

        if (!cancelled) {
          setStats({ total, inProgress, completedToday, trend, loading: false });
          isInitialLoadRef.current = false;
        }
      } catch {
        if (!cancelled) {
          setStats((prev) => ({ ...prev, loading: false }));
          isInitialLoadRef.current = false;
        }
      }
    };
    // Reset initial load flag when workspace changes
    isInitialLoadRef.current = true;
    load();
    const unsubs = [
      TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, load),
      TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, load),
      TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, load),
      TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, load),
      TaskEvents.on(TaskEvents.EVENTS.CACHE_INVALIDATE, load),
    ];
    return () => { cancelled = true; unsubs.forEach((u) => { try { u(); } catch {} }); };
  }, [id, isAllWorkspaces, doneStatusId, workingStatusIds.join(',')]);

  // Filter builder dialog
  const [filtersOpen, setFiltersOpen] = useState(false);




  // Sync tab state when URL changes (e.g., navigating from settings to workspace)
  useEffect(() => {
    const currentTabFromUrl = getCurrentTabFromUrl();
    if (currentTabFromUrl !== activeTab) {
      // When URL changes (e.g., navigating from settings), sync both states
      // to the same value to prevent incorrect animation on mount
      // This ensures prevActiveTab matches activeTab so initial position is correct
      setPrevActiveTab(currentTabFromUrl);
      setActiveTab(currentTabFromUrl);
    }
  }, [location.pathname, id]);

  useEffect(() => {
    if (invalidWorkspaceRoute || invalidWorkspaceId) return;
    const allowedSet = new Set(resolvedOrder);
    if (!allowedSet.has(activeTab)) {
      const fallbackTab = resolvedOrder[0] || 'grid';
      const targetPath = `${workspaceBasePath}${WORKSPACE_TAB_PATHS[fallbackTab]}`;
      const normalizedTarget = targetPath.replace(/\/+$/, '');
      const normalizedCurrent = location.pathname.replace(/\/+$/, '');
      if (normalizedCurrent !== normalizedTarget) {
        navigate(targetPath, { replace: true });
      }
    }
  }, [resolvedOrder, activeTab, navigate, location.pathname, workspaceBasePath, invalidWorkspaceRoute, invalidWorkspaceId]);

  //
  // Clear cache when workspace ID changes
  useEffect(() => {
    if (id) {
      console.log(`Switching to workspace ${id}, clearing cache`);
      rowCache.current.clear();
    }
  }, [id, location.pathname]);

  

  // Initialize common presets if they don't exist
  useEffect(() => {
    const ws = isAllWorkspaces ? 'all' : (id || 'all');
    const currentUserId = Number((currentUser as any)?.id);
    if (!Number.isFinite(currentUserId)) return;
    const all = listPresets(ws);
    
    // Check if common presets exist, if not create them
    // Normalize dates to YYYY-MM-DD format for consistent TasksCache date parsing
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
        savePreset({ name: preset.name, workspaceScope: ws, model: preset.model });
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      // Reload presets after creating common ones
      const quick = listPinnedPresets(ws).slice(0, 4);
      const updatedAll = listPresets(ws);
      dispatch(setPresets({ quickPresets: quick, allPresets: updatedAll }));
    }
  }, [id, isAllWorkspaces, currentUser, dispatch]);

  // Load quick presets scoped to workspace (refresh after dialog closes to capture new saves)
  useEffect(() => {
    const ws = isAllWorkspaces ? 'all' : (id || 'all');
    try {
      const quick = listPinnedPresets(ws).slice(0, 4);
      const all = listPresets(ws);
      dispatch(setPresets({ quickPresets: quick, allPresets: all }));
    } catch {
      dispatch(setPresets({ quickPresets: [], allPresets: [] }));
    }
  }, [id, isAllWorkspaces, filtersOpen, dispatch]);

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

  // Save search text to localStorage when it changes
  useEffect(() => {
    const key = `wh_workspace_search_global`;
    try {
      if (searchText) {
        localStorage.setItem(key, searchText);
      } else {
        localStorage.removeItem(key);
      }
    } catch {}
  }, [searchText]);

  // Restore saved filters for this workspace when grid is ready
  const handleTableReady = () => {
    const key = `wh_workspace_filters_${id || 'all'}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved && tableRef.current) {
        const model = JSON.parse(saved);
        tableRef.current.setFilterModel(model);
      }
    } catch {}
  };


  if (invalidWorkspaceRoute) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Invalid Workspace ID</h2>
          <p className="text-gray-600 mt-2">Please check the URL and try again.</p>
        </div>
      </div>
      
      
    );
  }

  if (invalidWorkspaceId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-red-600">Invalid Workspace ID</h2>
          <p className="text-gray-600 mt-2">ID: "{id}" must be a number or "all" - Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  // Define tabs for URL persistence
  const workspaceTabs = [
    {
      value: 'grid',
      label: (
        <div className="flex items-center gap-2">
          <ClipboardList />
          <span className="tab-label-text">Tasks</span>
        </div>
      ),
      forceMount: true,
      content: (
        <motion.div
          className='flex-1 h-full'
          key='grid'
          initial={false}
          animate={{ x: activeTab === 'grid' ? 0 : getWorkspaceTabInitialX(activeTab, 'grid') }}
          transition={activeTab === 'grid' ? TAB_ANIMATION.transition : { duration: 0 }}
        >
          <WorkspaceTable 
            key={isAllWorkspaces ? 'all' : (id || 'root')}
            ref={tableRef}
            rowCache={rowCache} 
            workspaceId={isAllWorkspaces ? 'all' : (id || '')} 
            searchText={searchText}
            onFiltersChanged={(active) => {
              setShowClearFilters(!!active);
              // Track current filter model for active filter chips
              const model = tableRef.current?.getFilterModel?.();
              dispatch(setFilterModel(model || null));
            }}
            onSelectionChanged={setSelectedIds}
            onOpenTaskDialog={(task) => {
              setSelectedTask(task);
              // Perf mark: used by TaskDialog to measure click→animationstart
              (window as any).__taskDialogClickTime = performance.now();
              setOpenEditTask(true);
            }}
            rowHeight={computedRowHeight}
            groupBy={groupBy}
            collapseGroups={collapseGroups}
            tagDisplayMode={tagDisplayMode}
            onReady={handleTableReady}
          />
        </motion.div>
      )
		},
    {
      value: 'calendar',
      label: (
        <div className="flex items-center gap-2">
          <Calendar />
          <span className="tab-label-text">Calendar</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='calendar' initial={{ x: getWorkspaceTabInitialX(prevActiveTab, 'calendar') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <CalendarViewTab workspaceId={id} />
        </motion.div>
      )
    },
    {
      value: 'scheduler',
      label: (
        <div className="flex items-center gap-2">
          <Clock />
          <span className="tab-label-text">Scheduler</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='scheduler' initial={{ x: getWorkspaceTabInitialX(prevActiveTab, 'scheduler') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <SchedulerViewTab workspaceId={id} />
        </motion.div>
      )
    },
    {
      value: 'map',
      label: (
        <div className="flex items-center gap-2">
          <MapIcon />
          <span className="tab-label-text">Map</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='map' initial={{ x: getWorkspaceTabInitialX(prevActiveTab, 'map') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <MapViewTab workspaceId={id} />
        </motion.div>
      )
    },
    {
      value: 'board',
      label: (
        <div className="flex items-center gap-2">
          <LayoutDashboard />
          <span className="tab-label-text">Board</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='board' initial={{ x: getWorkspaceTabInitialX(prevActiveTab, 'board') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <TaskBoardTab workspaceId={id} />
        </motion.div>
      )
    },
    {
      value: 'statistics',
      label: (
        <div className="flex items-center gap-2" aria-label="Statistics">
          <div className="flex items-center justify-center w-6 h-6 rounded border border-border/60 bg-muted/40 text-muted-foreground">
            <BarChart3 className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <span className="tab-label-text">Stats</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='statistics' initial={{ x: getWorkspaceTabInitialX(prevActiveTab, 'statistics') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <WorkspaceStatistics workspaceId={id} />
        </motion.div>
      )
    },
    {
      value: 'settings',
      label: (
        <div className="flex items-center gap-2" aria-label="Settings">
          <div className="flex items-center justify-center w-6 h-6 rounded border border-border/60 bg-muted/30 text-muted-foreground">
            <Settings className="w-4 h-4" strokeWidth={2.2} />
          </div>
          <span className="tab-label-text">Config</span>
        </div>
      ),
      content: (
        <motion.div className='flex-1 h-full' key='settings' initial={{ x: getWorkspaceTabInitialX(prevActiveTab, 'settings') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <SettingsComponent workspaceId={id} />
        </motion.div>
      )
    }
  ];

  function buildTabSequence(order: WorkspaceTabKey[]) {
    const sequence: WorkspaceTabKey[] = [];
    const seen = new Set<WorkspaceTabKey>();
    const pushUnique = (key: WorkspaceTabKey) => {
      if (!seen.has(key)) {
        seen.add(key);
        sequence.push(key);
      }
    };
    order.forEach(pushUnique);
    ['statistics', 'settings'].forEach((key) => pushUnique(key as WorkspaceTabKey));
    return sequence;
  }

  const workspaceTabMap = workspaceTabs.reduce<Record<string, typeof workspaceTabs[number]>>((acc, tab) => {
    acc[tab.value] = tab;
    return acc;
  }, {});
  
  // Filter tabs based on visibility preferences (always show grid, statistics, settings)
  const visibleTabSet = new Set(visibleTabs);
  const alwaysVisibleTabs = ['grid', 'statistics', 'settings'];
  const filteredOrder = resolvedOrder.filter(key => 
    alwaysVisibleTabs.includes(key) || visibleTabSet.has(key)
  );
  
  const orderedVisibleTabs = filteredOrder
    .map((key) => workspaceTabMap[key])
    .filter((tab): tab is typeof workspaceTabs[number] => Boolean(tab));
  const tabsForRender = orderedVisibleTabs.length > 0 ? orderedVisibleTabs : workspaceTabs.filter(tab => 
    alwaysVisibleTabs.includes(tab.value) || visibleTabSet.has(tab.value)
  );

  const statsArePending = stats.loading && stats.total === 0 && stats.inProgress === 0 && stats.completedToday === 0;
  const formatStatValue = (value: number) => (statsArePending ? '—' : value.toLocaleString());
  const completedLast7Days = stats.trend.reduce((sum, val) => sum + val, 0);
  const trendDelta = stats.trend.length >= 2 ? stats.trend[stats.trend.length - 1] - stats.trend[stats.trend.length - 2] : 0;

  const TrendSparkline = ({ data }: { data: number[] }) => {
    if (!data || data.length === 0) {
      return <div className="text-xs text-muted-foreground">—</div>;
    }
    const width = 100;
    const height = 40;
    const max = Math.max(...data, 1);
    const points = data.map((val, idx) => {
      const x = data.length === 1 ? width / 2 : (idx / Math.max(data.length - 1, 1)) * width;
      const y = height - ((val / max) * height);
      return `${x},${y}`;
    }).join(' ');
    const lastX = data.length === 1 ? width / 2 : width;
    const lastY = height - ((data[data.length - 1] / max) * height);

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10 text-sky-600" role="img" aria-label="7 day completion trend">
        <polyline fill="none" stroke="currentColor" strokeWidth="2.4" points={points} strokeLinecap="round" />
        <circle cx={lastX} cy={lastY} r="2.6" fill="currentColor" />
      </svg>
    );
  };

  type KpiCard = {
    key: string;
    label: string;
    value: string;
    icon: ReactNode;
    badgeClass: string;
    barClass: string;
    sparkline?: ReactNode;
    helperText?: string;
  };

  const kpiCards: KpiCard[] = [
    {
      key: 'total',
      label: t('workspace.stats.total', 'Total'),
      value: formatStatValue(stats.total),
      icon: <BarChart3 className="h-5 w-5" />,
      badgeClass: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-500/20',
      barClass: 'from-indigo-500 via-indigo-400 to-indigo-500'
    },
    {
      key: 'inProgress',
      label: t('workspace.stats.inProgress', 'In progress'),
      value: formatStatValue(stats.inProgress),
      icon: <Activity className="h-5 w-5" />,
      badgeClass: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white border-amber-600 shadow-lg shadow-amber-500/20',
      barClass: 'from-amber-500 via-amber-400 to-amber-500'
    },
    {
      key: 'completedToday',
      label: t('workspace.stats.completedToday', 'Completed today'),
      value: formatStatValue(stats.completedToday),
      icon: <Sparkles className="h-5 w-5" />,
      badgeClass: 'bg-gradient-to-br from-emerald-500 to-green-600 text-white border-emerald-600 shadow-lg shadow-emerald-500/20',
      barClass: 'from-emerald-500 via-emerald-400 to-emerald-500',
      helperText: stats.completedToday === 0 && !statsArePending ? t('workspace.stats.startCompleting', 'Start completing tasks to see progress!') : undefined
    },
    {
      key: 'trend',
      label: t('workspace.stats.sevenDayTrend', '7-day trend'),
      value: statsArePending ? '—' : `${completedLast7Days.toLocaleString()} ${t('workspace.stats.done', 'done')}`,
      icon: <TrendingUp className="h-5 w-5" />,
      badgeClass: 'bg-gradient-to-br from-purple-500 to-violet-600 text-white border-purple-600 shadow-lg shadow-purple-500/20',
      barClass: 'from-purple-500 via-purple-400 to-purple-500',
      sparkline: <TrendSparkline data={stats.trend} />,
      helperText: statsArePending 
        ? '' 
        : completedLast7Days === 0 
          ? t('workspace.stats.completeFirst', 'Complete your first task to begin tracking progress!')
          : `${trendDelta >= 0 ? '+' : ''}${trendDelta} ${t('workspace.stats.vsYesterday', 'vs yesterday')}`
    }
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-start gap-3 -mt-1 mb-3">
        {showHeaderKpis && (
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {kpiCards.map((card) => (
                <motion.div
                  key={card.key}
                  className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card/95 to-card/80 backdrop-blur-sm shadow-md hover:shadow-lg border-border/60 workspace-kpi-card group transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  whileHover={{ scale: 1.02 }}
                >
                  {/* Animated gradient top bar */}
                  <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${card.barClass} animate-gradient-x`} />
                  
                  {/* Subtle background gradient overlay */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${card.barClass} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                  
                  <div className="flex items-center gap-3 px-4 py-3 relative z-10">
                    <motion.div 
                      className={`flex items-center justify-center flex-shrink-0 rounded-xl p-2.5 border-2 ${card.badgeClass} workspace-kpi-icon group-hover:scale-110 transition-transform duration-300`}
                      whileHover={{ rotate: [0, -5, 5, -5, 0] }}
                      transition={{ duration: 0.5 }}
                    >
                      {card.icon}
                    </motion.div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80 truncate mb-0.5">
                        {card.label}
                      </div>
                      <motion.div 
                        className="text-2xl font-bold leading-tight text-foreground truncate"
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                      >
                        {card.value}
                      </motion.div>
                      {card.helperText ? (
                        <div className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                          {card.helperText}
                        </div>
                      ) : null}
                    </div>
                    {card.sparkline ? (
                      <div className="flex-shrink-0 w-24 sm:w-28 opacity-80 group-hover:opacity-100 transition-opacity">
                        {card.sparkline}
                      </div>
                    ) : null}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        <div className="flex-shrink-0 flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant={rightPanel ? 'secondary' : 'ghost'}
                size="sm"
                className="gap-2"
                aria-label="Collaboration menu"
              >
                <MessageSquare className="w-4 h-4" strokeWidth={2.2} />
                <span className="hidden sm:inline">{t('workspace.collab.collab', 'Collab')}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>{t('workspace.collab.collaboration', 'Collaboration')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={rightPanel === 'chat'}
                onCheckedChange={() => toggleRightPanel('chat')}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>{t('workspace.collab.chat', 'Chat')}</span>
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={rightPanel === 'resources'}
                onCheckedChange={() => toggleRightPanel('resources')}
              >
                <div className="flex items-center gap-2">
                  <FolderPlus className="w-4 h-4" />
                  <span>{t('workspace.collab.resources', 'Resources')}</span>
                </div>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {/* Bulk actions toolbar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 mb-2 border rounded px-2 py-1 bg-background/60">
          <span className="text-sm text-muted-foreground">Selected: {selectedIds.length}</span>
          <Button variant="ghost" size="sm" title="Mark complete" aria-label="Mark complete" disabled>
            <CheckCircle2 className="h-4 w-4 mr-1" /> Complete
          </Button>
          <Button variant="ghost" size="sm" title="Reassign" aria-label="Reassign" disabled>
            <UserRound className="h-4 w-4 mr-1" /> Reassign
          </Button>
          <Button variant="ghost" size="sm" title="Change priority" aria-label="Change priority" disabled>
            <Flag className="h-4 w-4 mr-1" /> Priority
          </Button>
          <Button variant="ghost" size="sm" title="Reschedule" aria-label="Reschedule" disabled>
            <CalendarDays className="h-4 w-4 mr-1" /> Reschedule
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            title="Delete selected tasks" 
            aria-label="Delete selected tasks"
            onClick={() => setDeleteDialogOpen(true)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
          <div className="ml-auto" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              tableRef.current?.clearSelection?.();
              setSelectedIds([]);
            }}
          >
            Clear selection
          </Button>
        </div>
      )}
      <div className={`flex h-full ${isResizing ? 'select-none' : ''}`}>
        <div className='flex-1 min-w-0'>
        <UrlTabs
          tabs={tabsForRender}
          defaultValue={primaryTabValue}
          basePath={`/workspace/${id}`}
          pathMap={WORKSPACE_TAB_PATHS}
          className="w-full h-full flex flex-col [&_[data-slot=tabs]]:gap-0 [&_[data-slot=tabs-content]]:mt-0 [&>div]:pt-0 [&_[data-slot=tabs-list]]:mb-0"
          onValueChange={(v) => { setPrevActiveTab(activeTab); setActiveTab(v as WorkspaceTabKey); }}
          showClearFilters={showClearFilters}
          onClearFilters={() => tableRef.current?.clearFilters()}
        />
        </div>
        {rightPanel && (
          <>
            <div
              className="w-1.5 cursor-col-resize bg-border hover:bg-primary/40"
              onMouseDown={(e) => {
                setIsResizing(true);
                setResizeStartX(e.clientX);
                setResizeStartWidth(rightPanelWidth);
              }}
              title="Drag to resize"
            />
            <div className="border-l bg-background flex flex-col" style={{ width: rightPanelWidth, flex: '0 0 auto' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <div className="text-sm font-medium">{rightPanel === 'chat' ? t('workspace.collab.chat', 'Chat') : t('workspace.collab.resources', 'Resources')}</div>
              <Button variant="ghost" size="icon" aria-label="Close panel" onClick={() => setRightPanel(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-2">
              {rightPanel === 'chat' ? (
                <ChatTab workspaceId={id} />
              ) : (
                <ResourcesTab workspaceId={id} />
              )}
            </div>
            </div>
          </>
        )}
      </div>

      <FilterBuilderDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        workspaceId={isAllWorkspaces ? 'all' : (id || 'all')}
        statuses={(statuses || []).map((s: any) => ({ id: Number(s.id), name: s.name }))}
        priorities={(priorities || []).map((p: any) => ({ id: Number(p.id), name: p.name }))}
        spots={(spots || []).map((sp: any) => ({ id: Number(sp.id), name: sp.name }))}
        owners={(users || [])
          .map((u: any) => {
            const idNum = Number(u.id);
            if (!Number.isFinite(idNum)) return null;
            return { id: idNum, name: u.name || u.email || `User #${idNum}` };
          })
          .filter((o): o is { id: number; name: string } => Boolean(o))}
        tags={(tags || [])
          .filter((t: any) => {
            const idNum = Number(t.id);
            return Number.isFinite(idNum);
          })
          .map((t: any) => ({
            id: Number(t.id),
            name: t.name,
            color: t.color
          }))}
        currentModel={tableRef.current?.getFilterModel?.()}
        currentSearchText={searchText}
        onApply={(model) => {
          const filterModel = model || null;
          tableRef.current?.setFilterModel(filterModel);
          dispatch(setFilterModel(filterModel));
          try { localStorage.setItem(`wh_workspace_filters_${id || 'all'}`, JSON.stringify(filterModel)); } catch {}
          dispatch(setSearchText(''));
        }}
      />


      {/* Task Dialog - Unified component for create/edit */}
      {!isAllWorkspaces && !isNaN(Number(id)) && (
        <TaskDialog 
          open={openCreateTask} 
          onOpenChange={setOpenCreateTask} 
          mode="create" 
          workspaceId={parseInt(id!, 10)} 
        />
      )}
      {isAllWorkspaces && (
        <TaskDialog 
          open={openCreateTask} 
          onOpenChange={setOpenCreateTask} 
          mode="create-all" 
        />
      )}
      <TaskDialog 
        open={openEditTask} 
        onOpenChange={setOpenEditTask} 
        mode="edit" 
        task={selectedTask} 
      />
      <TaskNotesModal />
      <DeleteTaskDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDeleteSelected}
        taskName={selectedIds.length === 1 ? undefined : `${selectedIds.length} tasks`}
      />
    </div>

  );
};
