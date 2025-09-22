import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { AppDispatch, RootState } from "@/store/store";
import { useNavigate } from "react-router-dom";
import { Team } from "@/store/types";
import { genericActions } from "@/store/genericSlices";

// Extended User type based on actual API data structure
interface UserData {
  id: number;
  name: string;
  email: string;
  team_id?: number | null;
  role_id?: number | null;
  organization_name?: string | null;
  is_admin?: boolean;
  has_active_subscription?: boolean;
  url_picture?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  AvatarCellRenderer,
  TextField,
  SelectField,
  CheckboxField
} from "../components";

function Users() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  // Redux state for related data
  const { value: teams, loading: teamsLoading } = useSelector((state: RootState) => state.teams) as { value: Team[]; loading: boolean };
  
  // Hydrate users and teams (IndexedDB -> Redux), then background refresh
  useEffect(() => {
    dispatch(genericActions.users.getFromIndexedDB());
    dispatch(genericActions.users.fetchFromAPI({ per_page: 1000 }));
    dispatch(genericActions.teams.getFromIndexedDB());
    dispatch(genericActions.teams.fetchFromAPI({ per_page: 1000 }));
  }, [dispatch]);

  // Note: create dialog open effect moved below after isCreateDialogOpen is defined
  
  // Use shared state management
  const {
    items: users,
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
    editingItem: editingUser,
    deletingItem: deletingUser,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<UserData>({
    entityName: 'users',
    searchFields: ['name', 'email']
  });

  // Ensure teams are fetched when opening create dialog (in case page loaded elsewhere first)
  useEffect(() => {
    if (!isCreateDialogOpen) return;
    dispatch(genericActions.teams.getFromIndexedDB());
    dispatch(genericActions.teams.fetchFromAPI({ per_page: 1000 }));
  }, [isCreateDialogOpen, dispatch]);

  // Ensure teams are fetched when opening edit dialog as well
  useEffect(() => {
    if (!isEditDialogOpen) return;
    dispatch(genericActions.teams.getFromIndexedDB());
    dispatch(genericActions.teams.fetchFromAPI({ per_page: 1000 }));
  }, [isEditDialogOpen, dispatch]);

  const columnDefs = useMemo<ColDef[]>(() => ([
    { 
      field: 'id', 
      headerName: 'ID',
      width: 80 
    },
    { 
      field: 'name', 
      headerName: 'Name',
      flex: 2,
      minWidth: 150, 
      cellRenderer: (params: ICellRendererParams) => (
        <AvatarCellRenderer name={params.data?.name || ''} />
      ) 
    },
    { 
      field: 'email', 
      headerName: 'Email',
      flex: 2,
      minWidth: 200 
    },
    { 
      field: 'team_id', 
      headerName: 'Team',
      width: 220,
      cellRenderer: (params: ICellRendererParams) => {
        const teamId = params.value;
        if (!teamId) return <span className="text-muted-foreground">No Team</span>;
        
        const team = teams.find((t: Team) => t.id === teamId);
        if (!team) return <span className="text-muted-foreground">Team {teamId}</span>;
        const initial = (team.name || '').charAt(0).toUpperCase();
        const hex = String((team as any).color || '').trim();
        let bg = hex;
        let fg = '#fff';
        try {
          if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
            const h = hex.length === 4
              ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
              : hex;
            const r = parseInt(h.slice(1, 3), 16);
            const g = parseInt(h.slice(3, 5), 16);
            const b = parseInt(h.slice(5, 7), 16);
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            fg = brightness > 180 ? '#111827' : '#ffffff';
          } else if (!hex) {
            bg = '';
          }
        } catch { /* ignore */ }
        return (
          <div className="flex items-center gap-2 h-full">
            <div
              className={`w-6 h-6 min-w-[1.5rem] rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 self-center ${bg ? '' : 'bg-muted text-foreground/80'}`}
              style={bg ? { backgroundColor: bg, color: fg } : undefined}
              title={team.name}
            >
              {initial || 'T'}
            </div>
            <Badge variant="secondary" className="h-6 px-2 inline-flex items-center self-center">
              {team.name}
            </Badge>
          </div>
        );
      }
    },
    { 
      field: 'is_admin', 
      headerName: 'Role',
      width: 120, 
      cellRenderer: (params: ICellRendererParams) => 
        params.value ? <Badge variant="default">Admin</Badge> : <Badge variant="outline">User</Badge> 
    },
    { 
      field: 'has_active_subscription', 
      headerName: 'Subscription',
      width: 130, 
      cellRenderer: (params: ICellRendererParams) => 
        params.value ? <Badge variant="default" className="bg-green-500">Active</Badge> : <Badge variant="destructive">Inactive</Badge> 
    },
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
  ]), [teams, handleEdit, handleDelete]);

  // Render entity preview for delete dialog
  const renderUserPreview = (user: UserData) => (
    <div className="flex items-center space-x-3">
      <div className="w-8 h-8 min-w-[2rem] bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
        {user.name.charAt(0).toUpperCase()}
      </div>
      <div>
        <div className="font-medium">{user.name}</div>
        <div className="text-sm text-muted-foreground">{user.email}</div>
        <div className="flex items-center space-x-2 mt-1">
          {user.team_id && (
            <Badge variant="secondary" className="text-xs">
              {teams.find(t => t.id === user.team_id)?.name || `Team ${user.team_id}`}
            </Badge>
          )}
          <Badge variant={user.is_admin ? "default" : "outline"} className="text-xs">
            {user.is_admin ? "Admin" : "User"}
          </Badge>
          <Badge 
            variant={user.has_active_subscription ? "default" : "destructive"} 
            className="text-xs"
          >
            {user.has_active_subscription ? "Active" : "Inactive"}
          </Badge>
        </div>
      </div>
    </div>
  );

  // Create submit handler
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const payload: Omit<UserData, 'id' | 'created_at' | 'updated_at' | 'deleted_at'> = {
      name: String(data.get('name') || ''),
      email: String(data.get('email') || ''),
      team_id: data.get('team_id') ? Number(data.get('team_id')) : null,
      role_id: data.get('role_id') ? Number(data.get('role_id')) : null,
      organization_name: (data.get('organization_name') as string) || null,
      is_admin: data.get('is_admin') === 'on',
      has_active_subscription: data.get('has_active_subscription') === 'on',
      url_picture: null
    };
    await createItem(payload as any);
  };

  // Edit submit handler
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    const form = e.target as HTMLFormElement;
    const data = new FormData(form);
    const updates: Partial<UserData> = {
      name: String(data.get('name') || editingUser.name),
      email: String(data.get('email') || editingUser.email),
      team_id: data.get('team_id') ? Number(data.get('team_id')) : null,
      role_id: data.get('role_id') ? Number(data.get('role_id')) : null,
      organization_name: (data.get('organization_name') as string) || null,
      is_admin: data.get('is_admin') === 'on',
      has_active_subscription: data.get('has_active_subscription') === 'on'
    };
    await updateItem(editingUser.id, updates);
  };

  return (
    <SettingsLayout
      title="Users"
      description="User accounts and permissions"
      icon={faUser}
      iconColor="#6366f1"
      search={{
        placeholder: "Search users...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: "Loading users..."
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      statistics={{
        title: "User Statistics",
        description: "Overview of users across your teams",
        items: [
          { label: "Total Users", value: users.length },
          { label: "Admins", value: users.filter((user: UserData) => user.is_admin).length },
          { 
            label: "Active Subscriptions", 
            value: users.length > 0 
              ? `${Math.round((users.filter((user: UserData) => user.has_active_subscription).length / users.length) * 100)}%`
              : "0%"
          }
        ]
      }}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/teams')}>
            Manage Teams
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
            <span className="mr-2 inline-flex items-center"><svg width="0" height="0" className="hidden" aria-hidden="true"></svg></span>
            Add User
          </Button>
        </div>
      }
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={columnDefs}
        noRowsMessage="No users found"
        height="500px"
        onRowDoubleClicked={(row: UserData) => handleEdit(row)}
      />

      {/* Create User Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add New User"
        description="Create a new user account."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <TextField
            id="name"
            name="name"
            label="Name"
            defaultValue=""
            required
          />
          <TextField
            id="email"
            name="email"
            label="Email"
            type="email"
            defaultValue=""
            required
          />
          <SelectField
            id="team_id"
            name="team_id"
            label="Team"
            defaultValue=""
            placeholder={teamsLoading && teams.length === 0 ? "Loading…" : "No Team"}
            options={teams.map((team: Team) => ({
              value: team.id.toString(),
              label: team.name
            }))}
          />
          <TextField
            id="organization_name"
            name="organization_name"
            label="Organization"
            defaultValue=""
          />
          <CheckboxField
            id="is_admin"
            name="is_admin"
            label="Admin"
            defaultChecked={false}
            description="Grant admin role"
          />
          <CheckboxField
            id="has_active_subscription"
            name="has_active_subscription"
            label="Subscription"
            defaultChecked={false}
            description="Active subscription"
          />
        </div>
      </SettingsDialog>

      {/* Edit User Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title="Edit User"
        description="Update the user information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingUser}
      >
        {editingUser && (
          <div className="grid gap-4">
            <TextField
              id="edit-name"
              name="name"
              label="Name"
              defaultValue={editingUser.name}
              required
            />
            <TextField
              id="edit-email"
              name="email"
              label="Email"
              type="email"
              defaultValue={editingUser.email}
              required
            />
            <SelectField
              id="edit-team_id"
              name="team_id"
              label="Team"
              defaultValue={editingUser.team_id?.toString() || ''}
              placeholder={teamsLoading && teams.length === 0 ? "Loading…" : "No Team"}
              options={teams.map((team: Team) => ({
                value: team.id.toString(),
                label: team.name
              }))}
            />
            <TextField
              id="edit-organization_name"
              name="organization_name"
              label="Organization"
              defaultValue={editingUser.organization_name ?? ''}
            />
            <CheckboxField
              id="edit-is_admin"
              name="is_admin"
              label="Admin"
              defaultChecked={!!editingUser.is_admin}
              description="Grant admin role"
            />
            <CheckboxField
              id="edit-has_active_subscription"
              name="has_active_subscription"
              label="Subscription"
              defaultChecked={!!editingUser.has_active_subscription}
              description="Active subscription"
            />
          </div>
        )}
      </SettingsDialog>

      {/* Delete User Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete User"
        description={
          deletingUser 
            ? `Are you sure you want to delete ${deletingUser.name} (${deletingUser.email})? This action cannot be undone.`
            : undefined
        }
        onConfirm={() => deletingUser ? deleteItem(deletingUser.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        entityName="user"
        entityData={deletingUser}
        renderEntityPreview={renderUserPreview}
      />
    </SettingsLayout>
  );
}

export default Users;