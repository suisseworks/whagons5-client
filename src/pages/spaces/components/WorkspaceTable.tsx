'use client';

import { useCallback, useMemo, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';
import 'ag-grid-enterprise';
import { LicenseManager } from 'ag-grid-enterprise';
import { useSelector } from 'react-redux';
import type { RootState } from '@/store';

import type { User } from '@/store/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconService } from '@/database/iconService';
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';

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



// Hover-controlled Popover wrapper
const HoverPopover = ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div
        onMouseEnter={() => {
          console.log('Mouse entered');
          setOpen(true)}}
        onMouseLeave={() => {
          console.log('Mouse left');
          setOpen(false)}}
        className="inline-flex"
      >
        <PopoverTrigger asChild>
          <div>{children}</div>
        </PopoverTrigger>
      </div>
      <PopoverContent side="top" align="center" className="w-auto min-w-[200px] p-4">
        {content}
      </PopoverContent>
    </Popover>
  );
};

 
// Initialize dayjs plugins
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);

// Cache key prefix for user avatars in table
const TABLE_AVATAR_CACHE_KEY = 'table_user_avatar_cache_';
const TABLE_AVATAR_CACHE_TIMESTAMP_KEY = 'table_user_avatar_timestamp_';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

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

  // Load modules on component mount
  useEffect(() => {
    loadRequiredModules()
      .then(() => {
        setModulesLoaded(true);
      })
      .catch(console.error);
  }, []);

  // Generate cache key based on request parameters including workspaceId and search
  const getCacheKey = useCallback((params: any) => {
    return `${workspaceId}-${params.startRow}-${params.endRow}-${JSON.stringify(
      params.filterModel || {}
    )}-${JSON.stringify(params.sortModel || [])}-${searchText}`;
  }, [workspaceId, searchText]);

  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const priorities = useSelector((s: RootState) => (s as any).priorities.value as any[]);
  const spots = useSelector((s: RootState) => (s as any).spots.value as any[]);
  const workspaces = useSelector((s: RootState) => (s as any).workspaces.value as any[]);
  const users = useSelector((s: RootState) => (s as any).users.value as User[]);
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

  const filteredStatuses = useMemo(() => {
    if (defaultCategoryId == null) return statuses;
    return (statuses || []).filter((s: any) => Number((s as any).category_id) === Number(defaultCategoryId));
  }, [statuses, defaultCategoryId]);

  // Load status icons when statuses change
  useEffect(() => {
    const loadStatusIcons = async () => {
      if (!filteredStatuses || filteredStatuses.length === 0) return;

      const iconNames = filteredStatuses
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
  }, [filteredStatuses]);

  const statusMap = useMemo(() => {
    const m: Record<number, { name: string; color?: string; icon?: string }> = {};
    for (const st of filteredStatuses || []) {
      const anySt: any = st as any;
      if (anySt && typeof anySt.id !== 'undefined') {
        const idNum = Number(anySt.id);
        m[idNum] = { name: anySt.name || `Status ${idNum}` , color: anySt.color, icon: anySt.icon } as any;
      }
    }
    return m;
  }, [filteredStatuses]);

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

  // Create user map for quick lookup
  const userMap = useMemo(() => {
    const m: Record<number, User> = {};
    for (const user of users || []) {
      m[user.id] = user;
    }
    return m;
  }, [users]);



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



  // Cache management functions for user avatars
  const getCachedAvatar = useCallback((userId: string): string | null => {
    try {
      const cachedData = localStorage.getItem(TABLE_AVATAR_CACHE_KEY + userId);
      const cachedTimestamp = localStorage.getItem(TABLE_AVATAR_CACHE_TIMESTAMP_KEY + userId);

      if (!cachedData || !cachedTimestamp) return null;

      const timestamp = parseInt(cachedTimestamp, 10);
      const now = Date.now();

      if (now - timestamp > CACHE_DURATION) {
        localStorage.removeItem(TABLE_AVATAR_CACHE_KEY + userId);
        localStorage.removeItem(TABLE_AVATAR_CACHE_TIMESTAMP_KEY + userId);
        return null;
      }

      return cachedData;
    } catch (error) {
      return null;
    }
  }, []);

  const setCachedAvatar = useCallback((userId: string, data: string) => {
    try {
      const timestamp = Date.now();
      localStorage.setItem(TABLE_AVATAR_CACHE_KEY + userId, data);
      localStorage.setItem(TABLE_AVATAR_CACHE_TIMESTAMP_KEY + userId, timestamp.toString());
    } catch (error) {
      // If localStorage is full, just set the image URL directly
      console.warn('Failed to cache avatar:', error);
    }
  }, []);

  // Function to get cached or fresh avatar URL
  const getAvatarSrc = useCallback((user: User): string | null => {
    if (!user?.url_picture) return null;

    // Try cache first
    const cached = getCachedAvatar(user.id.toString());
    if (cached) return cached;

    // If not cached, return original URL (will be cached on load)
    return user.url_picture;
  }, [getCachedAvatar]);

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

  const columnDefs = useMemo(() => ([
    // Combined Task Name and Description column
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
              <div className="text-sm text-muted-foreground line-clamp-2">{description}</div>
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
          const ids = (filteredStatuses || []).map((s: any) => Number((s as any).id));
          params.success(ids);
        },
        suppressMiniFilter: false,
        // Ensure set filter list shows names instead of numeric IDs
        valueFormatter: (p: any) => {
          const meta: any = statusMap[p.value as number];
          return meta?.name || `#${p.value}`;
        },
      },
      cellRenderer: (p: any) => {
        const meta: any = statusMap[p.value as number];
        const name = meta?.name || `#${p.value}`;
        const color = meta?.color || '#6B7280';
        const iconName = meta?.icon;
        const icon = getStatusIcon(iconName);

        return (
          <div className="flex items-center gap-2 h-full">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            {icon && typeof icon === 'object' ? (
              <FontAwesomeIcon
                icon={icon}
                className="text-base"
                style={{ color }}
              />
            ) : (
              <span className="text-xs" style={{ color }}>●</span>
            )}
            <span className="font-medium">{name}</span>
          </div>
        );
      },
      minWidth: 180,
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
        const meta: any = priorityMap[p.value as number];
        const name = meta?.name || `#${p.value}`;
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
              className="font-medium"
            >
              {name}
            </Badge>
          </div>
        );
      },
      minWidth: 120,
    },
    // Responsible column with avatars
    {
      field: 'user_ids',
      headerName: 'Responsible',
      flex: 1,
      filter: false,
      cellRenderer: (p: any) => {
        const userIds = p.data?.user_ids;
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
                        <AvatarImage src={user.url_picture || ''} alt={getUserDisplayName(user)} />
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
                    <AvatarImage
                      src={getAvatarSrc(user) || ''}
                      alt={getUserDisplayName(user)}
                      onLoad={(e) => {
                        // Cache the image when it loads successfully
                        const img = e.target as HTMLImageElement;
                        if (img.src && img.src !== user.url_picture && user.url_picture) {
                          setCachedAvatar(user.id.toString(), img.src);
                        }
                      }}
                      onError={(e) => {
                        console.log('Avatar image failed to load for user:', user.name, e);
                        // The AvatarFallback will automatically show
                      }}
                    />
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
        const meta: any = spotMap[p.value as number];
        const name = meta?.name || `#${p.value}`;

        return (
          <div className="flex items-center h-full py-2">
            <span className="text-sm text-muted-foreground">
              {name}
            </span>
          </div>
        );
      },
      minWidth: 120,
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
      minWidth: 140,
    },
    { field: 'work_duration', headerName: 'Work (min)', filter: false },
    { field: 'pause_duration', headerName: 'Pause (min)', filter: false },
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
      const cacheKey = getCacheKey(params);

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
            for (const s of filteredStatuses || []) {
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
          search: searchText,
        };

        // Only add workspace_id if we're not in "all" mode
        if (!isAllWorkspaces) {
          queryParams.workspace_id = workspaceId;
        }

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
    [getCacheKey, rowCache, searchText, workspaceId]
  );

  // Function to refresh the grid
  const refreshGrid = useCallback(() => {
    if (gridRef.current?.api && modulesLoaded) {
      rowCache.current.clear();
      const ds = {
        rowCount: undefined,
        getRows,
      };
      gridRef.current.api.setGridOption('datasource', ds);
    }
  }, [getRows, modulesLoaded, rowCache]);

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
    const ds = { rowCount: undefined, getRows };
    params.api.setGridOption('datasource', ds);
  }, [getRows]);

  // Show loading spinner while modules are loading
  if (!modulesLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <i className="fas fa-spinner fa-pulse fa-2x"></i>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="ag-theme-quartz h-full w-full">
      <div style={gridStyle}>
        <Suspense fallback={<div>Loading AgGridReact...</div>}>
          <AgGridReact
            ref={gridRef}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowHeight={80}
            headerHeight={44}
            rowBuffer={50}
            rowModelType={'infinite'}
            cacheBlockSize={500}
            maxConcurrentDatasourceRequests={1}
            maxBlocksInCache={10}
            onGridReady={onGridReady}
            animateRows={true}
            getRowId={(params: any) => String(params.data.id)}
            suppressColumnVirtualisation={true}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default WorkspaceTable; 