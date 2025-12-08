import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUser, faChartBar, faEnvelope, faUsers } from "@fortawesome/free-solid-svg-icons";
import { Check, Copy as CopyIcon } from "lucide-react";
import { UrlTabs } from "@/components/ui/url-tabs";
import { AppDispatch, RootState } from "@/store/store";
import { useNavigate } from "react-router-dom";
import { Team } from "@/store/types";
import { UserTeam } from "@/store/types";
import { Invitation } from "@/store/types";
import { genericActions } from "@/store/genericSlices";
import { MultiSelect } from "@/components/ui/multi-select";
import { Label } from "@/components/ui/label";
import { getEnvVariables } from "@/lib/getEnvVariables";
import { useLanguage } from "@/providers/LanguageProvider";

// Extended User type based on actual API data structure
interface UserData {
  id: number;
  name: string;
  email: string;
  teams?: Array<{ id: number; name: string; description?: string; color?: string; role_id?: number }> | null;
  role_id?: number | null;
  job_position_id?: number | null;
  job_position?: { id: number; title: string } | null;
  organization_name?: string | null;
  is_admin?: boolean;
  has_active_subscription?: boolean;
  url_picture?: string | null;
  color?: string | null;
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
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";

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
    setFormError,
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
    
    // Load user-teams pivot table (needed for team assignments)
    dispatch((genericActions as any).userTeams.getFromIndexedDB());
    
