import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faLocationDot, 
  faArrowLeft,
  faPlus,
  faEdit,
  faTrash,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Local Spot type for this page
type Spot = {
  id: number;
  name: string;
  description: string;
  address?: string;
  color?: string;
  created_at?: string;
  updated_at?: string;
};

// Custom cell renderer for spot name with color indicator
const SpotNameCellRenderer = (props: ICellRendererParams) => {
  const spotColor = props.data?.color || '#6B7280';
  const spotName = props.value as string;
  
  return (
    <div className="flex items-center space-x-3 h-full">
      <div 
        className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-medium"
        style={{ backgroundColor: spotColor }}
        title={spotName}
      >
        {spotName ? spotName.charAt(0).toUpperCase() : 'S'}
      </div>
      <span>{spotName}</span>
    </div>
  );
};

// Custom cell renderer for actions
const ActionsCellRenderer = (props: ICellRendererParams & { onEdit: (spot: Spot) => void; onDelete: (spot: Spot) => void }) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onEdit(props.data);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onDelete(props.data);
  };

  return (
    <div className="flex items-center space-x-2 h-full">
      <Button 
        size="sm" 
        variant="outline"
        onClick={handleEdit}
        className="p-1 h-7 w-7"
      >
        <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
      </Button>
      <Button 
        size="sm" 
        variant="destructive"
        onClick={handleDelete}
        className="p-1 h-7 w-7"
      >
        <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
      </Button>
    </div>
  );
};

