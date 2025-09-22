import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/animated/Tabs";
import { useState, useCallback, useEffect } from "react";
import { Users, Eye, Filter } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useParams } from "react-router-dom";
import { AppDispatch, RootState } from "@/store";
import { genericActions } from '@/store/genericSlices';
import OverviewTab from "./OverviewTab";
import UsersTab from "./UsersTab";
import CreationTab from "./CreationTab";

// Simplified module loading
const loadRequiredModules = async () => {
  const {
    ModuleRegistry,
    TextFilterModule,
    NumberFilterModule,
    InfiniteRowModelModule,
  } = await import('ag-grid-community');

  ModuleRegistry.registerModules([
    TextFilterModule,
    NumberFilterModule,
    InfiniteRowModelModule,
  ]);
};

interface TeamSharingInfo {
  id: string;
  name: string;
  organization_name: string;
  user_count: number;
  shared_date: string;
}

interface WorkspaceOverview {
  teams: TeamSharingInfo[];
  total_users: number;
  categories: string[];
  workspace_name: string;
}

interface WorkspaceFilters {
  allowed_categories: {
    category: string;
    description: string;
    enabled: boolean;
    task_count: number;
  }[];
  creation_restrictions: {
    internal_only: boolean;
    require_approval: boolean;
  };
}

interface WorkspaceInfo {
  name: string;
  icon: string;
  color: string;
  description: string;
}