    // Load invitations from IndexedDB only (no automatic API fetch)
    dispatch((genericActions as any).invitations.getFromIndexedDB());
  }, [dispatch]);

  // Form state for controlled components
  const [editFormData, setEditFormData] = useState<{
    name: string;
    email: string;
    job_position_id: string;
    organization_name: string;
    color: string;
    is_admin: boolean;
    has_active_subscription: boolean;
  }>({
    name: '',
    email: '',
    job_position_id: '',
    organization_name: '',
    color: '',
    is_admin: false,
    has_active_subscription: false
  });

  // Selected teams state (using string IDs for MultiSelect)
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [createSelectedTeams, setCreateSelectedTeams] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isTeamsDialogOpen, setIsTeamsDialogOpen] = useState(false);
  const [teamsDialogUser, setTeamsDialogUser] = useState<UserData | null>(null);

  // Create form state
  const [createFormData, setCreateFormData] = useState<{
    name: string;
    email: string;
    job_position_id: string;
    organization_name: string;
    color: string;
    is_admin: boolean;
    has_active_subscription: boolean;
  }>({
    name: '',
    email: '',
    job_position_id: '',
    organization_name: '',
    color: '',
    is_admin: false,
    has_active_subscription: false
  });

  // Update form data when editing user changes
  useEffect(() => {
    if (editingUser) {
      setEditFormData({
        name: editingUser.name || '',
        email: editingUser.email || '',
        job_position_id: editingUser.job_position_id != null ? editingUser.job_position_id.toString() : '',
        organization_name: editingUser.organization_name || '',
        color: editingUser.color || '',
        is_admin: !!editingUser.is_admin,
        has_active_subscription: !!editingUser.has_active_subscription
      });

      // Load existing user-team relationships
      const existingUserTeams = userTeams.filter((ut: UserTeam) => ut.user_id === editingUser.id);
      setSelectedTeams(existingUserTeams.map((ut: UserTeam) => ut.team_id.toString()));
    } else {
      // Reset selected teams when dialog closes
      setSelectedTeams([]);
    }
  }, [editingUser, userTeams]);

  // Reset create form when create dialog closes
  useEffect(() => {
    if (!isCreateDialogOpen) {
      setCreateFormData({
        name: '',
        email: '',
        job_position_id: '',
        organization_name: '',
        color: '',
        is_admin: false,
        has_active_subscription: false
      });
      setCreateSelectedTeams([]);
    }
  }, [isCreateDialogOpen]);

  const handleOpenTeamsDialog = (user: UserData) => {
    setTeamsDialogUser(user);
    setIsTeamsDialogOpen(true);
  };

  const handleCloseTeamsDialog = () => {
    setIsTeamsDialogOpen(false);
    setTeamsDialogUser(null);
  };

  const columnDefs = useMemo<ColDef[]>(() => {
    const columnLabels = {
      id: tu('grid.columns.id', 'ID'),
      name: tu('grid.columns.name', 'Name'),
      email: tu('grid.columns.email', 'Email'),
      teams: tu('grid.columns.teams', 'Teams'),
      jobPosition: tu('grid.columns.jobPosition', 'Job Position'),
      role: tu('grid.columns.role', 'Role'),
      subscription: tu('grid.columns.subscription', 'Subscription'),
      actions: tu('grid.columns.actions', 'Actions')
    };
    const noTeamsLabel = tu('grid.values.noTeams', 'No Teams');
    const noJobPositionLabel = tu('grid.values.noJobPosition', 'No Job Position');
    const adminLabel = tu('grid.values.admin', 'Admin');
    const userLabel = tu('grid.values.user', 'User');
    const activeLabel = tu('grid.values.active', 'Active');
    const inactiveLabel = tu('grid.values.inactive', 'Inactive');
    const manageTeamsLabel = tu('grid.actions.manageTeams', 'Teams');

    return [
      {
        field: 'id',
        headerName: columnLabels.id,
        width: 90,
        hide: true
      },
      {
        field: 'name',
        headerName: columnLabels.name,
        flex: 2,
        minWidth: 180,
        cellRenderer: (params: ICellRendererParams) => (
          <AvatarCellRenderer name={params.data?.name || ''} color={params.data?.color} />
        )
      },
      {
        field: 'email',
        headerName: columnLabels.email,
        flex: 1.8,
        minWidth: 180
      },
      {
        field: 'teams',
        headerName: columnLabels.teams,
        flex: 2,
        minWidth: 240,
        cellRenderer: (params: ICellRendererParams) => {
          const userId = params.data?.id;
          if (!userId) return <span className="text-muted-foreground">{noTeamsLabel}</span>;

          const userTeamRelationships = userTeams.filter((ut: UserTeam) => ut.user_id === userId);
          
          if (!userTeamRelationships || userTeamRelationships.length === 0) {
            return <span className="text-muted-foreground">{noTeamsLabel}</span>;
          }

          const userTeamObjects = userTeamRelationships
            .map((ut: UserTeam) => {
              const team = teams.find((t: Team) => t.id === ut.team_id);
              return team ? { id: team.id, name: team.name, color: team.color ?? null } : null;
            })
            .filter((team): team is { id: number; name: string; color: string | null } => team !== null);

          if (userTeamObjects.length === 0) {
            return <span className="text-muted-foreground">{noTeamsLabel}</span>;
          }

          return (
            <div className="flex flex-wrap gap-1">
              {userTeamObjects.map((team: { id: number; name: string; color: string | null }) => {
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
                  <Badge key={team.id} variant="secondary" className="h-6 px-2 inline-flex items-center gap-1">
                    <div
                      className={`w-4 h-4 min-w-[1rem] rounded-full flex items-center justify-center text-[10px] font-semibold ${bg ? '' : 'bg-muted text-foreground/80'}`}
                      style={bg ? { backgroundColor: bg, color: fg } : undefined}
                      title={team.name}
                    >
                      {initial || 'T'}
                    </div>
                    {team.name}
                  </Badge>
                );
              })}
            </div>
          );
        }
      },
      {
        field: 'job_position_id',
        headerName: columnLabels.jobPosition,
        flex: 1.6,
        minWidth: 160,
        cellRenderer: (params: ICellRendererParams) => {
          const idVal = params.value as number | string | undefined;
          if (idVal == null || idVal === '') return <span className="text-muted-foreground">{noJobPositionLabel}</span>;
          const idNum = typeof idVal === 'string' ? Number(idVal) : idVal;
          const jp = jobPositions.find((p: any) => Number(p.id) === idNum);
          return <Badge variant="secondary" className="h-6 px-2 inline-flex items-center self-center">{jp?.title || idNum}</Badge>;
        }
      },
      {
        field: 'is_admin',
        headerName: columnLabels.role,
        flex: 0.8,
        minWidth: 130,
        cellRenderer: (params: ICellRendererParams) =>
          params.value ? <Badge variant="default">{adminLabel}</Badge> : <Badge variant="outline">{userLabel}</Badge>
      },
      {
        field: 'has_active_subscription',
        headerName: columnLabels.subscription,
        flex: 1,
        minWidth: 150,
        cellRenderer: (params: ICellRendererParams) =>
          params.value ? <Badge variant="default" className="bg-green-500">{activeLabel}</Badge> : <Badge variant="destructive">{inactiveLabel}</Badge>
      },
      {
        field: 'actions',
        headerName: columnLabels.actions,
        width: 220,
        cellRenderer: createActionsCellRenderer({
          onEdit: handleEdit,
          onDelete: handleDelete,
          customActions: [
            {
              icon: faUsers,
              label: manageTeamsLabel,
              variant: "secondary",
              className: "p-1 h-7",
              onClick: (data: UserData) => handleOpenTeamsDialog(data)
            }
          ]
        }),
        sortable: false,
        filter: false,
        resizable: false,
        pinned: 'right'
      }
    ];
  }, [teams, jobPositions, userTeams, handleEdit, handleDelete, handleOpenTeamsDialog, t]);

  // Copy button component for table cells
  const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);
    const copyText = tu('copyButton.copy', 'Copy');
    const copiedText = tu('copyButton.copied', 'Copied');

    const handleCopy = () => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    };

    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleCopy}
        className="min-w-[80px]"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 mr-1" />
            {copiedText}
          </>
        ) : (
          <>
            <CopyIcon className="h-4 w-4 mr-1" />
            {copyText}
          </>
        )}
      </Button>
    );
  };

  // Invitation column definitions
  const invitationColumnDefs: ColDef[] = useMemo(() => {
    const columnLabels = {
      id: tu('invitations.columns.id', 'ID'),
      email: tu('invitations.columns.email', 'Email'),
      teams: tu('invitations.columns.teams', 'Teams'),
      link: tu('invitations.columns.link', 'Invitation Link'),
      created: tu('invitations.columns.created', 'Created'),
      actions: tu('invitations.columns.actions', 'Actions')
    };
    const noEmailLabel = tu('invitations.values.noEmail', 'No email');
    const noTeamsLabel = tu('grid.values.noTeams', 'No Teams');

    return [
      {
        field: 'id',
        headerName: columnLabels.id,
        width: 90,
        hide: true
      },
      {
        field: 'user_email',
        headerName: columnLabels.email,
        flex: 2,
        minWidth: 220,
        cellRenderer: (params: ICellRendererParams) => {
          return params.value || <span className="text-muted-foreground">{noEmailLabel}</span>;
        }
      },
      {
        field: 'team_ids',
        headerName: columnLabels.teams,
        flex: 2,
        minWidth: 240,
        cellRenderer: (params: ICellRendererParams) => {
          const teamIds = params.value as number[] | null | undefined;
          if (!teamIds || teamIds.length === 0) {
            return <span className="text-muted-foreground">{noTeamsLabel}</span>;
          }

          const invitationTeams = teamIds
            .map((teamId: number) => {
              const team = teams.find((t: Team) => t.id === teamId);
              return team ? { id: team.id, name: team.name, color: team.color ?? null } : null;
            })
            .filter((team): team is { id: number; name: string; color: string | null } => team !== null);

          if (invitationTeams.length === 0) {
            return <span className="text-muted-foreground">{noTeamsLabel}</span>;
          }

        return (
          <div className="flex flex-wrap gap-1">
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
                <Badge key={team.id} variant="secondary" className="h-6 px-2 inline-flex items-center gap-1">
                  <div
                    className={`w-4 h-4 min-w-[1rem] rounded-full flex items-center justify-center text-[10px] font-semibold ${bg ? '' : 'bg-muted text-foreground/80'}`}
                    style={bg ? { backgroundColor: bg, color: fg } : undefined}
                    title={team.name}
                  >
                    {initial || 'T'}
                  </div>
                  {team.name}
                </Badge>
              );
            })}
          </div>
        );
      }
    },
    {
      field: 'invitation_link',
      headerName: 'Invitation Link',
      flex: 3,
      minWidth: 300,
      cellRenderer: (params: ICellRendererParams) => {
        const invitation = params.data as Invitation;
        if (!invitation?.invitation_token) return <span className="text-muted-foreground">No token</span>;
        
        // Generate invitation link using VITE_DOMAIN
        const { VITE_DOMAIN } = getEnvVariables();
        const baseDomain = VITE_DOMAIN || 'whagons5.whagons.com';
        const tenantPrefix = invitation.tenant_domain_prefix || '';
        const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
        
        // Build domain: {tenant_prefix}.{base_domain}
        const domain = tenantPrefix 
          ? `${tenantPrefix}.${baseDomain}`
          : baseDomain;
        
        const invitationLink = `${protocol}://${domain}/auth/invitation/${invitation.invitation_token}`;
        
        return (
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={invitationLink}
              className="flex-1 px-2 py-1 text-xs border rounded bg-background text-foreground"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <CopyButton text={invitationLink} />
          </div>
        );
      }
    },
    {
      field: 'created_at',
      headerName: 'Created',
      flex: 1.5,
      minWidth: 150,
      cellRenderer: (params: ICellRendererParams) => {
        if (!params.value) return <span className="text-muted-foreground">-</span>;
        const date = new Date(params.value);
        return <span>{date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
      }
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      cellRenderer: createActionsCellRenderer({
        onDelete: (invitation: Invitation) => {
          setDeletingInvitation(invitation);
          setIsDeleteInvitationDialogOpen(true);
        }
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ];
  }, [teams, dispatch]);

  // Handle invitation deletion
  const handleDeleteInvitation = async () => {
    if (!deletingInvitation) return;
    
    try {
      await dispatch((genericActions as any).invitations.removeAsync(deletingInvitation.id)).unwrap();
      // Refresh invitations list from IndexedDB (will be updated by real-time listener or next validation)
      dispatch((genericActions as any).invitations.getFromIndexedDB());
      setIsDeleteInvitationDialogOpen(false);
      setDeletingInvitation(null);
    } catch (error: any) {
      // If error is 404 or 500, the invitation might already be deleted
      // Refresh from IndexedDB to sync state
      if (error?.response?.status === 404 || error?.response?.status === 500) {
        console.warn('Invitation may already be deleted, refreshing from cache');
        dispatch((genericActions as any).invitations.getFromIndexedDB());
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

    // Generate invitation link using VITE_DOMAIN
    const { VITE_DOMAIN } = getEnvVariables();
    const baseDomain = VITE_DOMAIN || 'whagons5.whagons.com';
    const tenantPrefix = invitation.tenant_domain_prefix || '';
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
    
    // Build domain: {tenant_prefix}.{base_domain}
    const domain = tenantPrefix 
      ? `${tenantPrefix}.${baseDomain}`
      : baseDomain;
    
    const invitationLink = `${protocol}://${domain}/auth/invitation/${invitation.invitation_token}`;

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
                  <Badge key={team.id} variant="secondary" className="text-xs inline-flex items-center gap-1">
                    <div
                      className={`w-3 h-3 min-w-[0.75rem] rounded-full flex items-center justify-center text-[9px] font-semibold ${bg ? '' : 'bg-muted text-foreground/80'}`}
                      style={bg ? { backgroundColor: bg, color: fg } : undefined}
                      title={team.name}
                    >
                      {initial || 'T'}
                    </div>
                    {team.name}
                  </Badge>
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
            {userTeamObjects.length > 0 && userTeamObjects.map((team: { id: number; name: string; color: string | null }) => (
              <Badge key={team.id} variant="secondary" className="text-xs">
                {team.name}
              </Badge>
            ))}
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

  // Invitation dialog state
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [inviteSelectedTeams, setInviteSelectedTeams] = useState<string[]>([]);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [invitationLink, setInvitationLink] = useState<string>('');
  const [showInvitationLink, setShowInvitationLink] = useState(false);
  const [isSendingInvitation, setIsSendingInvitation] = useState(false);
  const [copiedDialogLink, setCopiedDialogLink] = useState<boolean>(false);
  const [isDeleteInvitationDialogOpen, setIsDeleteInvitationDialogOpen] = useState(false);
  const [deletingInvitation, setDeletingInvitation] = useState<Invitation | null>(null);

  // Reset invitation form when invitation dialog closes
  useEffect(() => {
    if (!isInviteDialogOpen) {
      setInviteSelectedTeams([]);
      setInviteEmail('');
      setSendEmail(true); // Reset to checked by default
      setInvitationLink('');
      setShowInvitationLink(false);
      setCopiedDialogLink(false); // Reset copied state
    } else {
      // When dialog opens, ensure checkbox is checked by default
      setSendEmail(true);
    }
  }, [isInviteDialogOpen]);

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
          dispatch((genericActions as any).invitations.getFromIndexedDB());
          
          // Show invitation link if available
          if (result?.invitation_link) {
            setInvitationLink(result.invitation_link);
            setShowInvitationLink(true);
          }
          
          // If email was sent, close dialog after a moment
          if (sendEmail && inviteEmail) {
            setTimeout(() => {
              setIsInviteDialogOpen(false);
            }, 2000);
          } else {
            // Keep dialog open to show link
            setIsInviteDialogOpen(true);
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
      organization_name: createFormData.organization_name || null,
      color: createFormData.color || null,
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
        // Add user-team relationships
        for (const teamIdStr of createSelectedTeams) {
          const teamId = Number(teamIdStr);
          try {
            await dispatch((genericActions as any).userTeams.addAsync({
              user_id: createdUser.id,
              team_id: teamId
            })).unwrap();
          } catch (error) {
            console.error(`Failed to add user-team relationship:`, error);
          }
        }
      }
      
      // Close dialog
      setIsCreateDialogOpen(false);
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
      organization_name: editFormData.organization_name || null,
      color: editFormData.color || null,
      is_admin: editFormData.is_admin,
      has_active_subscription: editFormData.has_active_subscription
    };
    
    // Update user first
    await updateItem(editingUser.id, updates);

    // Handle user-team relationships
    const selectedTeamIds = selectedTeams.map(id => Number(id));
    const existingUserTeams = userTeams.filter((ut: UserTeam) => ut.user_id === editingUser.id);
    const existingTeamIds = existingUserTeams.map((ut: UserTeam) => ut.team_id);

    // Find teams to add (in selectedTeams but not in existing)
    const teamsToAdd = selectedTeamIds.filter(teamId => !existingTeamIds.includes(teamId));
    
    // Find teams to remove (in existing but not in selectedTeams)
    const teamsToRemove = existingTeamIds.filter(teamId => !selectedTeamIds.includes(teamId));

    // Add new user-team relationships
    for (const teamId of teamsToAdd) {
      try {
        await dispatch((genericActions as any).userTeams.addAsync({
          user_id: editingUser.id,
          team_id: teamId
        })).unwrap();
      } catch (error) {
        console.error(`Failed to add user-team relationship:`, error);
      }
    }

    // Remove deleted user-team relationships
    for (const teamId of teamsToRemove) {
      const userTeamToRemove = existingUserTeams.find((ut: UserTeam) => ut.team_id === teamId);
      if (userTeamToRemove) {
        try {
          await dispatch((genericActions as any).userTeams.removeAsync(userTeamToRemove.id)).unwrap();
        } catch (error) {
          console.error(`Failed to remove user-team relationship:`, error);
        }
      }
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
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/teams')}>
            {tu('header.manageTeams', 'Manage Teams')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/job-positions')}>
            {tu('header.manageJobPositions', 'Manage Job Positions')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/roles-and-permissions')}>
            {tu('header.rolesAndPermissions', 'Roles and Permissions')}
          </Button>
          <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)} size="sm">
            {tu('header.createUser', 'Create User')}
          </Button>
          <Button onClick={() => setIsInviteDialogOpen(true)} size="sm">
            {tu('header.createInvitation', 'Create Invitation')}
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

      {/* Manage Teams Dialog (placeholder) */}
      <SettingsDialog
        open={isTeamsDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseTeamsDialog();
          } else {
            setIsTeamsDialogOpen(true);
          }
        }}
        type="custom"
        title={tu('dialogs.manageTeams.title', 'Manage user teams')}
        description={tu('dialogs.manageTeams.description', 'Assign or remove teams for this user. (Coming soon)')}
        submitText={tu('dialogs.manageTeams.save', 'Save')}
        submitDisabled
        cancelText={tu('dialogs.manageTeams.close', 'Close')}
        contentClassName="max-w-xl"
      >
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {teamsDialogUser
            ? tu('dialogs.manageTeams.placeholder', `Team management for ${teamsDialogUser.name} will be available soon.`)
            : tu('dialogs.manageTeams.noUser', 'Select a user to manage teams.')}
        </div>
      </SettingsDialog>

      {/* Create User Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title={tu('dialogs.createUser.title', 'Create User')}
        description={tu('dialogs.createUser.description', 'Create a new user account.')}
        onSubmit={handleCreateSubmit}
        isSubmitting={isCreating}
        error={formError}
        submitDisabled={isCreating}
      >
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
      </SettingsDialog>

      {/* Create Invitation Dialog */}
      <SettingsDialog
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
        type="create"
        title={tu('dialogs.invitation.title', 'Create Invitation')}
        description={
          showInvitationLink
            ? tu('dialogs.invitation.success', 'Invitation created successfully!')
            : tu('dialogs.invitation.description', 'Create an invitation link. Users who sign up will be automatically added to the selected teams.')
        }
        onSubmit={showInvitationLink ? undefined : handleInviteSubmit}
        isSubmitting={isSendingInvitation}
        error={formError}
        submitDisabled={isSendingInvitation || showInvitationLink}
        submitText={showInvitationLink ? undefined : tu('dialogs.invitation.submit', 'Create Invitation')}
      >
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
              onClick={() => setIsInviteDialogOpen(false)}
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
      >
        {editingUser && (
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
            <TextField
              id="edit-color"
              label={tu('dialogs.editUser.fields.color', 'Color')}
              type="color"
              value={editFormData.color}
              onChange={(value) => setEditFormData(prev => ({ ...prev, color: value }))}
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
              id="edit-organization_name"
              label={tu('dialogs.editUser.fields.organization', 'Organization')}
              value={editFormData.organization_name}
              onChange={(value) => setEditFormData(prev => ({ ...prev, organization_name: value }))}
            />
            <CheckboxField
              id="edit-is_admin"
              label={tu('dialogs.editUser.fields.admin', 'Admin')}
              checked={editFormData.is_admin}
              onChange={(checked) => setEditFormData(prev => ({ ...prev, is_admin: checked }))}
              description={tu('dialogs.editUser.fields.adminDescription', 'Grant admin role')}
            />
            <CheckboxField
              id="edit-has_active_subscription"
              label={tu('dialogs.editUser.fields.subscription', 'Subscription')}
              checked={editFormData.has_active_subscription}
              onChange={(checked) => setEditFormData(prev => ({ ...prev, has_active_subscription: checked }))}
              description={tu('dialogs.editUser.fields.subscriptionDescription', 'Active subscription')}
            />
            <div className="grid grid-cols-4 items-start gap-4">
              <Label className="text-right pt-2">{tu('dialogs.editUser.fields.teams', 'Teams')}</Label>
              <div className="col-span-3">
                <MultiSelect
                  options={teams.map((team: Team) => ({
                    value: team.id.toString(),
                    label: team.name
                  }))}
                  onValueChange={setSelectedTeams}
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
            </div>
          </div>
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

interface UserStatisticsProps {
  users: UserData[];
  teams: Team[];
  userTeams: UserTeam[];
  jobPositions: any[];
  invitations: Invitation[];
  translate: (key: string, fallback: string) => string;
}

function UserStatistics({
  users,
  teams,
  userTeams,
  jobPositions,
  invitations,
  translate
}: UserStatisticsProps) {
  const totalUsers = users.length;
  const adminCount = users.filter((u) => u.is_admin).length;
  const activeSubCount = users.filter((u) => u.has_active_subscription).length;
  const activeSubPercent =
    totalUsers > 0 ? Math.round((activeSubCount / totalUsers) * 100) : 0;

  const usersByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    userTeams.forEach((ut) => {
      counts.set(ut.team_id, (counts.get(ut.team_id) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([teamId, count]) => {
        const team = teams.find((t) => t.id === teamId);
        return team ? { team, count } : null;
      })
      .filter(
        (item): item is { team: Team; count: number } => !!item
      )
      .sort((a, b) => b.count - a.count);
  }, [userTeams, teams]);

  const usersByJobPosition = useMemo(() => {
    const counts = new Map<number, number>();
    users.forEach((u) => {
      const jpId = u.job_position_id as number | null | undefined;
      if (!jpId) return;
      counts.set(jpId, (counts.get(jpId) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([jobPositionId, count]) => {
        const jp = jobPositions.find(
          (p: any) => Number(p.id) === Number(jobPositionId)
        );
        return jp ? { jobPosition: jp, count } : null;
      })
      .filter(
        (item): item is { jobPosition: any; count: number } => !!item
      )
      .sort((a, b) => b.count - a.count);
  }, [users, jobPositions]);

  const invitationsOverTime = useMemo(() => {
    const map = new Map<string, number>();
    invitations.forEach((inv) => {
      if (!inv.created_at) return;
      const date = dayjs(inv.created_at as any).format("YYYY-MM-DD");
      map.set(date, (map.get(date) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [invitations]);

  const summaryLabels = {
    total: translate('stats.cards.total', 'Total Users'),
    admins: translate('stats.cards.admins', 'Admins'),
    subscriptions: translate('stats.cards.subscriptions', 'Active Subscriptions'),
    invitations: translate('stats.cards.invitations', 'Pending Invitations')
  };
  const charts = {
    usersPerTeamTitle: translate('stats.charts.usersPerTeam.title', 'Users per Team'),
    usersPerTeamDescription: translate('stats.charts.usersPerTeam.description', 'Distribution of users across teams'),
    usersPerTeamAxis: translate('stats.charts.usersPerTeam.axis', 'Users'),
    usersByJobTitle: translate('stats.charts.usersByJob.title', 'Users by Job Position'),
    usersByJobDescription: translate('stats.charts.usersByJob.description', 'Distribution across job positions'),
    usersByJobSeries: translate('stats.charts.usersByJob.series', 'Users'),
    invitationsOverTimeTitle: translate('stats.charts.invitationsOverTime.title', 'Invitations Over Time'),
    invitationsOverTimeDescription: translate('stats.charts.invitationsOverTime.description', 'Last 30 days of invitation creation'),
    invitationsAxis: translate('stats.charts.invitationsOverTime.axis', 'Invitations')
  };
  const emptyStates = {
    noTeamAssignments: translate('stats.empty.noTeamAssignments', 'No team assignment data available'),
    noJobPositions: translate('stats.empty.noJobPositions', 'No job position data available')
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalUsers}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.total}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-600">
                  {adminCount}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{summaryLabels.admins}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {activeSubPercent}%
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.subscriptions}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-sky-600">
                  {invitations.length}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.invitations}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{charts.usersPerTeamTitle}</CardTitle>
              <CardDescription className="text-xs">
                {charts.usersPerTeamDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersByTeam.length > 0 ? (
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: "axis",
                      axisPointer: { type: "shadow" }
                    },
                    grid: {
                      left: "3%",
                      right: "4%",
                      bottom: "3%",
                      containLabel: true
                    },
                    xAxis: {
                      type: "value",
                      name: charts.usersPerTeamAxis
                    },
                    yAxis: {
                      type: "category",
                      data: usersByTeam
                        .map((item) => item.team.name)
                        .reverse(),
                      axisLabel: {
                        formatter: (value: string) =>
                          value.length > 20
                            ? value.substring(0, 20) + "..."
                            : value
                      }
                    },
                    series: [
                      {
                        name: charts.usersPerTeamAxis,
                        type: "bar",
                        data: usersByTeam
                          .map((item) => ({
                            value: item.count,
                            itemStyle: {
                              color: item.team.color || "#6366f1"
                            }
                          }))
                          .reverse()
                      }
                    ]
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  {emptyStates.noTeamAssignments}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{charts.usersByJobTitle}</CardTitle>
              <CardDescription className="text-xs">
                {charts.usersByJobDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {usersByJobPosition.length > 0 ? (
                <ReactECharts
                  option={{
                    tooltip: {
                      trigger: "item",
                      formatter: "{b}: {c} ({d}%)"
                    },
                    legend: {
                      orient: "vertical",
                      left: "left",
                      textStyle: { fontSize: 10 }
                    },
                    series: [
                      {
                        name: charts.usersByJobSeries,
                        type: "pie",
                        radius: ["40%", "70%"],
                        avoidLabelOverlap: false,
                        itemStyle: {
                          borderRadius: 8,
                          borderColor: "#fff",
                          borderWidth: 2
                        },
                        label: {
                          show: true,
                          formatter: "{b}: {c}"
                        },
                        emphasis: {
                          label: {
                            show: true,
                            fontSize: 12,
                            fontWeight: "bold"
                          }
                        },
                        data: usersByJobPosition.map((item) => ({
                          value: item.count,
                          name: item.jobPosition.title
                        }))
                      }
                    ]
                  }}
                  style={{ height: "300px" }}
                />
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                  {emptyStates.noJobPositions}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invitations over time */}
        {invitationsOverTime.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{charts.invitationsOverTimeTitle}</CardTitle>
              <CardDescription className="text-xs">
                {charts.invitationsOverTimeDescription}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ReactECharts
                option={{
                  tooltip: {
                    trigger: "axis",
                    formatter: (params: any) => {
                      const param = params[0];
                      return `${param.axisValue}<br/>${param.marker}${param.seriesName}: ${param.value}`;
                    }
                  },
                  grid: {
                    left: "3%",
                    right: "4%",
                    bottom: "3%",
                    containLabel: true
                  },
                  xAxis: {
                    type: "category",
                    data: invitationsOverTime.map((item) =>
                      dayjs(item.date).format("MMM DD")
                    ),
                    axisLabel: {
                      rotate: 45,
                      fontSize: 10
                    }
                  },
                  yAxis: {
                    type: "value",
                    name: charts.invitationsAxis
                  },
                  series: [
                    {
                      name: charts.invitationsAxis,
                      type: "line",
                      smooth: true,
                      data: invitationsOverTime.map((item) => item.count),
                      areaStyle: {
                        color: {
                          type: "linear",
                          x: 0,
                          y: 0,
                          x2: 0,
                          y2: 1,
                          colorStops: [
                            {
                              offset: 0,
                              color: "rgba(99, 102, 241, 0.3)"
                            },
                            {
                              offset: 1,
                              color: "rgba(99, 102, 241, 0.05)"
                            }
                          ]
                        }
                      },
                      itemStyle: {
                        color: "#6366f1"
                      },
                      lineStyle: {
                        color: "#6366f1",
                        width: 2
                      }
                    }
                  ]
                }}
                style={{ height: "300px" }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default Users;