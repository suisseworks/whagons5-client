import { useMemo, useState, useEffect, useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShieldAlt, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import type { ColDef } from "ag-grid-community";
import type { Role, Permission, RolePermission } from "@/store/types";
import { AppDispatch, RootState } from "@/store/store";
import { genericActions } from "@/store/genericSlices";
import { Button } from "@/components/ui/button";
import api from "@/api/whagonsApi";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  TextField,
  TextAreaField,
  SelectField
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
    scope: 'GLOBAL' | 'TEAM';
  }>({
    name: '',
    description: '',
    scope: 'TEAM'
  });

  const [editFormData, setEditFormData] = useState<{
    name: string;
    description: string;
    scope: 'GLOBAL' | 'TEAM';
  }>({
    name: '',
    description: '',
    scope: 'TEAM'
  });

  // Permissions modal state
  const [isPermissionsDialogOpen, setIsPermissionsDialogOpen] = useState(false);
  const [selectedRoleName, setSelectedRoleName] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<Set<string>>(new Set());
  const [isSavingPerms, setIsSavingPerms] = useState(false);
  const [isLoadingRolePerms, setIsLoadingRolePerms] = useState(false);
  const [activePermTab, setActivePermTab] = useState<'general' | 'settings'>('general');

  // Reset create form when dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      setCreateFormData({
        name: '',
        description: '',
        scope: 'TEAM'
      });
    }
  }, [isCreateDialogOpen]);

  // Update edit form data when editing item changes
  useEffect(() => {
    if (editingItem) {
      setEditFormData({
        name: editingItem.name || '',
        description: editingItem.description || '',
        scope: (editingItem as any).scope || 'TEAM'
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

  const generalGroups = useMemo(
    () => groupedPermissions.filter(({ group }) => ['tasks', 'workspaces'].includes(group)),
    [groupedPermissions]
  );
  const settingsGroups = useMemo(
    () => groupedPermissions.filter(({ group }) => !['tasks', 'workspaces'].includes(group)),
    [groupedPermissions]
  );

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

  const getGroupIds = (perms: Permission[]) =>
    perms
      .map((p) => p.id)
      .filter((id) => id !== undefined && id !== null)
      .map((id) => String(id));

  const handleSelectGroup = (perms: Permission[]) => {
    const groupIds = getGroupIds(perms);
    setSelectedPermIds(prev => {
      const next = new Set(prev);
      groupIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleClearGroup = (perms: Permission[]) => {
    const groupIds = new Set(getGroupIds(perms));
    setSelectedPermIds(prev => {
      const next = new Set(prev);
      groupIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const getGroupSelectionState = (perms: Permission[]) => {
    if (perms.length === 0) return { selectedCount: 0, isAllSelected: false };
    const selectedCount = perms.reduce(
      (count, perm) => count + (selectedPermIds.has(String(perm.id)) ? 1 : 0),
      0
    );
    return { selectedCount, isAllSelected: selectedCount === perms.length };
  };

  const handleSavePermissions = useCallback(async () => {
    if (!selectedRoleId) return;
    try {
      setIsSavingPerms(true);
      // Convert selected IDs to permission names (Spatie sync expects names)
      const selectedNames = Array.from(selectedPermIds)
        .map((idStr) => permissions.find((p) => String(p.id) === idStr)?.name)
        .filter((name): name is string => Boolean(name));

      await api.put(`/roles/${selectedRoleId}/permissions`, {
        permissions: selectedNames,
      });

      setIsPermissionsDialogOpen(false);
    } finally {
      setIsSavingPerms(false);
    }
  }, [permissions, selectedPermIds, selectedRoleId]);

  const handleOpenPermissions = useCallback((role: Role) => {
    setSelectedRoleId(role.id);
    setSelectedRoleName(role.name || '');
    // Fetch current permissions from backend for this role
    (async () => {
      try {
        setIsLoadingRolePerms(true);
        const resp = await api.get(`/roles/${role.id}/permissions`);
        const names: string[] = resp?.data?.permissions || [];
        const ids = permissions
          .filter((p) => names.includes(p.name))
          .map((p) => String(p.id));
        setSelectedPermIds(new Set(ids));
      } catch (error) {
        console.error('Failed to load role permissions', error);
        setSelectedPermIds(new Set());
      } finally {
        setIsLoadingRolePerms(false);
      }
    })();
    setIsPermissionsDialogOpen(true);
  }, [permissions]);

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
      field: "scope",
      headerName: tu('grid.scope', 'Scope'),
      flex: 1,
      minWidth: 120,
      cellRenderer: (params: any) => {
        const scope = params?.data?.scope || 'TEAM';
        const isGlobal = scope === 'GLOBAL';
        return (
          <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
            isGlobal 
              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
              : 'bg-purple-100 text-purple-800 border border-purple-200'
          }`}>
            {isGlobal ? tu('grid.scopeGlobal', 'Global') : tu('grid.scopeTeam', 'Team')}
          </span>
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
  ], [handleEdit, handleOpenPermissions, tu]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: createFormData.name.trim(),
      description: createFormData.description.trim() || null,
      scope: createFormData.scope
    } as Omit<Role, "id" | "created_at" | "updated_at" | "deleted_at" | "workspace_id">;

    await createItem(data as any);

    // Reset form after successful creation
    setCreateFormData({
      name: '',
      description: '',
      scope: 'TEAM'
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const updates = {
      name: editFormData.name.trim(),
      description: editFormData.description.trim() || null,
      scope: editFormData.scope
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
          <SelectField
            id="scope"
            label={tu('form.scope', 'Scope')}
            value={createFormData.scope}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, scope: value as 'GLOBAL' | 'TEAM' }))}
            options={[
              { value: 'GLOBAL', label: tu('form.scopeGlobal', 'Global') },
              { value: 'TEAM', label: tu('form.scopeTeam', 'Team') }
            ]}
            required
            placeholder={tu('form.scopePlaceholder', 'Select scope')}
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
        footerActions={
          editingItem ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setIsEditDialogOpen(false);
                handleDelete(editingItem);
              }}
              disabled={isSubmitting}
            >
              <FontAwesomeIcon icon={faTrash} className="mr-2" />
              {tu('editDialog.delete', 'Delete')}
            </Button>
          ) : null
        }
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
            <SelectField
              id="edit-scope"
              label={tu('form.scope', 'Scope')}
              value={editFormData.scope}
              onChange={(value) => setEditFormData(prev => ({ ...prev, scope: value as 'GLOBAL' | 'TEAM' }))}
              options={[
                { value: 'GLOBAL', label: tu('form.scopeGlobal', 'Global') },
                { value: 'TEAM', label: tu('form.scopeTeam', 'Team') }
              ]}
              required
              placeholder={tu('form.scopePlaceholder', 'Select scope')}
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
        contentClassName="max-w-4xl"
        title={tu('permissionsDialog.title', 'Assign permissions')}
        description={selectedRoleName ? tu('permissionsDialog.description', 'Configure permissions for "{roleName}"').replace('{roleName}', selectedRoleName) : tu('permissionsDialog.description', 'Configure permissions')}
        onSubmit={(e) => { e.preventDefault(); handleSavePermissions(); }}
        isSubmitting={isSavingPerms}
        submitDisabled={isSavingPerms || !selectedRoleId}
        submitText={tu('permissionsDialog.save', 'Save')}
      >
        <div className="flex items-center justify-between mb-4 gap-2">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={activePermTab === 'general' ? 'default' : 'outline'}
              onClick={() => setActivePermTab('general')}
            >
              {tu('permissionsDialog.tabGeneral', 'General')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activePermTab === 'settings' ? 'default' : 'outline'}
              onClick={() => setActivePermTab('settings')}
            >
              {tu('permissionsDialog.tabSettings', 'Settings')}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              disabled={permissions.length === 0 || isLoadingRolePerms}
            >
              {tu('permissionsDialog.selectAll', 'Select all')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              disabled={selectedPermIds.size === 0 || isLoadingRolePerms}
            >
              {tu('permissionsDialog.clearAll', 'Clear')}
            </Button>
          </div>
        </div>
        <div className={`max-h-[65vh] overflow-auto pr-2 space-y-4 ${isLoadingRolePerms ? 'opacity-60 pointer-events-none' : ''}`}>
          {(activePermTab === 'general' ? generalGroups : settingsGroups).map(({ group, perms }) => {
            const { selectedCount, isAllSelected } = getGroupSelectionState(perms);
            return (
              <div key={group} className="border rounded-lg bg-muted/30 overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-muted/60">
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-base capitalize">{group}</div>
                    <span className="text-xs text-muted-foreground px-2 py-0.5 bg-background/60 rounded border">
                      {selectedCount}/{perms.length}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={isAllSelected ? "default" : "outline"}
                      onClick={() => handleSelectGroup(perms)}
                      disabled={perms.length === 0 || isLoadingRolePerms}
                      className="h-8"
                    >
                      {tu('permissionsDialog.selectGroupAll', 'All')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => handleClearGroup(perms)}
                      disabled={selectedCount === 0 || isLoadingRolePerms}
                      className="h-8"
                    >
                      {tu('permissionsDialog.selectGroupNone', 'None')}
                    </Button>
                  </div>
                </div>
                <div className="p-3 grid gap-2 sm:grid-cols-2">
                  {perms.map((perm) => {
                    const raw = (perm as any).key || perm.name || [perm.action, perm.resource].filter(Boolean).join('-');
                    const tokens = (raw || '').replace(/[.:/]/g, '-').split('-').filter(Boolean);
                    const actionLabel = (tokens[0] || perm.action || '').toUpperCase();
                    const displayName = actionLabel || `Permission ${perm.id}`;

                    return (
                      <label
                        key={perm.id}
                        className={`flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer transition-all ${
                          selectedPermIds.has(String(perm.id))
                            ? 'bg-emerald-50/80 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-background border-border hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedPermIds.has(String(perm.id))}
                          onChange={() => togglePermission(perm.id)}
                          className="h-4 w-4 accent-primary shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm uppercase tracking-wide text-foreground">
                            {displayName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">{perm.name}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SettingsDialog>

      {/* Delete Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tu('deleteDialog.title', 'Delete Role')}
        description={deletingItem ? tu('deleteDialog.description', 'Are you sure you want to delete the role "{name}"? This action cannot be undone.').replace('{name}', deletingItem.name || '') : undefined}
        onConfirm={() => deletingItem ? deleteItem(deletingItem.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingItem}
        entityName={tu('deleteDialog.entityName', 'role')}
        entityData={deletingItem as any}
        renderEntityPreview={(role: Role) => renderRolePreview(role)}
      />
    </SettingsLayout>
  );
}

export default RolesAndPermissions;

