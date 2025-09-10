import { useMemo } from "react";
import { useSelector } from "react-redux";
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers, faPlus } from "@fortawesome/free-solid-svg-icons";
import { RootState } from "@/store/store";
import { Team, Category, Task } from "@/store/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SettingsLayout,
  SettingsGrid,
  SettingsDialog,
  useSettingsState,
  createActionsCellRenderer,
  ColorIndicatorCellRenderer
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
    { 
      field: 'tasks', 
      headerName: 'Tasks',
      width: 100,
      cellRenderer: (params: ICellRendererParams) => {
        const taskCount = getTeamTaskCount(params.data.id);
        return (
          <div className="flex items-center h-full">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {taskCount}
            </Badge>
          </div>
        );
      },
      sortable: false,
      filter: false
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
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
    const formData = new FormData(e.target as HTMLFormElement);
    const teamData = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      color: formData.get('color') as string,
      deleted_at: null
    };
    await createItem(teamData);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeam) return;
    
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      color: formData.get('color') as string
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
      search={{
        placeholder: "Search teams...",
        value: searchQuery,
        onChange: (value: string) => {
          setSearchQuery(value);
          handleSearch(value);
        }
      }}
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
        <Button 
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center space-x-2 font-semibold bg-[linear-gradient(90deg,#ff6b35,#f59e0b)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#f59e0b]"
        >
          <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
          <span>Add Team</span>
        </Button>
      }
    >
      <SettingsGrid
        rowData={filteredItems}
        columnDefs={colDefs}
        noRowsMessage="No teams found"
      />

      {/* Create Team Dialog */}
      <SettingsDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        type="create"
        title="Add New Team"
        description="Create a new team to organize work and collaboration."
        onSubmit={handleCreateSubmit}
        isSubmitting={isSubmitting}
        error={formError}
        submitDisabled={isSubmitting}
      >
        <div className="grid gap-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name *</Label>
            <Input
              id="name"
              name="name"
              className="col-span-3"
              required
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="description" className="text-right">Description</Label>
            <Input
              id="description"
              name="description"
              className="col-span-3"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="color" className="text-right">Color</Label>
            <Input
              id="color"
              name="color"
              type="color"
              defaultValue="#4ECDC4"
              className="col-span-3"
            />
          </div>
        </div>
      </SettingsDialog>

      {/* Edit Team Dialog */}
      <SettingsDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-name" className="text-right">Name *</Label>
              <Input
                id="edit-name"
                name="name"
                defaultValue={editingTeam.name}
                className="col-span-3"
                required
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-description" className="text-right">Description</Label>
              <Input
                id="edit-description"
                name="description"
                defaultValue={editingTeam.description || ''}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-color" className="text-right">Color</Label>
              <Input
                id="edit-color"
                name="color"
                type="color"
                defaultValue={editingTeam.color || '#4ECDC4'}
                className="col-span-3"
              />
            </div>
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
