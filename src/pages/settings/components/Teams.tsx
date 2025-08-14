import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faUsers, 
  faArrowLeft,
  faPlus,
  faEdit,
  faTrash,
  faSpinner
} from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import { getTeamsFromIndexedDB, addTeamAsync, updateTeamAsync, removeTeamAsync, teamsSlice } from "@/store/reducers/teamsSlice";
import { getCategoriesFromIndexedDB } from "@/store/reducers/categoriesSlice";
import { getTasksFromIndexedDB } from "@/store/reducers/tasksSlice";
import { Team } from "@/store/types";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Custom cell renderer for team name with color indicator
const TeamNameCellRenderer = (props: ICellRendererParams) => {
  const teamColor = props.data?.color || '#6B7280';
  const teamName = props.value;
  
  return (
    <div className="flex items-center space-x-3 h-full">
      <div 
        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
        style={{ backgroundColor: teamColor }}
      >
        {teamName ? teamName.charAt(0).toUpperCase() : 'T'}
      </div>
      <span>{teamName}</span>
    </div>
  );
};

// Custom cell renderer for actions
const ActionsCellRenderer = (props: ICellRendererParams & { onEdit: (team: Team) => void; onDelete: (team: Team) => void }) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onEdit(props.data);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onDelete(props.data);
  };

  return (
    <div className="flex items-center space-x-2 h-full">
      <Button 
        size="sm" 
        variant="outline"
        onClick={handleEdit}
        className="p-1 h-7 w-7"
      >
        <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
      </Button>
      <Button 
        size="sm" 
        variant="destructive"
        onClick={handleDelete}
        className="p-1 h-7 w-7"
      >
        <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
      </Button>
    </div>
  );
};

