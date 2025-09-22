import { useMemo, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { ColDef, ICellRendererParams } from "ag-grid-community";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowUpWideShort, faPlus } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import type { Priority } from "@/store/types";
import { Button } from "@/components/ui/button";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  ColorIndicatorCellRenderer,
  TextField
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

  // Form state for controlled components
  const [createFormData, setCreateFormData] = useState<{
    name: string;
    color: string;
    level: string;
  }>({
    name: '',
    color: '#ef4444',
    level: ''
  });

  const [editFormData, setEditFormData] = useState<{
    name: string;
    color: string;
    level: string;
  }>({
    name: '',
    color: '#ef4444',
    level: ''
  });

  // Update edit form data when editing item changes
  useEffect(() => {
    if (editingItem) {
      setEditFormData({
        name: editingItem.name || '',
        color: editingItem.color || '#ef4444',
        level: editingItem.level?.toString() || ''
      });
    }
  }, [editingItem]);

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

    const data = {
      name: createFormData.name,
      color: createFormData.color,
      level: createFormData.level ? parseInt(createFormData.level) : null
    } as Omit<Priority, "id" | "created_at" | "updated_at">;

    await createItem(data as any);

    // Reset form after successful creation
    setCreateFormData({
      name: '',
      color: '#ef4444',
      level: ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const updates = {
      name: editFormData.name,
      color: editFormData.color,
      level: editFormData.level ? parseInt(editFormData.level) : editingItem.level ?? null
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
          <TextField
            id="name"
            label="Name"
            value={createFormData.name}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, name: value }))}
            required
          />
          <TextField
            id="color"
            label="Color"
            type="color"
            value={createFormData.color}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, color: value }))}
          />
          <TextField
            id="level"
            label="Level"
            type="number"
            min="0"
            value={createFormData.level}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, level: value }))}
            placeholder="Optional numeric level"
          />
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
            <TextField
              id="edit-name"
              label="Name"
              value={editFormData.name}
              onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
              required
            />
            <TextField
              id="edit-color"
              label="Color"
              type="color"
              value={editFormData.color}
              onChange={(value) => setEditFormData(prev => ({ ...prev, color: value }))}
            />
            <TextField
              id="edit-level"
              label="Level"
              type="number"
              min="0"
              value={editFormData.level}
              onChange={(value) => setEditFormData(prev => ({ ...prev, level: value }))}
            />
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


