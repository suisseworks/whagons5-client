import { useMemo, useEffect } from "react";
import { useDispatch } from "react-redux";
import { ColDef } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLayerGroup, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
// import { RootState } from "@/store/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  ColorIndicatorCellRenderer
} from "../components";
import { AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";

type SpotType = { id: number; name: string; description?: string | null; color?: string | null };

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
  // Remove the single useEffect for spotTypes loading.

  const SpotTypeNameCellRenderer = (params: any) => {
    const name = params.data?.name as string;
    const color = (params.data?.color as string) || '#6b7280';
    return (
      <ColorIndicatorCellRenderer value={name} name={name} color={color} />
    );
  };

  const colDefs = useMemo<ColDef[]>(() => [
    { field: 'name', headerName: 'Name', flex: 2, minWidth: 180, cellRenderer: SpotTypeNameCellRenderer },
    { field: 'description', headerName: 'Description', flex: 3, minWidth: 220 },
    {
      field: 'actions', headerName: 'Actions', width: 120,
      cellRenderer: () => null,
      sortable: false, filter: false, resizable: false, pinned: 'right'
    }
  ], [handleEdit, handleDelete]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = new FormData(e.target as HTMLFormElement);
    const payload = {
      name: String(form.get('name') || ''),
      description: String(form.get('description') || '') || null,
      color: String(form.get('color') || '#10b981')
    } as any;
    await createItem(payload);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const form = new FormData(e.target as HTMLFormElement);
    const updates = {
      name: String(form.get('name') || ''),
      description: String(form.get('description') || '') || null,
      color: String(form.get('color') || (editingItem as any).color || '#10b981')
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
      search={{ placeholder: 'Search spot types...', value: searchQuery, onChange: (v: string) => { setSearchQuery(v); handleSearch(v); } }}
      loading={{ isLoading: loading, message: 'Loading spot types...' }}
      error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
      statistics={{ title: 'Spot Types', description: 'Overview', items: [{ label: 'Total Types', value: items.length }] }}
      headerActions={
        <Button 
          size="default"
          className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
          onClick={() => setIsCreateDialogOpen(true)}
        >
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Add Spot Type
        </Button>
      }
    >
      <div className="flex-1 min-h-0">
        <SettingsGrid
          rowData={filteredItems}
          columnDefs={colDefs}
          noRowsMessage="No spot types found"
          onRowDoubleClicked={handleEdit}
        />
      </div>

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
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="color" className="text-right">Color</Label>
            <Input id="color" name="color" type="color" defaultValue="#10b981" className="col-span-3 h-9 p-1" />
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
        footerActions={
          editingItem ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={() => {
                setIsEditDialogOpen(false);
                handleDelete(editingItem);
              }}
              disabled={isSubmitting}
              title="Delete Spot Type"
              aria-label="Delete Spot Type"
            >
              <FontAwesomeIcon icon={faTrash} />
            </Button>
          ) : null
        }
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-color" className="text-right">Color</Label>
              <Input id="edit-color" name="color" type="color" defaultValue={(editingItem as any).color || '#10b981'} className="col-span-3 h-9 p-1" />
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