function Teams() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const gridRef = useRef<AgGridReact>(null);
  
  // Redux state
  const { value: teams, loading, error } = useSelector((state: RootState) => state.teams);
  const { value: categories } = useSelector((state: RootState) => state.categories);
  const { value: tasks } = useSelector((state: RootState) => state.tasks);
  
  const [rowData, setRowData] = useState<Team[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#4ECDC4'
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: '#4ECDC4'
  });

  // Get category count for a team
  const getTeamCategoryCount = useCallback((teamId: number) => {
    return categories.filter(category => category.team_id === teamId).length;
  }, [categories]);

  // Get task count for a team
  const getTeamTaskCount = useCallback((teamId: number) => {
    return tasks.filter(task => task.team_id === teamId).length;
  }, [tasks]);

  // Handle delete team
  const handleDeleteTeam = useCallback((team: Team) => {
    setDeletingTeam(team);
    dispatch(teamsSlice.actions.clearError());
    setIsDeleteDialogOpen(true);
  }, [dispatch]);

  // Handle close delete dialog
  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingTeam(null);
    dispatch(teamsSlice.actions.clearError());
  };

  // Delete team with validation
  const deleteTeam = async () => {
    if (!deletingTeam) return;
    
    const categoryCount = getTeamCategoryCount(deletingTeam.id);
    const taskCount = getTeamTaskCount(deletingTeam.id);
    
    if (categoryCount > 0 || taskCount > 0) {
      // This should not happen as the dialog already shows the count
      // But adding extra validation just in case
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      await dispatch(removeTeamAsync(deletingTeam.id)).unwrap();
      
      // Reset state and close dialog
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting team:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit team
  const handleEditTeam = useCallback((team: Team) => {
    setEditingTeam(team);
    setEditFormData({
      name: team.name,
      description: team.description || '',
      color: team.color || '#4ECDC4'
    });
    // Clear any existing errors
    dispatch(teamsSlice.actions.clearError());
    setIsEditDialogOpen(true);
  }, [dispatch]);

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
      cellRenderer: (params: ICellRendererParams) => ActionsCellRenderer({...params, onEdit: handleEditTeam, onDelete: handleDeleteTeam}),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [handleEditTeam, handleDeleteTeam, getTeamCategoryCount, getTeamTaskCount]);

  // Load teams from Redux store
  useEffect(() => {
    dispatch(getTeamsFromIndexedDB());
  }, [dispatch]);

  // Load categories from Redux store
  useEffect(() => {
    dispatch(getCategoriesFromIndexedDB());
  }, [dispatch]);

  // Load tasks from Redux store
  useEffect(() => {
    dispatch(getTasksFromIndexedDB());
  }, [dispatch]);

  // Update rowData when teams change
  useEffect(() => {
    setRowData(teams);
  }, [teams]);

  // Create new team via Redux
  const createTeam = async () => {
    try {
      setFormError(null);
      setIsSubmitting(true);
      
      const teamData: Omit<Team, 'id' | 'created_at' | 'updated_at'> = {
        name: formData.name,
        description: formData.description,
        color: formData.color,
        deleted_at: null
      };
      
      await dispatch(addTeamAsync(teamData)).unwrap();
      
      // Reset form and close dialog
      setFormData({
        name: '',
        description: '',
        color: '#4ECDC4'
      });
      setFormError(null);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating team:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update existing team via Redux
  const updateTeam = async () => {
    if (!editingTeam) return;
    
    try {
      setIsSubmitting(true);
      
      const updates: Partial<Team> = {
        name: editFormData.name,
        description: editFormData.description,
        color: editFormData.color
      };
      
      await dispatch(updateTeamAsync({ 
        id: editingTeam.id, 
        updates 
      })).unwrap();
      
      // Reset form and close dialog
      setEditFormData({
        name: '',
        description: '',
        color: '#4ECDC4'
      });
      setEditingTeam(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating team:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTeam = () => {
    // Reset form data when opening dialog
    setFormData({
      name: '',
      description: '',
      color: '#4ECDC4'
    });
    setFormError(null);
    // Clear any existing errors
    dispatch(teamsSlice.actions.clearError());
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim()) {
      createTeam();
    }
  };

  const handleEditFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editFormData.name.trim()) {
      updateTeam();
    }
  };

  const handleBackClick = () => {
    navigate('/settings');
  };

  const handleSearch = (value: string) => {
    const lowerCaseValue = value.toLowerCase();
    if (lowerCaseValue === '') {
      setRowData(teams);
    } else {
      const filteredData = teams.filter((team) => {
        return team.name?.toLowerCase().includes(lowerCaseValue) ||
               team.description?.toLowerCase().includes(lowerCaseValue);
      });
      setRowData(filteredData);
    }
  };

  const onGridReady = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (gridRef.current?.api) {
        gridRef.current.api.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <button 
              onClick={handleBackClick}
              className="flex items-center space-x-1 hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
              <span>Settings</span>
            </button>
            <span>»</span>
            <span className="text-foreground">Teams</span>
          </nav>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faUsers} className="text-purple-500 text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            <span>Loading teams...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <button 
              onClick={handleBackClick}
              className="flex items-center space-x-1 hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
              <span>Settings</span>
            </button>
            <span>»</span>
            <span className="text-foreground">Teams</span>
          </nav>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faUsers} className="text-purple-500 text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => dispatch(getTeamsFromIndexedDB())} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <button 
            onClick={handleBackClick}
            className="flex items-center space-x-1 hover:text-foreground transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <span>»</span>
          <span className="text-foreground">Teams</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <FontAwesomeIcon icon={faUsers} className="text-purple-500 text-2xl" />
              <h1 className="text-3xl font-bold tracking-tight">Teams</h1>
            </div>
            <p className="text-muted-foreground">
              Organize and manage work teams for collaboration
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddTeam} className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span>Add Team</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Team</DialogTitle>
                <DialogDescription>
                  Create a new team to organize work and collaboration.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="color" className="text-right">
                      Color
                    </Label>
                    <Input
                      type="color"
                      id="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  {/* Preview */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Preview</Label>
                    <div className="col-span-3 flex items-center space-x-3 p-2 border rounded">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: formData.color }}
                      >
                        {formData.name ? formData.name.charAt(0).toUpperCase() : 'T'}
                      </div>
                      <span>{formData.name || 'Team Name'}</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  {(formError || error) && (
                    <div className="text-sm text-destructive mb-2 text-left">
                      {formError || error}
                    </div>
                  )}
                  <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                    {isSubmitting ? (
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    ) : (
                      <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    )}
                    {isSubmitting ? 'Adding...' : 'Add Team'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit Team Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Team</DialogTitle>
                <DialogDescription>
                  Update the team information.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditFormSubmit} className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-name" className="text-right">
                      Name
                    </Label>
                    <Input
                      id="edit-name"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="col-span-3"
                      required
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-description" className="text-right">
                      Description
                    </Label>
                    <Input
                      id="edit-description"
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="edit-color" className="text-right">
                      Color
                    </Label>
                    <Input
                      type="color"
                      id="edit-color"
                      value={editFormData.color}
                      onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                      className="col-span-3"
                    />
                  </div>
                  {/* Preview */}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Preview</Label>
                    <div className="col-span-3 flex items-center space-x-3 p-2 border rounded">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: editFormData.color }}
                      >
                        {editFormData.name ? editFormData.name.charAt(0).toUpperCase() : 'T'}
                      </div>
                      <span>{editFormData.name || 'Team Name'}</span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  {error && (
                    <div className="text-sm text-destructive mb-2 text-left">
                      {error}
                    </div>
                  )}
                  <Button type="submit" disabled={isSubmitting || !editFormData.name.trim()}>
                    {isSubmitting ? (
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    ) : (
                      <FontAwesomeIcon icon={faEdit} className="mr-2" />
                    )}
                    {isSubmitting ? 'Updating...' : 'Update Team'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete Team Dialog */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={handleCloseDeleteDialog}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <FontAwesomeIcon icon={faTrash} className="text-destructive" />
                  <span>Delete Team</span>
                </DialogTitle>
                <DialogDescription>
                  {deletingTeam && (() => {
                    const categoryCount = getTeamCategoryCount(deletingTeam.id);
                    const taskCount = getTeamTaskCount(deletingTeam.id);
                    
                    if (categoryCount > 0 || taskCount > 0) {
                      return (
                        <div className="space-y-2">
                          <p>This team cannot be deleted because it has associated data:</p>
                          <ul className="text-sm text-muted-foreground list-disc list-inside">
                            {categoryCount > 0 && <li>{categoryCount} categor{categoryCount !== 1 ? 'ies' : 'y'}</li>}
                            {taskCount > 0 && <li>{taskCount} task{taskCount !== 1 ? 's' : ''}</li>}
                          </ul>
                          <p className="text-sm text-muted-foreground">
                            Please reassign or delete all associated items before attempting to delete this team.
                          </p>
                        </div>
                      );
                    } else {
                      return (
                        <div className="space-y-2">
                          <p>Are you sure you want to delete the team "{deletingTeam.name}"?</p>
                          <p className="text-sm text-muted-foreground">
                            This action cannot be undone.
                          </p>
                        </div>
                      );
                    }
                  })()}
                </DialogDescription>
              </DialogHeader>
              
              {deletingTeam && (
                <div className="py-4">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div 
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: deletingTeam.color }}
                      >
                        {deletingTeam.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium">{deletingTeam.name}</div>
                        <div className="text-sm text-muted-foreground">{deletingTeam.description}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {getTeamCategoryCount(deletingTeam.id)} categories
                          </span>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">
                            {getTeamTaskCount(deletingTeam.id)} tasks
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                {error && (
                  <div className="text-sm text-destructive mb-2 text-left">
                    {error}
                  </div>
                )}
                <Button variant="outline" onClick={handleCloseDeleteDialog}>
                  Cancel
                </Button>
                {deletingTeam && getTeamCategoryCount(deletingTeam.id) === 0 && getTeamTaskCount(deletingTeam.id) === 0 && (
                  <Button 
                    variant="destructive" 
                    onClick={deleteTeam}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                    ) : (
                      <FontAwesomeIcon icon={faTrash} className="mr-2" />
                    )}
                    {isSubmitting ? 'Deleting...' : 'Delete Team'}
                  </Button>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Separator />

      {/* Search and Grid */}
      <div className="space-y-4">
        <Input
          placeholder="Search teams..."
          className="w-full max-w-md"
          onChange={(e) => handleSearch(e.target.value)}
        />
        
        <div className="ag-theme-quartz h-[400px] w-full">
          <AgGridReact
            ref={gridRef}
            rowData={rowData}
            columnDefs={colDefs}
            onGridReady={onGridReady}
            suppressColumnVirtualisation={true}
            animateRows={true}
            rowHeight={50}
            headerHeight={40}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true
            }}
            noRowsOverlayComponent={() => (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No teams found</p>
              </div>
            )}
          />
        </div>
      </div>

      <Separator />

      {/* Stats Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Statistics</CardTitle>
          <CardDescription>Overview of your teams and their usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{teams.length}</div>
              <div className="text-sm text-muted-foreground">Total Teams</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {categories.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {tasks.length}
              </div>
              <div className="text-sm text-muted-foreground">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {teams.length > 0 ? Math.round(categories.length / teams.length * 10) / 10 : 0}
              </div>
              <div className="text-sm text-muted-foreground">Avg Categories/Team</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Teams;
