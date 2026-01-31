import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faUsers,
  faPlus,
  faChartBar,
  faCircleInfo,
  faLightbulb,
  faSitemap,
  faPalette,
  faUserTie,
  faToggleOn,
  faPen,
  faLayerGroup,
  faCheckCircle,
  faUser
} from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import { Team, Category, Task, Role, UserTeam } from "@/store/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrlTabs } from "@/components/ui/url-tabs";
import { StatusIcon } from "@/pages/settings/components/StatusIcon";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  TextField,
  SelectField,
  CheckboxField,
  IconPicker
} from "../components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import ReactECharts from "echarts-for-react";
import dayjs from "dayjs";
import { useLanguage } from "@/providers/LanguageProvider";
import { genericActions } from "@/store/genericSlices";
import { Plus, Trash } from "lucide-react";

// Custom cell renderer: show color avatar, name, and description stacked
const TeamNameCellRenderer = (props: ICellRendererParams) => {
  const name = props.value as string;
  const description = props.data?.description as string | null | undefined;
  const color = props.data?.color || '#6B7280';
  const isActive = props.data?.is_active !== false;
  return (
    <div className="flex items-center space-x-3 h-full">
      <div 
        className="w-6 h-6 min-w-[1.5rem] rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {name ? name.charAt(0).toUpperCase() : '?'}
      </div>
      <div className="flex flex-col leading-tight">
        <span className={`truncate ${isActive ? '' : 'line-through opacity-60'}`}>{name}</span>
        {description ? (
          <span className={`text-xs text-muted-foreground truncate ${isActive ? '' : 'line-through opacity-60'}`}>{description}</span>
        ) : null}
      </div>
    </div>
  );
};

