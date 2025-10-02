'use client';

import { useCallback, useMemo, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';
import 'ag-grid-enterprise';
import { LicenseManager } from 'ag-grid-enterprise';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState } from '@/store';
import { AppDispatch } from '@/store/store';
import { updateTaskAsync } from '@/store/reducers/tasksSlice';

import type { User, Task } from '@/store/types';
import { iconService } from '@/database/iconService';
import HoverPopover from '@/pages/spaces/components/HoverPopover';
import StatusCell from '@/pages/spaces/components/StatusCell';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import { AvatarCache } from '@/store/indexedDB/AvatarCache';

// Helper functions for user display
const getUserInitials = (user: User): string => {
  if (user?.name) {
    return user.name.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2);
  }
  if (user?.email) {
    return user.email.slice(0, 2).toUpperCase();
  }
  return 'U';
};

const getUserDisplayName = (user: User): string => {
  return user?.name || user?.email || 'User';
};



// Initialize dayjs plugins
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

// Avatar images are cached globally via AvatarCache (IndexedDB)

const AG_GRID_LICENSE = import.meta.env.VITE_AG_GRID_LICENSE_KEY as string | undefined;
if (AG_GRID_LICENSE) {
  LicenseManager.setLicenseKey(AG_GRID_LICENSE);
} else {
  console.warn('AG Grid Enterprise license key (VITE_AG_GRID_LICENSE_KEY) is missing.');
}

// Lazy load AgGridReact component
const AgGridReact = lazy(() => import('ag-grid-react').then(module => ({ default: module.AgGridReact }))) as any;

const loadRequiredModules = async () => {
  const community: any = await import('ag-grid-community');
  const enterprise: any = await import('ag-grid-enterprise');

  const { ModuleRegistry } = community;

  const pick = (pkg: any, name: string) => (pkg && pkg[name]) || null;

  const toRegister = [
    // community
    'TextFilterModule',
    'NumberFilterModule',
    'DateFilterModule',
    'CustomFilterModule',
    'ExternalFilterModule',
    'QuickFilterModule',
    'InfiniteRowModelModule',
    // enterprise
    'SetFilterModule',
    'MultiFilterModule',
    'AdvancedFilterModule',
    'ServerSideRowModelModule',
  ]
    .map((n) => pick(community, n) || pick(enterprise, n))
    .filter(Boolean);

  ModuleRegistry.registerModules(toRegister);
};

