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
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Workspace, workspacesSlice } from '@/store/reducers/workspacesSlice';
import {
  Settings,
  User,
  Users,
  Plus,
  ChevronDown,
  Briefcase,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { AppDispatch, RootState } from '@/store';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import WhagonsCheck from '@/assets/WhagonsCheck';

// Global pinned state management
let isPinnedGlobal = false;
const pinnedStateCallbacks: ((pinned: boolean) => void)[] = [];

export const setPinnedState = (pinned: boolean) => {
    isPinnedGlobal = pinned;
    pinnedStateCallbacks.forEach(callback => callback(pinned));
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
    const { toggleSidebar } = useSidebar();
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
            title={isPinned ? "Unpin Sidebar" : "Pin Sidebar"}
        >
            <div className="relative w-4 h-4 flex items-center justify-center">
                {/* Circle */}
                <div className="w-3 h-3 border-2 border-current rounded-full"></div>
                {/* Dot when pinned */}
                {isPinned && (
                    <div className="absolute w-1.5 h-1.5 bg-current rounded-full"></div>
                )}
            </div>
            <span className="sr-only">{isPinned ? "Unpin Sidebar" : "Pin Sidebar"}</span>
        </Button>
    );
};

export function AppSidebar() {
  const { state, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;
  const isCollapsed = state === 'collapsed';

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [isPinned, setIsPinned] = useState(getPinnedState());

  const dispatch = useDispatch<AppDispatch>();
  const { value: workspaces } = useSelector((state: RootState) => state.workspaces);
  const { addWorkspace } = workspacesSlice.actions;

  // Subscribe to pinned state changes
  useEffect(() => {
    const unsubscribe = subscribeToPinnedState(setIsPinned);
    return unsubscribe;
  }, []);

  const handleAddWorkspace = () => {
    if (!workspaceName.trim() || !workspaceDescription.trim()) {
      // Basic validation: Ensure fields are not empty
      // You might want to add more robust validation/feedback
      alert('Please enter both name and description.');
      return;
    }

    const newId = crypto.randomUUID();
    const newWorkspace: Workspace = {
      id: newId,
      name: workspaceName,
      // Use a path structure like /workspace/:id for routing
      path: `/workspace/${newId}`,
      description: workspaceDescription,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dispatch(addWorkspace(newWorkspace));

    // Reset form and close modal
    setWorkspaceName('');
    setWorkspaceDescription('');
    setIsModalOpen(false);
  };

  useEffect(() => {
    console.log(workspaces);
  }, [workspaces]);

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
          <div
            className={`flex items-center pt-3 pb-3 transition-all duration-300 ${
              isCollapsed ? 'justify-center' : 'justify-center'
            }`}
          >
            <WhagonsCheck width={showExpandedContent ? 45 : 32} height={showExpandedContent ? 21 : 15} color="#27C1A7" />
            {showExpandedContent && (
              <div className='text-xl pl-2 font-semibold text-[#27C1A7]' style={{ fontFamily: 'Montserrat' }}>
                Whagons
              </div>
            )}
          </div>
          {!isCollapsed && !isMobile && (
            <PinnedSidebarTrigger className="ml-2 text-primary hover:text-primary/80" />
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="bg-sidebar">
        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild className="text-sm font-normal">
                <div className={`flex items-center w-full pr-3 transition-all duration-300 ${
                  isCollapsed ? 'justify-center px-0' : 'justify-between'
                }`}>
                  <CollapsibleTrigger className={`flex items-center cursor-pointer hover:bg-sidebar-accent rounded-sm p-1 pr-2 -ml-3 transition-all duration-300 ${
                    (isCollapsed && !isMobile) ? 'flex-col justify-center ml-0 px-2' : 'justify-start flex-1'
                  }`}>
                    
                    {(isCollapsed && !isMobile) ? (
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 p-0 hover:bg-primary/10 text-primary hover:text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsModalOpen(true);
                      }}
                    >
                      <Plus size={16} className="text-primary" />
                      <span className="sr-only">Add Workspace</span>
                    </Button>
                  )}
                </div>
              </SidebarGroupLabel>
              
              <CollapsibleContent>
                {(!isCollapsed || isMobile) && (
                  <SidebarGroupContent
                    className="pt-2 pl-1"
                  >
                    {workspaces.map((workspace) => (
                      <Link
                        key={workspace.id}
                        to={workspace.path}
                        className={`block rounded-md relative transition-colors px-4 py-2 mx-2 ${
                          pathname === workspace.path
                            ? 'bg-primary/10 text-primary border-l-4 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent px-5'
                        }`}
                      >
                        {workspace.name}
                      </Link>
                    ))}
                  </SidebarGroupContent>
                )}
                
                {/* Show workspace first letters when collapsed AND collapsible is open - DESKTOP ONLY */}
                {isCollapsed && !isMobile && (
                  <SidebarGroupContent className="pt-2">
                    <div className="flex flex-col items-center space-y-1 px-1 py-1 rounded-md bg-sidebar-accent/30">
                      {workspaces.map((workspace) => (
                        <Link
                          key={workspace.id}
                          to={workspace.path}
                          className={`flex items-center justify-center w-8 h-8 rounded text-xs font-medium transition-colors ${
                            pathname === workspace.path
                              ? 'bg-primary/20 text-primary border border-primary/40'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent'
                          }`}
                          title={workspace.name}
                        >
                          {workspace.name.charAt(0).toUpperCase()}
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
                  tooltip={isCollapsed && !isMobile ? "Settings" : undefined}
                  className={`rounded-md relative transition-colors ${
                    (isCollapsed && !isMobile)
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
                  <Link to="/settings" className={(isCollapsed && !isMobile) ? 'flex justify-center items-center w-full' : ''}>
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