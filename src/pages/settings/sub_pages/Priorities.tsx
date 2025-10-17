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
  TextField,
  SelectField
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
  const { value: categories } = useSelector((state: RootState) => state.categories);

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
    category_id: string;
  }>({
    name: '',
    color: '#ef4444',
    category_id: ''
  });

  const [editFormData, setEditFormData] = useState<{
    name: string;
    color: string;
    category_id: string;
  }>({
    name: '',
    color: '#ef4444',
    category_id: ''
  });

  // Update edit form data when editing item changes
  useEffect(() => {
    if (editingItem) {
      setEditFormData({
        name: editingItem.name || '',
        color: editingItem.color || '#ef4444',
        category_id: editingItem.category_id?.toString() || ''
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
      colId: "category_name",
      headerName: "Category",
      flex: 2,
      minWidth: 200,
      rowGroup: true,
      rowGroupIndex: 0,
      valueGetter: (params: any) => {
        const catId = params.data?.category_id as number | null | undefined;
        if (!catId) return 'Unassigned';
        const cat = (categories as any[])?.find((c: any) => c.id === Number(catId));
        return cat?.name || 'Unassigned';
      },
      cellRenderer: (params: ICellRendererParams) => {
        const catId = params.data?.category_id as number | null | undefined;
        if (!catId) {
          return <span className="text-muted-foreground">Unassigned</span>;
        }
        const cat = (categories as any[])?.find((c: any) => c.id === Number(catId));
        if (!cat) {
          return <span className="text-muted-foreground">Unassigned</span>;
        }
        return (
          <ColorIndicatorCellRenderer value={cat.name} name={cat.name} color={cat.color || "#6b7280"} />
        );
      },
      comparator: (a: any, b: any) => String(a || '').localeCompare(String(b || '')),
      sortable: true,
      filter: true
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 100, // Fixed compact width for icons only
      suppressSizeToFit: true, // Lock size, no auto-expansion
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDelete
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right"
    }
  ], [handleEdit, handleDelete, categories]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: createFormData.name,
      color: createFormData.color,
      category_id: createFormData.category_id ? parseInt(createFormData.category_id) : null
    } as Omit<Priority, "id" | "created_at" | "updated_at">;

    await createItem(data as any);

    // Reset form after successful creation
    setCreateFormData({
      name: '',
      color: '#ef4444',
      category_id: ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const updates = {
      name: editFormData.name,
      color: editFormData.color,
      category_id: editFormData.category_id ? parseInt(editFormData.category_id) : editingItem.category_id ?? null
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
        onRowClicked={handleEdit}
        gridOptions={{
          groupDisplayType: 'groupRows',
          groupDefaultExpanded: -1
        }}
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
          <SelectField
            id="category"
            label="Category"
            value={createFormData.category_id}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, category_id: value }))}
            placeholder="Unassigned"
            options={(categories as any[])?.map((c: any) => ({ value: c.id.toString(), label: c.name }))}
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
            <SelectField
              id="edit-category"
              label="Category"
              value={editFormData.category_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, category_id: value }))}
              placeholder="Unassigned"
              options={(categories as any[])?.map((c: any) => ({ value: c.id.toString(), label: c.name }))}
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