function Teams() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const tt = (key: string, fallback: string) => t(`settings.teams.${key}`, fallback);
  const dispatch = useDispatch<AppDispatch>();
  const noneOptionLabel = tt('fields.none', 'None');
  const unassignedOptionLabel = tt('fields.unassigned', 'Unassigned');
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: users } = useSelector((state: RootState) => (state as any).users || { value: [] });
  const { value: userTeams } = useSelector((state: RootState) => state.userTeams) as { value: UserTeam[]; loading: boolean };
  const { value: roles } = useSelector((state: RootState) => state.roles) as { value: Role[]; loading: boolean };
  
  // Use shared state management
  const {
    items: teams,
    filteredItems,
    loading,
    error,
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
    setFormError,
    setEditingItem,
    editingItem: editingTeam,
    deletingItem: deletingTeam,
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  } = useSettingsState<Team>({
    entityName: 'teams',
    searchFields: ['name', 'description']
  });

  // Local state for form values
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: '',
    is_active: true,
    parent_team_id: null as number | null,
    team_lead_id: null as number | null
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: '',
    is_active: true,
    parent_team_id: null as number | null,
    team_lead_id: null as number | null
  });

  // Update edit form data when editing team changes
  useEffect(() => {
    if (editingTeam) {
      setEditFormData({
        name: editingTeam.name || '',
        description: editingTeam.description || '',
        color: editingTeam.color || '#4ECDC4',
        icon: editingTeam.icon ?? '',
        is_active: editingTeam.is_active ?? true,
        parent_team_id: editingTeam.parent_team_id ?? null,
        team_lead_id: editingTeam.team_lead_id ?? null
      });
      // Initialize user assignments for the users tab
      const related = userTeams.filter((ut) => ut.team_id === editingTeam.id);
      const assignments = related.map((ut) => ({
        id: ut.id,
        userId: String(ut.user_id),
        roleId: getRoleId(ut) != null ? String(getRoleId(ut)) : '',
        key: `existing-${ut.id}`
      }));
      setUserAssignments(assignments);
      setUsersFormError(null);
      setUserSearchTerm('');
    }
  }, [editingTeam, userTeams]);

  // Helper functions for counts
  const getTeamCategoryCount = (teamId: number) => {
    return categories.filter((category: Category) => category.team_id === teamId).length;
  };

  const getTeamTaskCount = (teamId: number) => {
    return tasks.filter((task: Task) => task.team_id === teamId).length;
  };

  // Validation for team deletion
  const canDeleteTeam = (team: Team) => {
    const categoryCount = getTeamCategoryCount(team.id);
    const taskCount = getTeamTaskCount(team.id);
    return categoryCount === 0 && taskCount === 0;
  };

  const handleDeleteTeam = (team: Team) => {
    if (canDeleteTeam(team)) {
      deleteItem(team.id);
    } else {
      handleDelete(team); // This will show the dialog with validation message
    }
  };

  // Quick lookup maps
  const teamIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of teams) map.set(t.id, t.name);
    return map;
  }, [teams]);

  const userIdToName = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of (users || [])) map.set(u.id, u.name);
    return map;
  }, [users]);

  const getRoleId = (ut: UserTeam | any) => {
    const val = ut?.role_id ?? ut?.roleId ?? ut?.role?.id;
    return val == null ? null : Number(val);
  };

  const [userAssignments, setUserAssignments] = useState<Array<{ id?: number; userId: string; roleId: string; key: string }>>([]);
  const [usersFormError, setUsersFormError] = useState<string | null>(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const addUserAssignment = () => {
    const used = new Set(userAssignments.map((a) => a.userId));
    const firstAvailable = (users || []).find((u: any) => !used.has(String(u.id)));
    if (!firstAvailable) {
      setUsersFormError(tt('dialogs.manageUsers.noAvailableUsers', 'No more users available to add.'));
      return;
    }
    setUserAssignments((prev) => [
      ...prev,
      {
        userId: firstAvailable ? String(firstAvailable.id) : '',
        roleId: '',
        key: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`
      }
    ]);
  };

  const updateUserAssignment = (key: string, patch: Partial<{ userId: string; roleId: string }>) => {
    setUserAssignments((prev) =>
      prev.map((a) => (a.key === key ? { ...a, ...patch } : a))
    );
  };

  const removeUserAssignment = (key: string) => {
    setUserAssignments((prev) => prev.filter((a) => a.key !== key));
  };

  const saveUserAssignments = async (teamId: number) => {
    setUsersFormError(null);
    const existing = userTeams.filter((ut) => ut.team_id === teamId);
    const isEmpty = userAssignments.length === 0;
    const current = isEmpty
      ? []
      : userAssignments.map((a) => ({
          ...a,
          userIdNum: Number(a.userId),
          roleIdNum: a.roleId ? Number(a.roleId) : null
        }));

    if (!isEmpty) {
      if (current.some((c) => !c.userId || Number.isNaN(c.userIdNum))) {
        setUsersFormError(tt('dialogs.manageUsers.errors.userRequired', 'Selecciona un usuario para cada fila.'));
        throw new Error(tt('dialogs.manageUsers.errors.userRequired', 'Selecciona un usuario para cada fila.'));
      }
      if (current.some((c) => c.roleId == null || c.roleId === '' || Number.isNaN(c.roleIdNum ?? NaN))) {
        setUsersFormError(tt('dialogs.manageUsers.errors.roleRequired', 'Selecciona un rol para cada usuario.'));
        throw new Error(tt('dialogs.manageUsers.errors.roleRequired', 'Selecciona un rol para cada usuario.'));
      }
      const duplicate = current.find((c, idx) => current.findIndex((d) => d.userIdNum === c.userIdNum) !== idx);
      if (duplicate) {
        setUsersFormError(tt('dialogs.manageUsers.errors.duplicateUser', 'No puedes repetir el mismo usuario.'));
        throw new Error(tt('dialogs.manageUsers.errors.duplicateUser', 'No puedes repetir el mismo usuario.'));
      }
    }

    const toAdd = current.filter((c) => c.id == null);
    const toUpdate = current.filter((c) => {
      const match = existing.find((ex) => ex.id === c.id);
      if (!match) return false;
      return match.user_id !== c.userIdNum || getRoleId(match) !== c.roleIdNum;
    });
    const toRemove = existing.filter((ex) => !current.some((c) => c.id === ex.id));

    for (const add of toAdd) {
      await dispatch((genericActions as any).userTeams.addAsync({
        user_id: add.userIdNum,
        team_id: teamId,
        role_id: add.roleIdNum
      })).unwrap();
    }

    for (const upd of toUpdate) {
      await dispatch((genericActions as any).userTeams.updateAsync({
        id: upd.id,
        updates: {
          user_id: upd.userIdNum,
          team_id: teamId,
          role_id: upd.roleIdNum
        }
      })).unwrap();
    }

    for (const del of toRemove) {
      await dispatch((genericActions as any).userTeams.removeAsync(del.id)).unwrap();
    }

    dispatch((genericActions as any).userTeams.getFromIndexedDB?.());
  };

  // Open edit with immediate form population to avoid flicker
  const handleQuickEdit = useCallback((item: Team) => {
    if (!item) return;
    setEditFormData({
      name: item.name || '',
      description: item.description || '',
      color: item.color || '#4ECDC4',
      icon: (item as any).icon ?? '',
      is_active: (item as any).is_active ?? true,
      parent_team_id: (item as any).parent_team_id ?? null,
      team_lead_id: (item as any).team_lead_id ?? null
    });
    setFormError(null);
    setEditingItem(item);
    setIsEditDialogOpen(true);
  }, [setEditFormData, setFormError, setEditingItem, setIsEditDialogOpen]);

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: tt('grid.columns.teamName', 'Team Name'),
      flex: 1.5,
      minWidth: 220,
      maxWidth: 420,
      cellRenderer: TeamNameCellRenderer
    },
    {
      field: 'parent_team_id',
      headerName: tt('grid.columns.parentTeam', 'Parent Team'),
      flex: 1,
      minWidth: 160,
      valueGetter: (p) => p.data?.parent_team_id ?? null,
      cellRenderer: (p: ICellRendererParams) => {
        const id = p?.data?.parent_team_id as number | null | undefined;
        return id ? (teamIdToName.get(id) || `#${id}`) : '-';
      }
    },
    {
      field: 'icon',
      headerName: tt('grid.columns.icon', 'Icon'),
      width: 90,
      cellRenderer: (p: ICellRendererParams) => {
        const iconStr: string = p?.data?.icon || 'fas fa-circle';
        const color = p?.data?.color || '#6B7280';
        return (
          <div className="flex items-center h-full">
            <StatusIcon icon={iconStr} color={color} />
          </div>
        );
      },
      sortable: false,
      filter: false
    },
    {
      field: 'team_lead_id',
      headerName: tt('grid.columns.teamLead', 'Team Lead'),
      flex: 1,
      minWidth: 180,
      valueGetter: (p) => p.data?.team_lead_id ?? null,
      cellRenderer: (p: ICellRendererParams) => {
        const id = p?.data?.team_lead_id as number | null | undefined;
        if (!id) return '-';
        return userIdToName.get(id) || `User #${id}`;
      }
    },
    {
      field: 'is_active',
      headerName: tt('grid.columns.active', 'Active'),
      width: 100,
      valueGetter: (p) => !!p.data?.is_active,
      cellRenderer: (p: ICellRendererParams) => (p?.data?.is_active ? tt('grid.values.yes', 'Yes') : tt('grid.values.no', 'No'))
    },
    // Tasks column removed per request; task counts still used in delete validation and stats
  ], [teamIdToName, userIdToName, t]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!createFormData.name?.trim()) {
      throw new Error(tt('validation.nameRequired', 'Team name is required'));
    }

    const teamData = {
      name: createFormData.name.trim(),
      description: createFormData.description.trim(),
      color: createFormData.color,
      icon: createFormData.icon || null,
      is_active: !!createFormData.is_active,
      parent_team_id: createFormData.parent_team_id,
      team_lead_id: createFormData.team_lead_id,
      deleted_at: null
    };

    await createItem(teamData);

    // Reset form after successful creation
    setCreateFormData({
      name: '',
      description: '',
      color: '#4ECDC4',
      icon: '',
      is_active: true,
      parent_team_id: null,
      team_lead_id: null
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

    // Validate required fields
    if (!editFormData.name?.trim()) {
      throw new Error(tt('validation.nameRequired', 'Team name is required'));
    }

    const updates = {
      name: editFormData.name.trim(),
      description: editFormData.description.trim(),
      color: editFormData.color,
      icon: editFormData.icon || null,
      is_active: !!editFormData.is_active,
      parent_team_id: editFormData.parent_team_id,
      team_lead_id: editFormData.team_lead_id
    };

    await updateItem(editingTeam.id, updates);
    
    // Also save user assignments if they were modified
    try {
      await saveUserAssignments(editingTeam.id);
    } catch (err: any) {
      // If user assignment save fails, show error but don't block the team update
      setUsersFormError(err?.message || tt('dialogs.manageUsers.errors.generic', 'Error updating team users'));
    }
  };


  // Render entity preview for delete dialog
  const renderTeamPreview = (team: Team) => {
    const categoryCount = getTeamCategoryCount(team.id);
    const taskCount = getTeamTaskCount(team.id);
    const categoriesLabel = tt('preview.categoriesLabel', '{count} categories').replace('{count}', String(categoryCount));
    const tasksLabel = tt('preview.tasksLabel', '{count} tasks').replace('{count}', String(taskCount));
    return (
      <div className="flex items-center space-x-3">
        <div 
          className="w-8 h-8 min-w-[2rem] rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
          style={{ backgroundColor: team.color ?? '#6B7280' }}
        >
          {team.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="font-medium">{team.name}</div>
          <div className="text-sm text-muted-foreground">{team.description}</div>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {categoriesLabel}
            </span>
            <span className="text-xs text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">
              {tasksLabel}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <SettingsLayout
      title={tt('title', 'Teams')}
      description={tt('description', 'Organize and manage work teams for collaboration')}
      icon={faUsers}
      iconColor="#8b5cf6"
      loading={{
        isLoading: loading,
        message: tt('loading', 'Loading teams...')
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/users')}>
            {tt('header.manageUsers', 'Manage Users')}
          </Button>
          <Button
            size="default"
            className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-[0.98]"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            {tt('header.addTeam', 'Add Team')}
          </Button>
        </div>
      }
    >
      <UrlTabs
        tabs={[
          {
            value: "teams",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faUsers} className="w-4 h-4" />
                <span>{tt('tabs.grid', 'Teams')}</span>
              </div>
            ),
            content: (
              <div className="flex h-full flex-col">
                <div className="flex-1 min-h-0">
                  <SettingsGrid
                    rowData={filteredItems}
                    columnDefs={colDefs}
                    noRowsMessage={tt('grid.noRows', 'No teams found')}
                    rowSelection="single"
                    onRowDoubleClicked={(row: any) => handleQuickEdit(row?.data ?? row)}
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
                <span>{tt('tabs.stats', 'Statistics')}</span>
              </div>
            ),
            content: (
              <TeamStatistics
                teams={teams}
                categories={categories}
                tasks={tasks}
                translate={tt}
              />
            )
          },
          {
            value: "help",
            label: (
              <div className="flex items-center gap-2">
                <FontAwesomeIcon icon={faCircleInfo} className="w-4 h-4" />
                <span>{tt('tabs.help', 'Visual help')}</span>
              </div>
            ),
            content: (
              <TeamHelpContent
                translate={tt}
                onAddTeam={() => setIsCreateDialogOpen(true)}
                onManageUsers={() => navigate('/settings/users')}
              />
            )
          }
        ]}
        defaultValue="teams"
        basePath="/settings/teams"
        className="h-full flex flex-col"
      />

      {/* Create Team Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) {
            // Reset form data when closing create dialog
            setCreateFormData({
              name: '',
              description: '',
              color: '#4ECDC4',
              icon: '',
              is_active: true,
              parent_team_id: null,
              team_lead_id: null
            });
          }
        }}
        type="create"
        title={tt('dialogs.create.title', 'Add New Team')}
        description={tt('dialogs.create.description', 'Create a new team to organize work and collaboration.')}
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <TextField
            id="name"
            label={tt('dialogs.create.fields.name', 'Name')}
            value={createFormData.name}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, name: value }))}
            required
          />
          <TextField
            id="description"
            label={tt('dialogs.create.fields.description', 'Description')}
            value={createFormData.description}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, description: value }))}
          />
          <TextField
            id="color"
            label={tt('dialogs.create.fields.color', 'Color')}
            type="color"
            value={createFormData.color}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, color: value }))}
          />
          <IconPicker
            id="icon"
            label={tt('dialogs.create.fields.icon', 'Icon')}
            value={createFormData.icon}
            onChange={(icon) => setCreateFormData(prev => ({ ...prev, icon }))}
            color={createFormData.color}
          />
          <SelectField
            id="parent-team"
            label={tt('dialogs.create.fields.parentTeam', 'Parent Team')}
            value={createFormData.parent_team_id ?? 'none'}
            onChange={(val) => setCreateFormData(prev => ({ ...prev, parent_team_id: val === 'none' ? null : Number(val) }))}
            options={[{ value: 'none', label: noneOptionLabel }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
          />
          <SelectField
            id="team-lead"
            label={tt('dialogs.create.fields.teamLead', 'Team Lead')}
            value={createFormData.team_lead_id ?? 'none'}
            onChange={(val) => setCreateFormData(prev => ({ ...prev, team_lead_id: val === 'none' ? null : Number(val) }))}
            options={[{ value: 'none', label: unassignedOptionLabel }, ...(users || []).map((u: any) => ({ value: u.id, label: u.name }))]}
          />
          <CheckboxField
            id="is-active"
            label={tt('dialogs.create.fields.active', 'Active')}
            checked={!!createFormData.is_active}
            onChange={(checked) => setCreateFormData(prev => ({ ...prev, is_active: checked }))}
          />
        </div>
      </SettingsDialog>

      {/* Edit Team Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open);
          if (!open) {
            // Reset form data when closing edit dialog
            setEditFormData({
              name: '',
              description: '',
              color: '#4ECDC4',
              icon: '',
              is_active: true,
              parent_team_id: null,
              team_lead_id: null
            });
            // Reset user assignments and search
            setUserAssignments([]);
            setUserSearchTerm('');
            setUsersFormError(null);
          }
        }}
        type="edit"
        title={tt('dialogs.edit.title', 'Edit Team')}
        description={tt('dialogs.edit.description', 'Update the team information.')}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError || usersFormError || undefined}
        submitDisabled={isSubmitting || !editingTeam}
        footerActions={
          editingTeam ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              onClick={() => {
                setIsEditDialogOpen(false);
                handleDeleteTeam(editingTeam);
              }}
              disabled={isSubmitting}
              title={tt('dialogs.delete.title', 'Delete Team')}
              aria-label={tt('dialogs.delete.title', 'Delete Team')}
            >
              <Trash className="h-4 w-4" />
            </Button>
          ) : null
        }
      >
        {editingTeam && (
          <Tabs defaultValue="general" className="w-full">
            <TabsList>
              <TabsTrigger value="general">{tt('dialogs.edit.tabs.general', 'General')}</TabsTrigger>
              <TabsTrigger value="users">{tt('dialogs.edit.tabs.users', 'Users')}</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <div className="grid gap-4">
                <TextField
                  id="edit-name"
                  label={tt('dialogs.edit.fields.name', 'Name')}
                  value={editFormData.name}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
                  required
                />
                <TextField
                  id="edit-description"
                  label={tt('dialogs.edit.fields.description', 'Description')}
                  value={editFormData.description}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, description: value }))}
                />
                <TextField
                  id="edit-color"
                  label={tt('dialogs.edit.fields.color', 'Color')}
                  type="color"
                  value={editFormData.color}
                  onChange={(value) => setEditFormData(prev => ({ ...prev, color: value }))}
                />
                <IconPicker
                  id="edit-icon"
                  label={tt('dialogs.edit.fields.icon', 'Icon')}
                  value={editFormData.icon}
                  onChange={(icon) => setEditFormData(prev => ({ ...prev, icon }))}
                  color={editFormData.color}
                />
                <SelectField
                  id="edit-parent-team"
                  label={tt('dialogs.edit.fields.parentTeam', 'Parent Team')}
                  value={editFormData.parent_team_id ?? 'none'}
                  onChange={(val) => setEditFormData(prev => ({ ...prev, parent_team_id: val === 'none' ? null : Number(val) }))}
                  options={[{ value: 'none', label: noneOptionLabel }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
                />
                <SelectField
                  id="edit-team-lead"
                  label={tt('dialogs.edit.fields.teamLead', 'Team Lead')}
                  value={editFormData.team_lead_id ?? 'none'}
                  onChange={(val) => setEditFormData(prev => ({ ...prev, team_lead_id: val === 'none' ? null : Number(val) }))}
                  options={[{ value: 'none', label: unassignedOptionLabel }, ...(users || []).map((u: any) => ({ value: u.id, label: u.name }))]}
                />
                <CheckboxField
                  id="edit-is-active"
                  label={tt('dialogs.edit.fields.active', 'Active')}
                  checked={!!editFormData.is_active}
                  onChange={(checked) => setEditFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>
            </TabsContent>
            <TabsContent value="users">
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-muted/60 rounded-md px-3 py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                      {editingTeam.name?.charAt(0)?.toUpperCase?.() || 'T'}
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="font-semibold text-sm">{editingTeam.name}</span>
                      <span className="text-xs text-muted-foreground">
                        <FontAwesomeIcon icon={faUser} className="w-3 h-3 mr-1" />
                        {userAssignments.length} {tt('dialogs.manageUsers.count', 'users')}
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addUserAssignment}
                    disabled={!((users || []).some((u: any) => !userAssignments.find((a) => a.userId === String(u.id))))}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {tt('dialogs.manageUsers.add', 'Add user')}
                  </Button>
                </div>

                {userAssignments.length === 0 ? (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    {tt('dialogs.manageUsers.empty', 'No users assigned. Add one to get started.')}
                  </div>
                ) : (
                  <>
                    <TextField
                      id="user-search"
                      label={tt('dialogs.manageUsers.search', 'Buscar usuario')}
                      value={userSearchTerm}
                      onChange={setUserSearchTerm}
                      placeholder={tt('dialogs.manageUsers.searchPlaceholder', 'Escribe para filtrar...')}
                    />
                    <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                      {(() => {
                        const q = userSearchTerm.trim().toLowerCase();
                        const visibleAssignments = q
                          ? userAssignments.filter((assignment) => {
                              const user = (users || []).find((u: any) => String(u.id) === assignment.userId);
                              if (user) {
                                const nameMatch = (user.name || '').toLowerCase().includes(q);
                                const emailMatch = (user.email || '').toLowerCase().includes(q);
                                if (nameMatch || emailMatch) return true;
                              }
                              return false;
                            })
                          : userAssignments;

                        if (userAssignments.length > 0 && visibleAssignments.length === 0) {
                          return (
                            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                              {tt('dialogs.manageUsers.noMatches', 'No hay usuarios que coincidan con la búsqueda.')}
                            </div>
                          );
                        }

                        return visibleAssignments.map((assignment) => {
                          const usedUserIds = userAssignments
                            .filter((a) => a.key !== assignment.key)
                            .map((a) => a.userId);
                          const userOptions = (users || [])
                            .filter((u: any) => assignment.userId === String(u.id) || !usedUserIds.includes(String(u.id)))
                            .filter((u: any) => {
                              const q = userSearchTerm.trim().toLowerCase();
                              if (!q) return true;
                              return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                            })
                            .map((u: any) => ({ value: String(u.id), label: u.name || u.email || `User ${u.id}` }));
                          const teamRoles = roles.filter((r) => r.scope === 'TEAM');
                          const roleOptions = teamRoles.map((r) => ({ value: String(r.id), label: r.name }));
                          const hasCurrentUser = assignment.userId && userOptions.some((opt: { value: string }) => opt.value === assignment.userId);
                          const hasCurrentRole = assignment.roleId && roleOptions.some((opt) => opt.value === assignment.roleId);
                          return (
                            <div key={assignment.key} className="grid grid-cols-12 gap-3 items-end border rounded-md p-3">
                              <div className="col-span-5">
                                <SelectField
                                  id={`user-${assignment.key}`}
                                  label={tt('dialogs.manageUsers.user', 'User')}
                                  value={assignment.userId}
                                  onChange={(value) => updateUserAssignment(assignment.key, { userId: value })}
                                  options={hasCurrentUser || !assignment.userId ? userOptions : [{ value: assignment.userId, label: tt('dialogs.manageUsers.unknownUser', `User ${assignment.userId}`) }, ...userOptions]}
                                  placeholder={tt('dialogs.manageUsers.selectUser', 'Select a user')}
                                  searchable
                                  searchPlaceholder={tt('dialogs.manageUsers.searchPlaceholder', 'Escribe para filtrar...')}
                                  required
                                />
                              </div>
                              <div className="col-span-5">
                                <SelectField
                                  id={`role-${assignment.key}`}
                                  label={tt('dialogs.manageUsers.role', 'Role')}
                                  value={assignment.roleId}
                                  onChange={(value) => updateUserAssignment(assignment.key, { roleId: value })}
                                  options={hasCurrentRole || !assignment.roleId ? roleOptions : [{ value: assignment.roleId, label: tt('dialogs.manageUsers.unknownRole', `Role ${assignment.roleId}`) }, ...roleOptions]}
                                  placeholder={tt('dialogs.manageUsers.selectRole', 'Select a role')}
                                  required
                                />
                              </div>
                              <div className="col-span-2 flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeUserAssignment(assignment.key)}
                                  aria-label={tt('dialogs.manageUsers.remove', 'Remove')}
                                >
                                  <Trash className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </SettingsDialog>

      {/* Delete Team Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title={tt('dialogs.delete.title', 'Delete Team')}
        description={
          deletingTeam ? (() => {
            const categoryCount = getTeamCategoryCount(deletingTeam.id);
            const taskCount = getTeamTaskCount(deletingTeam.id);
            
            if (categoryCount > 0 || taskCount > 0) {
              return tt(
                'dialogs.delete.restricted',
                'This team cannot be deleted because it has {categories} categories and {tasks} tasks. Please reassign or delete all associated items first.'
              )
                .replace('{categories}', String(categoryCount))
                .replace('{tasks}', String(taskCount));
            } else {
              return tt(
                'dialogs.delete.confirm',
                'Are you sure you want to delete the team "{name}"? This action cannot be undone.'
              ).replace('{name}', deletingTeam.name);
            }
          })() : undefined
        }
        onConfirm={() => deletingTeam && canDeleteTeam(deletingTeam) ? deleteItem(deletingTeam.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingTeam || !canDeleteTeam(deletingTeam)}
        entityName={tt('entityName', 'team')}
        entityData={deletingTeam}
        renderEntityPreview={renderTeamPreview}
      />
    </SettingsLayout>
  );
}

interface TeamStatisticsProps {
  teams: Team[];
  categories: Category[];
  tasks: Task[];
  translate: (key: string, fallback: string) => string;
}

function TeamStatistics({ teams, categories, tasks, translate }: TeamStatisticsProps) {
  const totalTeams = teams.length;
  const totalCategories = categories.length;

  const activeTeams = useMemo(
    () => teams.filter((t: any) => t.is_active !== false).length,
    [teams]
  );

  const inactiveTeams = totalTeams - activeTeams;

  const tasksByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    tasks.forEach((task: Task) => {
      const tid = task.team_id as number | null | undefined;
      if (!tid) return;
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([teamId, count]) => {
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? { team, count } : null;
      })
      .filter((item): item is { team: Team; count: number } => !!item)
      .sort((a, b) => b.count - a.count);
  }, [tasks, teams]);

  const categoriesByTeam = useMemo(() => {
    const counts = new Map<number, number>();
    categories.forEach((cat: any) => {
      const tid = cat.team_id as number | null | undefined;
      if (!tid) return;
      counts.set(tid, (counts.get(tid) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([teamId, count]) => {
        const team = teams.find((t: Team) => t.id === teamId);
        return team ? { team, count } : null;
      })
      .filter((item): item is { team: Team; count: number } => !!item)
      .sort((a, b) => b.count - a.count);
  }, [categories, teams]);

  const tasksOverTime = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((task: Task) => {
      if (!task.created_at) return;
      const date = dayjs(task.created_at).format("YYYY-MM-DD");
      map.set(date, (map.get(date) || 0) + 1);
    });

    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [tasks]);

  const avgCategoriesPerTeam =
    totalTeams > 0 ? Math.round((totalCategories / totalTeams) * 10) / 10 : 0;

  const summaryLabels = {
    total: translate('stats.cards.total', 'Total Teams'),
    active: translate('stats.cards.active', 'Active Teams'),
    inactive: translate('stats.cards.inactive', 'Inactive Teams'),
    avgCategories: translate('stats.cards.avgCategories', 'Avg Categories / Team')
  };
  const statusChart = {
    title: translate('stats.charts.status.title', 'Teams by Status'),
    description: translate('stats.charts.status.description', 'Active vs inactive teams'),
    legendActive: translate('stats.charts.status.legendActive', 'Active'),
    legendInactive: translate('stats.charts.status.legendInactive', 'Inactive'),
    seriesName: translate('stats.charts.status.seriesName', 'Teams'),
    empty: translate('stats.empty.noTeams', 'No team data available')
  };
  const tasksChart = {
    title: translate('stats.charts.tasksByTeam.title', 'Tasks by Team'),
    description: translate('stats.charts.tasksByTeam.description', 'Top teams by assigned tasks'),
    axis: translate('stats.charts.tasksByTeam.axis', 'Tasks'),
    empty: translate('stats.empty.noTasks', 'No task data available')
  };
  const categoriesChart = {
    title: translate('stats.charts.categoriesByTeam.title', 'Categories by Team'),
    description: translate('stats.charts.categoriesByTeam.description', 'Distribution of categories across teams'),
    axis: translate('stats.charts.categoriesByTeam.axis', 'Categories'),
    empty: translate('stats.empty.noCategories', 'No category data available')
  };
  const overTimeChart = {
    title: translate('stats.charts.tasksOverTime.title', 'Tasks Over Time'),
    description: translate('stats.charts.tasksOverTime.description', 'Last 30 days of task creation across all teams'),
    axis: translate('stats.charts.tasksOverTime.axis', 'Tasks'),
    series: translate('stats.charts.tasksOverTime.series', 'Tasks Created')
  };

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{totalTeams}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.total}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-600">
                  {activeTeams}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.active}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {inactiveTeams}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.inactive}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{avgCategoriesPerTeam}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {summaryLabels.avgCategories}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Donut chart: teams by status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{statusChart.title}</CardTitle>
            <CardDescription className="text-xs">
              {statusChart.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {totalTeams > 0 ? (
              <ReactECharts
                option={{
                  tooltip: {
                    trigger: "item",
                    formatter: "{b}: {c} ({d}%)"
                  },
                  legend: {
                    orient: "vertical",
                    left: "left",
                    textStyle: { fontSize: 11 }
                  },
                  series: [
                    {
                        name: statusChart.seriesName,
                      type: "pie",
                      radius: ["40%", "70%"],
                      avoidLabelOverlap: true,
                      itemStyle: {
                        borderRadius: 8,
                        borderColor: "#fff",
                        borderWidth: 2
                      },
                      label: {
                        show: true,
                        position: "inside",
                        formatter: "{b}",
                        fontSize: 11
                      },
                      labelLine: {
                        show: false
                      },
                      labelLayout: {
                        hideOverlap: true
                      },
                      emphasis: {
                        label: {
                          show: true,
                          fontSize: 12,
                          fontWeight: "bold"
                        }
                      },
                      data: [
                        {
                          value: activeTeams,
                            name: statusChart.legendActive,
                          itemStyle: { color: "#22c55e" }
                        },
                        {
                          value: inactiveTeams,
                            name: statusChart.legendInactive,
                          itemStyle: { color: "#9ca3af" }
                        }
                      ]
                    }
                  ]
                }}
                style={{ height: "260px" }}
              />
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground text-sm">
                  {statusChart.empty}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{tasksChart.title}</CardTitle>
              <CardDescription className="text-xs">
                {tasksChart.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {tasksByTeam.length > 0 ? (
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
                      name: tasksChart.axis
                    },
                    yAxis: {
                      type: "category",
                      data: tasksByTeam
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
                        name: tasksChart.axis,
                        type: "bar",
                        data: tasksByTeam
                          .map((item) => ({
                            value: item.count,
                            itemStyle: {
                              color: item.team.color || "#3b82f6"
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
                  {tasksChart.empty}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{categoriesChart.title}</CardTitle>
              <CardDescription className="text-xs">
                {categoriesChart.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categoriesByTeam.length > 0 ? (
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
                      name: categoriesChart.axis
                    },
                    yAxis: {
                      type: "category",
                      data: categoriesByTeam
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
                        name: categoriesChart.axis,
                        type: "bar",
                        data: categoriesByTeam
                          .map((item) => ({
                            value: item.count,
                            itemStyle: {
                              color: item.team.color || "#8b5cf6"
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
                  {categoriesChart.empty}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tasks over time */}
        {tasksOverTime.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{overTimeChart.title}</CardTitle>
              <CardDescription className="text-xs">
                {overTimeChart.description}
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
                    data: tasksOverTime.map((item) =>
                      dayjs(item.date).format("MMM DD")
                    ),
                    axisLabel: {
                      rotate: 45,
                      fontSize: 10
                    }
                  },
                  yAxis: {
                    type: "value",
                    name: overTimeChart.axis
                  },
                  series: [
                    {
                        name: overTimeChart.series,
                      type: "line",
                      smooth: true,
                      data: tasksOverTime.map((item) => item.count),
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
                              color: "rgba(139, 92, 246, 0.3)"
                            },
                            {
                              offset: 1,
                              color: "rgba(139, 92, 246, 0.05)"
                            }
                          ]
                        }
                      },
                      itemStyle: {
                        color: "#8b5cf6"
                      },
                      lineStyle: {
                        color: "#8b5cf6",
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

interface TeamHelpContentProps {
  translate: (key: string, fallback: string) => string;
  onAddTeam: () => void;
  onManageUsers: () => void;
}

interface HelpFieldCard {
  key: string;
  icon: IconDefinition;
  title: string;
  description: string;
}

interface HelpLifecycleStep {
  key: string;
  icon: IconDefinition;
  title: string;
  description: string;
}

function TeamHelpContent({ translate, onAddTeam, onManageUsers }: TeamHelpContentProps) {
  const fieldCards: HelpFieldCard[] = [
    {
      key: 'name',
      icon: faPen,
      title: translate('help.fields.name.title', 'Name & description'),
      description: translate('help.fields.name.description', 'Pick a short, searchable label and explain the team’s scope so other admins know when to use it.')
    },
    {
      key: 'appearance',
      icon: faPalette,
      title: translate('help.fields.appearance.title', 'Color & icon'),
      description: translate('help.fields.appearance.description', 'Visual cues keep the grid readable. Choose contrasting colors for squads that collaborate often.')
    },
    {
      key: 'hierarchy',
      icon: faSitemap,
      title: translate('help.fields.hierarchy.title', 'Parent team'),
      description: translate('help.fields.hierarchy.description', 'Nest teams to mirror departments or regions. Child teams inherit visibility rules from their parent.')
    },
    {
      key: 'lead',
      icon: faUserTie,
      title: translate('help.fields.lead.title', 'Team lead'),
      description: translate('help.fields.lead.description', 'Select a point of contact for escalations. Only users in the directory are available here.')
    },
    {
      key: 'status',
      icon: faToggleOn,
      title: translate('help.fields.status.title', 'Active toggle'),
      description: translate('help.fields.status.description', 'Archive a team without losing history by switching it off instead of deleting it.')
    },
    {
      key: 'relations',
      icon: faLayerGroup,
      title: translate('help.fields.relationships.title', 'Linked work'),
      description: translate('help.fields.relationships.description', 'Categories and tasks rely on their team. Reassign those items before removing a team.')
    }
  ];

  const lifecycleSteps: HelpLifecycleStep[] = [
    {
      key: 'plan',
      icon: faLightbulb,
      title: translate('help.lifecycle.plan.title', 'Plan your structure'),
      description: translate('help.lifecycle.plan.description', 'List the departments, squads or pods you support and decide which ones should be parent teams.')
    },
    {
      key: 'create',
      icon: faPlus,
      title: translate('help.lifecycle.create.title', 'Create & brand the team'),
      description: translate('help.lifecycle.create.description', 'Use consistent naming and colors so people can instantly recognize the team in filters and dashboards.')
    },
    {
      key: 'assign',
      icon: faUsers,
      title: translate('help.lifecycle.assign.title', 'Assign ownership'),
      description: translate('help.lifecycle.assign.description', 'Set the team lead, link categories, and make sure tasks are routed to the correct team.')
    },
    {
      key: 'measure',
      icon: faChartBar,
      title: translate('help.lifecycle.measure.title', 'Measure & iterate'),
      description: translate('help.lifecycle.measure.description', 'Review the Statistics tab to spot overloaded teams and rebalance categories or workloads.')
    }
  ];

  const bestPractices = [
    translate('help.bestPractices.visual', 'Reuse colors and icons only when teams collaborate closely to avoid visual noise.'),
    translate('help.bestPractices.naming', 'Stick to a naming convention (region-team-type) so searches stay predictable.'),
    translate('help.bestPractices.hierarchy', 'Use parent teams sparingly—two levels are usually enough for clear reporting.'),
    translate('help.bestPractices.integrity', 'Before deleting a team, verify with stakeholders that all tasks and categories have migrated.')
  ];

  const optionBullets = [
    translate('help.options.grid.actions', 'Use the action menu in the Teams grid to jump into quick edit or delete.'),
    translate('help.options.grid.search', 'Search instantly filters by team name or description when you need to find a squad.'),
    translate('help.options.grid.sort', 'Click column headers to sort by parent, lead, or status to identify gaps.'),
    translate('help.options.grid.quickEdit', 'Double-click a row to open editing with pre-filled data—no need to leave the grid.')
  ];

  const deletionReminders = [
    translate('help.deletion.guard', 'Teams that still own categories or tasks cannot be deleted for integrity reasons.'),
    translate('help.deletion.reassign', 'Reassign dependent categories/tasks first, then delete or archive the team.'),
    translate('help.deletion.archive', 'Keep historical reporting by toggling the team inactive instead of deleting it outright.')
  ];

  return (
    <div className="flex-1 min-h-0 overflow-auto p-4">
      <div className="space-y-4">
        <Card className="border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FontAwesomeIcon icon={faCircleInfo} className="text-violet-600" />
              {translate('help.hero.title', 'Need a quick refresher on teams?')}
            </CardTitle>
            <CardDescription className="text-sm">
              {translate('help.hero.description', 'Understand what each option does before creating or updating teams.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={onAddTeam}>
                <FontAwesomeIcon icon={faPlus} className="mr-2 h-3.5 w-3.5" />
                {translate('help.hero.createAction', 'Create a team')}
              </Button>
              <Button size="sm" variant="outline" onClick={onManageUsers}>
                <FontAwesomeIcon icon={faUsers} className="mr-2 h-3.5 w-3.5" />
                {translate('help.hero.manageUsers', 'Assign or invite users')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {translate('help.fields.title', 'What each option controls')}
            </CardTitle>
            <CardDescription className="text-xs">
              {translate('help.fields.subtitle', 'Reference this checklist while filling the team form.')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {fieldCards.map((card) => (
                <div
                  key={card.key}
                  className="flex gap-3 rounded-lg border border-border/60 bg-background/60 p-3 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-600">
                    <FontAwesomeIcon icon={card.icon} className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{card.title}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {translate('help.lifecycle.title', 'Recommended flow')}
              </CardTitle>
              <CardDescription className="text-xs">
                {translate('help.lifecycle.subtitle', 'Follow these steps to keep your structure clean.')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {lifecycleSteps.map((step, index) => (
                <div key={step.key} className="rounded-lg border border-border/60 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant="secondary">
                      {translate('help.lifecycle.stepLabel', 'Step {step}').replace('{step}', String(index + 1))}
                    </Badge>
                    <FontAwesomeIcon icon={step.icon} className="h-4 w-4 text-violet-500" />
                  </div>
                  <div className="text-sm font-medium">{step.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {translate('help.bestPractices.title', 'Best practices')}
              </CardTitle>
              <CardDescription className="text-xs">
                {translate('help.bestPractices.subtitle', 'Avoid the most common pitfalls when configuring teams.')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {bestPractices.map((tip, index) => (
                  <li key={`${tip}-${index}`} className="flex gap-2">
                    <FontAwesomeIcon icon={faCheckCircle} className="mt-1 h-3.5 w-3.5 text-emerald-500" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              {translate('help.options.title', 'Where to manage everything')}
            </CardTitle>
            <CardDescription className="text-xs">
              {translate('help.options.subtitle', 'Use these areas to keep teams, users, and workload perfectly aligned.')}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FontAwesomeIcon icon={faLayerGroup} className="text-violet-500" />
                {translate('help.options.gridTitle', 'Teams grid')}
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {optionBullets.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span className="text-violet-500">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border/60 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <FontAwesomeIcon icon={faChartBar} className="text-indigo-500" />
                {translate('help.options.statsTitle', 'Statistics & safety')}
              </div>
              <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
                {deletionReminders.map((item, index) => (
                  <li key={`${item}-${index}`} className="flex gap-2">
                    <span className="text-indigo-500">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Teams;
