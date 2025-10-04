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
  SelectField,
  ColorIndicatorCellRenderer
} from "../components";
import { UrlTabs } from "@/components/ui/url-tabs";

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

  // Enhanced spots data with hierarchy path for tree data
  const hierarchyData = useMemo(() => {
    const spotById = new Map<number, Spot>();
    spots.forEach(spot => spotById.set(spot.id, spot));

    const buildPath = (spot: Spot) => {
      const path: string[] = [];
      let current: Spot | undefined = spot;
      const visited = new Set<number>();
      while (current) {
        if (visited.has(current.id)) break; // guard against cycles
        visited.add(current.id);
        path.unshift(current.name || `Spot ${current.id}`);
        current = current.parent_id ? spotById.get(current.parent_id) : undefined;
      }
      return path;
    };

    return spots.map(spot => ({
      ...spot,
      spot_type_name: (spotTypes as any[]).find((t) => t.id === spot.spot_type_id)?.name ?? `Type ${spot.spot_type_id}`,
      spot_type_color: (spotTypes as any[]).find((t) => t.id === spot.spot_type_id)?.color ?? undefined,
      hierarchyPath: buildPath(spot)
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

  // Dropdown options for parent spot selection
  const ROOT_VALUE = '__ROOT__';
  const parentSpotOptions = useMemo(() => {
    return [
      { value: ROOT_VALUE, label: 'Root' },
      ...spots.map((s) => ({ value: String(s.id), label: s.name }))
    ];
  }, [spots]);

  const editParentSpotOptions = useMemo(() => {
    if (!editingSpot) return parentSpotOptions;
    return parentSpotOptions.filter((opt) => opt.value === '' || opt.value !== String(editingSpot.id));
  }, [parentSpotOptions, editingSpot]);

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

  // Column definitions for AG Grid (tree data)
  const colDefs = useMemo<ColDef[]>(() => [
    {
      headerName: 'Spot',
      field: 'name',
      flex: 2,
      minWidth: 280,
      cellRenderer: 'agGroupCellRenderer',
      cellRendererParams: {
        suppressCount: true,
        innerRenderer: SpotNameCellRenderer
      },
      rowDrag: true
    },
    {
      headerName: 'Spot Type',
      field: 'spot_type_name',
      width: 160,
      cellRenderer: ColorIndicatorCellRenderer as any,
      cellRendererParams: (p: any) => ({ name: p.data?.spot_type_name, color: p.data?.spot_type_color })
    },
    // Tasks column removed per request
    // Updated column removed per request
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
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

  // Grid options for tree data with hierarchical selection
  const gridOptions = useMemo(() => ({
    treeData: true,
    getDataPath: (data: any) => data.hierarchyPath,
    groupDefaultExpanded: 1,
    animateRows: true,
    getRowId: (params: any) => params?.data?.id != null ? String(params.data.id) : undefined,
    suppressRowClickSelection: true,
    rowDragManaged: true,
    onCellDoubleClicked: (params: any) => {
      if (params?.colDef?.field === 'spot_type_color' && params?.data?.spot_type_id) {
        const type = (spotTypes as any[]).find((t) => t.id === params.data.spot_type_id);
        if (type) {
          setEditingSpotType({ id: type.id, name: type.name });
          setEditingSpotTypeColor(type.color || '#000000');
          setIsEditSpotTypeOpen(true);
        }
      }
    },
    onRowDragEnd: async (event: any) => {
      const dragged = event?.node?.data;
      if (!dragged) return;
      const overNode = event?.overNode;
      const newParentId: number | null = overNode?.data?.id ?? null;
      if (newParentId === dragged.id) return; // cannot parent to self

      // Build quick lookup for cycle prevention
      const spotById = new Map<number, Spot>(spots.map(s => [s.id, s]));
      const isDescendantOf = (childId: number, ancestorId: number): boolean => {
        let current = spotById.get(childId)?.parent_id ?? null;
        const visited = new Set<number>();
        while (current != null) {
          if (current === ancestorId) return true;
          if (visited.has(current)) break; // guard
          visited.add(current);
          current = spotById.get(current)?.parent_id ?? null;
        }
        return false;
      };

      if (newParentId != null && isDescendantOf(newParentId, dragged.id)) {
        return; // prevent cycles
      }

      // Only update if parent actually changed
      const currentParent = spotById.get(dragged.id)?.parent_id ?? null;
      if (currentParent !== newParentId) {
        await updateItem(dragged.id, { parent_id: newParentId });
      }
    }
  }), [spotTypes, spots, updateItem]);

  // No auto group column; first column renders the hierarchy

  const rowSelection = useMemo(() => ({
    mode: 'multiRow',
    groupSelects: 'filteredDescendants' as const,
  }), []);

  // Spot Type quick edit dialog state
  const [isEditSpotTypeOpen, setIsEditSpotTypeOpen] = useState(false);
  const [editingSpotType, setEditingSpotType] = useState<{ id: number; name: string } | null>(null);
  const [editingSpotTypeColor, setEditingSpotTypeColor] = useState<string>("#000000");

  const handleUpdateSpotType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSpotType) return;
    await dispatch((genericActions as any).spotTypes.updateAsync({ id: editingSpotType.id, updates: { color: editingSpotTypeColor } }));
    setIsEditSpotTypeOpen(false);
    setEditingSpotType(null);
  };

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

  // Define tabs for URL persistence
  const spotsTabs = [
    {
      value: 'main',
      label: 'Spots',
      content: (
        <div className="flex-1 min-h-0 flex flex-col space-y-4">
          <SettingsGrid
            rowData={searchableHierarchyData}
            columnDefs={colDefs}
            gridOptions={gridOptions}
            rowSelection={rowSelection as any}
            noRowsMessage="No spots found"
            onRowDoubleClicked={handleEdit}
            className="flex-1 min-h-0"
            height="100%"
          />
        </div>
      )
    },
    {
      value: 'branches',
      label: 'Branches',
      content: (
        <div className="flex-1 min-h-0 flex flex-col space-y-4">
          <SettingsGrid
            rowData={searchableHierarchyData.filter((s: any) => s.is_branch)}
            columnDefs={colDefs}
            gridOptions={gridOptions}
            rowSelection={rowSelection as any}
            noRowsMessage="No branches found"
            onRowDoubleClicked={handleEdit}
            className="flex-1 min-h-0"
            height="100%"
          />
        </div>
      )
    }
  ];

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
      <UrlTabs
        tabs={spotsTabs}
        defaultValue="main"
        basePath="/settings/spots"
        className="flex-1 h-full flex flex-col"
      />

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
            <SelectField
              id="parent_id"
              label="Parent Spot"
              value={createFormData.parent_id || ROOT_VALUE}
              onChange={(value) => setCreateFormData(prev => ({ ...prev, parent_id: value === ROOT_VALUE ? '' : value }))}
              options={parentSpotOptions}
              placeholder="None (Root)"
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
            <SelectField
              id="edit-parent_id"
              label="Parent Spot"
              value={editFormData.parent_id || ROOT_VALUE}
              onChange={(value) => setEditFormData(prev => ({ ...prev, parent_id: value === ROOT_VALUE ? '' : value }))}
              options={editParentSpotOptions}
              placeholder="None (Root)"
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

      {/* Edit Spot Type Color Dialog */}
      <SettingsDialog
        open={isEditSpotTypeOpen}
        onOpenChange={setIsEditSpotTypeOpen}
        type="edit"
        title={editingSpotType ? `Edit Spot Type: ${editingSpotType.name}` : 'Edit Spot Type'}
        description="Update the spot type color."
        onSubmit={handleUpdateSpotType}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!editingSpotType}
      >
        {editingSpotType && (
          <div className="grid gap-4">
            <TextField
              id="edit-spot-type-name"
              label="Name"
              value={editingSpotType.name}
              onChange={(value) => setEditingSpotType(prev => prev ? { ...prev, name: value } : prev)}
              required
            />
            <TextField
              id="edit-spot-type-color"
              label="Color"
              type="color"
              value={editingSpotTypeColor}
              onChange={(value) => setEditingSpotTypeColor(value)}
              required
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