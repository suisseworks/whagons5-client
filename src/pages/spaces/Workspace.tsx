import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { UrlTabs } from '@/components/ui/url-tabs';
import { ClipboardList, Settings, Plus, MessageSquare, FolderPlus, Calendar, Clock, LayoutDashboard, X, Map as MapIcon, CheckCircle2, UserRound, CalendarDays, Flag, Search, SlidersHorizontal, ChevronUp } from 'lucide-react';
import WorkspaceTable, { WorkspaceTableHandle } from '@/pages/spaces/components/WorkspaceTable';
import SettingsComponent from '@/pages/spaces/components/Settings';
import ChatTab from '@/pages/spaces/components/ChatTab';
import ResourcesTab from '@/pages/spaces/components/ResourcesTab';
import CalendarViewTab from '@/pages/spaces/components/CalendarViewTab';
import SchedulerViewTab from '@/pages/spaces/components/SchedulerViewTab';
import TaskBoardTab from '@/pages/spaces/components/TaskBoardTab';
import MapViewTab from '@/pages/spaces/components/MapViewTab';
import { Input } from '@/components/ui/input';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import CreateTaskDialog from '@/pages/spaces/components/CreateTaskDialog';
import { motion } from 'motion/react';
import { TAB_ANIMATION, getWorkspaceTabInitialX } from '@/config/tabAnimation';
import FilterBuilderDialog from '@/pages/spaces/components/FilterBuilderDialog';
import { listPresets, listPinnedPresets, isPinned, togglePin, setPinnedOrder, SavedFilterPreset } from '@/pages/spaces/components/workspaceTable/filterPresets';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';