const WorkspaceTable = ({ 
  rowCache, 
  workspaceId,
  searchText = ''
}: { 
  rowCache: React.MutableRefObject<Map<string, { rows: any[]; rowCount: number }>>; 
  workspaceId: string;
  searchText?: string;
}) => {
  const containerStyle = useMemo(() => ({ width: '100%', height: '100%' }), []);
  const gridStyle = useMemo(() => ({ height: '100%', width: '100%' }), []);
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const gridRef = useRef<any>(null);
  // Refs to avoid stale closures so we can refresh cache without rebinding datasource
  const searchRef = useRef<string>(searchText);
  useEffect(() => { searchRef.current = searchText; }, [searchText]);
  const workspaceRef = useRef<string>(workspaceId);
  useEffect(() => { workspaceRef.current = workspaceId; }, [workspaceId]);

  // Load modules on component mount
  useEffect(() => {
    loadRequiredModules()
      .then(() => {
        setModulesLoaded(true);
      })
      .catch(console.error);
  }, []);

  // Removed unused getCacheKey helper

  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  const workspaces = useSelector((s: RootState) => (s as any).workspaces.value as any[]);
  const users = useSelector((s: RootState) => (s as any).users.value as User[]);
  const categories = useSelector((s: RootState) => (s as any).categories.value as any[]);
  const statusTransitions = useSelector((s: RootState) => (s as any).statusTransitions.value as any[]);
  const dispatch = useDispatch<AppDispatch>();
  const isAllWorkspaces = useMemo(() => workspaceId === 'all', [workspaceId]);
  const workspaceNumericId = useMemo(() => isAllWorkspaces ? null : Number(workspaceId), [workspaceId, isAllWorkspaces]);
  const currentWorkspace = useMemo(() => {
    if (isAllWorkspaces) return null;
    return workspaces.find((w: any) => Number(w.id) === workspaceNumericId);
  }, [workspaces, workspaceNumericId, isAllWorkspaces]);
  const defaultCategoryId = currentWorkspace?.category_id ?? null;

  // State for status icons
  const [statusIcons, setStatusIcons] = useState<{ [key: string]: any }>({});
  const [defaultStatusIcon, setDefaultStatusIcon] = useState<any>(null);

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

  // Loaded flags to avoid interim fallbacks
  const statusesLoaded = !!(globalStatuses && globalStatuses.length > 0);
  const prioritiesLoaded = !!(priorities && priorities.length > 0);
  const spotsLoaded = !!(spots && spots.length > 0);
  const usersLoaded = !!(users && users.length > 0);

  const statusMap = useMemo(() => {
    const m: Record<number, { name: string; color?: string; icon?: string; action?: string }> = {};
    for (const st of globalStatuses || []) {
      const anySt: any = st as any;
      if (anySt && typeof anySt.id !== 'undefined') {
        const idNum = Number(anySt.id);
        m[idNum] = { name: anySt.name || `Status ${idNum}` , color: anySt.color, icon: anySt.icon, action: anySt.action } as any;
      }
    }
    return m;
  }, [globalStatuses]);
  // Map: category_id -> status_transition_group_id
  const categoryToGroup = useMemo(() => {
    const m = new Map<number, number>();
    for (const c of categories || []) {
      const id = Number((c as any).id);
      const gid = Number((c as any).status_transition_group_id);
      if (Number.isFinite(id) && Number.isFinite(gid)) m.set(id, gid);
    }
    return m;
  }, [categories]);

  // Map: group_id -> from_status -> Set(to_status)
  const transitionsByGroupFrom = useMemo(() => {
    const map = new Map<number, Map<number, Set<number>>>();
    for (const tr of statusTransitions || []) {
      const g = Number((tr as any).status_transition_group_id);
      const from = Number((tr as any).from_status);
      const to = Number((tr as any).to_status);
      if (!Number.isFinite(g) || !Number.isFinite(from) || !Number.isFinite(to)) continue;
      if (!map.has(g)) map.set(g, new Map());
      const inner = map.get(g)!;
      if (!inner.has(from)) inner.set(from, new Set());
      inner.get(from)!.add(to);
    }
    return map;
  }, [statusTransitions]);

  const getAllowedNextStatuses = useCallback((task: any): number[] => {
    const groupId = categoryToGroup.get(Number(task.category_id));
    if (!groupId) return [];
    const byFrom = transitionsByGroupFrom.get(groupId);
    if (!byFrom) return [];
    const set = byFrom.get(Number(task.status_id));
    return set ? Array.from(set.values()) : [];
  }, [categoryToGroup, transitionsByGroupFrom]);

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

  const statusMapRef = useRef(statusMap);
  useEffect(() => { statusMapRef.current = statusMap; }, [statusMap]);

  const priorityMap = useMemo(() => {
    const m: Record<number, { name: string; color?: string; level?: number }> = {};
    for (const priority of priorities || []) {
      const anyPriority: any = priority as any;
      if (anyPriority && typeof anyPriority.id !== 'undefined') {
        const idNum = Number(anyPriority.id);
        m[idNum] = { name: anyPriority.name || `Priority ${idNum}`, color: anyPriority.color, level: anyPriority.level } as any;
      }
    }
    return m;
  }, [priorities]);
  const priorityMapRef = useRef(priorityMap);
  useEffect(() => { priorityMapRef.current = priorityMap; }, [priorityMap]);

  const filteredPriorities = useMemo(() => {
    if (defaultCategoryId == null) return priorities;
    return (priorities || []).filter((p: any) => Number((p as any).category_id) === Number(defaultCategoryId));
  }, [priorities, defaultCategoryId]);

  const spotMap = useMemo(() => {
    const m: Record<number, { name: string; description?: string }> = {};
    for (const spot of spots || []) {
      const anySpot: any = spot as any;
      if (anySpot && typeof anySpot.id !== 'undefined') {
        const idNum = Number(anySpot.id);
        m[idNum] = { name: anySpot.name || `Spot ${idNum}`, description: anySpot.description } as any;
      }
    }
    return m;
  }, [spots]);
  const spotMapRef = useRef(spotMap);
  useEffect(() => { spotMapRef.current = spotMap; }, [spotMap]);

  // Create user map for quick lookup
  const userMap = useMemo(() => {
    const m: Record<number, User> = {};
    for (const user of users || []) {
      m[user.id] = user;
    }
    return m;
  }, [users]);
  const userMapRef = useRef(userMap);
  useEffect(() => { userMapRef.current = userMap; }, [userMap]);
  const globalStatusesRef = useRef(globalStatuses);
  useEffect(() => { globalStatusesRef.current = globalStatuses; }, [globalStatuses]);

  // Hybrid mode: client-side when filtered row count is small enough
  const CLIENT_THRESHOLD = 1000;
  const [useClientSide, setUseClientSide] = useState(false);
  const [clientRows, setClientRows] = useState<Task[]>([]);

  useEffect(() => {
    const decideMode = async () => {
      try {
        if (!TasksCache.initialized) await TasksCache.init();

        // Build minimal params equivalent to the grid query
        const baseParams: any = { search: searchText };
        if (workspaceId !== 'all') baseParams.workspace_id = workspaceId;

        // Normalize status set filter by names if ever needed in future (not applied here)

        // Get filtered count only
        const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
        const totalFiltered = countResp?.rowCount ?? 0;
        if (totalFiltered > 0 && totalFiltered <= CLIENT_THRESHOLD) {
          const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: totalFiltered });
          setClientRows(rowsResp?.rows || []);
          setUseClientSide(true);
        } else {
          setClientRows([]);
          setUseClientSide(false);
        }
      } catch (e) {
        console.warn('decideMode failed', e);
        setUseClientSide(false);
      }
    };
    decideMode();
  }, [workspaceId, searchText]);



  // Function to get user names from user IDs
  const getUserNames = useCallback((userIds: any): string => {
    if (!userIds) return 'No users assigned';

    // Handle different possible formats
    let userIdArray: number[] = [];

    try {
      if (Array.isArray(userIds)) {
        userIdArray = userIds;
      } else if (typeof userIds === 'string') {
        // Try to parse JSON string
        const parsed = JSON.parse(userIds);
        userIdArray = Array.isArray(parsed) ? parsed : [];
      } else if (typeof userIds === 'number') {
        // Handle single user ID
        userIdArray = [userIds];
      }

      // Ensure userIdArray is actually an array
      if (!Array.isArray(userIdArray)) {
        console.warn('userIds is not an array:', userIds);
        return 'No users assigned';
      }

      if (userIdArray.length === 0) return 'No users assigned';

      const userNames = userIdArray
        .map(id => userMap[id]?.name || `User ${id}`)
        .join(', ');

      return userNames;
    } catch (error) {
      console.error('Error processing userIds:', error, userIds);
      return 'No users assigned';
    }
  }, [userMap]);

  // Function to get users from user IDs
  const getUsersFromIds = useCallback((userIds: any): User[] => {
    if (!userIds) return [];

    // Handle different possible formats
    let userIdArray: number[] = [];

    try {
      if (Array.isArray(userIds)) {
        userIdArray = userIds;
      } else if (typeof userIds === 'string') {
        // Try to parse JSON string
        const parsed = JSON.parse(userIds);
        userIdArray = Array.isArray(parsed) ? parsed : [];
      } else if (typeof userIds === 'number') {
        // Handle single user ID
        userIdArray = [userIds];
      }

      // Ensure userIdArray is actually an array
      if (!Array.isArray(userIdArray)) {
        console.warn('userIds is not an array:', userIds);
        return [];
      }

      if (userIdArray.length === 0) return [];

      return userIdArray
        .map(id => userMap[id])
        .filter(Boolean) as User[];
    } catch (error) {
      console.error('Error processing userIds:', error, userIds);
      return [];
    }
  }, [userMap]);



  // Per-cell avatar image component backed by global AvatarCache
  const AvatarImg = ({ user }: { user: User }) => {
    const [src, setSrc] = useState<string>('');
    useEffect(() => {
      let cancelled = false;
      const run = async () => {
        if (!user?.id) return;
        // Read synchronously from cache first (no network)
        const cached = await AvatarCache.getByAny([user.id, (user as any).google_uuid]);
        if (!cancelled && cached) { setSrc(cached); return; }
        // Only if no cache, trigger a single fetch with dedupe
        if (user?.url_picture) {
          const data = await AvatarCache.fetchAndCache(user.id, user.url_picture, [(user as any).google_uuid]);
          if (!cancelled && data) setSrc(data);
        }
      };
      run();
      return () => { cancelled = true; };
    }, [user?.id, user?.url_picture]);
    return (
      <AvatarImage
        src={src}
        alt={getUserDisplayName(user)}
        onError={() => {}}
      />
    );
  };

  // Function to format due date with dayjs
  const formatDueDate = useCallback((dateString: string | null): string => {
    if (!dateString) return 'No due date';

    const date = dayjs(dateString);
    const now = dayjs();

    if (date.isBefore(now)) {
      return `${date.fromNow()} overdue`;
    } else {
      return `Due ${date.fromNow()}`;
    }
  }, []);
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
  }, [usersLoaded]);

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

  const columnDefs = useMemo(() => ([
    {
      field: 'name',
      headerName: 'Task',
      flex: 2.5,
      filter: false,
      cellRenderer: (p: any) => {
        const name = p.data?.name || '';
        const description = p.data?.description || '';
        return (
          <div className="flex flex-col gap-1 h-full justify-center py-2">
            <div className="font-semibold text-base text-foreground">{name}</div>
            {description && (
              <div className="text-xs text-muted-foreground/70 truncate">{description}</div>
            )}
          </div>
        );
      },
      minWidth: 300,
    },
    {
      field: 'status_id',
      headerName: 'Status',
      sortable: true,
      filter: 'agSetColumnFilter',
      valueFormatter: (p: any) => {
        const meta: any = statusMap[p.value as number];
        return meta?.name || `#${p.value}`;
      },
      filterParams: {
        values: (params: any) => {
          const ids = (globalStatuses || []).map((s: any) => Number((s as any).id));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const meta: any = statusMap[p.value as number];
          return meta?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        const row = p.data;
        if (!statusesLoaded || !row) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        const meta: any = statusMap[p.value as number];
        if (!meta) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        const allowedNext = getAllowedNextStatuses(row);
        return (
          <StatusCell
            value={p.value}
            statusMap={statusMap}
            getStatusIcon={getStatusIcon}
            allowedNext={allowedNext}
            onChange={(to) => handleChangeStatus(row, to)}
          />
        );
      },
      width: 160,
      minWidth: 110,
      maxWidth: 200,
    },
    // Priority column with badge
    {
      field: 'priority_id',
      headerName: 'Priority',
      sortable: true,
      filter: 'agSetColumnFilter',
      valueFormatter: (p: any) => {
        const meta: any = priorityMap[p.value as number];
        return meta?.name || `#${p.value}`;
      },
      filterParams: {
        values: (params: any) => {
          const ids = (filteredPriorities || []).map((p: any) => Number((p as any).id));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const meta: any = priorityMap[p.value as number];
          return meta?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        if (!prioritiesLoaded) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        if (p.value == null) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        const meta: any = priorityMap[p.value as number];
        if (!meta) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        const name = meta.name;
        const color = meta?.color || '#6B7280';

        return (
          <div className="flex items-center h-full py-2">
            <Badge
              variant="outline"
              style={{
                borderColor: color,
                color: color,
                backgroundColor: `${color}10`
              }}
              className="text-xs px-2 py-0.5 font-medium leading-tight truncate max-w-[90px]"
              title={name}
            >
              {name}
            </Badge>
          </div>
        );
      },
      width: 110,
      minWidth: 72,
      maxWidth: 120,
    },
    // Responsible column with avatars
    {
      field: 'user_ids',
      headerName: 'Responsible',
      flex: 1,
      filter: false,
      cellRenderer: (p: any) => {
        if (!usersLoaded) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        const userIds = p.data?.user_ids;
        // If the field hasn't arrived yet for this row, render placeholder instead of false "No users"
        if (userIds == null) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        const users = getUsersFromIds(userIds);

        if (!users || users.length === 0) {
          return (
            <div className="flex items-center h-full py-2">
              <div className="text-sm text-muted-foreground">
                No users assigned
              </div>
            </div>
          );
        }

        // Show up to 3 avatars, with a count indicator if more
        const displayUsers = users.slice(0, 3);
        const remainingCount = users.length - displayUsers.length;

        return (
          <div className="flex items-center h-full py-2 gap-2">
            <div className="flex items-center -space-x-2"
            >
              {displayUsers.map((user) => (
                <HoverPopover
                  key={user.id}
                  content={(
                    <div className="flex flex-col items-center gap-3"
                    >
                      <Avatar className="h-16 w-16 border-2 border-background">
                        <AvatarImg user={user} />
                        <AvatarFallback className="text-base font-medium">
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-base font-medium text-popover-foreground text-center">
                        {getUserDisplayName(user)}
                      </span>
                    </div>
                  )}
                >
                  <Avatar className="h-8 w-8 border border-background hover:border-primary transition-colors cursor-pointer">
                    <AvatarImg user={user} />
                    <AvatarFallback className="text-xs">
                      {getUserInitials(user)}
                    </AvatarFallback>
                  </Avatar>
                </HoverPopover>
              ))}
              {remainingCount > 0 && (
                <div className="h-8 w-8 rounded-full bg-muted border border-background flex items-center justify-center">
                  <span className="text-xs text-muted-foreground font-medium">
                    +{remainingCount}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      },
      minWidth: 140,
    },
    {
      field: 'due_date',
      headerName: 'Due',
      filter: false,
      cellRenderer: (p: any) => {
        const dueDate = p.data?.due_date;
        const formatted = formatDueDate(dueDate);
        return (
          <div className="flex items-center h-full py-2">
            <span className={`text-sm ${dueDate && dayjs(dueDate).isBefore(dayjs()) ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              {formatted}
            </span>
          </div>
        );
      },
      minWidth: 140,
    },
    // Spot column
    {
      field: 'spot_id',
      headerName: 'Location',
      sortable: true,
      filter: 'agSetColumnFilter',
      valueFormatter: (p: any) => {
        const meta: any = spotMap[p.value as number];
        return meta?.name || `#${p.value}`;
      },
      filterParams: {
        values: (params: any) => {
          const ids = (spots || []).map((s: any) => Number((s as any).id));
          params.success(ids);
        },
        suppressMiniFilter: false,
        valueFormatter: (p: any) => {
          const meta: any = spotMap[p.value as number];
          return meta?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        if (!spotsLoaded) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        if (p.value == null) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        const meta: any = spotMap[p.value as number];
        if (!meta) {
          return (
            <div className="flex items-center h-full py-2">
              <span className="opacity-0">.</span>
            </div>
          );
        }
        const name = meta.name;

        return (
          <div className="flex items-center h-full py-2">
            <span className="text-sm text-muted-foreground">
              {name}
            </span>
          </div>
        );
      },
      minWidth: 100,
    },
    {
      field: 'response_date',
      headerName: 'Response',
      filter: false,
      cellRenderer: (p: any) => {
        const responseDate = p.data?.response_date;
        const formatted = formatDueDate(responseDate);
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-sm text-muted-foreground">
              {responseDate ? formatted.replace('Due ', 'Responded ').replace('overdue', 'late') : 'No response'}
            </span>
          </div>
        );
      },
      minWidth: 140,
    },
    {
      field: 'resolution_date',
      headerName: 'Resolution',
      filter: false,
      cellRenderer: (p: any) => {
        const resolutionDate = p.data?.resolution_date;
        const formatted = formatDueDate(resolutionDate);
        return (
          <div className="flex items-center h-full py-2">
            <span className="text-sm text-muted-foreground">
              {resolutionDate ? formatted.replace('Due ', 'Resolved ').replace('overdue', 'late') : 'No resolution'}
            </span>
          </div>
        );
      },
      width: 150,
    },
  ]), [statusMap, statuses, priorityMap, priorities, spotMap, spots, getUserNames, getUsersFromIds, getStatusIcon, formatDueDate]);
  const defaultColDef = useMemo(() => {
    return {
      minWidth: 100,
      sortable: true,
      filter: false, // disable filters globally; we'll enable only on Status column
      resizable: true,
      floatingFilter: false, // remove the under-header filter row
    };
  }, []);

  // Infinite Row Model datasource using IndexedDB as the data source
  const getRows = useCallback(
    async (params: any) => {
      // Build cache key using current refs so we don't need to rebind datasource
      const cacheKey = `${workspaceRef.current}-${params.startRow}-${params.endRow}-${JSON.stringify(
        params.filterModel || {}
      )}-${JSON.stringify(params.sortModel || [])}-${searchRef.current}`;

      if (rowCache.current.has(cacheKey)) {
        const cachedData = rowCache.current.get(cacheKey)!;
        params.successCallback(cachedData.rows, cachedData.rowCount);
        return;
      }

      try {
        if (!TasksCache.initialized) {
          await TasksCache.init();
        }

        // Normalize set filter selections by name -> ids for statuses if needed
        const normalized = { ...params } as any;
        if (normalized.filterModel && normalized.filterModel.status_id) {
          const fm = { ...normalized.filterModel } as any;
          const st = { ...fm.status_id } as any;
          const rawValues: any[] = Array.isArray(st.values) ? st.values : [];
          const hasNonNumeric = rawValues.some((v) => isNaN(Number(v)));
          if (hasNonNumeric) {
            const wanted = new Set<string>(rawValues.map((v) => String(v)));
            const idSet = new Set<number>();
            for (const s of globalStatusesRef.current || []) {
              const anyS: any = s as any;
              if (wanted.has(String(anyS.name))) idSet.add(Number(anyS.id));
            }
            st.values = Array.from(idSet.values());
            fm.status_id = st;
            normalized.filterModel = fm;
          } else {
            st.values = rawValues.map((v) => Number(v));
            fm.status_id = st;
            normalized.filterModel = fm;
          }
        }

        const queryParams: any = {
          ...normalized,
          search: searchRef.current,
        };

        // Only add workspace_id if we're not in "all" mode
        if (workspaceRef.current !== 'all') {
          queryParams.workspace_id = workspaceRef.current;
        }

        // Provide lookup maps for richer local searching
        queryParams.__statusMap = statusMapRef.current;
        queryParams.__priorityMap = priorityMapRef.current;
        queryParams.__spotMap = spotMapRef.current;
        queryParams.__userMap = userMapRef.current;

        const result = await TasksCache.queryTasks(queryParams);

        const rows = result?.rows || [];
        const total = result?.rowCount || 0;
        rowCache.current.set(cacheKey, { rows, rowCount: total });
        params.successCallback(rows, total);
      } catch (error) {
        console.error('Error querying local tasks cache:', error);
        params.failCallback();
      }
    },
    [rowCache]
  );

  // Function to refresh the grid
  const refreshGrid = useCallback(async () => {
    if (!modulesLoaded || !gridRef.current?.api) return;
    if (useClientSide) {
      // Recompute client rows from IndexedDB and update rowData
      try {
        const baseParams: any = { search: searchRef.current };
        if (workspaceRef.current !== 'all') baseParams.workspace_id = workspaceRef.current;
        // Provide lookup maps for richer local searching
        baseParams.__statusMap = statusMapRef.current;
        baseParams.__priorityMap = priorityMapRef.current;
        baseParams.__spotMap = spotMapRef.current;
        baseParams.__userMap = userMapRef.current;

        const countResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: 0 });
        const totalFiltered = countResp?.rowCount ?? 0;
        const rowsResp = await TasksCache.queryTasks({ ...baseParams, startRow: 0, endRow: totalFiltered });
        const rows = rowsResp?.rows || [];
        setClientRows(rows);
        gridRef.current.api.setGridOption('rowData', rows);
        return;
      } catch (e) {
        console.warn('refreshGrid (client-side) failed', e);
      }
    }
    // Infinite row model refresh
    rowCache.current.clear();
    gridRef.current.api.refreshInfiniteCache();
  }, [modulesLoaded, rowCache, useClientSide]);

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

  // Listen for task events to refresh the table
  useEffect(() => {
    const unsubscribeCreated = TaskEvents.on(TaskEvents.EVENTS.TASK_CREATED, (data) => {
      console.log('Task created, refreshing grid:', data);
      refreshGrid();
    });

    const unsubscribeUpdated = TaskEvents.on(TaskEvents.EVENTS.TASK_UPDATED, (data) => {
      console.log('Task updated, refreshing grid:', data);
      refreshGrid();
    });

    const unsubscribeDeleted = TaskEvents.on(TaskEvents.EVENTS.TASK_DELETED, (data) => {
      console.log('Task deleted, refreshing grid:', data);
      refreshGrid();
    });

    const unsubscribeBulkUpdate = TaskEvents.on(TaskEvents.EVENTS.TASKS_BULK_UPDATE, () => {
      console.log('Bulk task update, refreshing grid');
      refreshGrid();
    });

    const unsubscribeInvalidate = TaskEvents.on(TaskEvents.EVENTS.CACHE_INVALIDATE, () => {
      console.log('Cache invalidated, refreshing grid');
      refreshGrid();
    });

    // Cleanup subscriptions on unmount
    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
      unsubscribeBulkUpdate();
      unsubscribeInvalidate();
    };
  }, [refreshGrid]);

  const onGridReady = useCallback((params: any) => {
    if (!useClientSide) {
      const ds = { rowCount: undefined, getRows };
      params.api.setGridOption('datasource', ds);
    }
  }, [getRows, useClientSide]);

  // Show loading spinner while modules are loading
  if (!modulesLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <i className="fas fa-spinner fa-pulse fa-2x"></i>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="ag-theme-quartz wh-workspace-grid h-full w-full">
      <div style={gridStyle}>
        <Suspense fallback={<div>Loading AgGridReact...</div>}>
          <AgGridReact
            key={`rm-${useClientSide ? 'client' : 'infinite'}-${workspaceId}`}
            ref={gridRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={80}
            headerHeight={44}
            rowBuffer={50}
            {...(useClientSide ? {
              // Client-Side Row Model
              rowData: clientRows,
              immutableData: true,
              getRowId: (params: any) => String(params.data.id),
            } : {
              // Infinite Row Model
              rowModelType: 'infinite' as const,
              cacheBlockSize: 500,
              maxConcurrentDatasourceRequests: 1,
              maxBlocksInCache: 10,
              getRowId: (params: any) => String(params.data.id),
            })}
            onGridReady={onGridReady}
            animateRows={true}
            suppressColumnVirtualisation={true}
            suppressLoadingOverlay={true}
            suppressNoRowsOverlay={true}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default WorkspaceTable; 