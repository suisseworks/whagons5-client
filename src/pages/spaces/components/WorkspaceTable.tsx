'use client';

import { useCallback, useMemo, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { TasksCache } from '@/store/indexedDB/TasksCache';
import { TaskEvents } from '@/store/eventEmiters/taskEvents';
import 'ag-grid-enterprise';
import { LicenseManager } from 'ag-grid-enterprise';
import { useDispatch, useSelector } from 'react-redux';
import { genericActions } from '@/store/genericSlices';
import type { RootState } from '@/store';

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

  // Load status metadata (name + color) from store
  const dispatch = useDispatch();
  const statuses = useSelector((s: RootState) => (s as any).statuses.value as any[]);
  const workspaces = useSelector((s: RootState) => (s as any).workspaces.value as any[]);
  const isAllWorkspaces = useMemo(() => workspaceId === 'all', [workspaceId]);
  const workspaceNumericId = useMemo(() => isAllWorkspaces ? null : Number(workspaceId), [workspaceId, isAllWorkspaces]);
  const currentWorkspace = useMemo(() => {
    if (isAllWorkspaces) return null;
    return workspaces.find((w: any) => Number(w.id) === workspaceNumericId);
  }, [workspaces, workspaceNumericId, isAllWorkspaces]);
  const defaultCategoryId = currentWorkspace?.category_id ?? null;

  const filteredStatuses = useMemo(() => {
    if (defaultCategoryId == null) return statuses;
    return (statuses || []).filter((s: any) => Number((s as any).category_id) === Number(defaultCategoryId));
  }, [statuses, defaultCategoryId]);

  const statusMap = useMemo(() => {
    const m: Record<number, { name: string; color?: string }> = {};
    for (const st of filteredStatuses || []) {
      const anySt: any = st as any;
      if (anySt && typeof anySt.id !== 'undefined') {
        const idNum = Number(anySt.id);
        m[idNum] = { name: anySt.name || `Status ${idNum}` , color: anySt.color, icon: anySt.icon } as any;
      }
    }
    return m;
  }, [filteredStatuses]);
  useEffect(() => {
    // first attempt from IndexedDB (fast, offline), then refresh from network
    // @ts-ignore
    dispatch(genericActions.statuses.getFromIndexedDB());
    // @ts-ignore
    dispatch(genericActions.workspaces.getFromIndexedDB());
  }, [dispatch]);

  // When statuses are loaded/updated, refresh the Status column cells to replace #id with names
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ columns: ['status_id'], force: true, suppressFlash: true });
    }
  }, [statusMap]);

  const columnDefs = useMemo(() => ([
    // this row shows the row index, doesn't use any data from the row
    // {
    //   field: 'id',
    //   // add loader
    //   cellRenderer: (params: any) => {
    //     if (params.value !== undefined) {
    //       return params.value;
    //     } else {
    //       return <i className="fas fa-spinner fa-pulse"></i>;
    //     }
    //   },
    //   maxWidth: 100,
    // },
    { field: 'name', headerName: 'Task', flex: 1, filter: false },
    // workspace_id omitted; all tasks are scoped to the selected workspace
    { field: 'description', headerName: 'Description', flex: 1, filter: false },
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
        const icon = meta?.icon as string | undefined;
        return (
          <div className="flex items-center gap-2 h-full">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            {icon ? (
              <span
                className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded text-[10px] leading-none border"
                style={{ borderColor: color, color }}
              >
                {icon}
              </span>
            ) : null}
            <span>{name}</span>
          </div>
        );
      },
      minWidth: 160,
    },
    // { field: 'template_id' },
    // { field: 'spot_id' },
    // { field: 'status_id' },
    { field: 'due_date', headerName: 'Due', filter: false },
    { field: 'response_date', headerName: 'Response', filter: false },
    { field: 'resolution_date', headerName: 'Resolution', filter: false },
    { field: 'work_duration', headerName: 'Work (min)', filter: false },
    { field: 'pause_duration', headerName: 'Pause (min)', filter: false },
  ]), [statusMap, statuses]);
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
            rowHeight={48}
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