export const Workspace = () => {
  const location = useLocation();

  // Extract workspace ID from the current path
  const getWorkspaceIdFromPath = (pathname: string): string | undefined => {
    const match = pathname.match(/\/workspace\/([^/?]+)/);
    return match ? match[1] : undefined;
  };

  const id = getWorkspaceIdFromPath(location.pathname);
  // State to store the fetched data
  const [activeTab, setActiveTab] = useState('grid');
  const [prevActiveTab, setPrevActiveTab] = useState('grid');

  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());
  const [searchText, setSearchText] = useState('');
  const tableRef = useRef<WorkspaceTableHandle | null>(null);
  const [showClearFilters, setShowClearFilters] = useState(false);
  const [openCreateTask, setOpenCreateTask] = useState(false);
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
  // Toggle visibility of search/filters header
  const [controlsVisible, setControlsVisible] = useState<boolean>(() => {
    try { return (localStorage.getItem('wh_workspace_controls_visible') ?? 'true') !== 'false'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('wh_workspace_controls_visible', String(controlsVisible)); } catch {}
  }, [controlsVisible]);

  // Display options
  const [showHeaderKpis, setShowHeaderKpis] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wh_workspace_show_kpis');
      return saved == null ? true : saved === 'true';
    } catch { return true; }
  });
  useEffect(() => {
    const handler = (e: any) => {
      const v = e?.detail?.showKpis;
      if (typeof v === 'boolean') setShowHeaderKpis(v);
    };
    window.addEventListener('wh:displayOptionsChanged', handler as any);
    return () => window.removeEventListener('wh:displayOptionsChanged', handler as any);
  }, []);

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
  const computedRowHeight = rowDensity === 'compact' ? 40 : rowDensity === 'comfortable' ? 46 : 64;
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
  // Metadata for filters
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  // Grouping
  const [groupBy, setGroupBy] = useState<'none' | 'spot_id' | 'status_id' | 'priority_id'>(() => {
    try {
      const key = `wh_workspace_group_by_${id || 'all'}`;
      const saved = localStorage.getItem(key) as any;
      return saved || 'none';
    } catch { return 'none'; }
  });
  const [collapseGroups, setCollapseGroups] = useState<boolean>(() => {
    try {
      const key = `wh_workspace_group_collapse_${id || 'all'}`;
      const saved = localStorage.getItem(key);
      return saved == null ? true : saved === 'true';
    } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem(`wh_workspace_group_by_${id || 'all'}`, groupBy); } catch {}
  }, [groupBy, id]);
  useEffect(() => {
    try { localStorage.setItem(`wh_workspace_group_collapse_${id || 'all'}`, String(collapseGroups)); } catch {}
  }, [collapseGroups, id]);

  // Check if this is the "all" workspace route (needed for stats and presets)
  const isAllWorkspaces = location.pathname === '/workspace/all' || id === 'all';
  const invalidWorkspaceRoute = !id && !isAllWorkspaces;
  const invalidWorkspaceId = !isAllWorkspaces && id !== undefined && isNaN(Number(id));

  // Derived status groupings for stats
  const doneStatusId = (statuses || []).find((s: any) => String((s as any).action || '').toUpperCase() === 'DONE')?.id
    ?? (statuses || []).find((s: any) => String((s as any).name || '').toLowerCase().includes('done'))?.id;
  const workingStatusIds: number[] = (statuses || [])
    .filter((s: any) => String((s as any).action || '').toUpperCase() === 'WORKING')
    .map((s: any) => Number((s as any).id))
    .filter((n: number) => Number.isFinite(n));

  // Header stats
  const [stats, setStats] = useState<{ total: number; inProgress: number; completedToday: number; loading: boolean }>({ total: 0, inProgress: 0, completedToday: 0, loading: true });
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setStats((s) => ({ ...s, loading: true }));
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
        if (doneStatusId != null) {
          const midnight = new Date();
          midnight.setHours(0, 0, 0, 0);
          const r = await TasksCache.queryTasks({ ...base, status_id: Number(doneStatusId), updated_after: midnight.toISOString(), startRow: 0, endRow: 0 });
          completedToday = r?.rowCount ?? 0;
        }

        if (!cancelled) setStats({ total, inProgress, completedToday, loading: false });
      } catch {
        if (!cancelled) setStats({ total: 0, inProgress: 0, completedToday: 0, loading: false });
      }
    };
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
  const [quickPresets, setQuickPresets] = useState<SavedFilterPreset[]>([]);
  const [allPresets, setAllPresets] = useState<SavedFilterPreset[]>([]);
  const dragIdRef = useRef<string | null>(null);




  //
  // Clear cache when workspace ID changes
  useEffect(() => {
    if (id) {
      console.log(`Switching to workspace ${id}, clearing cache`);
      rowCache.current.clear();
    }
  }, [id, location.pathname]);
  // Debug logging
  console.log('Workspace component - id:', id, 'typeof:', typeof id);
  console.log('Current path:', location.pathname);

  

  // Load quick presets scoped to workspace (refresh after dialog closes to capture new saves)
  useEffect(() => {
    const ws = isAllWorkspaces ? 'all' : (id || 'all');
    try {
      setQuickPresets(listPinnedPresets(ws).slice(0, 4));
      setAllPresets(listPresets(ws));
    } catch {
      setQuickPresets([]);
      setAllPresets([]);
    }
  }, [id, isAllWorkspaces, filtersOpen]);

  // Persist and restore search text globally
  useEffect(() => {
    const key = `wh_workspace_search_global`;
    try {
      const saved = localStorage.getItem(key);
      if (saved != null) setSearchText(saved);
    } catch {}
  }, []);

  // Restore saved filters for this workspace when grid is ready
  const appliedInitialFilters = useRef(false);
  useEffect(() => {
    if (appliedInitialFilters.current) return;
    const key = `wh_workspace_filters_${id || 'all'}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved && tableRef.current) {
        const model = JSON.parse(saved);
        tableRef.current.setFilterModel(model);
        appliedInitialFilters.current = true;
      }
    } catch {}
  }, [id]);

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
            ref={tableRef}
            rowCache={rowCache} 
            workspaceId={isAllWorkspaces ? 'all' : (id || '')} 
            searchText={searchText}
            onFiltersChanged={(active) => setShowClearFilters(!!active)}
            onSelectionChanged={setSelectedIds}
            rowHeight={computedRowHeight}
            groupBy={groupBy}
            collapseGroups={collapseGroups}
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
      value: 'settings',
      label: (
        <div className="flex items-center gap-2" aria-label="Settings">
          <Settings />
        </div>
      ),
      content: (
        <motion.div key='settings' initial={{ x: getWorkspaceTabInitialX(prevActiveTab, 'settings') }} animate={{ x: 0 }} transition={TAB_ANIMATION.transition}>
          <SettingsComponent workspaceId={id} />
        </motion.div>
      )
    }
  ];

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toggle controls button */}
      <div className="flex items-center justify-end mb-2 pr-8">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Toggle controls"
          title={controlsVisible ? 'Hide controls' : 'Show controls'}
          onClick={() => setControlsVisible(v => !v)}
          className="mr-12 mt-[-10px]"
        >
          {controlsVisible ? <ChevronUp className="w-5 h-5" /> : <SlidersHorizontal className="w-5 h-5" />}
        </Button>
      </div>

      {controlsVisible && (
      <div className="flex items-center gap-6 mb-2 mt-[-24px]">
        <div className="relative max-w-sm w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Search…"
            className="h-10 pl-9 pr-9 rounded-[8px] border border-border/40 placeholder:text-muted-foreground/50 dark:bg-[#252b36] dark:border-[#2A2A2A] dark:placeholder-[#6B7280] focus-visible:border-[#6366F1]"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        {/* Quick filter chips */}
        <div className="flex items-center gap-2 ml-2">
          <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground"
            title="All tasks"
            onClick={() => {
              tableRef.current?.setFilterModel(null);
              try { localStorage.removeItem(`wh_workspace_filters_${id || 'all'}`); } catch {}
            }}
          >All</Button>
          {quickPresets.map((p, idx) => (
            <div
              key={p.id}
              draggable
              onDragStart={() => { dragIdRef.current = p.id; }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={() => {
                const draggedId = dragIdRef.current;
                dragIdRef.current = null;
                if (!draggedId || draggedId === p.id) return;
                const scope = isAllWorkspaces ? 'all' : (id || 'all');
                const current = quickPresets.slice();
                const from = current.findIndex(x => x.id === draggedId);
                const to = idx;
                if (from < 0 || to < 0) return;
                const moved = current.splice(from, 1)[0];
                current.splice(to, 0, moved);
                setQuickPresets(current);
                try { setPinnedOrder(scope, current.map(x => x.id)); } catch {}
              }}
              className="inline-flex"
              title="Drag to reorder pinned preset"
            >
              <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground"
                title={p.name}
                onClick={() => {
                  tableRef.current?.setFilterModel(p.model);
                  try { localStorage.setItem(`wh_workspace_filters_${id || 'all'}`, JSON.stringify(p.model)); } catch {}
                  setSearchText('');
                }}
              >{p.name}</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground"
            title="Custom filters"
            onClick={() => setFiltersOpen(true)}
          >Filters…</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground" title="More presets">More…</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[240px]">
              <DropdownMenuLabel>Apply preset</DropdownMenuLabel>
              {allPresets.length === 0 ? (
                <DropdownMenuItem disabled>No presets yet</DropdownMenuItem>
              ) : (
                allPresets.map((p) => (
                  <DropdownMenuItem key={p.id} onClick={() => {
                    tableRef.current?.setFilterModel(p.model);
                    try { localStorage.setItem(`wh_workspace_filters_${id || 'all'}`, JSON.stringify(p.model)); } catch {}
                    setSearchText('');
                  }}>
                    {p.name}
                  </DropdownMenuItem>
                ))
              )}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Pin to toolbar</DropdownMenuLabel>
              {allPresets.map((p) => (
                <DropdownMenuCheckboxItem
                  key={p.id}
                  checked={isAllWorkspaces ? isPinned('all', p.id) : isPinned(id || 'all', p.id)}
                  onCheckedChange={() => {
                    const scope = isAllWorkspaces ? 'all' : (id || 'all');
                    togglePin(scope, p.id);
                    // refresh pinned list after toggle
                    try {
                      setQuickPresets(listPinnedPresets(scope).slice(0, 4));
                    } catch {}
                  }}
                >
                  {p.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {/* Density toggles */}
        {/* Density moved to Settings screen */}
        {/* Group by control */}
        <div className="flex items-center gap-2 ml-2">
          <Label className="text-xs text-muted-foreground">Group</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger size="sm" className="h-8 rounded-lg px-3 text-[12px] text-foreground/65 border-border/30 hover:bg-foreground/5">
              <SelectValue placeholder="Group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="spot_id">Location</SelectItem>
              <SelectItem value="status_id">Status</SelectItem>
              <SelectItem value="priority_id">Priority</SelectItem>
            </SelectContent>
          </Select>
          {groupBy !== 'none' && (
            <div className="flex items-center gap-2">
              <Switch checked={collapseGroups} onCheckedChange={setCollapseGroups} />
              <Label className="text-sm text-muted-foreground">Collapse</Label>
            </div>
          )}
        </div>
        <div className="ml-auto flex items-center gap-4 pr-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle Chat"
            onClick={() => setRightPanel(prev => prev === 'chat' ? null : 'chat')}
            title="Chat"
          >
            <MessageSquare className="w-6 h-6" strokeWidth={2.2} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle Resources"
            onClick={() => setRightPanel(prev => prev === 'resources' ? null : 'resources')}
            title="Resources"
          >
            <FolderPlus className="w-6 h-6" strokeWidth={2.2} />
          </Button>
        </div>
      </div>
      )}
      {/* Stats summary (chips) */}
      {showHeaderKpis && (
        <div className="flex flex-wrap gap-2.5 mb-0">
          <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-card/80 px-3 py-1.5">
            <ClipboardList className="h-[18px] w-[18px] text-cyan-600" />
            <span className="text-[12px] text-muted-foreground">Total</span>
            <span className="text-base font-semibold">{stats.loading ? '—' : stats.total.toLocaleString()}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-card/80 px-3 py-1.5">
            <Clock className="h-[18px] w-[18px] text-amber-600" />
            <span className="text-[12px] text-muted-foreground">In progress</span>
            <span className="text-base font-semibold">{stats.loading ? '—' : stats.inProgress.toLocaleString()}</span>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border/40 bg-card/80 px-3 py-1.5">
            <CheckCircle2 className="h-[18px] w-[18px] text-emerald-600" />
            <span className="text-[12px] text-muted-foreground">Completed today</span>
            <span className="text-base font-semibold">{stats.loading ? '—' : stats.completedToday.toLocaleString()}</span>
          </div>
        </div>
      )}
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
          <div className="ml-auto" />
          <Button variant="outline" size="sm" onClick={() => setSelectedIds([])}>Clear selection</Button>
        </div>
      )}
      <div className={`flex h-full ${isResizing ? 'select-none' : ''}`}>
        <div className='flex-1 min-w-0'>
        <UrlTabs
          tabs={workspaceTabs}
          defaultValue="grid"
          basePath={`/workspace/${id}`}
          pathMap={{ grid: '', calendar: '/calendar', scheduler: '/scheduler', map: '/map', board: '/board', settings: '/settings' }}
          className="w-full h-full flex flex-col"
          onValueChange={(v) => { setPrevActiveTab(activeTab); setActiveTab(v); }}
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
              <div className="text-sm font-medium">{rightPanel === 'chat' ? 'Chat' : 'Resources'}</div>
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
        currentModel={tableRef.current?.getFilterModel?.()}
        currentSearchText={searchText}
        onApply={(model) => {
          tableRef.current?.setFilterModel(model);
          try { localStorage.setItem(`wh_workspace_filters_${id || 'all'}`, JSON.stringify(model)); } catch {}
          setSearchText('');
        }}
      />


      {/* Floating Action Button for mobile (bottom-right) */}
      {!isAllWorkspaces && !isNaN(Number(id)) && (
        <>
          <button
            className="fixed right-5 bottom-20 sm:hidden inline-flex items-center justify-center h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg"
            onClick={() => setOpenCreateTask(true)}
            aria-label="Create Task"
          >
            <Plus className="h-6 w-6" />
          </button>
          <CreateTaskDialog open={openCreateTask} onOpenChange={setOpenCreateTask} workspaceId={parseInt(id!, 10)} />
        </>
      )}
    </div>

  );
};
