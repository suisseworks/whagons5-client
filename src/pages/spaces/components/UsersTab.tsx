import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useCallback, useMemo, useRef, useEffect, lazy, Suspense } from "react";

// Lazy load AgGridReact component
const AgGridReact = lazy(() => import('ag-grid-react').then(module => ({ default: module.AgGridReact })));

interface User {
  id: string;
  name: string;
  email: string;
  team_name: string;
  organization_name: string;
  created_at: string;
  role: boolean;
  has_active_subscription: boolean;
}

interface UsersTabProps {
  modulesLoaded: boolean;
  selectedTeamFilter: string | null;
  onClearTeamFilter: () => void;
}

function UsersTab({ 
  modulesLoaded, 
  selectedTeamFilter, 
  onClearTeamFilter 
}: UsersTabProps) {
  const gridRef = useRef<any>(null);
  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>());

  // Generate cache key based on request parameters
  const getCacheKey = useCallback((params: any) => {
    return `${params.startRow}-${params.endRow}-${JSON.stringify(
      params.filterModel || {}
    )}-${JSON.stringify(params.sortModel || [])}-${selectedTeamFilter || 'all'}`;
  }, [selectedTeamFilter]);

  // Column definitions for users table
  const [userColumnDefs] = useState([
    {
      field: 'id',
      maxWidth: 80,
      cellRenderer: (params: any) => {
        if (params.value !== undefined) {
          return params.value;
        } else {
          return <i className="fas fa-spinner fa-pulse"></i>;
        }
      },
    },
    {
      field: 'name',
      minWidth: 150,
      cellRenderer: (params: any) => {
        if (params.data?.name) {
          return (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {params.data.name.charAt(0).toUpperCase()}
              </div>
              <span>{params.data.name}</span>
            </div>
          );
        }
        return <i className="fas fa-spinner fa-pulse"></i>;
      },
    },
    {
      field: 'email',
      minWidth: 200,
    },
    {
      field: 'team_name',
      minWidth: 150,
      cellRenderer: (params: any) => {
        if (params.value) {
          return <Badge variant="secondary">{params.value}</Badge>;
        }
        return null;
      },
    },
    {
      field: 'organization_name',
      minWidth: 150,
    },
    {
      field: 'role',
      maxWidth: 120,
      cellRenderer: (params: any) => {
        if (params.value === true) {
          return <Badge variant="default">Admin</Badge>;
        } else if (params.value === false) {
          return <Badge variant="outline">User</Badge>;
        }
        return null;
      },
    },
    {
      field: 'has_active_subscription',
      maxWidth: 200,
      cellRenderer: (params: any) => {
        if (params.value === true) {
          return <Badge variant="default" className="bg-green-500">Active</Badge>;
        } else if (params.value === false) {
          return <Badge variant="destructive">Inactive</Badge>;
        }
        return null;
      },
    },
    {
      field: 'created_at',
      minWidth: 120,
      cellRenderer: (params: any) => {
        if (params.value) {
          return new Date(params.value).toLocaleDateString();
        }
        return null;
      },
    },
  ] as any);

  const defaultColDef = useMemo(() => {
    return {
      minWidth: 100,
      sortable: true,
      filter: true,
      resizable: true,
      flex: 1,
    };
  }, []);

  // Get rows function for AG Grid
  const getRows = useCallback(
    async (params: any) => {
      const cacheKey = getCacheKey(params);

      // Check if data is already cached
      if (rowCache.current.has(cacheKey)) {
        console.log(`Cache hit for users range ${params.startRow} to ${params.endRow}`);
        const cachedData = rowCache.current.get(cacheKey)!;
        params.successCallback(cachedData.rows, cachedData.rowCount);
        return;
      }

      console.log('Fetching users for range', params.startRow, 'to', params.endRow, 'with team filter:', selectedTeamFilter);

      try {
        // Mock data for now - replace with actual API call
        let mockUsers: User[] = Array.from({ length: 100 }, (_, i) => ({
          id: `user_${i + 1}`,
          name: `User ${i + 1}`,
          email: `user${i + 1}@example.com`,
          team_name: i % 3 === 0 ? 'Engineering Team' : i % 3 === 1 ? 'Marketing Team' : 'Operations Team',
          organization_name: i % 2 === 0 ? 'TechCorp Inc.' : 'Partner Corp',
          created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          role: i % 10 === 0,
          has_active_subscription: i % 4 !== 0,
        }));

        // Apply team filter if selected
        if (selectedTeamFilter) {
          mockUsers = mockUsers.filter(user => user.team_name === selectedTeamFilter);
        }

        const start = params.startRow || 0;
        const end = params.endRow || mockUsers.length;
        const rowsThisPage = mockUsers.slice(start, end);

        // Cache the result
        rowCache.current.set(cacheKey, {
          rows: rowsThisPage,
          rowCount: mockUsers.length,
        });

        params.successCallback(rowsThisPage, mockUsers.length);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        params.failCallback();
      }
    },
    [getCacheKey, selectedTeamFilter]
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

  const containerStyle = useMemo(() => ({ width: '100%', height: '100%' }), []);
  const gridStyle = useMemo(() => ({ height: '100%', width: '100%' }), []);

  // Clear cache when team filter changes
  useEffect(() => {
    rowCache.current.clear();
  }, [selectedTeamFilter]);

  return (
    <div className="flex flex-col h-full">
      <Card className="flex-shrink-0">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          {selectedTeamFilter && (
            <div className="flex items-center space-x-2 mt-2 p-2 bg-muted/50 rounded-md border">
              <span className="text-sm font-medium text-muted-foreground">Filtered by team:</span>
              <Badge variant="secondary" className="text-sm">
                {selectedTeamFilter}
              </Badge>
              <button
                onClick={onClearTeamFilter}
                className="text-muted-foreground hover:text-foreground text-sm underline ml-2"
              >
                Clear filter
              </button>
            </div>
          )}
          <CardDescription>
            {selectedTeamFilter 
              ? `Showing users from ${selectedTeamFilter}` 
              : "All users from teams that have access to this workspace"
            }
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="flex-1 mt-4">
        <CardContent className="p-0 h-full">
          {!modulesLoaded ? (
            <div className="flex items-center justify-center h-64">
              <i className="fas fa-spinner fa-pulse fa-2x"></i>
            </div>
          ) : (
            <div style={containerStyle} className="ag-theme-quartz h-full w-full">
              <div style={gridStyle}>
                <Suspense fallback={<div>Loading Users Table...</div>}>
                  <AgGridReact
                    ref={gridRef}
                    columnDefs={userColumnDefs}
                    defaultColDef={defaultColDef}
                    rowBuffer={50}
                    rowModelType={'infinite'}
                    cacheBlockSize={100}
                    cacheOverflowSize={2}
                    maxConcurrentDatasourceRequests={1}
                    infiniteInitialRowCount={50}
                    maxBlocksInCache={10}
                    onGridReady={onGridReady}
                    animateRows={true}
                    getRowId={(params: any) => String(params.data.id)}
                    suppressColumnVirtualisation={true}
                    key={selectedTeamFilter || 'all'} // Force re-render when filter changes
                  />
                </Suspense>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default UsersTab; 