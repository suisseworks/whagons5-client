import { UrlTabs } from "@/components/ui/url-tabs";
import { useState, useCallback, useEffect, useMemo } from "react";
import { Users, Eye, Filter, SlidersHorizontal } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import { AppDispatch, RootState } from "@/store";
import { genericActions } from '@/store/genericSlices';
import OverviewTab from "./OverviewTab";
import UsersTab from "./UsersTab";
import CreationTab from "./CreationTab";
import { motion } from "motion/react";
import { WORKSPACE_SETTINGS_TAB_ANIMATION, getWorkspaceSettingsTabInitialX } from "@/config/tabAnimation";

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

function Settings({ workspaceId }: { workspaceId?: string }) {
  const [prevActiveTab, setPrevActiveTab] = useState<'overview' | 'users' | 'filters' | 'display'>('display');
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'filters' | 'display'>('display');
  const [modulesLoaded, setModulesLoaded] = useState(false);
  const [workspaceOverview, setWorkspaceOverview] = useState<WorkspaceOverview | null>(null);
  const [workspaceFilters, setWorkspaceFilters] = useState<WorkspaceFilters | null>(null);
  const [loading, setLoading] = useState(false);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string | null>(null);

  const dispatch = useDispatch<AppDispatch>();
  const location = useLocation();
  // Using async actions for workspace operations

  // Get current workspace from Redux store (slice only; no fetching)
  const { value: workspaces } = useSelector((state: RootState) => (state as any).workspaces as { value: any[] });

  // Get categories from Redux store
  const { value: categories } = useSelector((state: RootState) => (state as any).categories as { value: any[] });

  // Find workspace by ID from prop or fallback to first workspace
  const currentWorkspace = useMemo(() => {
    // If no workspaces loaded yet, return null
    if (workspaces.length === 0) {
      return null;
    }

    if (!workspaceId || workspaceId === 'all') {
      return workspaces[0];
    }

    // Try to find workspace by ID (handle both string and number IDs)
    const workspaceIdNum = isNaN(Number(workspaceId)) ? workspaceId : Number(workspaceId);
    return workspaces.find((workspace: any) =>
      workspace.id === workspaceIdNum ||
      workspace.id === workspaceId ||
      workspace.id.toString() === workspaceId
    ) || null;
  }, [workspaceId, workspaces]);

  // Debug logging
  console.log('Workspace matching debug:', {
    workspaceId,
    workspaceIdType: typeof workspaceId,
    workspacesLength: workspaces.length,
    workspaceIds: workspaces.map((w: any) => ({ id: w.id, idType: typeof w.id, name: w.name })),
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

  // Sync activeTab with URL on initial load
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/users')) {
      setActiveTab('users');
      setPrevActiveTab('users');
    } else if (path.includes('/creation')) {
      setActiveTab('filters');
      setPrevActiveTab('filters');
    } else if (path.includes('/overview')) {
      setActiveTab('overview');
      setPrevActiveTab('overview');
    } else {
      setActiveTab('display');
      setPrevActiveTab('display');
    }
  }, [location.pathname]);


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

  // Define tabs for URL persistence
  const settingsTabs = [
    {
      value: 'display',
      label: (
        <div className="flex items-center space-x-2">
          <SlidersHorizontal className="w-4 h-4" />
          <span>Display</span>
        </div>
      ),
      content: (
        <motion.div
          className="mt-4 flex-1 h-full"
          key="display"
          initial={{ x: getWorkspaceSettingsTabInitialX(prevActiveTab, 'display') }}
          animate={{ x: 0 }}
          transition={WORKSPACE_SETTINGS_TAB_ANIMATION.transition}
        >
          {/* Display options */}
          <div className="mb-4 p-3 border rounded-md bg-background">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">Show header KPIs</div>
                <div className="text-xs text-muted-foreground">Toggle the Total / In progress / Completed today pills</div>
              </div>
              <Switch
                defaultChecked={(typeof window !== 'undefined' && (localStorage.getItem(`wh_workspace_show_kpis_${workspaceId || 'all'}`) ?? 'true') !== 'false')}
                onCheckedChange={(checked) => {
                  try { localStorage.setItem(`wh_workspace_show_kpis_${workspaceId || 'all'}`, String(checked)); } catch {}
                  try { window.dispatchEvent(new CustomEvent('wh:displayOptionsChanged', { detail: { showKpis: checked, workspaceId: workspaceId || 'all' } })); } catch {}
                }}
              />
            </div>
          </div>
          <div className="mb-4 p-3 border rounded-md bg-background">
            <div className="flex items-center gap-3">
              <Label>Table density</Label>
              <ToggleGroup
                type="single"
                defaultValue={(typeof window !== 'undefined' && (localStorage.getItem('wh_workspace_density') as any)) || 'compact'}
                onValueChange={(v) => {
                  if (!v) return;
                  try { localStorage.setItem('wh_workspace_density', v); } catch {}
                  try { window.dispatchEvent(new CustomEvent('wh:rowDensityChanged', { detail: v })); } catch {}
                }}
              >
                <ToggleGroupItem value="compact" aria-label="Compact density" className="h-8 px-2 text-xs">C</ToggleGroupItem>
                <ToggleGroupItem value="comfortable" aria-label="Comfortable density" className="h-8 px-2 text-xs">M</ToggleGroupItem>
                <ToggleGroupItem value="spacious" aria-label="Spacious density" className="h-8 px-2 text-xs">L</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </motion.div>
      )
    },
    {
      value: 'overview',
      label: (
        <div className="flex items-center space-x-2">
          <Eye className="w-4 h-4" />
          <span>Overview</span>
        </div>
      ),
      content: (
        <motion.div
          className="mt-4 flex-1 h-full"
          key="overview"
          initial={{ x: getWorkspaceSettingsTabInitialX(prevActiveTab, 'overview') }}
          animate={{ x: 0 }}
          transition={WORKSPACE_SETTINGS_TAB_ANIMATION.transition}
        >
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
        </motion.div>
      )
    },
    {
      value: 'users',
      label: (
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4" />
          <span>Users</span>
        </div>
      ),
      content: (
        <motion.div
          className="mt-4 flex-1 h-full"
          key="users"
          initial={{ x: getWorkspaceSettingsTabInitialX(prevActiveTab, 'users') }}
          animate={{ x: 0 }}
          transition={WORKSPACE_SETTINGS_TAB_ANIMATION.transition}
        >
          <UsersTab
            modulesLoaded={modulesLoaded}
            selectedTeamFilter={selectedTeamFilter}
            onClearTeamFilter={handleClearTeamFilter}
          />
        </motion.div>
      )
    },
    {
      value: 'filters',
      label: (
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4" />
          <span>Creation</span>
        </div>
      ),
      content: (
        <motion.div
          className="mt-4 flex-1 h-full"
          key="filters"
          initial={{ x: getWorkspaceSettingsTabInitialX(prevActiveTab, 'filters') }}
          animate={{ x: 0 }}
          transition={WORKSPACE_SETTINGS_TAB_ANIMATION.transition}
        >
          <CreationTab
            modulesLoaded={modulesLoaded}
            workspaceFilters={workspaceFilters}
            filtersLoading={filtersLoading}
            onToggleCategory={handleToggleCategory}
          />
        </motion.div>
      )
    }
  ];

  // If no workspaceId is provided, this is being used as the main settings page
  if (!workspaceId) {
    return (
      <div className="p-4 pt-0 space-y-4">
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your application settings and preferences.</p>
        </div>
        {/* Main settings content would go here */}
        <div className="text-center text-muted-foreground">
          Main settings page - workspace-specific settings are shown when accessed from a workspace.
        </div>
      </div>
    );
  }

  // Show loading state while workspaces are being loaded
  if (workspaces.length === 0) {
    return (
      <div className="h-full w-full p-4 pt-0 flex flex-col">
        <div className="mb-3 flex-shrink-0">
          <h1 className="text-xl font-bold text-foreground">Workspace Settings</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-sm text-muted-foreground">Loading workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state if workspace not found after loading
  if (!currentWorkspace) {
    return (
      <div className="h-full w-full p-4 pt-0 flex flex-col">
        <div className="mb-3 flex-shrink-0">
          <h1 className="text-xl font-bold text-foreground">Workspace Settings</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-red-600">Invalid Workspace ID</h2>
            <p className="text-gray-600 mt-2">ID: "{workspaceId}" - Please check the URL and try again.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full p-4 pt-0 flex flex-col">
      <div className="mb-3 flex-shrink-0">
        <h1 className="text-xl font-bold text-foreground">Workspace Settings</h1>
      </div>

      {/* Table density control moved into Overview tab */}

      <UrlTabs
        tabs={settingsTabs}
        defaultValue="display"
        basePath={`/workspace/${workspaceId}/settings`}
        pathMap={{ display: '', overview: '/overview', users: '/users', filters: '/creation' }}
        className="w-full h-full flex flex-col"
        onValueChange={(value) => {
          setPrevActiveTab(activeTab);
          setActiveTab(value);
        }}
      />
    </div>
  );
}

export default Settings;