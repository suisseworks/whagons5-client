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
  MoreHorizontal,
  Sparkles,
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { Link, useLocation } from 'react-router-dom';
import { RootState } from '@/store';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
// import { useAuth } from '@/providers/AuthProvider'; // Currently not used, uncomment when needed
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/animate-ui/primitives/radix/collapsible';
import AssistantWidget from './AssistantWidget';
import WhagonsCheck from '@/assets/WhagonsCheck';

import { iconService } from '@/database/iconService';
import { Workspace } from '@/store/types';
// Removed Messages feature
import AppSidebarWorkspaces from './AppSidebarWorkspaces';
import { genericCaches } from '@/store/genericSlices';

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

  // Local-first: read workspaces directly from IndexedDB to render immediately, then let Redux take over
  const [initialWorkspaces, setInitialWorkspaces] = useState<Workspace[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    const loadLocal = async () => {
      try {
        const cache = (genericCaches as any)?.workspaces;
        if (cache && typeof cache.getAll === 'function') {
          const rows = await cache.getAll();
          if (!cancelled) setInitialWorkspaces(rows || []);
        }
      } catch {
        // ignore
      }
    };
    loadLocal();
    return () => { cancelled = true; };
  }, []);

  // Prefer Redux once it has data; otherwise show local IndexedDB rows
  const displayWorkspaces: Workspace[] = (workspaces && workspaces.length > 0)
    ? workspaces as any
    : (initialWorkspaces || []);

  // Dedupe workspaces by id to avoid duplicate key warnings when state temporarily contains duplicates
  const uniqueWorkspaces = useMemo(() => {
    const map = new Map<string, Workspace>();
    for (const w of displayWorkspaces) map.set(String(w.id), w);
    return Array.from(map.values());
  }, [displayWorkspaces]);

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
      const iconNames = uniqueWorkspaces.map((workspace: Workspace) => workspace.icon).filter(Boolean);
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
  }, [uniqueWorkspaces]);

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
        className={`!p-0 bg-sidebar-header backdrop-blur-xl transition-colors duration-200 ${isCollapsed ? 'px-1' : ''
        }`}
        style={{
          height: 'var(--app-header-height)',
          flexShrink: 0,
        }}
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
        <Collapsible defaultOpen={false} className="w-full">
          <CollapsibleTrigger asChild>
            <SidebarMenuButton
              asChild
              tooltip={isCollapsed && !isMobile ? 'More' : undefined}
              className="rounded-[8px] transition-opacity opacity-70 hover:opacity-100 hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
              style={{
                height: '30px',
                padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
                gap: '8px',
                fontWeight: 500,
                fontSize: '12px',
              }}
            >
              <button
                type="button"
                className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center w-full'} text-[var(--sidebar-text-primary)]`}
              >
                <IconBadge color="var(--sidebar-border)" size={18}>
                  <MoreHorizontal size={12} className="w-3 h-3 block" style={{ color: 'var(--sidebar-text-secondary)', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                </IconBadge>
                {!isCollapsed && !isMobile && <span className="ml-1.5">More</span>}
              </button>
            </SidebarMenuButton>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2 space-y-1 opacity-70 hover:opacity-100 transition-opacity">
            <SidebarGroup style={{ flexShrink: 0 }}>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? 'TeamConnect' : undefined}
                      className="rounded-[8px] transition-colors text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                      style={{
                        height: '30px',
                        padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
                        gap: '8px',
                        fontWeight: pathname === '/teamconnect' ? 600 : 400,
                        fontSize: '12px',
                        boxShadow: pathname === '/teamconnect' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                      }}
                    >
                      <Link
                        to="/teamconnect"
                        className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center'} group relative`}
                      >
                        <IconBadge color="var(--sidebar-border)" size={18}>
                          <Users2 size={12} className="w-3 h-3 block" style={{ color: 'var(--sidebar-text-secondary)', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                        </IconBadge>
                        {!isCollapsed && !isMobile && <span className="ml-1.5">TeamConnect</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? 'Compliance' : undefined}
                      className="rounded-[8px] transition-colors text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                      style={{
                        height: '30px',
                        padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
                        gap: '8px',
                        fontWeight: pathname.startsWith('/compliance') ? 600 : 400,
                        fontSize: '12px',
                        boxShadow: pathname.startsWith('/compliance') ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                      }}
                    >
                      <Link
                        to="/compliance/standards"
                        className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center'} group relative`}
                      >
                        <IconBadge color="var(--sidebar-border)" size={18}>
                          <FileText size={12} className="w-3 h-3 block" style={{ color: 'var(--sidebar-text-secondary)', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                        </IconBadge>
                        {!isCollapsed && !isMobile && <span className="ml-1.5">Compliance</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? 'Analytics' : undefined}
                      className="rounded-[8px] transition-colors text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                      style={{
                        height: '30px',
                        padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
                        gap: '8px',
                        fontWeight: pathname === '/analytics' ? 600 : 400,
                        fontSize: '12px',
                        boxShadow: pathname === '/analytics' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                      }}
                    >
                      <Link
                        to="/analytics"
                        className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center'} group relative`}
                      >
                        <IconBadge color="var(--sidebar-border)" size={18}>
                          <BarChart3 size={12} className="w-3 h-3 block" style={{ color: 'var(--sidebar-text-secondary)', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                        </IconBadge>
                        {!isCollapsed && !isMobile && <span className="ml-1.5">Analytics</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? 'Plugins' : undefined}
                      className="rounded-[8px] transition-colors text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                      style={{
                        height: '30px',
                        padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
                        gap: '8px',
                        fontWeight: pathname === '/plugins' ? 600 : 400,
                        fontSize: '12px',
                        boxShadow: pathname === '/plugins' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                      }}
                    >
                      <Link
                        to="/plugins"
                        className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center'} group relative`}
                      >
                        <IconBadge color="var(--sidebar-border)" size={18}>
                          <Plug size={12} className="w-3 h-3 block" style={{ color: 'var(--sidebar-text-secondary)', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                        </IconBadge>
                        {!isCollapsed && !isMobile && <span className="ml-1.5">Plugins</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarSeparator className="my-1 border-[var(--sidebar-border)]" />

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? 'Settings' : undefined}
                      className="rounded-[8px] transition-colors text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                      style={{
                        height: '30px',
                        padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
                        gap: '8px',
                        fontWeight: pathname === '/settings' ? 600 : 400,
                        fontSize: '12px',
                        boxShadow: pathname === '/settings' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                      }}
                    >
                      <Link
                        to="/settings"
                        className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center'} group relative`}
                      >
                        <IconBadge color="var(--sidebar-border)" size={18}>
                          <Settings size={12} className="w-3 h-3 block" style={{ color: 'var(--sidebar-text-secondary)', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                        </IconBadge>
                        {!isCollapsed && !isMobile && <span className="ml-1.5">Settings</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? 'Global Settings' : undefined}
                      className="rounded-[8px] transition-colors text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
                      style={{
                        height: '30px',
                        padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
                        gap: '8px',
                        fontWeight: pathname === '/settings/global' ? 600 : 400,
                        fontSize: '12px',
                        boxShadow: pathname === '/settings/global' ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
                      }}
                    >
                      <Link
                        to="/settings/global"
                        className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center'} group relative`}
                      >
                        <IconBadge color="var(--sidebar-border)" size={18}>
                          <Globe size={12} className="w-3 h-3 block" style={{ color: 'var(--sidebar-text-secondary)', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                        </IconBadge>
                        {!isCollapsed && !isMobile && <span className="ml-1.5">Global Settings</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </CollapsibleContent>
        </Collapsible>

        <div className="flex justify-center pt-2 pb-1">
          <AssistantWidget
            floating={false}
            renderTrigger={(open) => (
              <button
                type="button"
                onClick={open}
                title="Copilot"
                className="h-8 w-8 inline-flex items-center justify-center rounded-full bg-[var(--sidebar-border)]/80 text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] transition-colors"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}
          />
        </div>

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
