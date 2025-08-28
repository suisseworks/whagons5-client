import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { genericActions } from "@/store/genericSlices";
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

// Import Spot type from store types
import { Spot } from "@/store/types";

// Custom cell renderer for spot name with type indicator
const SpotNameCellRenderer = (props: ICellRendererParams) => {
  const spotName = props.value as string;
  const isBranch = props.data?.is_branch || false;
  const indicatorColor = isBranch ? '#EF4444' : '#10B981'; // Red for branches, green for locations

  return (
    <div className="flex items-center space-x-3 h-full">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-medium"
        style={{ backgroundColor: indicatorColor }}
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
  const dispatch = useDispatch();
  const gridRef = useRef<AgGridReact>(null);

  // Redux state
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: spots, loading, error } = useSelector((state: RootState) => state.spots);

  // Local state for Spots
  const [rowData, setRowData] = useState<Spot[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [deletingSpot, setDeletingSpot] = useState<Spot | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    parent_id: null as number | null,
    spot_type_id: 1, // Default spot type
    is_branch: false
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    parent_id: null as number | null,
    spot_type_id: 1,
    is_branch: false
  });

  // Sync rowData with spots from Redux
  useEffect(() => {
    setRowData(spots);
  }, [spots]);

  // Derived counts
  const getSpotTaskCount = useCallback((spotId: number) => {
    return tasks.filter((task: any) => task.spot_id === spotId).length;
  }, [tasks]);

  // Handlers
  const handleAddSpot = () => {
    setFormData({ name: '', parent_id: null, spot_type_id: 1, is_branch: false });
    setIsCreateDialogOpen(true);
  };

  const handleEditSpot = useCallback((spot: Spot) => {
    setEditingSpot(spot);
    setEditFormData({
      name: spot.name,
      parent_id: spot.parent_id || null,
      spot_type_id: spot.spot_type_id,
      is_branch: spot.is_branch
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
      await dispatch(genericActions.spots.createItem(formData));
      setIsCreateDialogOpen(false);
      setFormData({ name: '', parent_id: null, spot_type_id: 1, is_branch: false });
    } catch (e) {
      console.error('Failed to create spot:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateSpot = async () => {
    if (!editingSpot) return;
    try {
      setIsSubmitting(true);
      await dispatch(genericActions.spots.updateItem({
        id: editingSpot.id,
        ...editFormData
      }));
      setEditingSpot(null);
      setIsEditDialogOpen(false);
    } catch (e) {
      console.error('Failed to update spot:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteSpot = async () => {
    if (!deletingSpot) return;
    try {
      setIsSubmitting(true);
      await dispatch(genericActions.spots.deleteItem(deletingSpot.id));
      handleCloseDeleteDialog();
    } catch (e) {
      console.error('Failed to delete spot:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Spot', flex: 2, minWidth: 200, cellRenderer: SpotNameCellRenderer },
    {
      field: 'is_branch', headerName: 'Type', width: 100,
      cellRenderer: (params: ICellRendererParams) => (
        <div className="flex items-center h-full">
          <Badge variant={params.value ? "default" : "secondary"}>
            {params.value ? 'Branch' : 'Location'}
          </Badge>
        </div>
      )
    },
    {
      field: 'spot_type_id', headerName: 'Spot Type', width: 120,
      valueFormatter: (p) => `Type ${p.value}`
    },
    {
      field: 'parent_id', headerName: 'Parent', width: 120,
      valueFormatter: (p) => p.value ? `Spot ${p.value}` : 'Root'
    },
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
    setRowData(spots.filter((s: Spot) =>
      s.name.toLowerCase().includes(q) ||
      (s.is_branch ? 'branch' : 'location').includes(q)
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
                    <Label htmlFor="spot_type_id" className="text-right">Spot Type</Label>
                    <Input id="spot_type_id" type="number" value={formData.spot_type_id} onChange={(e) => setFormData({ ...formData, spot_type_id: parseInt(e.target.value) || 1 })} className="col-span-3" min="1" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="parent_id" className="text-right">Parent ID</Label>
                    <Input id="parent_id" type="number" value={formData.parent_id || ''} onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })} className="col-span-3" placeholder="Leave empty for root" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="is_branch" className="text-right">Is Branch</Label>
                    <input id="is_branch" type="checkbox" checked={formData.is_branch} onChange={(e) => setFormData({ ...formData, is_branch: e.target.checked })} className="col-span-3" />
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
                    <Label htmlFor="edit-spot_type_id" className="text-right">Spot Type</Label>
                    <Input id="edit-spot_type_id" type="number" value={editFormData.spot_type_id} onChange={(e) => setEditFormData({ ...editFormData, spot_type_id: parseInt(e.target.value) || 1 })} className="col-span-3" min="1" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-parent_id" className="text-right">Parent ID</Label>
                    <Input id="edit-parent_id" type="number" value={editFormData.parent_id || ''} onChange={(e) => setEditFormData({ ...editFormData, parent_id: e.target.value ? parseInt(e.target.value) : null })} className="col-span-3" placeholder="Leave empty for root" />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-is_branch" className="text-right">Is Branch</Label>
                    <input id="edit-is_branch" type="checkbox" checked={editFormData.is_branch} onChange={(e) => setEditFormData({ ...editFormData, is_branch: e.target.checked })} className="col-span-3" />
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
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: deletingSpot.is_branch ? '#EF4444' : '#10B981' }}>
                        {deletingSpot.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{deletingSpot.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {deletingSpot.is_branch ? 'Branch' : 'Location'} • Type {deletingSpot.spot_type_id}
                          {deletingSpot.parent_id && ` • Parent: Spot ${deletingSpot.parent_id}`}
                        </div>
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


