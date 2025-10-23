import { useMemo, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faPlus } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Team, Category, Task } from "@/store/types";
import { Button } from "@/components/ui/button";
import { StatusIcon } from "@/pages/settings/components/StatusIcon";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  ColorIndicatorCellRenderer,
  TextField,
  SelectField,
  CheckboxField,
  IconPicker
} from "../components";

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
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  const { value: users } = useSelector((state: RootState) => (state as any).users || { value: [] });
  
  // Use shared state management
  const {
    items: teams,
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
    }
  }, [editingTeam]);

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
      headerName: 'Team Name',
      flex: 1.5,
      minWidth: 220,
      maxWidth: 420,
      cellRenderer: TeamNameCellRenderer
    },
    {
      field: 'parent_team_id',
      headerName: 'Parent Team',
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
      headerName: 'Icon',
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
      headerName: 'Team Lead',
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
      headerName: 'Active',
      width: 100,
      valueGetter: (p) => !!p.data?.is_active,
      cellRenderer: (p: ICellRendererParams) => (p?.data?.is_active ? 'Yes' : 'No')
    },
    // Tasks column removed per request; task counts still used in delete validation and stats
    {
      field: 'actions',
      headerName: 'Actions',
      width: 110,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleQuickEdit,
        onDelete: handleDeleteTeam
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [handleEdit, handleDeleteTeam, teamIdToName, userIdToName]);

  // Form handlers
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!createFormData.name?.trim()) {
      throw new Error('Team name is required');
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
      throw new Error('Team name is required');
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
  const renderTeamPreview = (team: Team) => (
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
            {getTeamCategoryCount(team.id)} categories
          </span>
          <span className="text-xs text-muted-foreground">•</span>
          <span className="text-xs text-muted-foreground">
            {getTeamTaskCount(team.id)} tasks
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <SettingsLayout
      title="Teams"
      description="Organize and manage work teams for collaboration"
      icon={faUsers}
      iconColor="#8b5cf6"
      loading={{
        isLoading: loading,
        message: "Loading teams..."
      }}
      error={error ? {
        message: error,
        onRetry: () => window.location.reload()
      } : undefined}
      statistics={{
        title: "Team Statistics",
        description: "Overview of your teams and their usage",
        items: [
          { label: "Total Teams", value: teams.length },
          { label: "Total Categories", value: categories.length },
          { label: "Total Tasks", value: tasks.length },
          { label: "Avg Categories/Team", value: teams.length > 0 ? Math.round(categories.length / teams.length * 10) / 10 : 0 }
        ]
      }}
      headerActions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/settings/users')}>
            Manage Users
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <FontAwesomeIcon icon={faPlus} className="mr-2" />
            Add Team
          </Button>
        </div>
      }
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={colDefs}
        noRowsMessage="No teams found"
        rowSelection="single"
        onRowDoubleClicked={(row: any) => handleQuickEdit(row?.data ?? row)}
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
        title="Add New Team"
        description="Create a new team to organize work and collaboration."
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
            id="description"
            label="Description"
            value={createFormData.description}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, description: value }))}
          />
          <TextField
            id="color"
            label="Color"
            type="color"
            value={createFormData.color}
            onChange={(value) => setCreateFormData(prev => ({ ...prev, color: value }))}
          />
          <IconPicker
            id="icon"
            label="Icon"
            value={createFormData.icon}
            onChange={(icon) => setCreateFormData(prev => ({ ...prev, icon }))}
            color={createFormData.color}
          />
          <SelectField
            id="parent-team"
            label="Parent Team"
            value={createFormData.parent_team_id ?? 'none'}
            onChange={(val) => setCreateFormData(prev => ({ ...prev, parent_team_id: val === 'none' ? null : Number(val) }))}
            options={[{ value: 'none', label: 'None' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
          />
          <SelectField
            id="team-lead"
            label="Team Lead"
            value={createFormData.team_lead_id ?? 'none'}
            onChange={(val) => setCreateFormData(prev => ({ ...prev, team_lead_id: val === 'none' ? null : Number(val) }))}
            options={[{ value: 'none', label: 'Unassigned' }, ...(users || []).map((u: any) => ({ value: u.id, label: u.name }))]}
          />
          <CheckboxField
            id="is-active"
            label="Active"
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
          }
        }}
        type="edit"
        title="Edit Team"
        description="Update the team information."
        onSubmit={handleEditSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting || !editingTeam}
      >
        {editingTeam && (
          <div className="grid gap-4">
            <TextField
              id="edit-name"
              label="Name"
              value={editFormData.name}
              onChange={(value) => setEditFormData(prev => ({ ...prev, name: value }))}
              required
            />
            <TextField
              id="edit-description"
              label="Description"
              value={editFormData.description}
              onChange={(value) => setEditFormData(prev => ({ ...prev, description: value }))}
            />
            <TextField
              id="edit-color"
              label="Color"
              type="color"
              value={editFormData.color}
              onChange={(value) => setEditFormData(prev => ({ ...prev, color: value }))}
            />
            <IconPicker
              id="edit-icon"
              label="Icon"
              value={editFormData.icon}
              onChange={(icon) => setEditFormData(prev => ({ ...prev, icon }))}
              color={editFormData.color}
            />
            <SelectField
              id="edit-parent-team"
              label="Parent Team"
              value={editFormData.parent_team_id ?? 'none'}
              onChange={(val) => setEditFormData(prev => ({ ...prev, parent_team_id: val === 'none' ? null : Number(val) }))}
              options={[{ value: 'none', label: 'None' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
            />
            <SelectField
              id="edit-team-lead"
              label="Team Lead"
              value={editFormData.team_lead_id ?? 'none'}
              onChange={(val) => setEditFormData(prev => ({ ...prev, team_lead_id: val === 'none' ? null : Number(val) }))}
              options={[{ value: 'none', label: 'Unassigned' }, ...(users || []).map((u: any) => ({ value: u.id, label: u.name }))]}
            />
            <CheckboxField
              id="edit-is-active"
              label="Active"
              checked={!!editFormData.is_active}
              onChange={(checked) => setEditFormData(prev => ({ ...prev, is_active: checked }))}
            />
          </div>
        )}
      </SettingsDialog>

      {/* Delete Team Dialog */}
      <SettingsDialog
        open={isDeleteDialogOpen}
        onOpenChange={handleCloseDeleteDialog}
        type="delete"
        title="Delete Team"
        description={
          deletingTeam ? (() => {
            const categoryCount = getTeamCategoryCount(deletingTeam.id);
            const taskCount = getTeamTaskCount(deletingTeam.id);
            
            if (categoryCount > 0 || taskCount > 0) {
              return `This team cannot be deleted because it has ${categoryCount} categories and ${taskCount} tasks. Please reassign or delete all associated items first.`;
            } else {
              return `Are you sure you want to delete the team "${deletingTeam.name}"? This action cannot be undone.`;
            }
          })() : undefined
        }
        onConfirm={() => deletingTeam && canDeleteTeam(deletingTeam) ? deleteItem(deletingTeam.id) : undefined}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={!deletingTeam || !canDeleteTeam(deletingTeam)}
        entityName="team"
        entityData={deletingTeam}
        renderEntityPreview={renderTeamPreview}
      />
    </SettingsLayout>
  );
}

export default Teams;
