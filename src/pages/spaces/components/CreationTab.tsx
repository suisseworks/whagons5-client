import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState, useCallback, useMemo, useRef, lazy, Suspense } from "react";

// Lazy load AgGridReact component
const AgGridReact = lazy(() => import('ag-grid-react').then(module => ({ default: module.AgGridReact })));

interface WorkspaceFilters {
  allowed_categories: {
    category: string;
    description: string;
    enabled: boolean;
    task_count: number;
  }[];
  creation_restrictions: {
    internal_only: boolean;
    require_approval: boolean;
  };
}

interface CreationTabProps {
  modulesLoaded: boolean;
  workspaceFilters: WorkspaceFilters | null;
  filtersLoading: boolean;
  onToggleCategory: (categoryName: string) => void;
}

function CreationTab({ 
  modulesLoaded, 
  workspaceFilters, 
  filtersLoading, 
  onToggleCategory 
}: CreationTabProps) {
  const [categorySearch, setCategorySearch] = useState('');

  // Column definitions for categories table
  const [categoryColumnDefs] = useState([
    {
      field: 'category',
      headerName: 'Category',
      minWidth: 180,
      flex: 1,
      cellRenderer: (params: any) => {
        if (params.value) {
          return (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                {params.value.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium">{params.value}</span>
            </div>
          );
        }
        return <i className="fas fa-spinner fa-pulse"></i>;
      },
    },
    {
      field: 'description',
      headerName: 'Description',
      minWidth: 300,
      flex: 1,
    },
    {
      field: 'task_count',
      headerName: 'Task Types',
      maxWidth: 120,
      flex: 1,
      cellRenderer: (params: any) => {
        if (params.value !== undefined) {
          return <Badge variant="secondary">{params.value}</Badge>;
        }
        return null;
      },
    },
    {
      field: 'enabled',
      headerName: 'Creation Status',
      maxWidth: 150,
      flex: 1,
      cellRenderer: (params: any) => {
        if (params.value === true) {
          return <Badge variant="default" className="bg-green-500">Creation Allowed</Badge>;
        } else if (params.value === false) {
          return <Badge variant="outline">Creation Blocked</Badge>;
        }
        return null;
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      maxWidth: 200,
      flex: 1,
      cellRenderer: (params: any) => {
        if (params.data) {
          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleCategory(params.data.category)}
              className="text-sm"
            >
              {params.data.enabled ? 'Block Creation' : 'Allow Creation'}
            </Button>
          );
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

  // Get rows function for categories
  const getCategoryRows = useCallback(
    async (params: any) => {
      console.log('Fetching categories for range', params.startRow, 'to', params.endRow);

      try {
        if (!workspaceFilters) {
          params.failCallback();
          return;
        }

        // Filter categories based on search
        let filteredCategories = workspaceFilters.allowed_categories.filter(category => {
          const matchesSearch = category.category.toLowerCase().includes(categorySearch.toLowerCase()) ||
                               category.description.toLowerCase().includes(categorySearch.toLowerCase());
          return matchesSearch;
        });

        const start = params.startRow || 0;
        const end = params.endRow || filteredCategories.length;
        const rowsThisPage = filteredCategories.slice(start, end);

        params.successCallback(rowsThisPage, filteredCategories.length);
      } catch (error) {
        console.error('Failed to fetch categories:', error);
        params.failCallback();
      }
    },
    [workspaceFilters, categorySearch]
  );

  const onCategoryGridReady = useCallback(
    (params: any) => {
      const dataSource = {
        rowCount: undefined,
        getRows: getCategoryRows,
      };
      params.api.setGridOption('datasource', dataSource);
    },
    [getCategoryRows]
  );

  const containerStyle = useMemo(() => ({ width: '100%', height: '100%' }), []);
  const gridStyle = useMemo(() => ({ height: '100%', width: '100%' }), []);

  if (filtersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-pulse fa-2x"></i>
      </div>
    );
  }

  if (!workspaceFilters) {
    return (
      <div className="text-center text-muted-foreground">
        Failed to load category settings
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full mb-5">
      {/* Header Card */}
      <Card className="flex-shrink-0">
        <CardHeader>
          <CardTitle>Task Creation Filters</CardTitle>
          <CardDescription>
            Control which categories can be used when creating tasks from within this workspace
          </CardDescription>
          <div className="flex items-center space-x-2 mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> These settings only control task creation from within this workspace. 
              They don't affect category ownership or where tasks created elsewhere are routed.
            </span>
          </div>
          
          {/* Search Control */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search categories..."
              value={categorySearch}
              onChange={(e) => setCategorySearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
      </Card>

      {/* Standalone Table */}
      <div className="flex-1 mt-4 min-h-96">
        {!modulesLoaded ? (
          <div className="flex items-center justify-center h-64">
            <i className="fas fa-spinner fa-pulse fa-2x"></i>
          </div>
        ) : (
          <div style={containerStyle} className="ag-theme-quartz h-full w-full">
            <div style={gridStyle}>
              <Suspense fallback={<div>Loading Categories Table...</div>}>
                <AgGridReact
                  columnDefs={categoryColumnDefs}
                  defaultColDef={defaultColDef}
                  rowBuffer={50}
                  rowModelType={'infinite'}
                  cacheBlockSize={100}
                  cacheOverflowSize={2}
                  maxConcurrentDatasourceRequests={1}
                  infiniteInitialRowCount={50}
                  maxBlocksInCache={10}
                  onGridReady={onCategoryGridReady}
                  animateRows={true}
                  getRowId={(params: any) => String(params.data.category)}
                  suppressColumnVirtualisation={true}
                  key={categorySearch} // Force re-render when search changes
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      {/* Summary Card */}
      <Card className="flex-shrink-0 mt-4">
        <CardContent className="pl-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Available Categories:</span>
              <Badge variant="secondary">{workspaceFilters.allowed_categories.length}</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Creation Allowed:</span>
              <Badge variant="default" className="bg-green-500">
                {workspaceFilters.allowed_categories.filter(c => c.enabled).length}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Creation Blocked:</span>
              <Badge variant="outline">
                {workspaceFilters.allowed_categories.filter(c => !c.enabled).length}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Total Task Types:</span>
              <Badge variant="secondary">
                {workspaceFilters.allowed_categories.reduce((sum, cat) => sum + cat.task_count, 0)}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default CreationTab; 