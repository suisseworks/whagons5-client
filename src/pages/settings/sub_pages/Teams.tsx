import { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faPlus } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Team, Category, Task } from "@/store/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  ColorIndicatorCellRenderer,
  TextField
} from "../components";

// Custom cell renderer for team name with color indicator
const TeamNameCellRenderer = (props: ICellRendererParams) => (
  <ColorIndicatorCellRenderer 
    value={props.value} 
    name={props.value}
    color={props.data?.color || '#6B7280'}
  />
);

function Teams() {
  const navigate = useNavigate();
  // Redux state for related data
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  
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
    color: '#4ECDC4'
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: '#4ECDC4'
  });

  // Update edit form data when editing team changes
  useEffect(() => {
    if (editingTeam) {
      setEditFormData({
        name: editingTeam.name || '',
        description: editingTeam.description || '',
        color: editingTeam.color || '#4ECDC4'
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

  // Column definitions for AG Grid
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: 'Team Name',
      flex: 2,
      minWidth: 200,
      cellRenderer: TeamNameCellRenderer
    },
    { 
      field: 'description', 
      headerName: 'Description',
      flex: 3,
      minWidth: 250
    },
    { 
      field: 'categories', 
      headerName: 'Categories',
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        const categoryCount = getTeamCategoryCount(params.data.id);
        return (
          <div className="flex items-center h-full">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {categoryCount}
            </Badge>
          </div>
        );
      },
      sortable: false,
      filter: false
    },
    // Tasks column removed per request; task counts still used in delete validation and stats
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      cellRenderer: createActionsCellRenderer({
        onEdit: handleEdit,
        onDelete: handleDeleteTeam
      }),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [handleEdit, handleDeleteTeam]);

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
      deleted_at: null
    };

    await createItem(teamData);

    // Reset form after successful creation
    setCreateFormData({
      name: '',
      description: '',
      color: '#4ECDC4'
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
      color: editFormData.color
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
        onRowDoubleClicked={(row: any) => handleEdit(row)}
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
              color: '#4ECDC4'
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
              color: '#4ECDC4'
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
