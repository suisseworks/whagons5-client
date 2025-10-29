import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { UrlTabs } from '@/components/ui/url-tabs';
import { ClipboardList, Settings, Plus, MessageSquare, FolderPlus, Calendar, Clock, LayoutDashboard, X, Map as MapIcon, CheckCircle2, UserRound, CalendarDays, Flag } from 'lucide-react';
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
import { motion, useAnimation } from 'motion/react';

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

  const gridControls = useAnimation();

  // Row density (affects grid row height)
  const [rowDensity, setRowDensity] = useState<'compact' | 'comfortable' | 'spacious'>(() => {
    try {
      return (localStorage.getItem('wh_workspace_density') as any) || 'compact';
    } catch { return 'compact'; }
  });
  const computedRowHeight = rowDensity === 'compact' ? 40 : rowDensity === 'comfortable' ? 52 : 64;
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

  // Handle grid animation based on current tab
  useEffect(() => {
    if (activeTab === 'grid') {
      gridControls.start({ x: 0 });
    } else {
      gridControls.start({
        x: "-80vw",
        transition: {
          type: "spring",
          stiffness: 100,
          damping: 10
        }
      });
    }
  }, [activeTab, gridControls]);

  //
  // Clear cache when workspace ID changes
  useEffect(() => {
    if (id) {
      console.log(`Switching to workspace ${id}, clearing cache`);
      rowCache.current.clear();
    }
    if (activeTab === 'grid') {
      gridControls.start({
        opacity: 0.3,
        transition: { duration: 0.2, repeat: 1, repeatType: "reverse", ease: "easeInOut" }
      });
    }
  }, [id, location.pathname]);
  // Debug logging
  console.log('Workspace component - id:', id, 'typeof:', typeof id);
  console.log('Current path:', location.pathname);

  // Check if this is the "all" workspace route
  const isAllWorkspaces = location.pathname === '/workspace/all' || id === 'all';

  const invalidWorkspaceRoute = !id && !isAllWorkspaces;
  const invalidWorkspaceId = !isAllWorkspaces && id !== undefined && isNaN(Number(id));

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
          Tasks
        </div>
      ),
      content: (
        <motion.div
          className='flex-1 h-full'
          animate={gridControls}
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
          Calendar
        </div>
      ),
      content: (
        <div className='flex-1 h-full'>
          <CalendarViewTab workspaceId={id} />
        </div>
      )
    },
    {
      value: 'scheduler',
      label: (
        <div className="flex items-center gap-2">
          <Clock />
          Scheduler
        </div>
      ),
      content: (
        <div className='flex-1 h-full'>
          <SchedulerViewTab workspaceId={id} />
        </div>
      )
    },
    {
      value: 'map',
      label: (
        <div className="flex items-center gap-2">
          <MapIcon />
          Map
        </div>
      ),
      content: (
        <div className='flex-1 h-full'>
          <MapViewTab workspaceId={id} />
        </div>
      )
    },
    {
      value: 'board',
      label: (
        <div className="flex items-center gap-2">
          <LayoutDashboard />
          Board
        </div>
      ),
      content: (
        <div className='flex-1 h-full'>
          <TaskBoardTab workspaceId={id} />
        </div>
      )
    },
		{
			value: 'list',
			label: (
				<div className="flex items-center gap-2" aria-label="Settings">
					<Settings />
				</div>
			),
			content: (
				<motion.div
					exit={{ x: "-80vw" }}
					initial={{ x: "80vw" }}
					animate={{ x: 0 }}
				>
					<SettingsComponent workspaceId={id} />
				</motion.div>
			)
		}
  ];

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-6 mb-2">
        <Input
          placeholder="Search tasks..."
          className="max-w-sm h-12"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
        {/* Quick filter chips */}
        <div className="flex items-center gap-2 ml-2">
          <Button variant="outline" size="sm" className="h-9"
            title="All tasks"
            onClick={() => {
              tableRef.current?.setFilterModel(null);
              try { localStorage.removeItem(`wh_workspace_filters_${id || 'all'}`); } catch {}
            }}
          >All</Button>
          <Button variant="outline" size="sm" className="h-9"
            title="High priority"
            onClick={() => {
              const high = [...(priorities || [])].sort((a: any,b: any) => (b.level||0)-(a.level||0))[0];
              if (!high) return;
              const model: any = { priority_id: { filterType: 'set', values: [Number(high.id)] } };
              tableRef.current?.setFilterModel(model);
              try { localStorage.setItem(`wh_workspace_filters_${id || 'all'}`, JSON.stringify(model)); } catch {}
            }}
          >High Priority</Button>
        </div>
        {/* Density toggles */}
        {/* Density moved to Settings screen */}
        {/* Group by control */}
        <div className="flex items-center gap-2 ml-2">
          <Label className="text-sm text-muted-foreground">Group</Label>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <SelectTrigger size="sm" className="h-9">
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
        <div className="ml-auto flex items-center gap-1">
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
			pathMap={{ grid: '', calendar: '/calendar', scheduler: '/scheduler', map: '/map', board: '/board', list: '/settings' }}
          className="w-full h-full flex flex-col"
          onValueChange={setActiveTab}
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
