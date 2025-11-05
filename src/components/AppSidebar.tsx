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
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Settings,
  Plus,
  ChevronDown,
  BarChart3,
  Layers,
  Plug,
  Users2,
  Globe,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { RootState } from '@/store';
import { useEffect, useMemo, useRef, useState } from 'react';
// import { useAuth } from '@/providers/AuthProvider'; // Currently not used, uncomment when needed
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from '@/components/animate-ui/primitives/radix/collapsible';
import WhagonsCheck from '@/assets/WhagonsCheck';

import { iconService } from '@/database/iconService';
import { Workspace } from '@/store/types';
// Removed Messages feature
import AppSidebarWorkspaces from './AppSidebarWorkspaces';
import AppSidebarDummy from './AppSidebarDummy';

// Global pinned state management
let isPinnedGlobal = localStorage.getItem('sidebarPinned') === 'true';
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
    localStorage.setItem('sidebarPinned', newPinned.toString());
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

export function AppSidebar({ overlayOnExpand = true }: { overlayOnExpand?: boolean }) {
  const { state, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;
  const isCollapsed = state === 'collapsed';

  // Extract toggleSidebar to suppress unused warning
  // const { toggleSidebar } = useSidebar();

  const [, setIsPinned] = useState(getPinnedState());
  const [workspaceIcons, setWorkspaceIcons] = useState<{ [key: string]: any }>({});
  const [defaultIcon, setDefaultIcon] = useState<any>(null);
  const hoverOpenTimerRef = useRef<number | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  // const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  // const [createBoardOpen, setCreateBoardOpen] = useState(false);

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

  // Messages removed

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current as any) {
        clearTimeout(hoverOpenTimerRef.current as any);
      }
      if (hoverCloseTimerRef.current as any) {
        clearTimeout(hoverCloseTimerRef.current as any);
      }
    };
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

  // Determine if we should show expanded content
  const showExpandedContent = !isCollapsed || isMobile;

  // Hover handlers re-enabled for open/close without transform animations
  const handleMouseEnter = () => {
    if (isMobile) return;
    if (state !== 'collapsed') return;
    if ((hoverCloseTimerRef.current as any)) {
      clearTimeout(hoverCloseTimerRef.current as any);
      hoverCloseTimerRef.current = null;
    }
    if (!(hoverOpenTimerRef.current as any)) {
      hoverOpenTimerRef.current = setTimeout(() => {
        // open sidebar on hover in
        try { setOpen(true); } catch { }
        hoverOpenTimerRef.current = null;
      }, 0) as unknown as number;
    }
  };

  const handleMouseLeave = () => {
    if (isMobile) return;
    if (getPinnedState()) return;
    if (hoverOpenTimerRef.current as any) {
      clearTimeout(hoverOpenTimerRef.current as any);
      hoverOpenTimerRef.current = null;
    }
    if (!(hoverCloseTimerRef.current as any)) {
      hoverCloseTimerRef.current = setTimeout(() => {
        try { setOpen(false); } catch { }
        hoverCloseTimerRef.current = null;
      }, 100) as unknown as number;
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
      className={`bg-sidebar border-r border-sidebar-border transition-all duration-300 text-sidebar-foreground font-montserrat text-[1rem]`}
      overlayExpanded={overlayOnExpand && !getPinnedState()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader
        className={`shadow-md bg-sidebar-header h-16 transition-colors duration-200 ${isCollapsed ? 'px-1' : ''
        }`}
      >
        <div className="flex items-center justify-center w-full h-full">
          <Link
            to="/welcome"
            title="Home"
            className={`flex items-center h-full transition-all duration-300 ${isCollapsed ? 'justify-center' : 'justify-center'
            }`}
          >
            <WhagonsCheck
              width={showExpandedContent ? 56 : 38}
              height={showExpandedContent ? 26 : 18}
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

      <SidebarContent className="bg-sidebar [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] dark:[background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:14px_14px]">
        <SidebarGroup>
          {/* Everything workspace - above the Spaces dropdown */}
          {(!isCollapsed || isMobile) && (
            <div className="px-3">
              <Link
                to={`/workspace/all`}
                className={`group flex items-center space-x-2 rounded-md relative overflow-hidden transition-colors h-10 px-3 ${pathname === `/workspace/all`
                    ? 'bg-primary/15 text-primary border-l-4 border-primary'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                } after:absolute after:left-0 after:top-0 after:h-full after:w-0 hover:after:w-1 after:bg-primary/60 after:transition-all after:duration-200`}
              >
                <span>
                  <Layers className="w-5 h-5 text-[#27C1A7]" />
                </span>
                <span className="font-semibold">Everything</span>
              </Link>
            </div>
          )}

          {/* Show Everything icon when collapsed - DESKTOP ONLY */}
          {isCollapsed && !isMobile && (
            <div className="px-2 flex justify-center">
              <Link
                to={`/workspace/all`}
                className={`flex items-center justify-center w-10 h-10 rounded text-xs font-medium transition-colors ${pathname === `/workspace/all`
                    ? 'bg-primary/20 text-primary border border-primary/40'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
                title={'Everything'}
              >
                <Layers className="w-5 h-5 text-[#27C1A7]" />
              </Link>
            </div>
          )}

            <AppSidebarWorkspaces
              workspaces={uniqueWorkspaces}
              pathname={pathname}
              getWorkspaceIcon={getWorkspaceIcon}
            />
          {/* TeamConnect (replaces Messages) */}
          <SidebarGroup>
            {(!isCollapsed || isMobile) && (
              <div className="px-3 py-2">
                <Link
                  to={`/teamconnect`}
                  className={`group flex items-center space-x-2 rounded-md relative overflow-hidden transition-colors h-10 px-3 ${pathname === `/teamconnect`
                      ? 'bg-primary/15 text-primary border-l-4 border-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  } after:absolute after:left-0 after:top-0 after:h-full after:w-0 hover:after:w-1 after:bg-primary/60 after:transition-all after:duration-200`}
                >
                  <span>
                    <Users2 className="w-4 h-4" />
                  </span>
                  <span className="font-semibold">TeamConnect</span>
                </Link>
              </div>
            )}

            {/* Collapsed icon only */}
            {isCollapsed && !isMobile && (
              <div className="px-2 flex justify-center">
                <Link
                  to={`/teamconnect`}
                  className={`flex items-center justify-center w-10 h-10 rounded text-xs font-medium transition-colors ${pathname === `/teamconnect`
                      ? 'bg-primary/20 text-primary border border-primary/40'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  }`}
                  title={'TeamConnect'}
                >
                  <Users2 className="w-5 h-5 text-[#27C1A7]" />
                </Link>
              </div>
            )}
          </SidebarGroup>

          {/* <AppSidebarDummy /> */}
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar [background-image:radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.06)_1px,transparent_0)] dark:[background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:14px_14px] border-t border-sidebar-border">
        {/* Section: Analytics & Plugins */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="pt-1 pb-1">
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Analytics' : undefined}
                  className={`rounded-md relative transition-colors ${isCollapsed && !isMobile
                      ? `h-10 flex justify-center items-center ${pathname === '/analytics'
                            ? 'bg-primary/10 text-primary border-2 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                      : `h-10 ${pathname === '/analytics'
                            ? 'bg-primary/15 text-primary border-l-4 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                  }`}
                >
                  <Link
                    to="/analytics"
                    className={`${isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden after:absolute after:left-0 after:top-0 after:h-full after:w-0 after:bg-primary/60`}
                  >
                    <BarChart3 size={20} className="w-5! h-5! p-[1px]" />
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Analytics</span>
                    ) : (
                      <span className="ml-3 text-sm font-medium">Analytics</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="pt-1 pb-1">
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Plugins' : undefined}
                  className={`rounded-md relative transition-colors ${
                    isCollapsed && !isMobile
                      ? `h-10 flex justify-center items-center ${
                          pathname === '/plugins'
                            ? 'bg-primary/10 text-primary border-2 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                      : `h-10 ${
                          pathname === '/plugins'
                            ? 'bg-primary/15 text-primary border-l-4 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                  }`}
                >
                  <Link
                    to="/plugins"
                    className={`${
                      isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden after:absolute after:left-0 after:top-0 after:h-full after:w-0 after:bg-primary/60`}
                  >
                    <Plug size={20} className="w-5! h-5! p-[1px]" />
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Plugins</span>
                    ) : (
                      <span className="ml-3 text-sm font-medium">Plugins</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Section: Settings */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem className="pt-1 pb-1">
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Settings' : undefined}
                  className={`rounded-md relative transition-colors ${isCollapsed && !isMobile
                      ? `h-10 flex justify-center items-center ${pathname === '/settings'
                            ? 'bg-primary/10 text-primary border-2 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                      : `h-10 ${pathname === '/settings'
                            ? 'bg-primary/15 text-primary border-l-4 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                  }`}
                >
                  <Link
                    to="/settings"
                    className={`${isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden after:absolute after:left-0 after:top-0 after:h-full after:w-0 after:bg-primary/60`}
                  >
                    <Settings size={20} className="w-5! h-5! p-[1px]" />
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Settings</span>
                    ) : (
                      <span className="ml-3 text-sm font-medium">Settings</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="pt-1 pb-1">
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Global Settings' : undefined}
                  className={`rounded-md relative transition-colors ${isCollapsed && !isMobile
                      ? `h-10 flex justify-center items-center ${pathname === '/settings/global'
                            ? 'bg-primary/10 text-primary border-2 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                      : `h-10 ${pathname === '/settings/global'
                            ? 'bg-primary/15 text-primary border-l-4 border-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        }`
                  }`}
                >
                  <Link
                    to="/settings/global"
                    className={`${isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden after:absolute after:left-0 after:top-0 after:h-full after:w-0 after:bg-primary/60`}
                  >
                    <Globe size={20} className="w-5! h-5! p-[1px]" />
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Global Settings</span>
                    ) : (
                      <span className="ml-3 text-sm font-medium">Global Settings</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Messages create board dialog removed */}

        {showExpandedContent && (
          <div className="px-2 py-1 text-xs text-muted-foreground">
            Version 5.0.0
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
