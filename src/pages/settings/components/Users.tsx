import { useCallback, useEffect, useMemo, useRef, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faArrowLeft, faSpinner, faTrash } from "@fortawesome/free-solid-svg-icons";

// Lazy load AgGridReact
const AgGridReact = lazy(() => import('ag-grid-react').then(m => ({ default: m.AgGridReact })));

type UserRow = {
  id: string;
  name: string;
  email: string;
  team_name?: string;
  organization_name?: string;
  created_at?: string;
  role?: boolean; // true = admin
  has_active_subscription?: boolean;
};

function Users() {
  const navigate = useNavigate();
  const gridRef = useRef<any>(null);
  const rowCache = useRef(new Map<string, { rows: any[]; rowCount: number }>())
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);

  const [search, setSearch] = useState('');

  const getCacheKey = useCallback((params: any) => {
    return `${params.startRow}-${params.endRow}-${JSON.stringify(params.filterModel || {})}-${JSON.stringify(params.sortModel || [])}-${selectedTeamFilter || 'all'}-${search}`;
  }, [selectedTeamFilter, search]);

  const columnDefs = useMemo(() => ([
    { field: 'id', maxWidth: 80 },
    { field: 'name', minWidth: 150, cellRenderer: (p: any) => (
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
          {p.data?.name?.charAt(0)?.toUpperCase()}
        </div>
        <span>{p.data?.name}</span>
      </div>
    ) },
    { field: 'email', minWidth: 200 },
    { field: 'team_name', minWidth: 150, cellRenderer: (p: any) => p.value ? <Badge variant="secondary">{p.value}</Badge> : null },
    { field: 'organization_name', minWidth: 150 },
    { field: 'role', maxWidth: 120, cellRenderer: (p: any) => p.value === true ? <Badge variant="default">Admin</Badge> : <Badge variant="outline">User</Badge> },
    { field: 'has_active_subscription', maxWidth: 180, cellRenderer: (p: any) => p.value ? <Badge variant="default" className="bg-green-500">Active</Badge> : <Badge variant="destructive">Inactive</Badge> },
    { field: 'created_at', minWidth: 140, valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString() : '' },
    { field: 'actions', headerName: 'Actions', maxWidth: 120, cellRenderer: (p: any) => (
      <div className="flex items-center space-x-2 h-full">
        <Button size="sm" variant="destructive" className="p-1 h-7 w-7" onClick={() => { setDeletingUser(p.data); setIsDeleteDialogOpen(true); }}>
          <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
        </Button>
      </div>
    ) },
  ]), []);

  const defaultColDef = useMemo(() => ({ minWidth: 100, sortable: true, filter: true, resizable: true, flex: 1 }), []);

  const getRows = useCallback(async (params: any) => {
    const cacheKey = getCacheKey(params);
    if (rowCache.current.has(cacheKey)) {
      const cached = rowCache.current.get(cacheKey)!;
      params.successCallback(cached.rows, cached.rowCount);
      return;
    }

    // TODO: Replace with API call
    let mockUsers: UserRow[] = Array.from({ length: 100 }, (_, i) => ({
      id: `user_${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      team_name: i % 3 === 0 ? 'Engineering Team' : i % 3 === 1 ? 'Marketing Team' : 'Operations Team',
      organization_name: i % 2 === 0 ? 'TechCorp Inc.' : 'Partner Corp',
      created_at: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      role: i % 10 === 0,
      has_active_subscription: i % 4 !== 0,
    }));

    if (selectedTeamFilter) {
      mockUsers = mockUsers.filter(u => u.team_name === selectedTeamFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      mockUsers = mockUsers.filter(u => (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.team_name || '').toLowerCase().includes(q) ||
        (u.organization_name || '').toLowerCase().includes(q)
      ));
    }

    const start = params.startRow || 0;
    const end = params.endRow || mockUsers.length;
    const rowsThisPage = mockUsers.slice(start, end);
    rowCache.current.set(cacheKey, { rows: rowsThisPage, rowCount: mockUsers.length });
    params.successCallback(rowsThisPage, mockUsers.length);
  }, [getCacheKey, selectedTeamFilter, search]);

  const onGridReady = useCallback((params: any) => {
    const dataSource = { rowCount: undefined, getRows };
    params.api.setGridOption('datasource', dataSource);
  }, [getRows]);

  useEffect(() => { rowCache.current.clear(); }, [selectedTeamFilter, search]);

  const handleBackClick = () => navigate('/settings');

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-screen">
      <div className="space-y-2 py-6 border-b border-gray-200">
        <nav className="flex items-center space-x-2 text-sm text-[#64748b]">
          <button onClick={handleBackClick} className="flex items-center space-x-1 hover:text-foreground hover:underline transition-colors cursor-pointer">
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <span>{'>'}</span>
          <span className="text-foreground">Users</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <FontAwesomeIcon icon={faUser} className="text-2xl" style={{ color: '#10b981' }} />
              <h1 className="text-4xl font-extrabold tracking-tight">Users</h1>
            </div>
            <p className="text-sm" style={{ color: '#64748b' }}>User accounts and permissions</p>
          </div>
          <div className="flex items-center space-x-1">
            <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          </div>
        </div>
      </div>

      <div className="ag-theme-quartz h-[500px] w-full">
        <Suspense fallback={<div className="flex items-center justify-center h-64"><FontAwesomeIcon icon={faSpinner} className="animate-spin" /></div>}>
          <AgGridReact
            ref={gridRef}
            columnDefs={columnDefs}
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
            getRowId={(p: any) => String(p.data.id)}
            suppressColumnVirtualisation={true}
          />
        </Suspense>
      </div>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              {deletingUser ? `Are you sure you want to delete ${deletingUser.name} (${deletingUser.email})?` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(false)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User Statistics</CardTitle>
          <CardDescription>Overview of users across your teams</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">100</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">10</div>
              <div className="text-sm text-muted-foreground">Admins</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">75%</div>
              <div className="text-sm text-muted-foreground">Active Subscriptions</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Users;