function Spots() {
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact>(null);

  // Redux state (to compute associations)
  const { value: tasks } = useSelector((state: RootState) => state.tasks);

  // Local state for Spots (mock-backed for now)
  const [spots, setSpots] = useState<Spot[]>([]);
  const [rowData, setRowData] = useState<Spot[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [deletingSpot, setDeletingSpot] = useState<Spot | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    address: '',
    color: '#2563EB'
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    address: '',
    color: '#2563EB'
  });

  // Mock fetch
  useEffect(() => {
    const fetchSpots = async () => {
      try {
        setLoading(true);
        setError(null);
        // TODO: replace with API + Redux slice
        const mock: Spot[] = Array.from({ length: 12 }, (_, i) => ({
          id: i + 1,
          name: `Spot ${i + 1}`,
          description: i % 3 === 0 ? 'Main building' : i % 3 === 1 ? 'Warehouse' : 'Back office',
          address: `Street ${i + 1}, City`,
          color: i % 3 === 0 ? '#EF4444' : i % 3 === 1 ? '#10B981' : '#2563EB',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        setSpots(mock);
        setRowData(mock);
      } catch (e: any) {
        setError('Failed to load spots');
      } finally {
        setLoading(false);
      }
    };
    fetchSpots();
  }, []);

  // Derived counts
  const getSpotTaskCount = useCallback((spotId: number) => {
    return tasks.filter(task => task.spot_id === spotId).length;
  }, [tasks]);

  // Handlers
  const handleAddSpot = () => {
    setFormData({ name: '', description: '', address: '', color: '#2563EB' });
    setIsCreateDialogOpen(true);
  };

  const handleEditSpot = useCallback((spot: Spot) => {
    setEditingSpot(spot);
    setEditFormData({
      name: spot.name,
      description: spot.description || '',
      address: spot.address || '',
      color: spot.color || '#2563EB'
    });
    setIsEditDialogOpen(true);
  }, []);

  const handleDeleteSpot = useCallback((spot: Spot) => {
    setDeletingSpot(spot);
    setIsDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingSpot(null);
  };

  const createSpot = async () => {
    try {
      setIsSubmitting(true);
      const newSpot: Spot = {
        id: (spots.at(-1)?.id || 0) + 1,
        name: formData.name,
        description: formData.description,
        address: formData.address,
        color: formData.color,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const updated = [...spots, newSpot];
      setSpots(updated);
      setRowData(updated);
      setIsCreateDialogOpen(false);
    } catch (e) {
      setError('Failed to add spot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSpot = async () => {
    if (!editingSpot) return;
    try {
      setIsSubmitting(true);
      const updated = spots.map(s => s.id === editingSpot.id 
        ? { ...s, ...editFormData, updated_at: new Date().toISOString() } 
        : s);
      setSpots(updated);
      setRowData(updated);
      setEditingSpot(null);
      setIsEditDialogOpen(false);
    } catch (e) {
      setError('Failed to update spot');
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSpot = async () => {
    if (!deletingSpot) return;
    try {
      setIsSubmitting(true);
      const updated = spots.filter(s => s.id !== deletingSpot.id);
      setSpots(updated);
      setRowData(updated);
      handleCloseDeleteDialog();
    } catch (e) {
      setError('Failed to delete spot');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Spot', flex: 2, minWidth: 200, cellRenderer: SpotNameCellRenderer },
    { field: 'description', headerName: 'Description', flex: 3, minWidth: 220 },
    { field: 'address', headerName: 'Address', flex: 2, minWidth: 200 },
    { 
      field: 'tasks', headerName: 'Tasks', width: 100,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex items-center h-full">
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            {getSpotTaskCount(params.data.id)}
          </Badge>
        </div>
      ),
      sortable: false, filter: false
    },
    { field: 'updated_at', headerName: 'Updated', width: 140, valueFormatter: (p) => p.value ? new Date(p.value).toLocaleDateString() : '' },
    {
      field: 'actions', headerName: 'Actions', width: 120,
      cellRenderer: (params: ICellRendererParams) => ActionsCellRenderer({ ...params, onEdit: handleEditSpot, onDelete: handleDeleteSpot }),
      sortable: false, filter: false, resizable: false, pinned: 'right'
    }
  ], [getSpotTaskCount, handleEditSpot, handleDeleteSpot]);

  const onGridReady = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
  }, []);

  const handleBackClick = () => navigate('/settings');

  const handleSearch = (value: string) => {
    const q = value.toLowerCase();
    if (!q) { setRowData(spots); return; }
    setRowData(spots.filter(s => 
      s.name.toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.address || '').toLowerCase().includes(q)
    ));
  };

  useEffect(() => {
    const onResize = () => { if (gridRef.current?.api) gridRef.current.api.sizeColumnsToFit(); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <button onClick={handleBackClick} className="flex items-center space-x-1 hover:text-foreground transition-colors">
              <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
              <span>Settings</span>
            </button>
            <span>»</span>
            <span className="text-foreground">Spots</span>
          </nav>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faLocationDot} className="text-green-500 text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight">Spots</h1>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            <span>Loading spots...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <button onClick={handleBackClick} className="flex items-center space-x-1 hover:text-foreground transition-colors">
              <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
              <span>Settings</span>
            </button>
            <span>»</span>
            <span className="text-foreground">Spots</span>
          </nav>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faLocationDot} className="text-green-500 text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight">Spots</h1>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => window.location.reload()} variant="outline">Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <button onClick={handleBackClick} className="flex items-center space-x-1 hover:text-foreground transition-colors">
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <span>»</span>
          <span className="text-foreground">Spots</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <FontAwesomeIcon icon={faLocationDot} className="text-green-500 text-2xl" />
              <h1 className="text-3xl font-bold tracking-tight">Spots</h1>
            </div>
            <p className="text-muted-foreground">Set up locations and spot management</p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddSpot} className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span>Add Spot</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Spot</DialogTitle>
                <DialogDescription>
                  Define a new location for assigning tasks.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (formData.name.trim()) createSpot(); }} className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Input id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="address" className="text-right">Address</Label>
                    <Input id="address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="color" className="text-right">Color</Label>
                    <Input type="color" id="color" value={formData.color} onChange={(e) => setFormData({ ...formData, color: e.target.value })} className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                    {isSubmitting ? (<FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />) : (<FontAwesomeIcon icon={faPlus} className="mr-2" />)}
                    {isSubmitting ? 'Adding...' : 'Add Spot'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          
          {/* Edit Spot Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Spot</DialogTitle>
                <DialogDescription>Update the spot information.</DialogDescription>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); if (editFormData.name.trim()) updateSpot(); }} className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-name" className="text-right">Name</Label>
                    <Input id="edit-name" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} className="col-span-3" required />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-description" className="text-right">Description</Label>
                    <Input id="edit-description" value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-address" className="text-right">Address</Label>
                    <Input id="edit-address" value={editFormData.address} onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })} className="col-span-3" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-color" className="text-right">Color</Label>
                    <Input type="color" id="edit-color" value={editFormData.color} onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })} className="col-span-3" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting || !editFormData.name.trim()}>
                    {isSubmitting ? (<FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />) : (<FontAwesomeIcon icon={faEdit} className="mr-2" />)}
                    {isSubmitting ? 'Updating...' : 'Update Spot'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Spot Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={handleCloseDeleteDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faTrash} className="text-destructive" />
                  <span>Delete Spot</span>
                </DialogTitle>
                <DialogDescription>
                  {deletingSpot && (
                    <div className="space-y-2">
                      <p>Are you sure you want to delete the spot "{deletingSpot.name}"?</p>
                      <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                    </div>
                  )}
                </DialogDescription>
              </DialogHeader>
              {deletingSpot && (
                <div className="py-4">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: deletingSpot.color || '#6B7280' }}>
                        {deletingSpot.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{deletingSpot.name}</div>
                        <div className="text-sm text-muted-foreground">{deletingSpot.description}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-muted-foreground">{getSpotTaskCount(deletingSpot.id)} tasks</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                {error && (<div className="text-sm text-destructive mb-2 text-left">{error}</div>)}
                <Button variant="outline" onClick={handleCloseDeleteDialog}>Cancel</Button>
                {deletingSpot && (
                  <Button variant="destructive" onClick={deleteSpot} disabled={isSubmitting}>
                    {isSubmitting ? (<FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />) : (<FontAwesomeIcon icon={faTrash} className="mr-2" />)}
                    {isSubmitting ? 'Deleting...' : 'Delete Spot'}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <Input placeholder="Search spots..." className="w-full max-w-md" onChange={(e) => handleSearch(e.target.value)} />
        <div className="ag-theme-quartz h-[400px] w-full">
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={colDefs}
            onGridReady={onGridReady}
            suppressColumnVirtualisation={true}
            animateRows={true}
            rowHeight={50}
            headerHeight={40}
            defaultColDef={{ sortable: true, filter: true, resizable: true }}
            noRowsOverlayComponent={() => (
              <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">No spots found</p></div>
            )}
          />
        </div>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Spot Statistics</CardTitle>
          <CardDescription>Overview of your locations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{spots.length}</div>
              <div className="text-sm text-muted-foreground">Total Spots</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{tasks.length}</div>
              <div className="text-sm text-muted-foreground">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{spots.length > 0 ? Math.round((tasks.length / spots.length) * 10) / 10 : 0}</div>
              <div className="text-sm text-muted-foreground">Avg Tasks/Spot</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Spots;


