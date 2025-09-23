import { useMemo, useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLocationDot, faPlus, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";
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
  CheckboxField,
  SelectField
} from "../components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { Badge } from "@/components/ui/badge";

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
  const dispatch = useDispatch<AppDispatch>();
  // Redux state for related data
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: spotTypes } = useSelector((state: RootState) => (state as any).spotTypes || { value: [] });

  // Hydrate spot types for dropdown (fast IndexedDB, then API refresh)
  useEffect(() => {
    // Some app shells may already hydrate; harmless to call again
    dispatch(genericActions.spotTypes.getFromIndexedDB());
    dispatch(genericActions.spotTypes.fetchFromAPI({ per_page: 1000 }));
  }, [dispatch]);
  
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

  // Enhanced spots data with hierarchy information for row grouping
  const hierarchyData = useMemo(() => {
    // Create a map for quick parent lookup
    const spotById = new Map<number, Spot>();
    spots.forEach(spot => spotById.set(spot.id, spot));

    // Create enhanced data with hierarchy information
    return spots.map(spot => ({
      ...spot,
      // Add display fields for hierarchy
      spot_type_name: (spotTypes as any[]).find((t) => t.id === spot.spot_type_id)?.name ?? `Type ${spot.spot_type_id}`,
      parent_name: spot.parent_id ? (spotById.get(spot.parent_id)?.name ?? `Spot ${spot.parent_id}`) : 'Root'
    }));
  }, [spots, spotTypes]);

  // Apply search to hierarchy data
  const searchableHierarchyData = useMemo(() => {
    if (!searchQuery.trim()) {
      return hierarchyData;
    }
    return hierarchyData.filter(spot =>
      spot.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [hierarchyData, searchQuery]);



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

  // Column definitions for AG Grid with row grouping
  const colDefs = useMemo<ColDef[]>(() => [
    {
      field: 'name',
      headerName: 'Spot',
      flex: 2,
      minWidth: 200,
      cellRenderer: SpotNameCellRenderer
    },
    {
      field: 'spot_type_name',
      headerName: 'Spot Type',
      width: 120,
      valueFormatter: (p) => p.value || 'Unknown'
    },
    {
      field: 'parent_name',
      headerName: 'Parent',
      width: 120,
      rowGroup: true, // Enable row grouping on this column
      hide: true // Hide the column but use it for grouping
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
  ], [handleEdit, handleDelete, spotTypes]);

  // Grid options for row grouping with hierarchical selection (align with example)
  const gridOptions = useMemo(() => ({
    rowGroupPanelShow: 'always',
    groupDefaultExpanded: 1,
    animateRows: true,
    getRowId: (params: any) => String(params.data.id),
    suppressRowClickSelection: true,
  }), []);

  const autoGroupColumnDef = useMemo(() => ({
    headerName: 'Hierarchy',
    minWidth: 250,
    field: 'name',
    cellRenderer: 'agGroupCellRenderer',
  }), []);

  const rowSelection = useMemo(() => ({
    mode: 'multiRow',
    groupSelects: 'filteredDescendants' as const,
  }), []);

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
          {spot.is_branch ? 'Branch' : 'Location'} • {(spotTypes as any[]).find(t => t.id === spot.spot_type_id)?.name ?? `Type ${spot.spot_type_id}`}
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
      description="Set up hierarchical locations and spot management with row grouping"
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
        description: "Overview of your hierarchical locations",
        items: [
          { label: "Total Spots", value: spots.length },
          { label: "Total Tasks", value: tasks.length },
          { label: "Avg Tasks/Spot", value: spots.length > 0 ? Math.round((tasks.length / spots.length) * 10) / 10 : 0 },
          { label: "Root Spots", value: spots.filter(s => !s.parent_id).length }
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
      <Tabs defaultValue="main">
        <TabsList>
          <TabsTrigger value="main">Spots</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
        </TabsList>
        <TabsContent value="main">
          <SettingsGrid
            rowData={searchableHierarchyData}
            columnDefs={colDefs}
            gridOptions={gridOptions}
            autoGroupColumnDef={autoGroupColumnDef}
            rowSelection={rowSelection as any}
            noRowsMessage="No spots found"
            onRowDoubleClicked={handleEdit}
          />
        </TabsContent>
        <TabsContent value="branches">
          <SettingsGrid
            rowData={filteredItems.filter((s: any) => s.is_branch)}
            columnDefs={colDefs}
            gridOptions={gridOptions}
            autoGroupColumnDef={autoGroupColumnDef}
            rowSelection={rowSelection as any}
            noRowsMessage="No branches found"
            onRowDoubleClicked={handleEdit}
          />
        </TabsContent>
      </Tabs>

      {/* Create Spot Dialog */
      }
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
          <SelectField
            id="spot_type_id"
            label="Spot Type"
            value={createFormData.spot_type_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, spot_type_id: value }))}
            options={(spotTypes as any[]).map((st) => ({ value: st.id, label: st.name }))}
            placeholder={spotTypes?.length ? 'Select spot type' : 'Loading...'}
            required
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
            <SelectField
              id="edit-spot_type_id"
              label="Spot Type"
              value={editFormData.spot_type_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, spot_type_id: value }))}
              options={(spotTypes as any[]).map((st) => ({ value: st.id, label: st.name }))}
              placeholder={spotTypes?.length ? 'Select spot type' : 'Loading...'}
              required
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