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
      className={`bg-sidebar transition-all duration-300 text-sidebar-foreground font-montserrat text-[1rem]`}
      style={{ borderRight: '1px solid var(--sidebar-border)' }}
      overlayExpanded={overlayOnExpand && !getPinnedState()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <SidebarHeader
        className={`shadow-md bg-sidebar-header transition-colors duration-200 ${isCollapsed ? 'px-1' : ''
        }`}
        style={{ paddingTop: '12px', paddingBottom: '10px', height: '52px', flexShrink: 0 }}
      >
        <div className="flex items-center justify-center w-full h-full">
          <Link
            to="/welcome"
            title="Home"
            className={`flex items-center h-full transition-all duration-300 ${isCollapsed ? 'justify-center' : 'justify-center'
            }`}
          >
            <WhagonsCheck
              width={showExpandedContent ? 40 : 28}
              height={showExpandedContent ? 18 : 14}
              style={{ color: 'var(--sidebar-primary)' }}
            />
            {showExpandedContent && (
              <div
                className="pl-2 font-semibold text-[var(--sidebar-primary)]"
                style={{ fontFamily: 'Montserrat', fontSize: '20px', fontWeight: 600 }}
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

      <SidebarContent className="bg-sidebar" style={{ paddingLeft: isCollapsed && !isMobile ? '8px' : '20px', paddingRight: isCollapsed && !isMobile ? '8px' : '20px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Spaces section - scrollable */}
        <SidebarGroup style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <AppSidebarWorkspaces
              workspaces={uniqueWorkspaces}
              pathname={pathname}
              getWorkspaceIcon={getWorkspaceIcon}
              showEverythingButton={true}
            />
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar flex flex-col" style={{ borderTop: '1px solid var(--sidebar-border)', paddingLeft: isCollapsed && !isMobile ? '8px' : '20px', paddingRight: isCollapsed && !isMobile ? '8px' : '20px', flexShrink: 0 }}>
        {/* Section: TeamConnect */}
        <SidebarGroup style={{ flexShrink: 0, marginBottom: '4px', marginTop: '4px' }}>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem style={{ marginBottom: '0' }}>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'TeamConnect' : undefined}
                  className={`rounded-[8px] relative transition-colors ${isCollapsed && !isMobile
                      ? `flex justify-center items-center ${pathname === '/teamconnect'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)] border border-[var(--sidebar-ring)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                      : `${pathname === '/teamconnect'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                  }`}
                  style={{
                    height: '32px',
                    padding: isCollapsed && !isMobile ? '6px' : '6px 10px',
                    gap: '8px',
                    fontWeight: pathname === '/teamconnect' ? 600 : 500,
                    fontSize: '13px'
                  }}
                >
                  <Link
                    to="/teamconnect"
                    className={`${isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden`}
                  >
                    <div
                      className="flex items-center justify-center rounded-[4px] flex-shrink-0"
                      style={{
                        backgroundColor: '#8B5CF6',
                        width: '20px',
                        height: '20px',
                      }}
                    >
                      <Users2 size={16} className="w-4 h-4" style={{ color: '#ffffff', strokeWidth: 2 }} />
                    </div>
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">TeamConnect</span>
                    ) : (
                      <span className="ml-1.5">TeamConnect</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator className="h-[1px]" style={{ backgroundColor: 'var(--sidebar-border)', marginBottom: '4px' }} />

        {/* Section: Analytics & Plugins */}
        <SidebarGroup style={{ flexShrink: 0, marginBottom: '4px' }}>
          <SidebarGroupContent className="py-0">
            <SidebarMenu className="space-y-0">
              <SidebarMenuItem style={{ marginBottom: '1px' }}>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Analytics' : undefined}
                  className={`rounded-[8px] relative transition-colors ${isCollapsed && !isMobile
                      ? `flex justify-center items-center ${pathname === '/analytics'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)] border border-[var(--sidebar-ring)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                      : `${pathname === '/analytics'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                  }`}
                  style={{
                    height: '32px',
                    padding: isCollapsed && !isMobile ? '6px' : '6px 10px',
                    gap: '8px',
                    fontWeight: pathname === '/analytics' ? 600 : 500,
                    fontSize: '13px'
                  }}
                >
                  <Link
                    to="/analytics"
                    className={`${isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden`}
                  >
                    <BarChart3 size={16} className="w-4 h-4" style={{ opacity: pathname === '/analytics' ? 1 : 0.7, strokeWidth: 2 }} />
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Analytics</span>
                    ) : (
                      <span className="ml-1.5">Analytics</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem style={{ marginBottom: '0' }}>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Plugins' : undefined}
                  className={`rounded-[8px] relative transition-colors ${
                    isCollapsed && !isMobile
                      ? `flex justify-center items-center ${
                          pathname === '/plugins'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)] border border-[var(--sidebar-ring)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                      : `${
                          pathname === '/plugins'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                  }`}
                  style={{
                    height: '32px',
                    padding: isCollapsed && !isMobile ? '6px' : '6px 10px',
                    gap: '8px',
                    fontWeight: pathname === '/plugins' ? 600 : 500,
                    fontSize: '13px'
                  }}
                >
                  <Link
                    to="/plugins"
                    className={`${
                      isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden`}
                  >
                    <Plug size={16} className="w-4 h-4" style={{ opacity: pathname === '/plugins' ? 1 : 0.7, strokeWidth: 2 }} />
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Plugins</span>
                    ) : (
                      <span className="ml-1.5">Plugins</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="h-[1px]" style={{ backgroundColor: 'var(--sidebar-border)', marginBottom: '4px' }} />

        {/* Section: Settings */}
        <SidebarGroup style={{ flexShrink: 0, paddingTop: '2px', marginTop: 'auto' }}>
          <SidebarGroupContent className="py-0">
            <SidebarMenu className="space-y-0">
              <SidebarMenuItem style={{ marginBottom: '1px' }}>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Settings' : undefined}
                  className={`rounded-[8px] relative transition-colors ${isCollapsed && !isMobile
                      ? `flex justify-center items-center ${pathname === '/settings'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)] border border-[var(--sidebar-ring)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                      : `${pathname === '/settings'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                  }`}
                  style={{
                    height: '32px',
                    padding: isCollapsed && !isMobile ? '6px' : '6px 10px',
                    gap: '8px',
                    fontWeight: pathname === '/settings' ? 600 : 500,
                    fontSize: '13px'
                  }}
                >
                  <Link
                    to="/settings"
                    className={`${isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden`}
                  >
                    <div
                      className="flex items-center justify-center rounded-[4px] flex-shrink-0"
                      style={{
                        backgroundColor: '#64748B',
                        width: '20px',
                        height: '20px',
                      }}
                    >
                      <Settings size={16} className="w-4 h-4" style={{ color: '#ffffff', strokeWidth: 2 }} />
                    </div>
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Settings</span>
                    ) : (
                      <span className="ml-1.5">Settings</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem style={{ marginBottom: '0' }}>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Global Settings' : undefined}
                  className={`rounded-[8px] relative transition-colors ${isCollapsed && !isMobile
                      ? `flex justify-center items-center ${pathname === '/settings/global'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)] border border-[var(--sidebar-ring)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                      : `${pathname === '/settings/global'
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                  }`}
                  style={{
                    height: '32px',
                    padding: isCollapsed && !isMobile ? '6px' : '6px 10px',
                    gap: '8px',
                    fontWeight: pathname === '/settings/global' ? 600 : 500,
                    fontSize: '13px'
                  }}
                >
                  <Link
                    to="/settings/global"
                    className={`${isCollapsed && !isMobile
                        ? 'flex justify-center items-center w-full'
                        : 'flex items-center'
                    } group relative overflow-hidden`}
                  >
                    <div
                      className="flex items-center justify-center rounded-[4px] flex-shrink-0"
                      style={{
                        backgroundColor: '#64748B',
                        width: '20px',
                        height: '20px',
                      }}
                    >
                      <Globe size={16} className="w-4 h-4" style={{ color: '#ffffff', strokeWidth: 2 }} />
                    </div>
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Global Settings</span>
                    ) : (
                      <span className="ml-1.5">Global Settings</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Messages create board dialog removed */}

        {showExpandedContent && (
          <div style={{ padding: '4px 16px', fontSize: '12px', color: 'var(--sidebar-text-tertiary)', fontWeight: 400, marginTop: '4px', flexShrink: 0 }}>
            Version 5.0.0
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
