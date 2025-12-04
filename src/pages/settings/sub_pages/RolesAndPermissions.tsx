import { useMemo, useState, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShieldAlt, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { ColDef } from "ag-grid-community";
import type { Role } from "@/store/types";
import { AppDispatch } from "@/store/store";
import { genericActions } from "@/store/genericSlices";
import { Button } from "@/components/ui/button";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  TextField,
  TextAreaField
} from "../components";
import { useLanguage } from "@/providers/LanguageProvider";

function RolesAndPermissions() {
  const { t } = useLanguage();
  const tu = (key: string, fallback: string) => t(`settings.rolesAndPermissions.${key}`, fallback);
  const dispatch = useDispatch<AppDispatch>();

  // Load roles data on mount
  useEffect(() => {
    dispatch((genericActions as any).roles.getFromIndexedDB());
    dispatch((genericActions as any).roles.fetchFromAPI());
  }, [dispatch]);

  const {
    filteredItems,
    loading,
    error,
    searchQuery,
    setSearchQuery,
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
  } = useSettingsState<Role>({
    entityName: "roles",
    searchFields: ["name", "description"]
  });

  // Form state for controlled components
  const [createFormData, setCreateFormData] = useState<{
    name: string;
    description: string;
  }>({
    name: '',
    description: ''
  });

  const [editFormData, setEditFormData] = useState<{
    name: string;
    description: string;
  }>({
    name: '',
    description: ''
  });

  // Permissions modal state
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedRoleName, setSelectedRoleName] = useState<string>('');

  // Reset create form when dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      setCreateFormData({
        name: '',
        description: ''
      });
    }
  }, [isCreateDialogOpen]);

  // Update edit form data when editing item changes
  useEffect(() => {
    if (editingItem) {
      setEditFormData({
        name: editingItem.name || '',
        description: editingItem.description || ''
      });
    }
  }, [editingItem]);

  const handleOpenPermissions = useCallback((role: Role) => {
    setSelectedRoleName(role.name || '');
    setIsPermissionsDialogOpen(true);
  }, []);

  const columns = useMemo<ColDef[]>(() => [
    {
      field: "name",
      headerName: tu('grid.name', 'Name'),
      flex: 2,
      minWidth: 200
    },
    {
      field: "description",
      headerName: tu('grid.description', 'Description'),
      flex: 3,
      minWidth: 300,
      cellRenderer: (params: any) => {
        const desc = params?.value;
        return desc ? (
          <span className="text-muted-foreground">{desc}</span>
        ) : (
          <span className="text-muted-foreground italic">{tu('grid.noDescription', 'No description')}</span>
        );
      }
    },
    {
      field: "created_at",
      headerName: tu('grid.createdAt', 'Created At'),
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: any) => {
        const date = params?.value;
        if (!date) return '-';
        return new Date(date).toLocaleDateString();
      }
    },
    {
      field: "actions",
      headerName: tu('grid.actions', 'Actions'),
      width: 260,
      suppressSizeToFit: true,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDelete,
        customActions: [
          {
            icon: faShieldAlt,
            label: tu('grid.permissions', 'Permissions'),
            variant: "outline",
            className: "px-2 h-8",
            onClick: (row: Role) => handleOpenPermissions(row)
          }
        ]
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: "right"
    }
  ], [handleEdit, handleDelete, handleOpenPermissions, tu]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: createFormData.name.trim(),
      description: createFormData.description.trim() || null
    } as Omit<Role, "id" | "created_at" | "updated_at" | "deleted_at" | "workspace_id">;

    await createItem(data as any);

    // Reset form after successful creation
    setCreateFormData({
      name: '',
      description: ''
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const updates = {
      name: editFormData.name.trim(),
      description: editFormData.description.trim() || null
    } as Partial<Role>;

    await updateItem(editingItem.id, updates);
  };

  const renderRolePreview = (role: Role) => (
    <div className="flex items-center space-x-3">
      <FontAwesomeIcon icon={faShieldAlt} className="w-5 h-5 text-muted-foreground" />
      <div>
        <div className="font-medium">{role.name}</div>
        {role.description && (
          <div className="text-xs text-muted-foreground">{role.description}</div>
        )}
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title={tu('title', 'Roles and Permissions')}
      description={tu('description', 'Manage user roles and permissions')}
      icon={faShieldAlt}
      iconColor="#6366f1"
      backPath="/settings"
      loading={{ isLoading: loading, message: tu('loading', 'Loading roles...') }}
      error={error ? { message: error, onRetry: () => window.location.reload() } : undefined}
      search={{
        placeholder: tu('searchPlaceholder', 'Search roles...'),
        value: searchQuery,
        onChange: setSearchQuery
      }}
      headerActions={
        <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
          <FontAwesomeIcon icon={faPlus} className="mr-2" />
          {tu('addRole', 'Add Role')}
        </Button>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 min-h-0">
          <SettingsGrid
            rowData={filteredItems.filter((item: Role) => 
              !searchQuery || 
              item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
              item.description?.toLowerCase().includes(searchQuery.toLowerCase())
            )}
            columnDefs={columns}
            onRowDoubleClicked={handleEdit}
            gridOptions={{}}
            noRowsMessage={tu('noRoles', 'No roles found')}
            zebraRows={true}
          />
        </div>
      </div>

      {/* Create Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title={tu('createDialog.title', 'Add New Role')}
        description={tu('createDialog.description', 'Create a new role for your organization.')}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !createFormData.name.trim()}
      >
        <div className="grid gap-4">
          <TextField
            id="name"
            label={tu('form.name', 'Name')}
            value={createFormData.name}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, name: value }))}
            required
            placeholder={tu('form.namePlaceholder', 'Enter role name')}
          />
          <TextAreaField
            id="description"
            label={tu('form.description', 'Description')}
            value={createFormData.description}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, description: value }))}
            placeholder={tu('form.descriptionPlaceholder', 'Enter role description (optional)')}
            rows={3}
          />
        </div>
      </SettingsDialog>

      {/* Edit Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title={tu('editDialog.title', 'Edit Role')}
        description={tu('editDialog.description', 'Update the role information.')}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingItem || !editFormData.name.trim()}
      >
        {editingItem && (
          <div className="grid gap-4">
            <TextField
              id="edit-name"
              label={tu('form.name', 'Name')}
              value={editFormData.name}
              onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
              required
              placeholder={tu('form.namePlaceholder', 'Enter role name')}
            />
            <TextAreaField
              id="edit-description"
              label={tu('form.description', 'Description')}
              value={editFormData.description}
              onChange={(value) => setEditFormData(prev => ({ ...prev, description: value }))}
              placeholder={tu('form.descriptionPlaceholder', 'Enter role description (optional)')}
              rows={3}
            />
          </div>
        )}
      </SettingsDialog>

      {/* Permissions Dialog (empty for now) */}
      <SettingsDialog
        open={isPermissionsDialogOpen}
        onOpenChange={setIsPermissionsDialogOpen}
        type="custom"
        title={tu('permissionsDialog.title', 'Assign permissions')}
        description={selectedRoleName ? tu('permissionsDialog.description', `Configure permissions for "${selectedRoleName}"`) : tu('permissionsDialog.description', 'Configure permissions')}
        onSubmit={(e) => { e.preventDefault(); setIsPermissionsDialogOpen(false); }}
        isSubmitting={false}
        submitDisabled={false}
        submitText={tu('permissionsDialog.close', 'Close')}
      >
        <div className="min-h-[120px] flex items-center justify-center text-muted-foreground text-sm">
          {tu('permissionsDialog.empty', 'Permissions UI coming soon.')}
        </div>
      </SettingsDialog>

      {/* Delete Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tu('deleteDialog.title', 'Delete Role')}
        description={deletingItem ? tu('deleteDialog.description', `Are you sure you want to delete the role "${deletingItem.name}"? This action cannot be undone.`) : undefined}
        onConfirm={() => deletingItem ? deleteItem(deletingItem.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingItem}
        entityName="role"
        entityData={deletingItem as any}
        renderEntityPreview={(role: Role) => renderRolePreview(role)}
      />
    </SettingsLayout>
  );
}

export default RolesAndPermissions;

