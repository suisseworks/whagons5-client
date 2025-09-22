import { useMemo } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot, faPlus, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Spot } from "@/store/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  TextField,
  CheckboxField
} from "../components";

// Custom cell renderer for spot name with type indicator
const SpotNameCellRenderer = (props: ICellRendererParams) => {
  const spotName = props.value as string;
  const isBranch = props.data?.is_branch || false;
  const indicatorClass = isBranch ? 'bg-destructive' : 'bg-primary';

  return (
    <div className="flex items-center space-x-3 h-full">
      <div
        className={`w-6 h-6 rounded-md flex items-center justify-center text-primary-foreground text-xs font-medium ${indicatorClass}`}
        title={spotName}
      >
        {spotName ? spotName.charAt(0).toUpperCase() : 'S'}
      </div>
      <span>{spotName}</span>
    </div>
  );
};

function Spots() {
  // Redux state for related data
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  
  // Use shared state management
  const {
    items: spots,
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    handleSearch,
    createItem,
    updateItem,
    deleteItem,
    isSubmitting,
    formError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    editingItem: editingSpot,
    deletingItem: deletingSpot,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Spot>({
    entityName: 'spots',
    searchFields: ['name']
  });

  // Helper functions
  const getSpotTaskCount = (spotId: number) => {
    return tasks.filter((task: any) => task.spot_id === spotId).length;
  };

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: 'Spot', 
      flex: 2, 
      minWidth: 200, 
      cellRenderer: SpotNameCellRenderer 
    },
    // Type column removed per request (no corresponding DB field)
    {
      field: 'spot_type_id', 
      headerName: 'Spot Type', 
      width: 120,
      valueFormatter: (p) => `Type ${p.value}`
    },
    {
      field: 'parent_id', 
      headerName: 'Parent', 
      width: 120,
      valueFormatter: (p) => p.value ? `Spot ${p.value}` : 'Root'
    },
    // Tasks column removed per request
    // Updated column removed per request
    {
      field: 'actions', 
      headerName: 'Actions', 
      width: 120,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDelete
      }),
      sortable: false, 
      filter: false, 
      resizable: false, 
      pinned: 'right'
    }
  ], [getSpotTaskCount, handleEdit, handleDelete]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const spotData = {
      name: formData.get('name') as string,
      parent_id: formData.get('parent_id') ? parseInt(formData.get('parent_id') as string) : null,
      spot_type_id: parseInt(formData.get('spot_type_id') as string) || 1,
      is_branch: formData.get('is_branch') === 'on'
    };
    await createItem(spotData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpot) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      name: formData.get('name') as string,
      parent_id: formData.get('parent_id') ? parseInt(formData.get('parent_id') as string) : null,
      spot_type_id: parseInt(formData.get('spot_type_id') as string) || 1,
      is_branch: formData.get('is_branch') === 'on'
    };
    await updateItem(editingSpot.id, updates);
  };

  // Render entity preview for delete dialog
  const renderSpotPreview = (spot: Spot) => (
    <div className="flex items-center space-x-3">
      <div className={`w-8 h-8 rounded-md flex items-center justify-center text-primary-foreground text-sm font-medium ${spot.is_branch ? 'bg-destructive' : 'bg-primary'}`}>
        {spot.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div className="font-medium">{spot.name}</div>
        <div className="text-sm text-muted-foreground">
          {spot.is_branch ? 'Branch' : 'Location'} • Type {spot.spot_type_id}
          {spot.parent_id && ` • Parent: Spot ${spot.parent_id}`}
        </div>
        <div className="flex items-center space-x-2 mt-1">
          <span className="text-xs text-muted-foreground">{getSpotTaskCount(spot.id)} tasks</span>
        </div>
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title="Spots"
      description="Set up locations and spot management"
      icon={faLocationDot}
      iconColor="#10b981"
      search={{
        placeholder: "Search spots...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: "Loading spots..."
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      statistics={{
        title: "Spot Statistics",
        description: "Overview of your locations",
        items: [
          { label: "Total Spots", value: spots.length },
          { label: "Total Tasks", value: tasks.length },
          { label: "Avg Tasks/Spot", value: spots.length > 0 ? Math.round((tasks.length / spots.length) * 10) / 10 : 0 }
        ]
      }}
      headerActions={
        <div className="flex items-center gap-2">
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Add Spot
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/settings/spots/types" className="flex items-center">
              <FontAwesomeIcon icon={faLayerGroup} className="mr-2" />
              Spot Types
            </Link>
          </Button>
        </div>
      }
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={colDefs}
        noRowsMessage="No spots found"
      />

      {/* Create Spot Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add New Spot"
        description="Create a new spot to organize your tasks by location."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <TextField
            id="name"
            name="name"
            label="Name"
            defaultValue=""
            required
          />
          <TextField
            id="spot_type_id"
            name="spot_type_id"
            label="Spot Type"
            type="number"
            defaultValue="1"
            min="1"
          />
          <TextField
            id="parent_id"
            name="parent_id"
            label="Parent ID"
            type="number"
            defaultValue=""
            placeholder="Leave empty for root"
          />
          <CheckboxField
            id="is_branch"
            name="is_branch"
            label="Is Branch"
            defaultChecked={false}
            description="This is a branch location"
          />
        </div>
      </SettingsDialog>

      {/* Edit Spot Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit Spot"
        description="Update the spot information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingSpot}
      >
        {editingSpot && (
          <div className="grid gap-4">
            <TextField
              id="edit-name"
              name="name"
              label="Name"
              defaultValue={editingSpot.name}
              required
            />
            <TextField
              id="edit-spot_type_id"
              name="spot_type_id"
              label="Spot Type"
              type="number"
              defaultValue={editingSpot.spot_type_id.toString()}
              min="1"
            />
            <TextField
              id="edit-parent_id"
              name="parent_id"
              label="Parent ID"
              type="number"
              defaultValue={editingSpot.parent_id?.toString() || ""}
              placeholder="Leave empty for root"
            />
            <CheckboxField
              id="edit-is_branch"
              name="is_branch"
              label="Is Branch"
              defaultChecked={editingSpot.is_branch}
              description="This is a branch location"
            />
          </div>
        )}
      </SettingsDialog>

      {/* Delete Spot Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Spot"
        description={
          deletingSpot 
            ? `Are you sure you want to delete the spot "${deletingSpot.name}"? This action cannot be undone.`
            : undefined
        }
        onConfirm={() => deletingSpot ? deleteItem(deletingSpot.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        entityName="spot"
        entityData={deletingSpot}
        renderEntityPreview={renderSpotPreview}
      />
    </SettingsLayout>
  );
}

export default Spots;