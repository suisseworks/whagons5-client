import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faChartBar, faEnvelope } from "@fortawesome/free-solid-svg-icons";
import { Check, Copy as CopyIcon, Plus, Trash } from "lucide-react";
import { UrlTabs } from "@/components/ui/url-tabs";
import { AppDispatch, RootState } from "@/store/store";
import { useNavigate } from "react-router-dom";
import { Team, UserTeam, Invitation, Role } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import { MultiSelect } from "@/components/ui/multi-select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/providers/LanguageProvider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/animated/Tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildInvitationLink } from "@/lib/invitationLink";
import type { UserData } from "../types";
import { getUserTeamRoleId } from "../utils/getUserTeamRoleId";
import { useInvitationsColumnDefs, useUsersColumnDefs } from "../utils/columnDefs";
import { UserStatistics } from "./UserStatistics";

import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  TextField,
  SelectField,
  CheckboxField
} from "../../../components";

function Users() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const tu = (key: string, fallback: string) => t(`settings.users.${key}`, fallback);
  // Redux state for related data
  const { value: teams, loading: teamsLoading } = useSelector((state: RootState) => state.teams) as { value: Team[]; loading: boolean };
  const { value: jobPositions, loading: jobPositionsLoading } = useSelector((state: RootState) => state.jobPositions) as { value: any[]; loading: boolean };
  const { value: userTeams } = useSelector((state: RootState) => state.userTeams) as { value: UserTeam[]; loading: boolean };
  const { value: invitations } = useSelector((state: RootState) => state.invitations) as { value: Invitation[]; loading: boolean };
  const { value: roles } = useSelector((state: RootState) => state.roles) as { value: Role[]; loading: boolean };
  
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
    setFormError,
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

  // Roles are loaded by DataManager on login

  // Form state for controlled components
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    job_position_id: string;
    color: string;
    is_admin: boolean;
    has_active_subscription: boolean;
  }>({
    name: '',
    email: '',
    job_position_id: '',
    color: '',
    is_admin: false,
    has_active_subscription: false
  });

  // Selected teams state (using string IDs for MultiSelect)
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedGlobalRoles, setSelectedGlobalRoles] = useState<string[]>([]);
  const [createSelectedTeams, setCreateSelectedTeams] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  // Team-role assignments for edit dialog
  const [editTeamAssignments, setEditTeamAssignments] = useState<Array<{ id?: number; teamId: string; roleId: string; key: string }>>([]);

  // Create form state
  const [createFormData, setCreateFormData] = useState<{
    name: string;
    email: string;
    job_position_id: string;
    color: string;
    organization_name: string;
    is_admin: boolean;
    has_active_subscription: boolean;
  }>({
    name: '',
    email: '',
    job_position_id: '',
    color: '',
    organization_name: '',
    is_admin: false,
    has_active_subscription: false
  });

  // Merged Add User dialog state
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [addUserActiveTab, setAddUserActiveTab] = useState<'create' | 'invite'>('invite');

  // Update form data when editing user changes
  useEffect(() => {
    if (editingUser) {
      setEditFormData({
        name: editingUser.name || '',
        email: editingUser.email || '',
        job_position_id: editingUser.job_position_id != null ? editingUser.job_position_id.toString() : '',
        color: editingUser.color || '',
        is_admin: !!editingUser.is_admin,
        has_active_subscription: !!editingUser.has_active_subscription
      });

      // Load existing user-team relationships
      const existingUserTeams = userTeams.filter((ut: UserTeam) => ut.user_id === editingUser.id);
      setSelectedTeams(existingUserTeams.map((ut: UserTeam) => ut.team_id.toString()));
      
      // Initialize team-role assignments for edit dialog
      const assignments: Array<{ id?: number; teamId: string; roleId: string; key: string }> = existingUserTeams.map((ut) => ({
        id: ut.id,
        teamId: String(ut.team_id),
        roleId: getUserTeamRoleId(ut) != null ? String(getUserTeamRoleId(ut)) : '',
        key: `existing-${ut.id}`
      }));
      setEditTeamAssignments(assignments);

      // Load existing global roles - extract role names from role objects
      const roleNames = Array.isArray(editingUser.global_roles) 
        ? editingUser.global_roles.map((role: any) => typeof role === 'object' ? role.name : role)
        : [];
      setSelectedGlobalRoles(roleNames);
    } else {
      // Reset selected teams and global roles when dialog closes
      setSelectedTeams([]);
      setSelectedGlobalRoles([]);
      setEditTeamAssignments([]);
    }
  }, [editingUser, userTeams]);

  // Reset create form when add user dialog closes (and we're on create tab)
  useEffect(() => {
    if (!isAddUserDialogOpen || addUserActiveTab !== 'create') {
      setCreateFormData({
        name: '',
        email: '',
        job_position_id: '',
        color: '',
        organization_name: '',
        is_admin: false,
        has_active_subscription: false
      });
      setCreateSelectedTeams([]);
    }
  }, [isAddUserDialogOpen, addUserActiveTab]);

  // Handle team selection changes in edit dialog
  const handleEditTeamsChange = (teamIds: string[]) => {
    setSelectedTeams(teamIds);
    
    // Update team assignments based on selected teams
    const currentTeamIds = new Set(teamIds);
    const existingAssignments = editTeamAssignments.filter(a => currentTeamIds.has(a.teamId));
    const newTeamIds = teamIds.filter(id => !editTeamAssignments.some(a => a.teamId === id));
    
    // Get default role (prefer "user" or "usuario", otherwise first TEAM role)
    const teamRoles = roles.filter((r: Role) => r.scope === 'TEAM');
    const defaultRole = teamRoles.length > 0
      ? (teamRoles.find((r: Role) => r.name?.toLowerCase().includes('user') || r.name?.toLowerCase().includes('usuario')) || teamRoles[0])
      : null;
    const defaultRoleId = defaultRole ? String(defaultRole.id) : '';
    
    // Add new team assignments with default role
    const newAssignments = newTeamIds.map(teamId => ({
      teamId,
      roleId: defaultRoleId,
      key: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`
    }));
    
    setEditTeamAssignments([...existingAssignments, ...newAssignments]);
  };

  const updateEditAssignment = (key: string, patch: Partial<{ teamId: string; roleId: string }>) => {
    setEditTeamAssignments((prev) =>
      prev.map((a) => (a.key === key ? { ...a, ...patch } : a))
    );
  };

  const removeEditAssignment = (key: string) => {
    const assignment = editTeamAssignments.find(a => a.key === key);
    if (assignment) {
      setSelectedTeams(prev => prev.filter(id => id !== assignment.teamId));
      setEditTeamAssignments(prev => prev.filter((a) => a.key !== key));
    }
  };

  const columnDefs = useUsersColumnDefs({
    translate: tu,
    teams,
    jobPositions,
    userTeams,
  });

  const invitationColumnDefs = useInvitationsColumnDefs({
    translate: tu,
    teams,
    onDeleteInvitation: (invitation) => {
      setDeletingInvitation(invitation);
      setIsDeleteInvitationDialogOpen(true);
    },
  });

  // Handle invitation deletion
  const handleDeleteInvitation = async () => {
    if (!deletingInvitation) return;
    
    try {
      await dispatch((genericActions as any).invitations.removeAsync(deletingInvitation.id)).unwrap();
      // Refresh invitations list from IndexedDB (will be updated by real-time listener or next validation)
      // No manual cache hydration here; state is kept in sync by login hydration + CRUD thunks/RTL.
      setIsDeleteInvitationDialogOpen(false);
      setDeletingInvitation(null);
    } catch (error: any) {
      // If error is 404 or 500, the invitation might already be deleted
      // Refresh from IndexedDB to sync state
      if (error?.response?.status === 404 || error?.response?.status === 500) {
        console.warn('Invitation may already be deleted, refreshing from cache');
        // No manual cache hydration here; state is kept in sync by login hydration + CRUD thunks/RTL.
      }
      console.error('Failed to delete invitation:', error);
      setIsDeleteInvitationDialogOpen(false);
      setDeletingInvitation(null);
    }
  };

  // Render invitation preview for delete dialog
  const renderInvitationPreview = (invitation: Invitation) => {
    const invitationTeams = (invitation.team_ids || [])
      .map((teamId: number) => {
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? { id: team.id, name: team.name, color: team.color ?? null } : null;
      })
      .filter((team): team is { id: number; name: string; color: string | null } => team !== null);

    const invitationLink = buildInvitationLink({
      invitationToken: invitation.invitation_token,
      tenantDomainPrefix: invitation.tenant_domain_prefix,
    });

    return (
      <div className="space-y-2">
        {invitation.user_email && (
          <div>
            <div className="text-sm font-medium">{tu('previews.invitation.email', 'Email')}</div>
            <div className="text-sm text-muted-foreground">{invitation.user_email}</div>
          </div>
        )}
        {invitationTeams.length > 0 && (
          <div>
            <div className="text-sm font-medium">{tu('previews.invitation.teams', 'Teams')}</div>
            <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
              {invitationTeams.map((team: { id: number; name: string; color: string | null }) => {
                const initial = (team.name || '').charAt(0).toUpperCase();
                const hex = String(team.color || '').trim();
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
                  <div
                    key={team.id}
                    className={`w-5 h-5 min-w-[1.25rem] rounded-full flex items-center justify-center text-xs font-semibold cursor-default ${bg ? '' : 'bg-muted text-foreground/80'}`}
                    style={bg ? { backgroundColor: bg, color: fg } : undefined}
                    title={team.name}
                  >
                    {initial || 'T'}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <div className="text-sm font-medium">{tu('dialogs.invitation.linkLabel', 'Invitation Link')}</div>
          <div className="text-xs text-muted-foreground break-all mt-1">{invitationLink}</div>
        </div>
      </div>
    );
  };

  // Render entity preview for delete dialog
  const renderUserPreview = (user: UserData) => {
    const adminLabel = tu('preview.admin', 'Admin');
    const userLabel = tu('preview.user', 'User');
    const activeLabel = tu('preview.active', 'Active');
    const inactiveLabel = tu('preview.inactive', 'Inactive');

    // Get user-team relationships from reducer
    const userTeamRelationships = userTeams.filter((ut: UserTeam) => ut.user_id === user.id);
    const userTeamObjects = userTeamRelationships
      .map((ut: UserTeam) => {
        const team = teams.find((t: Team) => t.id === ut.team_id);
        return team ? { id: team.id, name: team.name, color: team.color ?? null } : null;
      })
      .filter((team): team is { id: number; name: string; color: string | null } => team !== null);

    return (
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 min-w-[2rem] bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="font-medium">{user.name}</div>
          <div className="text-sm text-muted-foreground">{user.email}</div>
          <div className="flex items-center space-x-2 mt-1 flex-wrap gap-1">
            {userTeamObjects.length > 0 && userTeamObjects.map((team: { id: number; name: string; color: string | null }) => {
              const initial = (team.name || '').charAt(0).toUpperCase();
              const hex = String(team.color || '').trim();
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
                <div
                  key={team.id}
                  className={`w-5 h-5 min-w-[1.25rem] rounded-full flex items-center justify-center text-xs font-semibold cursor-default ${bg ? '' : 'bg-muted text-foreground/80'}`}
                  style={bg ? { backgroundColor: bg, color: fg } : undefined}
                  title={team.name}
                >
                  {initial || 'T'}
                </div>
              );
            })}
            <Badge variant={user.is_admin ? "default" : "outline"} className="text-xs">
              {user.is_admin ? adminLabel : userLabel}
            </Badge>
            <Badge 
              variant={user.has_active_subscription ? "default" : "destructive"} 
              className="text-xs"
            >
              {user.has_active_subscription ? activeLabel : inactiveLabel}
            </Badge>
          </div>
        </div>
      </div>
    );
  };

  // Invitation dialog state (for the invite tab)
  const [inviteSelectedTeams, setInviteSelectedTeams] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [showInvitationLink, setShowInvitationLink] = useState(false);
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [copiedDialogLink, setCopiedDialogLink] = useState<boolean>(false);
  const [isDeleteInvitationDialogOpen, setIsDeleteInvitationDialogOpen] = useState(false);
  const [deletingInvitation, setDeletingInvitation] = useState<Invitation | null>(null);

  // Reset invitation form when add user dialog closes
  useEffect(() => {
    if (!isAddUserDialogOpen) {
      setInviteSelectedTeams([]);
      setInviteEmail('');
      setSendEmail(true); // Reset to checked by default
      setInvitationLink('');
      setShowInvitationLink(false);
      setCopiedDialogLink(false); // Reset copied state
      setAddUserActiveTab('invite'); // Reset to invite tab (default)
    } else {
      // When dialog opens, ensure checkbox is checked by default
      setSendEmail(true);
    }
  }, [isAddUserDialogOpen]);

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSendingInvitation(true);
    setFormError(null);
    
    try {
      const payload: any = {
        team_ids: inviteSelectedTeams.length > 0 ? inviteSelectedTeams.map(id => Number(id)) : [],
        user_email: inviteEmail || null,
        send_email: sendEmail && !!inviteEmail,
      };
      
          const result = await dispatch((genericActions as any).invitations.addAsync(payload)).unwrap();
          
          // Refresh invitations list from IndexedDB (real-time listener will update cache automatically)
          // No manual cache hydration here; state is kept in sync by login hydration + CRUD thunks/RTL.
          
          // Show invitation link (build locally so dev host/port is always correct)
          const inv = (result as any)?.data ?? result;
          const token = inv?.invitation_token;
          if (token) {
            setInvitationLink(
              buildInvitationLink({
                invitationToken: token,
                tenantDomainPrefix: inv?.tenant_domain_prefix,
              })
            );
            setShowInvitationLink(true);
          }
          
          // If email was sent, close dialog after a moment
          if (sendEmail && inviteEmail) {
            setTimeout(() => {
              setIsAddUserDialogOpen(false);
            }, 2000);
          } else {
            // Keep dialog open to show link
            setIsAddUserDialogOpen(true);
          }
    } catch (error: any) {
      const backendErrors = error?.response?.data?.errors;
      const backendMessage = error?.response?.data?.message;
      const errorMessage = backendErrors
        ? Object.entries(backendErrors).map(([k, v]: any) => `${k}: ${(v?.[0] || v)}`).join(', ')
        : (backendMessage || error?.message || tu('errors.createInvitation', 'Failed to create invitation'));
      setFormError(errorMessage);
    } finally {
      setIsSendingInvitation(false);
    }
  };

  // Create submit handler
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userData: Omit<UserData, 'id' | 'created_at' | 'updated_at'> = {
      name: createFormData.name,
      email: createFormData.email,
      job_position_id: createFormData.job_position_id ? Number(createFormData.job_position_id) : null,
      color: createFormData.color || null,
      organization_name: createFormData.organization_name || null,
      is_admin: createFormData.is_admin,
      has_active_subscription: createFormData.has_active_subscription
    };

    try {
      setIsCreating(true);
      setFormError(null);
      // Create user directly using addAsync to get the created user back
      const createdUserResult = await dispatch((genericActions as any).users.addAsync(userData)).unwrap();
      const createdUser = createdUserResult as UserData;
      
      if (createdUser && createSelectedTeams.length > 0) {
        // Get default role (first available role, or first role with name "Usuario"/"User" if exists)
        // Note: roles are not in Redux, so we can't assign roles here
        // Roles should be assigned separately via the roles API if needed
        const defaultRole = roles.length > 0 
          ? (roles.find((r: Role) => r.name?.toLowerCase().includes('user') || r.name?.toLowerCase().includes('usuario')) || roles[0])
          : null;
        if (!defaultRole && roles.length > 0) {
          setFormError(tu('errors.noRoleAvailable', 'No roles available. Please create a role first.'));
          setIsCreating(false);
          return;
        }

        // Add user-team relationships
        for (const teamIdStr of createSelectedTeams) {
          const teamId = Number(teamIdStr);
          try {
            await dispatch((genericActions as any).userTeams.addAsync({
              user_id: createdUser.id,
              team_id: teamId,
              role_id: defaultRole?.id || null
            })).unwrap();
          } catch (error) {
            console.error(`Failed to add user-team relationship:`, error);
            setFormError(tu('errors.addTeamFailed', `Failed to add team relationship: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        }
        
        // Refresh userTeams cache to reflect changes
        // No manual cache hydration here; state is kept in sync by login hydration + CRUD thunks/RTL.
      }
      
      // Close dialog
      setIsAddUserDialogOpen(false);
    } catch (error: any) {
      // Handle and display errors
      const backendErrors = error?.response?.data?.errors;
      const backendMessage = error?.response?.data?.message;
      const errorMessage = backendErrors
        ? Object.entries(backendErrors).map(([k, v]: any) => `${k}: ${(v?.[0] || v)}`).join(', ')
        : (backendMessage || error?.message || tu('errors.createUser', 'Failed to create user'));
      setFormError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  // Edit submit handler
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const updates: Partial<UserData> = {
      name: editFormData.name,
      email: editFormData.email,
      job_position_id: editFormData.job_position_id ? Number(editFormData.job_position_id) : null,
      role_id: null, // Not used in this form
      color: editFormData.color || null,
      is_admin: editFormData.is_admin,
      has_active_subscription: editFormData.has_active_subscription,
      global_roles: selectedGlobalRoles
    };
    
    try {
      // Validate team-role assignments
      const assignmentsWithRoles = editTeamAssignments.filter(a => a.roleId && a.roleId !== '');
      if (editTeamAssignments.length > 0 && assignmentsWithRoles.length !== editTeamAssignments.length) {
        setFormError(tu('dialogs.manageTeams.errors.roleRequired', 'Selecciona un rol para cada equipo.'));
        return;
      }

      // Update user first
      await updateItem(editingUser.id, updates);

      // Handle user-team relationships
      const existingUserTeams = userTeams.filter((ut: UserTeam) => ut.user_id === editingUser.id);
      
      // Process team-role assignments
      const currentAssignments = editTeamAssignments.map((a) => ({
        ...a,
        teamIdNum: Number(a.teamId),
        roleIdNum: a.roleId ? Number(a.roleId) : null
      }));

      // Find assignments to add, update, and remove
      const toAdd = currentAssignments.filter((c) => c.id == null);
      const toUpdate = currentAssignments.filter((c) => {
        const match = existingUserTeams.find((ex) => ex.id === c.id);
        if (!match) return false;
        return match.team_id !== c.teamIdNum || getUserTeamRoleId(match) !== c.roleIdNum;
      });
      const toRemove = existingUserTeams.filter((ex) => !currentAssignments.some((c) => c.id === ex.id));

      // Add new user-team relationships
      for (const add of toAdd) {
        try {
          await dispatch((genericActions as any).userTeams.addAsync({
            user_id: editingUser.id,
            team_id: add.teamIdNum,
            role_id: add.roleIdNum
          })).unwrap();
        } catch (error: any) {
          console.error(`Failed to add user-team relationship:`, error);
          const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
          setFormError(tu('errors.addTeamFailed', `Failed to add team relationship: ${errorMsg}`));
          return;
        }
      }

      // Update existing user-team relationships
      for (const upd of toUpdate) {
        try {
          await dispatch((genericActions as any).userTeams.updateAsync({
            id: upd.id!,
            updates: {
              team_id: upd.teamIdNum,
              role_id: upd.roleIdNum
            }
          })).unwrap();
        } catch (error: any) {
          console.error(`Failed to update user-team relationship:`, error);
          const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
          setFormError(tu('errors.updateTeamFailed', `Failed to update team relationship: ${errorMsg}`));
          return;
        }
      }

      // Remove deleted user-team relationships
      for (const del of toRemove) {
        try {
          await dispatch((genericActions as any).userTeams.removeAsync(del.id)).unwrap();
        } catch (error: any) {
          console.error(`Failed to remove user-team relationship:`, error);
          const errorMsg = error?.response?.data?.message || error?.message || 'Unknown error';
          setFormError(tu('errors.removeTeamFailed', `Failed to remove team relationship: ${errorMsg}`));
          return;
        }
      }

      // Global roles are synchronized automatically in the backend update method
      // No separate API call needed
      
      // Refresh userTeams cache to reflect changes
      // No manual cache hydration here; state is kept in sync by login hydration + CRUD thunks/RTL.
      
      // Close edit dialog on success
      setIsEditDialogOpen(false);
    } catch (error: any) {
      const backendErrors = error?.response?.data?.errors;
      const backendMessage = error?.response?.data?.message;
      const errorMessage = backendErrors
        ? Object.entries(backendErrors).map(([k, v]: any) => `${k}: ${(v?.[0] || v)}`).join(', ')
        : (backendMessage || error?.message || tu('errors.updateUser', 'Failed to update user'));
      setFormError(errorMessage);
    }
  };

  return (
    <SettingsLayout
      title={tu('title', 'Users')}
      description={tu('description', 'User accounts and permissions')}
      icon={faUser}
      iconColor="#6366f1"
      search={{
        placeholder: tu('search.placeholder', 'Search users...'),
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
      loading={{
        isLoading: loading,
        message: tu('loading', 'Loading users...')
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/job-positions')}>
            {tu('header.manageJobPositions', 'Manage Job Positions')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/roles-and-permissions')}>
            {tu('header.rolesAndPermissions', 'Roles and Permissions')}
          </Button>
          <Button 
            onClick={() => setIsAddUserDialogOpen(true)} 
            size="default"
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
          >
            <Plus className="mr-2 h-4 w-4" />
            {tu('header.addUser', 'Add User')}
          </Button>
        </div>
      }
    >
      <UrlTabs
        tabs={[
          {
            value: "users",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
                <span>{tu('tabs.users', 'Users')}</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={columnDefs}
                    noRowsMessage={tu('grid.noUsers', 'No users found')}
                    onRowDoubleClicked={(row: UserData) => handleEdit(row)}
                  />
                </div>
              </div>
            )
          },
          {
            value: "statistics",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faChartBar} className="w-4 h-4" />
                <span>{tu('tabs.statistics', 'Statistics')}</span>
              </div>
            ),
            content: (
              <UserStatistics
                users={users}
                teams={teams}
                userTeams={userTeams}
                jobPositions={jobPositions}
                invitations={invitations}
                translate={tu}
              />
            )
          },
          {
            value: "invitations",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4" />
                <span>{tu('tabs.invitations', 'Invitations')}</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={invitations}
                    columnDefs={invitationColumnDefs}
                    noRowsMessage={tu('invitations.noRows', 'No invitations found')}
                  />
                </div>
              </div>
            )
          }
        ]}
        defaultValue="users"
        basePath="/settings/users"
        className="h-full flex flex-col"
      />


      {/* Merged Add User Dialog */}
      <SettingsDialog
        open={isAddUserDialogOpen}
        onOpenChange={setIsAddUserDialogOpen}
        type="create"
        title={tu('dialogs.addUser.title', 'Add User')}
        description={tu('dialogs.addUser.description', 'Create a new user account or send an invitation.')}
        onSubmit={addUserActiveTab === 'create' ? handleCreateSubmit : (showInvitationLink ? undefined : handleInviteSubmit)}
        isSubmitting={addUserActiveTab === 'create' ? isCreating : isSendingInvitation}
        error={formError}
        submitDisabled={
          addUserActiveTab === 'create' 
            ? isCreating 
            : (isSendingInvitation || showInvitationLink)
        }
        submitText={
          addUserActiveTab === 'create'
            ? tu('dialogs.createUser.submit', 'Create User')
            : (showInvitationLink ? undefined : tu('dialogs.invitation.submit', 'Create Invitation'))
        }
        contentClassName="max-w-2xl"
      >
        <Tabs value={addUserActiveTab} onValueChange={(value) => setAddUserActiveTab(value as 'create' | 'invite')} className="w-full">
          <div className="flex justify-center w-full mb-4">
            <TabsList className="w-fit">
              <TabsTrigger value="invite">
                {tu('dialogs.addUser.tabs.invite', 'Invite User')}
              </TabsTrigger>
              <TabsTrigger value="create">
                {tu('dialogs.addUser.tabs.create', 'Create User')}
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Create User Tab */}
          <TabsContent value="create" className="mt-4">
            <div className="grid gap-4">
              <TextField
                id="create-name"
                label={tu('dialogs.createUser.fields.name', 'Name')}
                value={createFormData.name}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, name: value }))}
                required
              />
              <TextField
                id="create-email"
                label={tu('dialogs.createUser.fields.email', 'Email')}
                type="email"
                value={createFormData.email}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, email: value }))}
                required
              />
              <TextField
                id="create-color"
                label={tu('dialogs.createUser.fields.color', 'Color')}
                type="color"
                value={createFormData.color}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, color: value }))}
              />
              <SelectField
                id="create-job_position_id"
                label={tu('dialogs.createUser.fields.jobPosition', 'Job Position')}
                value={createFormData.job_position_id}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, job_position_id: value }))}
                placeholder={
                  jobPositionsLoading && jobPositions.length === 0
                    ? tu('fields.loading', 'Loading…')
                    : tu('fields.noJobPosition', 'No Job Position')
                }
                options={jobPositions.map((jp: any) => ({
                  value: jp.id?.toString?.() ?? String(jp.id),
                  label: jp.title
                }))}
              />
              <TextField
                id="create-organization_name"
                label={tu('dialogs.createUser.fields.organization', 'Organization')}
                value={createFormData.organization_name}
                onChange={(value) => setCreateFormData(prev => ({ ...prev, organization_name: value }))}
              />
              <CheckboxField
                id="create-is_admin"
                label={tu('dialogs.createUser.fields.admin', 'Admin')}
                checked={createFormData.is_admin}
                onChange={(checked) => setCreateFormData(prev => ({ ...prev, is_admin: checked }))}
                description={tu('dialogs.createUser.fields.adminDescription', 'Grant admin role')}
              />
              <CheckboxField
                id="create-has_active_subscription"
                label={tu('dialogs.createUser.fields.subscription', 'Subscription')}
                checked={createFormData.has_active_subscription}
                onChange={(checked) => setCreateFormData(prev => ({ ...prev, has_active_subscription: checked }))}
                description={tu('dialogs.createUser.fields.subscriptionDescription', 'Active subscription')}
              />
              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">{tu('dialogs.createUser.fields.teams', 'Teams')}</Label>
                <div className="col-span-3">
                  <MultiSelect
                    options={teams.map((team: Team) => ({
                      value: team.id.toString(),
                      label: team.name
                    }))}
                    onValueChange={setCreateSelectedTeams}
                    defaultValue={createSelectedTeams}
                    placeholder={
                      teamsLoading && teams.length === 0
                        ? tu('multiSelect.loadingTeams', 'Loading teams...')
                        : tu('multiSelect.selectTeams', 'Select teams...')
                    }
                    maxCount={10}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
          
          {/* Invite User Tab */}
          <TabsContent value="invite" className="mt-4">
            {showInvitationLink ? (
              <div className="grid gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <Label className="text-sm font-medium mb-2 block">
                    {tu('dialogs.invitation.linkLabel', 'Invitation Link')}
                  </Label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={invitationLink}
                      className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(invitationLink);
                        setCopiedDialogLink(true);
                        setTimeout(() => setCopiedDialogLink(false), 4000);
                      }}
                      className="min-w-[80px]"
                    >
                      {copiedDialogLink ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          {tu('dialogs.invitation.copied', 'Copied')}
                        </>
                      ) : (
                        <>
                          <CopyIcon className="h-4 w-4 mr-1" />
                          {tu('dialogs.invitation.copy', 'Copy')}
                        </>
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {tu('dialogs.invitation.instructions', 'Share this link with the user. They will be added to the selected teams when they sign up.')}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => setIsAddUserDialogOpen(false)}
                  className="w-full"
                >
                  {tu('dialogs.invitation.close', 'Close')}
                </Button>
              </div>
            ) : (
              <div className="grid gap-4">
                <TextField
                  id="invite-email"
                  label={tu('dialogs.invitation.emailLabel', 'Email (Optional)')}
                  type="email"
                  value={inviteEmail}
                  onChange={(value) => setInviteEmail(value)}
                  placeholder={tu('dialogs.invitation.emailPlaceholder', 'user@example.com')}
                />
                <CheckboxField
                  id="invite-send-email"
                  label=""
                  checked={sendEmail}
                  onChange={(checked) => setSendEmail(checked)}
                  description={tu('dialogs.invitation.sendEmailDescription', 'Send invitation email to the address above')}
                  disabled={!inviteEmail}
                />
                <div className="grid grid-cols-4 items-start gap-4">
                  <Label className="text-right pt-2">{tu('dialogs.invitation.teamsLabel', 'Teams')}</Label>
                  <div className="col-span-3">
                    <MultiSelect
                      options={teams.map((team: Team) => ({
                        value: team.id.toString(),
                        label: team.name
                      }))}
                      onValueChange={setInviteSelectedTeams}
                      defaultValue={inviteSelectedTeams}
                      placeholder={
                        teamsLoading && teams.length === 0
                          ? tu('multiSelect.loadingTeams', 'Loading teams...')
                          : tu('multiSelect.selectTeams', 'Select teams...')
                      }
                      maxCount={10}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SettingsDialog>

      {/* Edit User Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        type="edit"
        title={tu('dialogs.editUser.title', 'Edit User')}
        description={tu('dialogs.editUser.description', 'Update the user information.')}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingUser}
        contentClassName="max-w-2xl"
        footerActions={
          editingUser ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={() => {
                setIsEditDialogOpen(false);
                handleDelete(editingUser);
              }}
              disabled={isSubmitting}
              title={tu('dialogs.deleteUser.title', 'Delete User')}
              aria-label={tu('dialogs.deleteUser.title', 'Delete User')}
            >
              <Trash className="h-4 w-4" />
            </Button>
          ) : null
        }
      >
        {editingUser && (
          <Tabs defaultValue="basic" className="w-full">
            <div className="flex justify-center w-full">
              <TabsList className="w-fit">
                <TabsTrigger value="basic">
                  {tu('dialogs.editUser.tabs.basic', 'Basic Information')}
                </TabsTrigger>
                <TabsTrigger value="professional">
                  {tu('dialogs.editUser.tabs.teams', 'Teams')}
                </TabsTrigger>
                <TabsTrigger value="permissions">
                  {tu('dialogs.editUser.tabs.permissions', 'Roles Globales')}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="basic" className="mt-4 min-h-[200px]">
              <div className="grid gap-4">
                <TextField
                  id="edit-name"
                  label={tu('dialogs.editUser.fields.name', 'Name')}
                  value={editFormData.name}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
                  required
                />
                <TextField
                  id="edit-email"
                  label={tu('dialogs.editUser.fields.email', 'Email')}
                  type="email"
                  value={editFormData.email}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, email: value }))}
                  required
                />
                <SelectField
                  id="edit-job_position_id"
                  label={tu('dialogs.editUser.fields.jobPosition', 'Job Position')}
                  value={editFormData.job_position_id}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, job_position_id: value }))}
                  placeholder={
                    jobPositionsLoading && jobPositions.length === 0
                      ? tu('fields.loading', 'Loading…')
                      : tu('fields.noJobPosition', 'No Job Position')
                  }
                  options={jobPositions.map((jp: any) => ({
                    value: jp.id?.toString?.() ?? String(jp.id),
                    label: jp.title
                  }))}
                />
                <TextField
                  id="edit-color"
                  label={tu('dialogs.editUser.fields.color', 'Color')}
                  type="color"
                  value={editFormData.color}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, color: value }))}
                />
              </div>
            </TabsContent>
            <TabsContent value="professional" className="mt-4 min-h-[200px]">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {tu('dialogs.editUser.fields.teams', 'Teams')}
                  </Label>
                  <MultiSelect
                    options={teams.map((team: Team) => ({
                      value: team.id.toString(),
                      label: team.name
                    }))}
                    onValueChange={handleEditTeamsChange}
                    defaultValue={selectedTeams}
                    placeholder={
                      teamsLoading && teams.length === 0
                        ? tu('multiSelect.loadingTeams', 'Loading teams...')
                        : tu('multiSelect.selectTeams', 'Select teams...')
                    }
                    maxCount={10}
                    className="w-full"
                  />
                </div>
                
                {editTeamAssignments.length > 0 && (
                  <div className="space-y-2 mt-4">
                    <Label className="text-sm font-medium">
                      {tu('dialogs.editUser.fields.teamRoles', 'Team Roles')}
                    </Label>
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{tu('dialogs.editUser.fields.team', 'Team')}</TableHead>
                            <TableHead>{tu('dialogs.editUser.fields.role', 'Role')}</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editTeamAssignments.map((assignment) => {
                            const team = teams.find((t: Team) => t.id === Number(assignment.teamId));
                            const teamRoles = roles.filter((r) => r.scope === 'TEAM');
                            const roleOptions = teamRoles.map((r) => ({ value: String(r.id), label: r.name }));
                            
                            return (
                              <TableRow key={assignment.key}>
                                <TableCell>
                                  <span className="font-medium">{team?.name || assignment.teamId}</span>
                                </TableCell>
                                <TableCell>
                                  <Select
                                    value={assignment.roleId || undefined}
                                    onValueChange={(value) => updateEditAssignment(assignment.key, { roleId: value })}
                                  >
                                    <SelectTrigger className="w-full">
                                      <SelectValue placeholder={tu('dialogs.editUser.fields.selectRole', 'Select a role')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {roleOptions.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                          {option.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeEditAssignment(assignment.key)}
                                    aria-label={tu('dialogs.editUser.fields.remove', 'Remove')}
                                  >
                                    <Trash className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="permissions" className="mt-4 min-h-[200px]">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {tu('dialogs.editUser.fields.globalRoles', 'Global Roles')}
                    <span className="text-muted-foreground text-xs font-normal ml-1">
                      ({tu('dialogs.editUser.fields.optional', 'Optional')})
                    </span>
                  </Label>
                  <MultiSelect
                    options={roles.length > 0
                      ? roles
                          .filter((role: Role) => role.scope === 'GLOBAL')
                          .map((role: Role) => ({
                            value: role.name,
                            label: role.name
                          }))
                      : []}
                    onValueChange={setSelectedGlobalRoles}
                    defaultValue={selectedGlobalRoles}
                    placeholder={
                      roles.length === 0 || roles.filter((r: Role) => r.scope === 'GLOBAL').length === 0
                        ? tu('multiSelect.noGlobalRoles', 'No global roles available')
                        : tu('multiSelect.selectGlobalRolesOptional', 'Select global roles (optional)...')
                    }
                    maxCount={10}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    {tu('dialogs.editUser.fields.globalRolesHelp', 'Global roles are optional. You can leave this field empty if you don\'t need to assign global roles to the user.')}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SettingsDialog>

      {/* Delete User Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tu('dialogs.deleteUser.title', 'Delete User')}
        description={
          deletingUser 
            ? tu('dialogs.deleteUser.description', 'Are you sure you want to delete {name} ({email})? This action cannot be undone.')
                .replace('{name}', deletingUser.name)
                .replace('{email}', deletingUser.email ?? '')
            : undefined
        }
        onConfirm={() => deletingUser ? deleteItem(deletingUser.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        entityName={tu('entityName', 'user')}
        entityData={deletingUser}
        renderEntityPreview={renderUserPreview}
      />

      {/* Delete Invitation Dialog */}
      <SettingsDialog
        open={isDeleteInvitationDialogOpen}
        onOpenChange={(open) => {
          setIsDeleteInvitationDialogOpen(open);
          if (!open) {
            setDeletingInvitation(null);
          }
        }}
        type="delete"
        title={tu('dialogs.deleteInvitation.title', 'Delete Invitation')}
        description={
          deletingInvitation
            ? tu('dialogs.deleteInvitation.description', 'Are you sure you want to delete this invitation{emailSuffix}? This action cannot be undone.')
                .replace(
                  '{emailSuffix}',
                  deletingInvitation.user_email
                    ? tu('dialogs.deleteInvitation.emailSuffix', ' for {email}').replace('{email}', deletingInvitation.user_email)
                    : ''
                )
            : undefined
        }
        onConfirm={handleDeleteInvitation}
        entityName={tu('dialogs.deleteInvitation.entityName', 'invitation')}
        entityData={deletingInvitation}
        renderEntityPreview={renderInvitationPreview}
      />
    </SettingsLayout>
  );
}


export default Users;