function Settings() {
  const [activeTab, setActiveTab] = useState('overview');
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const [workspaceOverview, setWorkspaceOverview] = useState<WorkspaceOverview | null>(null);
  const [workspaceFilters, setWorkspaceFilters] = useState<WorkspaceFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);

  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  const params = useParams<{ id: string }>();
  // Using async actions for workspace operations

  // Get current workspace from Redux store
  const { value: workspaces } = useSelector((state: RootState) => (state as any).workspaces as { value: any[] });

  // Get categories from Redux store
  const { value: categories } = useSelector((state: RootState) => (state as any).categories as { value: any[] });

  // Find workspace by ID from URL params or fallback to first workspace
  const currentWorkspace = params.id
    ? workspaces.find((workspace: any) => workspace.id.toString() === params.id)
    : workspaces.length > 0 ? workspaces[0] : null;

  // Debug logging
  console.log('Workspace matching debug:', {
    paramsId: params.id,
    workspacesLength: workspaces.length,
    workspaceIds: workspaces.map((w: any) => ({ id: w.id, name: w.name })),
    currentWorkspace: currentWorkspace ? { id: currentWorkspace.id, name: currentWorkspace.name } : null,
    pathname: location.pathname
  });

  // Convert workspace to WorkspaceInfo format
  const workspaceInfo: WorkspaceInfo | null = currentWorkspace ? {
    name: currentWorkspace.name,
    icon: currentWorkspace.icon,
    color: currentWorkspace.color,
    description: currentWorkspace.description || `Main workspace for ${currentWorkspace.name}`
  } : null;

  // Load modules on component mount
  useEffect(() => {
    loadRequiredModules()
      .then(() => {
        setModulesLoaded(true);
      })
      .catch(console.error);
  }, []);

  // Load categories on component mount
  useEffect(() => {
    const loadCategories = async () => {
      try {
        // Fetch categories from the API
        await dispatch(genericActions.categories.fetchAsync()).unwrap();
      } catch (error) {
        console.error('Failed to fetch categories:', error);
      }
    };

    loadCategories();
  }, [dispatch]);

  // Fetch workspace overview data
  useEffect(() => {
    if (!currentWorkspace || !categories.length) return;

    const fetchWorkspaceOverview = async () => {
      setLoading(true);
      try {
        // Filter categories based on workspace type
        let workspaceCategories: string[] = [];

        if (currentWorkspace.type === "DEFAULT") {
          // For default workspaces, find the single category associated with this workspace
          const associatedCategory = categories.find(cat => cat.workspace_id === currentWorkspace.id);
          if (associatedCategory) {
            workspaceCategories = [associatedCategory.name];
          }
        } else {
          // For other workspace types, show all categories (or implement specific logic)
          workspaceCategories = categories.map(cat => cat.name);
        }

        // Mock data for teams - replace with actual API call when available
        const mockOverview: WorkspaceOverview = {
          teams: [
            {
              id: "team1",
              name: "Engineering Team",
              organization_name: "TechCorp Inc.",
              user_count: 12,
              shared_date: "2024-01-15"
            },
            {
              id: "team2",
              name: "Marketing Team",
              organization_name: "TechCorp Inc.",
              user_count: 8,
              shared_date: "2024-01-20"
            },
            {
              id: "team3",
              name: "Operations Team",
              organization_name: "Partner Corp",
              user_count: 6,
              shared_date: "2024-02-01"
            }
          ],
          total_users: 26,
          categories: workspaceCategories,
          workspace_name: currentWorkspace.name
        };

        setWorkspaceOverview(mockOverview);
      } catch (error) {
        console.error('Failed to fetch workspace overview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceOverview();
  }, [currentWorkspace, categories]);

  // Fetch workspace filters data - now focused on categories
  useEffect(() => {
    if (!currentWorkspace || !categories.length) return;

    const fetchWorkspaceFilters = async () => {
      setFiltersLoading(true);
      try {
        // Filter categories based on workspace type and build allowed_categories
        let allowedCategories: WorkspaceFilters['allowed_categories'] = [];

        if (currentWorkspace.type === "DEFAULT") {
          // For default workspaces, show only the single associated category
          const associatedCategory = categories.find(cat => cat.workspace_id === currentWorkspace.id);
          if (associatedCategory) {
            allowedCategories = [{
              category: associatedCategory.name,
              description: associatedCategory.description || `Tasks for ${associatedCategory.name} category`,
              enabled: associatedCategory.enabled !== false, // Default to true if not explicitly false
              task_count: 0 // This would need to be fetched from API
            }];
          }
        } else {
          // For other workspace types, show all categories
          allowedCategories = categories.map(cat => ({
            category: cat.name,
            description: cat.description || `Tasks for ${cat.name} category`,
            enabled: cat.enabled !== false,
            task_count: 0 // This would need to be fetched from API
          }));
        }

        const mockFilters: WorkspaceFilters = {
          allowed_categories: allowedCategories,
          creation_restrictions: {
            internal_only: false,
            require_approval: false
          }
        };

        setWorkspaceFilters(mockFilters);
      } catch (error) {
        console.error('Failed to fetch workspace filters:', error);
      } finally {
        setFiltersLoading(false);
      }
    };

    fetchWorkspaceFilters();
  }, [currentWorkspace, categories]);

  // Handle team click to filter users
  const handleTeamClick = useCallback((teamName: string) => {
    setSelectedTeamFilter(teamName);
    setActiveTab('users');
  }, []);

  // Clear team filter
  const handleClearTeamFilter = useCallback(() => {
    setSelectedTeamFilter(null);
  }, []);

  // Toggle category enabled/disabled
  const handleToggleCategory = useCallback((categoryName: string) => {
    // For default workspaces, don't allow toggling - category should always be enabled
    if (currentWorkspace?.type === "DEFAULT") {
      return;
    }

    setWorkspaceFilters(prev => {
      if (!prev) return null;

      return {
        ...prev,
        allowed_categories: prev.allowed_categories.map(cat =>
          cat.category === categoryName ? { ...cat, enabled: !cat.enabled } : cat
        )
      };
    });
  }, [currentWorkspace]);

  // Update workspace info in Redux store
  const handleUpdateWorkspace = useCallback((updates: Partial<WorkspaceInfo>) => {
    if (!currentWorkspace) return;
    
    // Generate dynamic description based on name if no description is provided
    let finalUpdates = { ...updates };
    
    // If updating name and no description is explicitly provided, generate one
    if (updates.name && !updates.description) {
      // Check if current workspace has a description or if it's empty/default
      const hasCustomDescription = currentWorkspace.description && 
        !currentWorkspace.description.includes(`Main development workspace for ${currentWorkspace.name}`);
      
      // Only auto-generate if there's no custom description
      if (!hasCustomDescription) {
        finalUpdates.description = `Main development workspace for ${updates.name}`;
      }
    }
    
    // If no description is provided and current workspace has no description, generate one
    if (!finalUpdates.description && !currentWorkspace.description) {
      finalUpdates.description = `Main development workspace for ${finalUpdates.name || currentWorkspace.name}`;
    }
    
    const updatedWorkspace = {
      ...currentWorkspace,
      ...finalUpdates,
      updatedAt: new Date().toISOString()
    };
    
          dispatch(genericActions.workspaces.updateAsync({
            id: currentWorkspace.id,
            updates: updatedWorkspace
          }));
    }, [currentWorkspace, dispatch]);

  return (
    <div className="h-full w-full p-4 pt-0 flex flex-col">
      <div className="mb-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-foreground">Workspace Settings</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
          <TabsTrigger value="overview" className="flex items-center space-x-2">
            <Eye className="w-4 h-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center space-x-2">
            <Users className="w-4 h-4" />
            <span>Users</span>
          </TabsTrigger>
          <TabsTrigger value="filters" className="flex items-center space-x-2">
            <Filter className="w-4 h-4" />
            <span>Creation</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex-1">
          <OverviewTab
            workspaceOverview={workspaceOverview}
            workspaceInfo={workspaceInfo}
            workspaceId={currentWorkspace?.id || null}
            workspaceTeams={currentWorkspace?.teams || null}
            workspaceType={currentWorkspace?.type || null}
            loading={loading}
            onTeamClick={handleTeamClick}
            onUpdateWorkspace={handleUpdateWorkspace}
          />
        </TabsContent>

        <TabsContent value="users" className="mt-4 flex-1 min-h-0">
          <UsersTab
            modulesLoaded={modulesLoaded}
            selectedTeamFilter={selectedTeamFilter}
            onClearTeamFilter={handleClearTeamFilter}
          />
        </TabsContent>

        <TabsContent value="filters" className="mt-4 flex-1 min-h-0">
          <CreationTab
            modulesLoaded={modulesLoaded}
            workspaceFilters={workspaceFilters}
            filtersLoading={filtersLoading}
            onToggleCategory={handleToggleCategory}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default Settings;