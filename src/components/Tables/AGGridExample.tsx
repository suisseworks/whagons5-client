'use client';

import { useCallback, useMemo, useState, useRef, useEffect, lazy, Suspense } from 'react';
import { api } from '@/api';

// Lazy load AgGridReact component
const AgGridReact = lazy(() => import('ag-grid-react').then(module => ({ default: module.AgGridReact }))) as any;

// Simplified module loading - only load what we actually need
const loadRequiredModules = async () => {
  const {
    ModuleRegistry,
    TextFilterModule,
    NumberFilterModule,
    InfiniteRowModelModule,
  } = await import('ag-grid-community');

  ModuleRegistry.registerModules([
    TextFilterModule,     // For text filtering on name, template_id, etc.
    NumberFilterModule,   // For numeric filtering on ids
    InfiniteRowModelModule, // Required for infinite row model
  ]);
};

const GridExample = () => {
  const containerStyle = useMemo(() => ({ width: '100%', height: '100%' }), []);
  const gridStyle = useMemo(() => ({ height: '100%', width: '100%' }), []);
  const [modulesLoaded, setModulesLoaded] = useState(false);

  // Load modules on component mount
  useEffect(() => {
    loadRequiredModules()
      .then(() => {
        setModulesLoaded(true);
      })
      .catch(console.error);
  }, []);

  // Cache for storing fetched row data
  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());

  // Generate cache key based on request parameters
  const getCacheKey = useCallback((params: any) => {
    return `${params.startRow}-${params.endRow}-${JSON.stringify(
      params.filterModel || {}
    )}-${JSON.stringify(params.sortModel || [])}`;
  }, []);

  const [columnDefs, setColumnDefs] = useState([
    // this row shows the row index, doesn't use any data from the row
    {
      field: 'id',
      // add loader
      cellRenderer: (params: any) => {
        if (params.value !== undefined) {
          return params.value;
        } else {
          return <i className="fas fa-spinner fa-pulse"></i>;
        }
      },
      maxWidth: 100,
      sortable: true,
    },
    { field: 'name', minWidth: 150, sortable: true, filter: true },
    {
      field: 'workspace_id',
      sortable: true,
    },
    { field: 'template_id', minWidth: 150, sortable: true, filter: true },
    { field: 'spot_id', sortable: true, filter: true },
    { field: 'team_id', minWidth: 150, sortable: true, filter: true },
    { field: 'status_id', minWidth: 150, sortable: true, filter: true },
    { field: 'response_date', sortable: true, filter: true },
    { field: 'resolution_date', sortable: true, filter: true },
    { field: 'work_duration', sortable: true, filter: true },
    { field: 'pause_duration', sortable: true, filter: true },
  ]);
  const defaultColDef = useMemo(() => {
    return {
      flex: 1,
      minWidth: 100,
      sortable: false,
    };
  }, []);

  // Memoized getRows function
  const getRows = useCallback(
    async (params: any) => {
      const cacheKey = getCacheKey(params);

      // Check if data is already cached
      if (rowCache.current.has(cacheKey)) {
        console.log(
          `Cache hit for range ${params.startRow} to ${params.endRow}`
        );
        const cachedData = rowCache.current.get(cacheKey)!;
        params.successCallback(cachedData.rows, cachedData.rowCount);
        return;
      }

      console.log(params);
      console.log('asking for ' + params.startRow + ' to ' + params.endRow);

      try {
        const res = await api.get('/tasks', {
          params: params,
        });

        if (res.data.rowCount === 0 || res.data.rows.length === 0) {
          console.log('params', params.startRow);
          // Cache empty result
          rowCache.current.set(cacheKey, {
            rows: [],
            rowCount: params.startRow,
          });
          params.successCallback([], params.startRow);
        } else {
          // Cache successful result
          rowCache.current.set(cacheKey, { rows: res.data.rows, rowCount: -1 });
          params.successCallback(res.data.rows, -1);
        }
      } catch (error) {
        params.failCallback();
      }
    },
    [getCacheKey]
  );

  const onGridReady = useCallback(
    (params: any) => {
      const dataSource = {
        rowCount: undefined,
        getRows,
      };
      params.api.setGridOption('datasource', dataSource);
    },
    [getRows]
  );

  // Function to clear cache (useful for refreshing data)
  const clearCache = useCallback(() => {
    rowCache.current.clear();
    console.log('Row cache cleared');
  }, []);

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
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            rowBuffer={50}
            rowModelType={'infinite'}
            cacheBlockSize={500}
            cacheOverflowSize={2}
            maxConcurrentDatasourceRequests={1}
            infiniteInitialRowCount={100}
            maxBlocksInCache={10}
            onGridReady={onGridReady}
            animateRows={true}
            getRowId={(params: any) => String(params.data.id)}
          />
        </Suspense>
      </div>
    </div>
  );
};

export default GridExample;
