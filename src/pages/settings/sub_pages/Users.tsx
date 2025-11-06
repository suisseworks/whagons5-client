import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { faUser } from "@fortawesome/free-solid-svg-icons";
import { AppDispatch, RootState } from "@/store/store";
import { useNavigate } from "react-router-dom";
import { Team } from "@/store/types";
import { Role } from "@/store/types";
import { genericActions } from "@/store/genericSlices";

// Extended User type based on actual API data structure
interface UserData {
  id: number;
  name: string;
  email: string;
  team_id?: number | null;
  role_id?: number | null;
  job_position_id?: number | null;
  job_position?: { id: number; title: string } | null;
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
  const { value: jobPositions, loading: jobPositionsLoading } = useSelector((state: RootState) => state.jobPositions) as { value: any[]; loading: boolean };
  const { value: roles, loading: rolesLoading } = useSelector((state: RootState) => state.roles) as { value: Role[]; loading: boolean };
  
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
    updateItem,
    deleteItem,
    isSubmitting,
    formError,
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

  // Ensure users, teams, and job positions are loaded when users page mounts
  useEffect(() => {
    // Load users data
    dispatch((genericActions as any).users.getFromIndexedDB());
    
    // Load teams (needed for team column and dropdown)
    dispatch((genericActions as any).teams.getFromIndexedDB());
    
    // Load job positions (needed for dropdown/labels)
    dispatch((genericActions as any).jobPositions.getFromIndexedDB());
    
    // Load roles (needed for invitation form)
    dispatch((genericActions as any).roles.getFromIndexedDB());
  }, [dispatch]);

