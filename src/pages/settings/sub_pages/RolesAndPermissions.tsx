import { useMemo, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShieldAlt, faPlus } from "@fortawesome/free-solid-svg-icons";
import type { ColDef } from "ag-grid-community";
import type { Role, Permission, RolePermission } from "@/store/types";
import { AppDispatch, RootState } from "@/store/store";
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

  // Load roles and permissions data on mount
  useEffect(() => {
    dispatch((genericActions as any).roles.getFromIndexedDB());
    dispatch((genericActions as any).roles.fetchFromAPI());
    dispatch((genericActions as any).permissions.getFromIndexedDB());
    dispatch((genericActions as any).permissions.fetchFromAPI());
    dispatch((genericActions as any).rolePermissions.getFromIndexedDB());
    dispatch((genericActions as any).rolePermissions.fetchFromAPI());
  }, [dispatch]);

  const { value: permissions = [], loading: permissionsLoading } = useSelector((state: RootState) =>
    state.permissions as { value: Permission[]; loading: boolean }
  );

  const { value: rolePermissions = [] } = useSelector((state: RootState) =>
    state.rolePermissions as { value: RolePermission[] }
  );

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
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [isSavingPerms, setIsSavingPerms] = useState(false);

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

  // Sync selected permissions when role changes in modal
  useEffect(() => {
    if (!selectedRoleId) {
      setSelectedPermIds(new Set());
      return;
    }
    const current = rolePermissions
      .filter((rp: RolePermission) => rp.role_id === selectedRoleId)
      .map((rp: RolePermission) => String(rp.permission_id));
    setSelectedPermIds(new Set(current));
  }, [selectedRoleId, rolePermissions]);

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};

    permissions.forEach((perm) => {
      // Derive group from key/name/resource; last token after delimiters is the entity (e.g., archive-tasks -> tasks)
      const raw = (perm as any).key || perm.name || [perm.action, perm.resource].filter(Boolean).join('-');
      const tokens = (raw || '')
        .replace(/[.:/]/g, '-')
        .split('-')
        .filter(Boolean);

      const entity =
        (tokens.length >= 2 && tokens[tokens.length - 1]) ||
        perm.resource ||
        tokens[0] ||
        'otros';

      const groupKey = entity.trim().toLowerCase() || 'otros';

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(perm);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, perms]) => ({
        group,
        perms: perms.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      }));
  }, [permissions]);

  const togglePermission = (id: number | string) => {
    const key = String(id);
    setSelectedPermIds(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allIds = permissions
      .map((p) => p.id)
      .filter((id) => id !== undefined && id !== null)
      .map((id) => String(id));
    setSelectedPermIds(new Set(allIds));
  };

  const handleClearAll = () => {
    setSelectedPermIds(new Set());
  };

  const handleSavePermissions = useCallback(async () => {
    if (!selectedRoleId) return;
    try {
      setIsSavingPerms(true);
      const existing = rolePermissions.filter((rp: RolePermission) => rp.role_id === selectedRoleId);
      const existingIds = existing.map((rp: RolePermission) => rp.permission_id);
      const desired = Array.from(selectedPermIds).map((id) => Number(id));

      const toAdd = desired.filter((id) => !existingIds.includes(id));
      const toRemove = existing.filter((rp) => !desired.includes(rp.permission_id));

      for (const permission_id of toAdd) {
        await dispatch((genericActions as any).rolePermissions.addAsync({ role_id: selectedRoleId, permission_id })).unwrap();
      }
      for (const rp of toRemove) {
        await dispatch((genericActions as any).rolePermissions.removeAsync(rp.id)).unwrap();
      }

      setIsPermissionsDialogOpen(false);
    } finally {
      setIsSavingPerms(false);
    }
  }, [dispatch, rolePermissions, selectedPermIds, selectedRoleId]);

  const handleOpenPermissions = useCallback((role: Role) => {
    setSelectedRoleId(role.id);
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
      loading={{ isLoading: loading || permissionsLoading, message: tu('loading', 'Loading roles...') }}
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

      {/* Permissions Dialog */}
      <SettingsDialog
        open={isPermissionsDialogOpen}
        onOpenChange={setIsPermissionsDialogOpen}
        type="custom"
        title={tu('permissionsDialog.title', 'Assign permissions')}
        description={selectedRoleName ? tu('permissionsDialog.description', `Configure permissions for "${selectedRoleName}"`) : tu('permissionsDialog.description', 'Configure permissions')}
        onSubmit={(e) => { e.preventDefault(); handleSavePermissions(); }}
        isSubmitting={isSavingPerms}
        submitDisabled={isSavingPerms || !selectedRoleId}
        submitText={tu('permissionsDialog.save', 'Save')}
      >
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="text-sm text-muted-foreground">
            {tu('permissionsDialog.hint', 'Select the permissions for this role')}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleSelectAll} disabled={permissions.length === 0}>
              {tu('permissionsDialog.selectAll', 'Select all')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={handleClearAll} disabled={selectedPermIds.size === 0}>
              {tu('permissionsDialog.clearAll', 'Clear')}
            </Button>
          </div>
        </div>
        <div className="max-h-[70vh] overflow-auto pr-2">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {groupedPermissions.map(({ group, perms }) => (
              <div key={group} className="border rounded-lg p-3 bg-muted/30">
                <div className="font-semibold mb-3 capitalize text-center">{group}</div>
                <div className="grid gap-2">
                  {perms.map((perm) => {
                    const raw = (perm as any).key || perm.name || [perm.action, perm.resource].filter(Boolean).join('-');
                    const tokens = (raw || '').replace(/[.:/]/g, '-').split('-').filter(Boolean);
                    const actionLabel = (tokens[0] || perm.action || '').toUpperCase();
                    const displayName = actionLabel || `Permission ${perm.id}`;

                    return (
                      <label key={perm.id} className="flex items-center gap-2 rounded border border-border/70 bg-background px-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPermIds.has(String(perm.id))}
                          onChange={() => togglePermission(perm.id)}
                          className="h-4 w-4 accent-primary"
                        />
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex min-w-[72px] justify-center items-center rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase border ${
                              selectedPermIds.has(String(perm.id))
                                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }`}
                          >
                            {displayName}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
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

