import { useMemo } from "react";
import { useSelector } from "react-redux";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpWideShort, faPlus } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import type { Priority } from "@/store/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  ColorIndicatorCellRenderer
} from "../components";

const PriorityNameCellRenderer = (props: ICellRendererParams) => {
  const name = props.data?.name as string;
  const color = props.data?.color as string | undefined;
  return (
    <ColorIndicatorCellRenderer value={name} name={name} color={color || "#6b7280"} />
  );
};

function Priorities() {
  const { value: priorities } = useSelector((state: RootState) => state.priorities);

  const {
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
    editingItem,
    deletingItem,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Priority>({
    entityName: "priorities",
    searchFields: ["name"]
  });

  const columns = useMemo<ColDef[]>(() => [
    {
      field: "name",
      headerName: "Priority",
      flex: 2,
      minWidth: 200,
      cellRenderer: PriorityNameCellRenderer
    },
    {
      field: "level",
      headerName: "Level",
      width: 100,
      sortable: true,
      filter: true
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 120,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDelete
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right"
    }
  ], [handleEdit, handleDelete]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const data = {
      name: String(formData.get("name") || ""),
      color: String(formData.get("color") || "#6b7280"),
      level: formData.get("level") ? parseInt(String(formData.get("level"))) : null
    } as Omit<Priority, "id" | "created_at" | "updated_at">;
    await createItem(data as any);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const updates = {
      name: String(formData.get("name") || editingItem.name),
      color: String(formData.get("color") || editingItem.color || "#6b7280"),
      level: formData.get("level") ? parseInt(String(formData.get("level"))) : editingItem.level ?? null
    } as Partial<Priority>;
    await updateItem(editingItem.id, updates);
  };

  const renderPriorityPreview = (p: Priority) => (
    <div className="flex items-center space-x-3">
      <div
        className="w-6 h-6 rounded-full border"
        style={{ backgroundColor: p.color || "#6b7280" }}
      />
      <div>
        <div className="font-medium">{p.name}</div>
        {typeof p.level === "number" && (
          <div className="text-xs text-muted-foreground">Level {p.level}</div>
        )}
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title="Priorities"
      description="Manage priority levels used across tasks and templates"
      icon={faArrowUpWideShort}
      iconColor="#ef4444"
      backPath="/settings"
      search={{
        placeholder: "Search priorities...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{ isLoading: loading, message: "Loading priorities..." }}
      error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
      statistics={{
        title: "Priority Statistics",
        items: [
          { label: "Total Priorities", value: priorities.length },
        ]
      }}
      headerActions={
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          Add Priority
        </Button>
      }
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={columns}
        noRowsMessage="No priorities found"
      />

      {/* Create Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add New Priority"
        description="Create a new priority level."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <input id="name" name="name" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" required />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="color" className="text-right">Color</Label>
            <input id="color" name="color" type="color" defaultValue="#ef4444" className="col-span-3 h-9 w-16 p-0 border-0 bg-transparent" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="level" className="text-right">Level</Label>
            <input id="level" name="level" type="number" min="0" className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" placeholder="Optional numeric level" />
          </div>
        </div>
      </SettingsDialog>

      {/* Edit Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit Priority"
        description="Update the priority information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingItem}
      >
        {editingItem && (
          <div className="grid gap-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name *</Label>
              <input id="edit-name" name="name" defaultValue={editingItem.name} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" required />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-color" className="text-right">Color</Label>
              <input id="edit-color" name="color" type="color" defaultValue={(editingItem.color as string) || "#ef4444"} className="col-span-3 h-9 w-16 p-0 border-0 bg-transparent" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-level" className="text-right">Level</Label>
              <input id="edit-level" name="level" type="number" min="0" defaultValue={typeof editingItem.level === "number" ? editingItem.level : undefined} className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm" />
            </div>
          </div>
        )}
      </SettingsDialog>

      {/* Delete Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Priority"
        description={deletingItem ? `Are you sure you want to delete the priority "${deletingItem.name}"? This action cannot be undone.` : undefined}
        onConfirm={() => deletingItem ? deleteItem(deletingItem.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingItem}
        entityName="priority"
        entityData={deletingItem as any}
        renderEntityPreview={(p: Priority) => renderPriorityPreview(p)}
      />
    </SettingsLayout>
  );
}

export default Priorities;


