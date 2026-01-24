import { useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faPlus,
  faChartBar,
  faCircleInfo
} from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Team } from "@/store/types";
import { Button } from "@/components/ui/button";
import { UrlTabs } from "@/components/ui/url-tabs";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  TextField,
  SelectField,
  CheckboxField,
  IconPicker
} from "../../components";
import { useLanguage } from "@/providers/LanguageProvider";
import { Trash } from "lucide-react";
import { TeamStatistics, TeamHelpContent, ManageUsersDialog } from "./components";
import { useTeamColumnDefs } from "./utils/columnDefs";
import { useTeamFormData } from "./hooks/useTeamFormData";
import { useTeamValidation } from "./hooks/useTeamValidation";
import { useTeamUserAssignments } from "./hooks/useTeamUserAssignments";

function Teams() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const tt = (key: string, fallback: string) => t(`settings.teams.${key}`, fallback);
  const noneOptionLabel = tt('fields.none', 'None');
  const unassignedOptionLabel = tt('fields.unassigned', 'Unassigned');
  
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: users } = useSelector((state: RootState) => (state as any).users || { value: [] });
  const { value: userTeams } = useSelector((state: RootState) => state.userTeams) as { value: any[]; loading: boolean };
  const { value: roles } = useSelector((state: RootState) => state.roles) as { value: any[]; loading: boolean };
  
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

  // Form data hook
  const {
    createFormData,
    setCreateFormData,
    editFormData,
    setEditFormData,
    resetCreateForm,
    resetEditForm
  } = useTeamFormData(editingTeam, isEditDialogOpen);

  // Validation hook
  const { getTeamCategoryCount, getTeamTaskCount, canDeleteTeam } = useTeamValidation(teams, categories, tasks);

  // User assignments hook
  const {
    isUsersDialogOpen,
    setIsUsersDialogOpen,
    usersDialogTeam,
    userAssignments,
    isSavingUsers,
    usersFormError,
    userSearchTerm,
    setUserSearchTerm,
    handleOpenUsersDialog,
    handleCloseUsersDialog,
    addUserAssignment,
    updateUserAssignment,
    removeUserAssignment,
    handleSaveUsers
  } = useTeamUserAssignments(userTeams, users, roles, tt);

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

  // Column definitions
  const colDefs = useTeamColumnDefs({
    teams,
    users: users || [],
    teamIdToName,
    userIdToName,
    handleOpenUsersDialog,
    translate: tt
  });

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

  const handleDeleteTeam = (team: Team) => {
    if (canDeleteTeam(team)) {
      deleteItem(team.id);
    } else {
      handleDelete(team);
    }
  };

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

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
    resetCreateForm();
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;

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
            resetCreateForm();
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
            resetEditForm();
          }
        }}
        type="edit"
        title={tt('dialogs.edit.title', 'Edit Team')}
        description={tt('dialogs.edit.description', 'Update the team information.')}
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
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
        )}
      </SettingsDialog>

      {/* Manage Team Users Dialog */}
      <ManageUsersDialog
        open={isUsersDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCloseUsersDialog();
          } else {
            setIsUsersDialogOpen(true);
          }
        }}
        team={usersDialogTeam}
        userAssignments={userAssignments}
        users={users || []}
        roles={roles || []}
        userSearchTerm={userSearchTerm}
        onUserSearchTermChange={setUserSearchTerm}
        onAddUserAssignment={addUserAssignment}
        onUpdateUserAssignment={updateUserAssignment}
        onRemoveUserAssignment={removeUserAssignment}
        onSave={handleSaveUsers}
        isSaving={isSavingUsers}
        error={usersFormError}
        translate={tt}
      />

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

export default Teams;
