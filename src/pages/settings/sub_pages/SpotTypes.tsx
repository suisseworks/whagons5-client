import { useMemo, useEffect } from "react";
import { useDispatch } from "react-redux";
import { ColDef } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup, faPlus } from "@fortawesome/free-solid-svg-icons";
// import { RootState } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer
} from "../components";
import { AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";

type SpotType = { id: number; name: string; description?: string | null };

function SpotTypes() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items,
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    handleSearch,
    createItem,
    updateItem,
    // deleteItem,
    isSubmitting,
    formError,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    editingItem,
    deletingItem,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<SpotType>({
    entityName: 'spotTypes',
    searchFields: ['name', 'description']
  });

  // Fast hydration (IndexedDB -> Redux) then background network refresh
  useEffect(() => {
    dispatch(genericActions.spotTypes.getFromIndexedDB());
    dispatch(genericActions.spotTypes.fetchFromAPI({ per_page: 1000 }));
  }, [dispatch]);

  const colDefs = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Name', flex: 2, minWidth: 180 },
    { field: 'description', headerName: 'Description', flex: 3, minWidth: 220 },
    {
      field: 'actions', headerName: 'Actions', width: 120,
      cellRenderer: createActionsCellRenderer({ onEdit: handleEdit, onDelete: handleDelete }),
      sortable: false, filter: false, resizable: false, pinned: 'right'
    }
  ], [handleEdit, handleDelete]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const payload = {
      name: String(form.get('name') || ''),
      description: String(form.get('description') || '') || null
    } as any;
    await createItem(payload);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const form = new FormData(e.target as HTMLFormElement);
    const updates = {
      name: String(form.get('name') || ''),
      description: String(form.get('description') || '') || null
    } as any;
    await updateItem((editingItem as any).id, updates);
  };

  return (
    <SettingsLayout
      title="Spot Types"
      description="Manage the list of spot types used by Spots"
      icon={faLayerGroup}
      iconColor="#6366f1"
      backPath="/settings/spots"
      breadcrumbs={[
        { label: 'Spots', path: '/settings/spots' }
      ]}
      search={{ placeholder: 'Search spot types...', value: searchQuery, onChange: (v: string) => { setSearchQuery(v); handleSearch(v); } }}
      loading={{ isLoading: loading, message: 'Loading spot types...' }}
      error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
      statistics={{ title: 'Spot Types', description: 'Overview', items: [{ label: 'Total Types', value: items.length }] }}
      headerActions={
        <Button size="sm" onClick={() => setIsCreateDialogOpen(true)}>
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Add Spot Type
        </Button>
      }
    >
      <SettingsGrid rowData={filteredItems} columnDefs={colDefs} noRowsMessage="No spot types found" />

      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add Spot Type"
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <Input id="name" name="name" className="col-span-3" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Input id="description" name="description" className="col-span-3" />
          </div>
        </div>
      </SettingsDialog>

      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit Spot Type"
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!editingItem}
      >
        {editingItem && (
          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name *</Label>
              <Input id="edit-name" name="name" defaultValue={(editingItem as any).name} className="col-span-3" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">Description</Label>
              <Input id="edit-description" name="description" defaultValue={(editingItem as any).description || ''} className="col-span-3" />
            </div>
          </div>
        )}
      </SettingsDialog>

      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Spot Type"
        entityName="spot type"
        entityData={deletingItem}
      />
    </SettingsLayout>
  );
}

export default SpotTypes;


