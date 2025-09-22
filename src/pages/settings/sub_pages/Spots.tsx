import { useMemo, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot, faPlus, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Spot } from "@/store/types";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
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

  // Form state for controlled components
  const [createFormData, setCreateFormData] = useState<{
    name: string;
    spot_type_id: string;
    parent_id: string;
    is_branch: boolean;
  }>({
    name: '',
    spot_type_id: '1',
    parent_id: '',
    is_branch: false
  });

  const [editFormData, setEditFormData] = useState<{
    name: string;
    spot_type_id: string;
    parent_id: string;
    is_branch: boolean;
  }>({
    name: '',
    spot_type_id: '1',
    parent_id: '',
    is_branch: false
  });

  // Update edit form data when editing spot changes
  useEffect(() => {
    if (editingSpot) {
      setEditFormData({
        name: editingSpot.name || '',
        spot_type_id: editingSpot.spot_type_id?.toString() || '1',
        parent_id: editingSpot.parent_id?.toString() || '',
        is_branch: editingSpot.is_branch || false
      });
    }
  }, [editingSpot]);

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

    const spotData = {
      name: createFormData.name,
      parent_id: createFormData.parent_id ? parseInt(createFormData.parent_id) : null,
      spot_type_id: parseInt(createFormData.spot_type_id) || 1,
      is_branch: createFormData.is_branch
    };
    await createItem(spotData);

    // Reset form after successful creation
    setCreateFormData({
      name: '',
      spot_type_id: '1',
      parent_id: '',
      is_branch: false
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpot) return;

    const updates = {
      name: editFormData.name,
      parent_id: editFormData.parent_id ? parseInt(editFormData.parent_id) : null,
      spot_type_id: parseInt(editFormData.spot_type_id) || 1,
      is_branch: editFormData.is_branch
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
            label="Name"
            value={createFormData.name}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, name: value }))}
            required
          />
          <TextField
            id="spot_type_id"
            label="Spot Type"
            type="number"
            value={createFormData.spot_type_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, spot_type_id: value }))}
            min="1"
          />
          <TextField
            id="parent_id"
            label="Parent ID"
            type="number"
            value={createFormData.parent_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, parent_id: value }))}
            placeholder="Leave empty for root"
          />
          <CheckboxField
            id="is_branch"
            label="Is Branch"
            checked={createFormData.is_branch}
            onChange={(checked) => setCreateFormData(prev => ({ ...prev, is_branch: checked }))}
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
              label="Name"
              value={editFormData.name}
              onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
              required
            />
            <TextField
              id="edit-spot_type_id"
              label="Spot Type"
              type="number"
              value={editFormData.spot_type_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, spot_type_id: value }))}
              min="1"
            />
            <TextField
              id="edit-parent_id"
              label="Parent ID"
              type="number"
              value={editFormData.parent_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, parent_id: value }))}
              placeholder="Leave empty for root"
            />
            <CheckboxField
              id="edit-is_branch"
              label="Is Branch"
              checked={editFormData.is_branch}
              onChange={(checked) => setEditFormData(prev => ({ ...prev, is_branch: checked }))}
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