  // Form state for controlled components
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    team_id: string;
    job_position_id: string;
    organization_name: string;
    is_admin: boolean;
    has_active_subscription: boolean;
  }>({
    name: '',
    email: '',
    team_id: '',
    job_position_id: '',
    organization_name: '',
    is_admin: false,
    has_active_subscription: false
  });

  // Update form data when editing user changes
  useEffect(() => {
    if (editingUser) {
      setEditFormData({
        name: editingUser.name || '',
        email: editingUser.email || '',
        team_id: editingUser.team_id?.toString() || '',
        job_position_id: editingUser.job_position_id != null ? editingUser.job_position_id.toString() : '',
        organization_name: editingUser.organization_name || '',
        is_admin: !!editingUser.is_admin,
        has_active_subscription: !!editingUser.has_active_subscription
      });
    }
  }, [editingUser]);

  const columnDefs = useMemo<ColDef[]>(() => ([
    {
      field: 'id',
      headerName: 'ID',
      width: 90
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 2,
      minWidth: 180,
      cellRenderer: (params: ICellRendererParams) => (
        <AvatarCellRenderer name={params.data?.name || ''} />
      )
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 2.5,
      minWidth: 220
    },
    {
      field: 'team_id',
      headerName: 'Team',
      flex: 2,
      minWidth: 240,
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
      field: 'job_position_id',
      headerName: 'Job Position',
      flex: 2,
      minWidth: 220,
      cellRenderer: (params: ICellRendererParams) => {
        const idVal = params.value as number | string | undefined;
        if (idVal == null || idVal === '') return <span className="text-muted-foreground">No Job Position</span>;
        const idNum = typeof idVal === 'string' ? Number(idVal) : idVal;
        const jp = jobPositions.find((p: any) => Number(p.id) === idNum);
        return <Badge variant="secondary" className="h-6 px-2 inline-flex items-center self-center">{jp?.title || idNum}</Badge>;
      }
    },
    {
      field: 'is_admin',
      headerName: 'Role',
      flex: 0.8,
      minWidth: 130,
      cellRenderer: (params: ICellRendererParams) =>
        params.value ? <Badge variant="default">Admin</Badge> : <Badge variant="outline">User</Badge>
    },
    {
      field: 'has_active_subscription',
      headerName: 'Subscription',
      flex: 1,
      minWidth: 150,
      cellRenderer: (params: ICellRendererParams) =>
        params.value ? <Badge variant="default" className="bg-green-500">Active</Badge> : <Badge variant="destructive">Inactive</Badge>
    },
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
  ]), [teams, jobPositions, handleEdit, handleDelete]);

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

  // Invitation dialog state
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState<{
    team_id: string;
    role_id: string;
    job_position_id: string;
  }>({
    team_id: '',
    role_id: '',
    job_position_id: ''
  });

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = {
      team_id: inviteFormData.team_id ? Number(inviteFormData.team_id) : null,
      role_id: inviteFormData.role_id ? Number(inviteFormData.role_id) : null,
      job_position_id: inviteFormData.job_position_id ? Number(inviteFormData.job_position_id) : null,
    };
    await dispatch((genericActions as any).invitations.addAsync(payload));
    setIsInviteDialogOpen(false);
    setInviteFormData({ team_id: '', role_id: '', job_position_id: '' });
  };

  // Edit submit handler
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updates: Partial<UserData> = {
      name: editFormData.name,
      email: editFormData.email,
      team_id: editFormData.team_id ? Number(editFormData.team_id) : null,
      job_position_id: editFormData.job_position_id ? Number(editFormData.job_position_id) : null,
      role_id: null, // Not used in this form
      organization_name: editFormData.organization_name || null,
      is_admin: editFormData.is_admin,
      has_active_subscription: editFormData.has_active_subscription
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
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/job-positions')}>
            Manage Job Positions
          </Button>
          <Button onClick={() => setIsInviteDialogOpen(true)} size="sm">
            <span className="mr-2 inline-flex items-center"><svg width="0" height="0" className="hidden" aria-hidden="true"></svg></span>
            Create Invitation
          </Button>
        </div>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex-1 min-h-0">
          <SettingsGrid
            rowData={filteredItems}
            columnDefs={columnDefs}
            noRowsMessage="No users found"
            onRowDoubleClicked={(row: UserData) => handleEdit(row)}
          />
        </div>
      </div>

      {/* Create Invitation Dialog */}
      <SettingsDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        type="create"
        title="Create Invitation"
        description="Send an invitation with predefined team, role, and job position."
        onSubmit={handleInviteSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <SelectField
            id="invite-team_id"
            label="Team"
            value={inviteFormData.team_id}
            onChange={(value) => setInviteFormData(prev => ({ ...prev, team_id: value }))}
            placeholder={teamsLoading && teams.length === 0 ? "Loading…" : "No Team"}
            options={teams.map((team: Team) => ({ value: team.id.toString(), label: team.name }))}
          />
          <SelectField
            id="invite-role_id"
            label="Role"
            value={inviteFormData.role_id}
            onChange={(value) => setInviteFormData(prev => ({ ...prev, role_id: value }))}
            placeholder={rolesLoading && roles.length === 0 ? "Loading…" : "No Role"}
            options={roles.map((r: Role) => ({ value: r.id.toString(), label: r.name }))}
          />
          <SelectField
            id="invite-job_position_id"
            label="Job Position"
            value={inviteFormData.job_position_id}
            onChange={(value) => setInviteFormData(prev => ({ ...prev, job_position_id: value }))}
            placeholder={jobPositionsLoading && jobPositions.length === 0 ? "Loading…" : "No Job Position"}
            options={jobPositions.map((jp: any) => ({ value: jp.id?.toString?.() ?? String(jp.id), label: jp.title }))}
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
              label="Name"
              value={editFormData.name}
              onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
              required
            />
            <TextField
              id="edit-email"
              label="Email"
              type="email"
              value={editFormData.email}
              onChange={(value) => setEditFormData(prev => ({ ...prev, email: value }))}
              required
            />
            <SelectField
              id="edit-team_id"
              label="Team"
              value={editFormData.team_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, team_id: value }))}
              placeholder={teamsLoading && teams.length === 0 ? "Loading…" : "No Team"}
              options={teams.map((team: Team) => ({
                value: team.id.toString(),
                label: team.name
              }))}
            />
            <SelectField
              id="edit-job_position_id"
              label="Job Position"
              value={editFormData.job_position_id}
              onChange={(value) => setEditFormData(prev => ({ ...prev, job_position_id: value }))}
              placeholder={jobPositionsLoading && jobPositions.length === 0 ? "Loading…" : "No Job Position"}
              options={jobPositions.map((jp: any) => ({
                value: jp.id?.toString?.() ?? String(jp.id),
                label: jp.title
              }))}
            />
            <TextField
              id="edit-organization_name"
              label="Organization"
              value={editFormData.organization_name}
              onChange={(value) => setEditFormData(prev => ({ ...prev, organization_name: value }))}
            />
            <CheckboxField
              id="edit-is_admin"
              label="Admin"
              checked={editFormData.is_admin}
              onChange={(checked) => setEditFormData(prev => ({ ...prev, is_admin: checked }))}
              description="Grant admin role"
            />
            <CheckboxField
              id="edit-has_active_subscription"
              label="Subscription"
              checked={editFormData.has_active_subscription}
              onChange={(checked) => setEditFormData(prev => ({ ...prev, has_active_subscription: checked }))}
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