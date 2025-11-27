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
  FileText, // Add FileText icon
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { RootState } from '@/store';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

const IconBadge = ({
  children,
  color,
  size = 20,
}: {
  children: ReactNode;
  color: string;
  size?: number;
}) => (
  <div
    className="grid place-items-center rounded-[6px] flex-shrink-0"
    style={{
      backgroundColor: color,
      width: `${size}px`,
      height: `${size}px`,
      lineHeight: 0,
      position: 'relative'
    }}
  >
    {children}
  </div>
);

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
      className={`bg-sidebar text-sidebar-foreground font-montserrat text-[1rem]`}
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
              color={'var(--sidebar-primary)'}
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

      <SidebarContent className="bg-sidebar" style={{ paddingLeft: isCollapsed && !isMobile ? '4px' : '20px', paddingRight: isCollapsed && !isMobile ? '4px' : '20px', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {/* Spaces section - scrollable */}
        <SidebarGroup style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="scrollbar-hide" style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', paddingBottom: isCollapsed ? '80px' : '16px' }}>
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
                            ? 'text-[var(--sidebar-primary)]'
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
                    fontSize: '13px',
                    boxShadow: pathname === '/teamconnect' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                    borderTopLeftRadius: pathname === '/teamconnect' ? '4px' : undefined,
                    borderBottomLeftRadius: pathname === '/teamconnect' ? '4px' : undefined
                  }}
                >
                  <Link
                    to="/teamconnect"
                    className={`${isCollapsed && !isMobile
                        ? 'grid place-items-center w-8 h-8 p-0'
                        : 'flex items-center'
                    } group relative`}
                  >
                    <IconBadge color="#8B5CF6">
                      <Users2 size={14} className="w-4 h-4 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                    </IconBadge>
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
              {/* Compliance Link */}
              <SidebarMenuItem style={{ marginBottom: '1px' }}>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Compliance' : undefined}
                  className={`rounded-[8px] relative transition-colors ${isCollapsed && !isMobile
                      ? `flex justify-center items-center ${pathname.startsWith('/compliance')
                            ? 'text-[var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                      : `${pathname.startsWith('/compliance')
                            ? 'bg-[var(--sidebar-selected-bg)] text-[var(--sidebar-primary)]'
                            : 'text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]'
                        }`
                  }`}
                  style={{
                    height: '32px',
                    padding: isCollapsed && !isMobile ? '6px' : '6px 10px',
                    gap: '8px',
                    fontWeight: pathname.startsWith('/compliance') ? 600 : 500,
                    fontSize: '13px',
                    boxShadow: pathname.startsWith('/compliance') ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                    borderTopLeftRadius: pathname.startsWith('/compliance') ? '4px' : undefined,
                    borderBottomLeftRadius: pathname.startsWith('/compliance') ? '4px' : undefined
                  }}
                >
                  <Link
                    to="/compliance/standards"
                    className={`${isCollapsed && !isMobile
                        ? 'grid place-items-center w-8 h-8 p-0'
                        : 'flex items-center'
                    } group relative`}
                    >
                      <IconBadge color="#10B981">
                        <FileText size={14} className="w-4 h-4 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                      </IconBadge>
                    {isCollapsed && !isMobile ? (
                      <span className="sr-only">Compliance</span>
                    ) : (
                      <span className="ml-1.5">Compliance</span>
                    )}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem style={{ marginBottom: '1px' }}>
                <SidebarMenuButton
                  asChild
                  tooltip={isCollapsed && !isMobile ? 'Analytics' : undefined}
                  className={`rounded-[8px] relative transition-colors ${isCollapsed && !isMobile
                      ? `flex justify-center items-center ${pathname === '/analytics'
                            ? 'text-[var(--sidebar-primary)]'
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
                    fontSize: '13px',
                    boxShadow: pathname === '/analytics' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                    borderTopLeftRadius: pathname === '/analytics' ? '4px' : undefined,
                    borderBottomLeftRadius: pathname === '/analytics' ? '4px' : undefined
                  }}
                >
                  <Link
                    to="/analytics"
                    className={`${isCollapsed && !isMobile
                        ? 'grid place-items-center w-8 h-8 p-0'
                        : 'flex items-center'
                    } group relative`}
                    >
                      <IconBadge color="#0EA5E9">
                        <BarChart3 size={14} className="w-4 h-4 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                      </IconBadge>
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
                            ? 'text-[var(--sidebar-primary)]'
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
                    fontSize: '13px',
                    boxShadow: pathname === '/plugins' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                    borderTopLeftRadius: pathname === '/plugins' ? '4px' : undefined,
                    borderBottomLeftRadius: pathname === '/plugins' ? '4px' : undefined
                  }}
                >
                  <Link
                    to="/plugins"
                    className={`${
                      isCollapsed && !isMobile
                        ? 'grid place-items-center w-8 h-8 p-0'
                        : 'flex items-center'
                    } group relative`}
                    >
                      <IconBadge color="#F59E0B">
                        <Plug size={14} className="w-4 h-4 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                      </IconBadge>
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
                            ? 'text-[var(--sidebar-primary)]'
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
                    fontSize: '13px',
                    boxShadow: pathname === '/settings' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                    borderTopLeftRadius: pathname === '/settings' ? '4px' : undefined,
                    borderBottomLeftRadius: pathname === '/settings' ? '4px' : undefined
                  }}
                >
                  <Link
                    to="/settings"
                    className={`${isCollapsed && !isMobile
                        ? 'grid place-items-center w-8 h-8 p-0'
                        : 'flex items-center'
                    } group relative`}
                    >
                      <IconBadge color="#64748B">
                        <Settings size={14} className="w-4 h-4 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                      </IconBadge>
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
                            ? 'text-[var(--sidebar-primary)]'
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
                    fontSize: '13px',
                    boxShadow: pathname === '/settings/global' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                    borderTopLeftRadius: pathname === '/settings/global' ? '4px' : undefined,
                    borderBottomLeftRadius: pathname === '/settings/global' ? '4px' : undefined
                  }}
                >
                  <Link
                    to="/settings/global"
                    className={`${isCollapsed && !isMobile
                        ? 'grid place-items-center w-8 h-8 p-0'
                        : 'flex items-center'
                    } group relative`}
                    >
                      <IconBadge color="#64748B">
                        <Globe size={14} className="w-4 h-4 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                      </IconBadge>
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
