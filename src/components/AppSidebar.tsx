import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Settings,
  Users,
  Plus,
  ChevronDown,
  Briefcase,
  BarChart3,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { RootState } from '@/store';
import { useEffect, useMemo, useState } from 'react';
// import { useAuth } from '@/providers/AuthProvider'; // Currently not used, uncomment when needed
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/ui/collapsible';
import WhagonsCheck from '@/assets/WhagonsCheck';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconService } from '@/database/iconService';
import { Workspace } from '@/store/types';

// Global pinned state management
let isPinnedGlobal = false;
const pinnedStateCallbacks: ((pinned: boolean) => void)[] = [];

export const setPinnedState = (pinned: boolean) => {
  isPinnedGlobal = pinned;
  pinnedStateCallbacks.forEach((callback) => callback(pinned));
};

export const getPinnedState = () => isPinnedGlobal;

export const subscribeToPinnedState = (callback: (pinned: boolean) => void) => {
  pinnedStateCallbacks.push(callback);
  return () => {
    const index = pinnedStateCallbacks.indexOf(callback);
    if (index > -1) pinnedStateCallbacks.splice(index, 1);
  };
};

const PinnedSidebarTrigger = ({ className }: { className?: string }) => {
  const [isPinned, setIsPinned] = useState(isPinnedGlobal);

  useEffect(() => {
    const unsubscribe = subscribeToPinnedState(setIsPinned);
    return unsubscribe;
  }, []);

  const handleClick = () => {
    const newPinned = !isPinned;
    setPinnedState(newPinned);
    // Don't auto-close when unpinning - let hover behavior handle it
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={`size-7 ${className || ''}`}
      onClick={handleClick}
      title={isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {/* Circle */}
        <div className="w-3 h-3 border-2 border-current rounded-full"></div>
        {/* Dot when pinned */}
        {isPinned && (
          <div className="absolute w-1.5 h-1.5 bg-current rounded-full"></div>
        )}
      </div>
      <span className="sr-only">
        {isPinned ? 'Unpin Sidebar' : 'Pin Sidebar'}
      </span>
    </Button>
  );
};

export function AppSidebar() {
  const { state, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;
  const isCollapsed = state === 'collapsed';

  // Extract toggleSidebar to suppress unused warning
  // const { toggleSidebar } = useSidebar();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [isPinned, setIsPinned] = useState(getPinnedState());
  const [workspaceIcons, setWorkspaceIcons] = useState<{ [key: string]: any }>({});
  const [defaultIcon, setDefaultIcon] = useState<any>(null);

  // const dispatch = useDispatch<AppDispatch>();
  // const { user } = useAuth(); // Currently not used, uncomment when needed

  const workspacesState = useSelector(
    (state: RootState) => state.workspaces
  );
  const { value: workspaces = [] } = workspacesState || {};

  // Dedupe workspaces by id to avoid duplicate key warnings when state temporarily contains duplicates
  const uniqueWorkspaces = useMemo(() => {
    const map = new Map<string, Workspace>();
    for (const w of workspaces) map.set(String(w.id), w);
    return Array.from(map.values());
  }, [workspaces]);

  // Debug logging for workspaces state changes (only in development)
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('AppSidebar: Workspaces updated:', {
        count: uniqueWorkspaces?.length || 0,
        names: uniqueWorkspaces?.map((w: Workspace) => w.name) || []
      });
    }
  }, [uniqueWorkspaces]);

  // Note: clearError action not available in generic slices

  // Subscribe to pinned state changes
  useEffect(() => {
    const unsubscribe = subscribeToPinnedState(setIsPinned);
    return unsubscribe;
  }, []);

  // Load default icon
  useEffect(() => {
    const loadDefaultIcon = async () => {
      try {
        const icon = await iconService.getIcon('building');
        setDefaultIcon(icon);
      } catch (error) {
        console.error('Error loading default icon:', error);
        // Set a fallback icon to prevent the component from not rendering
        setDefaultIcon('fa-building');
      }
    };
    loadDefaultIcon();
  }, []);



  // // Additional effect to check if workspaces data is loaded
  // useEffect(() => {
  //   if (workspacesState && workspacesState.value && workspacesState.value.length > 0) {
  //     console.log('AppSidebar: Workspaces loaded successfully:', workspacesState.value.length);
  //   } else if (workspacesState && workspacesState.loading) {
  //     console.log('AppSidebar: Workspaces are loading...');
  //   } else if (workspacesState && workspacesState.error) {
  //     console.error('AppSidebar: Error loading workspaces:', workspacesState.error);
  //   }
  // }, [workspacesState]);

  // Load workspace icons when workspaces change
  useEffect(() => {
    const loadWorkspaceIcons = async () => {
      const iconNames = workspaces.map((workspace: Workspace) => workspace.icon).filter(Boolean);
      if (iconNames.length > 0) {
        try {
          const icons = await iconService.loadIcons(iconNames);
          setWorkspaceIcons(icons);
        } catch (error) {
          console.error('Error loading workspace icons:', error);
        }
      }
    };

    loadWorkspaceIcons();
  }, [workspaces]);

  // Preload common icons on component mount
  useEffect(() => {
    iconService.preloadCommonIcons();
  }, []);

  const getWorkspaceIcon = (iconName?: string) => {
    if (!iconName || typeof iconName !== 'string') {
      return defaultIcon;
    }
    
    // Parse FontAwesome class format to get the actual icon name
    // This matches the parsing logic in iconService
    let parsedIconName = iconName;
    
    // Handle FontAwesome class format (fas fa-icon-name, far fa-icon-name, etc.)
    const faClassMatch = iconName.match(/^(fas|far|fal|fat|fab|fad|fass)\s+fa-(.+)$/);
    if (faClassMatch) {
      parsedIconName = faClassMatch[2]; // Return just the icon name part
    } else if (iconName.startsWith('fa-')) {
      // Handle fa-prefix format (fa-icon-name -> icon-name)
      parsedIconName = iconName.substring(3);
    }
    
    return workspaceIcons[parsedIconName] || defaultIcon;
  };

  const handleAddWorkspace = () => {
    if (!workspaceName.trim() || !workspaceDescription.trim()) {
      // Basic validation: Ensure fields are not empty
      // You might want to add more robust validation/feedback
      alert('Please enter both name and description.');
      return;
    }

    // Create workspace data in the format expected by the API
    // const newWorkspaceData = {
    //   name: workspaceName,
    //   description: workspaceDescription,
    //   type: 'PROJECT',
    //   created_by: user?.id ? parseInt(user.id) : 0
    // };

    // TODO: Implement custom async thunk for adding workspaces
    // dispatch(genericActions.workspaces.addWorkspaceAsync(newWorkspaceData as any));

    // Reset form and close modal
    setWorkspaceName('');
    setWorkspaceDescription('');
    setIsModalOpen(false);
  };


  // Determine if we should show expanded content
  const showExpandedContent = !isCollapsed || isMobile;

  const handleMouseEnter = () => {
    if (isCollapsed) {
      setOpen(true);
    }
  };

  const handleMouseLeave = () => {
    // Only collapse if not pinned
    if (!isCollapsed && !isPinned) {
      setOpen(false);
    }
  };

  // Don't render icons until default icon is loaded
  // Temporarily commented out to debug workspace rendering
  /*
  if (!defaultIcon) {
    console.log('AppSidebar: Default icon not loaded yet, skipping render');
    return null;
  }
  */

  return (
    <Sidebar
      collapsible="icon"
      className={`bg-sidebar border-r border-sidebar-border transition-all duration-300`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader
        className={`shadow-md bg-sidebar transition-all duration-300 ${
          isCollapsed ? 'px-1' : ''
        }`}
      >
        <div className="flex items-center justify-center w-full">
          <Link
            to="/home"
            title="Home"
            className={`flex items-center pt-3 pb-3 transition-all duration-300 ${
              isCollapsed ? 'justify-center' : 'justify-center'
            }`}
          >
            <WhagonsCheck
              width={showExpandedContent ? 45 : 32}
              height={showExpandedContent ? 21 : 15}
              color="#27C1A7"
            />
            {showExpandedContent && (
              <div
                className="text-xl pl-2 font-semibold text-[#27C1A7]"
                style={{ fontFamily: 'Montserrat' }}
              >
                Whagons
              </div>
            )}
          </Link>
          {!isCollapsed && !isMobile && (
            <PinnedSidebarTrigger className="ml-2 text-primary hover:text-primary/80" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          {/* Everything workspace - above the Spaces dropdown */}
          {(!isCollapsed || isMobile) && (
            <div className="px-3 py-2">
              <Link
                to={`/workspace/all`}
                className={`flex items-center space-x-2 rounded-md relative transition-colors px-3 py-2 ${
                  pathname === `/workspace/all`
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Everything</span>
              </Link>
            </div>
          )}

          {/* Show Everything icon when collapsed - DESKTOP ONLY */}
          {isCollapsed && !isMobile && (
            <div className="px-2 py-2 flex justify-center">
              <Link
                to={`/workspace/all`}
                className={`flex items-center justify-center w-8 h-8 rounded text-xs font-medium transition-colors ${
                  pathname === `/workspace/all`
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
                title={'Everything'}
              >
                <Users className="w-4 h-4" />
              </Link>
            </div>
          )}

          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild className="text-sm font-normal">
                <div
                  className={`flex items-center w-full pr-3 transition-all duration-300 ${
                    isCollapsed ? 'justify-center px-0' : 'justify-between'
                  }`}
                >
                  <CollapsibleTrigger
                    className={`flex items-center cursor-pointer hover:bg-sidebar-accent rounded-sm p-1 pr-2 -ml-3 transition-all duration-300 ${
                      isCollapsed && !isMobile
                        ? 'flex-col justify-center ml-0 px-2'
                        : 'justify-start flex-1'
                    }`}
                  >
                    {isCollapsed && !isMobile ? (
                      <div className="flex flex-col items-center">
                        <Briefcase className="text-sidebar-foreground w-5 h-5 mb-1" />
                      </div>
                    ) : (
                      <>
                        <ChevronDown className="transition-transform duration-200 ease-out group-data-[state=open]/collapsible:rotate-180 w-4 h-4 text-sidebar-foreground" />
                        <span className="text-base font-semibold pl-2 text-sidebar-foreground flex items-center">
                          <Briefcase className="w-4 h-4 mr-2" />
                          Spaces
                        </span>
                      </>
                    )}
                  </CollapsibleTrigger>

                  {showExpandedContent && (
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          <Plus size={16} />
                          <span className="sr-only">Add Workspace</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>Add New Workspace</DialogTitle>
                          <DialogDescription>
                            Enter the details for your new workspace. Click save
                            when you're done.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="name" className="text-right">
                              Name
                            </Label>
                            <Input
                              id="name"
                              value={workspaceName}
                              onChange={(e) => setWorkspaceName(e.target.value)}
                              className="col-span-3"
                              placeholder="e.g., Project Phoenix"
                            />
                          </div>
                          <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="description" className="text-right">
                              Description
                            </Label>
                            <Input
                              id="description"
                              value={workspaceDescription}
                              onChange={(e) =>
                                setWorkspaceDescription(e.target.value)
                              }
                              className="col-span-3"
                              placeholder="e.g., For managing project tasks"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsModalOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" onClick={handleAddWorkspace}>
                            Save Workspace
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </SidebarGroupLabel>

              <CollapsibleContent>
                {(!isCollapsed || isMobile) && (
                  <SidebarGroupContent className="pt-2 pl-1">

                    {uniqueWorkspaces.map((workspace: Workspace) => {
                      // Skip temporary optimistic items (negative IDs)
                      if ((workspace.id as number) < 0) return null;

                      return (
                      <Link
                        key={`workspace-${workspace.id}`}
                        to={`/workspace/${workspace.id}`}
                        className={`flex items-center space-x-2 rounded-md relative transition-colors px-4 py-2 mx-2 ${
                          pathname === `/workspace/${workspace.id}`
                            ? 'bg-primary/10 text-primary border-l-4 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent px-5'
                        }`}
                      >
                        <FontAwesomeIcon
                          icon={getWorkspaceIcon(workspace.icon)}
                          style={{ color: workspace.color }}
                          className="w-4 h-4"
                        />
                        <span>{workspace.name}</span>
                      </Link>
                      );
                    })}
                  </SidebarGroupContent>
                )}

                {/* Show workspace icons when collapsed AND collapsible is open - DESKTOP ONLY */}
                {isCollapsed && !isMobile && (
                  <SidebarGroupContent className="pt-2">
                    <div className="flex flex-col items-center space-y-1 px-1 py-1 rounded-md bg-sidebar-accent/30">
                      {uniqueWorkspaces
                        .filter((workspace: Workspace) => (workspace.id as number) >= 0) // Skip temp items
                        .map((workspace: Workspace) => (
                        <Link
                          key={`workspace-collapsed-${workspace.id}`}
                          to={`/workspace/${workspace.id}`}
                          className={`flex items-center justify-center w-8 h-8 rounded text-xs font-medium transition-colors ${
                            pathname === `/workspace/${workspace.id}`
                              ? 'bg-primary/20 text-primary border border-primary/40'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent'
                          }`}
                          title={workspace.name}
                        >
                          <FontAwesomeIcon
                            icon={getWorkspaceIcon(workspace.icon)}
                            style={{ color: workspace.color }}
                            className="w-4 h-4"
                          />
                        </Link>
                      ))}
                    </div>
                  </SidebarGroupContent>
                )}
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
          <SidebarGroupContent>
            {/* Other content can go here if needed */}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar border-t border-sidebar-border">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="pt-1 pb-1">
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Analytics' : undefined}
                  className={`rounded-md relative transition-colors ${
                    isCollapsed && !isMobile
                      ? `h-10 flex justify-center items-center ${
                          pathname === '/analytics'
                            ? 'bg-primary/10 text-primary border-2 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }`
                      : `h-10 ${
                          pathname === '/analytics'
                            ? 'bg-primary/10 text-primary border-l-4 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }`
                  }`}
                >
                  <Link
                    to="/analytics"
                    className={
                      isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : ''
                    }
                  >
                    <BarChart3 size={20} className="w-5! h-5! p-[1px]" />
                    {showExpandedContent && <span>Analytics</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="pt-1 pb-1">
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Settings' : undefined}
                  className={`rounded-md relative transition-colors ${
                    isCollapsed && !isMobile
                      ? `h-10 flex justify-center items-center ${
                          pathname === '/settings'
                            ? 'bg-primary/10 text-primary border-2 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }`
                      : `h-10 ${
                          pathname === '/settings'
                            ? 'bg-primary/10 text-primary border-l-4 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent'
                        }`
                  }`}
                >
                  <Link
                    to="/settings"
                    className={
                      isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : ''
                    }
                  >
                    <Settings size={20} className="w-5! h-5! p-[1px]" />
                    {showExpandedContent && <span>Settings</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showExpandedContent && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            Version 5.0.0
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
