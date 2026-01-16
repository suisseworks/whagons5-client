import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import {
  Settings,
  Plug,
  Users2,
  Globe,
  FileText, // Add FileText icon
  MoreHorizontal,
  Sparkles,
  Bell, // Add Bell icon for broadcasts
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
  useCollapsible,
} from '@/components/animate-ui/primitives/radix/collapsible';
import AssistantWidget from './AssistantWidget';
import WhagonsCheck from '@/assets/WhagonsCheck';

import { iconService } from '@/database/iconService';
import { Workspace } from '@/store/types';
// Removed Messages feature
import AppSidebarWorkspaces from './AppSidebarWorkspaces';
import AppSidebarBoards from './AppSidebarBoards';
import { genericCaches } from '@/store/genericSlices';
import { useLanguage } from '@/providers/LanguageProvider';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useBranding } from '@/providers/BrandingProvider';

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

// Plugin configuration management
export interface PluginConfig {
  id: string;
  enabled: boolean;
  pinned: boolean;
  name: string;
  icon: any;
  iconColor: string;
  route: string;
  order?: number;
}

const PLUGINS_STORAGE_KEY = 'pluginsConfig';
const PINNED_ORDER_STORAGE_KEY = 'pinnedPluginsOrder';
const pluginConfigCallbacks: ((configs: PluginConfig[]) => void)[] = [];

const getDefaultPluginsConfig = (): PluginConfig[] => [
  {
    id: 'broadcasts',
    enabled: true,
    pinned: false,
    name: 'Broadcasts',
    icon: Bell,
    iconColor: '#ef4444', // red-500 to match plugin card
    route: '/broadcasts',
  },
  {
    id: 'boards',
    enabled: true,
    pinned: false,
    name: 'Boards',
    icon: Users2,
    iconColor: '#8b5cf6', // violet-500 to match plugin card
    route: '', // No route - boards are managed via sidebar collapsible section
  },
  {
    id: 'compliance',
    enabled: true,
    pinned: false,
    name: 'Compliance',
    icon: FileText,
    iconColor: '#10b981', // emerald-500 to match plugin card
    route: '/compliance/standards',
  },
];

const loadPluginsConfig = (): PluginConfig[] => {
  try {
    const stored = localStorage.getItem(PLUGINS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new plugins
      const defaults = getDefaultPluginsConfig();
      return defaults.map(defaultPlugin => {
        const stored = parsed.find((p: PluginConfig) => p.id === defaultPlugin.id);
        return stored ? { ...defaultPlugin, ...stored } : defaultPlugin;
      });
    }
  } catch (error) {
    console.error('Error loading plugins config:', error);
  }
  return getDefaultPluginsConfig();
};

let pluginsConfigGlobal = loadPluginsConfig();

export const setPluginsConfig = (configs: PluginConfig[]) => {
  pluginsConfigGlobal = configs;
  try {
    // Only store id, enabled, and pinned to localStorage
    const toStore = configs.map(({ id, enabled, pinned }) => ({ id, enabled, pinned }));
    localStorage.setItem(PLUGINS_STORAGE_KEY, JSON.stringify(toStore));
  } catch (error) {
    console.error('Error saving plugins config:', error);
  }
  pluginConfigCallbacks.forEach((callback) => callback(configs));
};

export const getPluginsConfig = () => pluginsConfigGlobal;

export const subscribeToPluginsConfig = (callback: (configs: PluginConfig[]) => void) => {
  pluginConfigCallbacks.push(callback);
  return () => {
    const index = pluginConfigCallbacks.indexOf(callback);
    if (index > -1) pluginConfigCallbacks.splice(index, 1);
  };
};

export const togglePluginEnabled = (pluginId: string) => {
  const configs = getPluginsConfig();
  const updated = configs.map(p => 
    p.id === pluginId ? { ...p, enabled: !p.enabled } : p
  );
  setPluginsConfig(updated);
};

export const togglePluginPinned = (pluginId: string) => {
  const configs = getPluginsConfig();
  const updated = configs.map(p => 
    p.id === pluginId ? { ...p, pinned: !p.pinned } : p
  );
  setPluginsConfig(updated);
};

// Pinned plugins order management
export const getPinnedPluginsOrder = (): string[] => {
  try {
    const stored = localStorage.getItem(PINNED_ORDER_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const setPinnedPluginsOrder = (order: string[]) => {
  try {
    localStorage.setItem(PINNED_ORDER_STORAGE_KEY, JSON.stringify(order));
  } catch (error) {
    console.error('Error saving pinned plugins order:', error);
  }
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

// Plugin menu item component - moved outside AppSidebar to prevent recreation on every render
const PluginMenuItem = ({ 
  plugin, 
  isCollapsed, 
  isMobile, 
  pathname, 
  t 
}: { 
  plugin: PluginConfig; 
  isCollapsed: boolean; 
  isMobile: boolean; 
  pathname: string; 
  t: (key: string, fallback?: string) => string;
}) => {
  const Icon = plugin.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={isCollapsed && !isMobile ? t(`sidebar.${plugin.id}`, plugin.name) : undefined}
        className="rounded-[8px] transition-colors text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
        style={{
          height: '30px',
          padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
          gap: '8px',
          fontWeight: pathname.startsWith(plugin.route) || pathname === plugin.route ? 600 : 400,
          fontSize: '12px',
          boxShadow: pathname.startsWith(plugin.route) || pathname === plugin.route ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
        }}
      >
        <Link
          to={plugin.route}
          className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center'} group relative`}
        >
          <IconBadge color={plugin.iconColor} size={18}>
            <Icon size={12} className="w-3 h-3 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
          </IconBadge>
          {!isCollapsed && !isMobile && <span className="ml-1.5">{t(`sidebar.${plugin.id}`, plugin.name)}</span>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

// Sortable plugin menu item component - moved outside AppSidebar to prevent recreation on every render
const SortablePluginMenuItem = ({ 
  plugin, 
  isCollapsed, 
  isMobile, 
  pathname, 
  t 
}: { 
  plugin: PluginConfig; 
  isCollapsed: boolean; 
  isMobile: boolean; 
  pathname: string; 
  t: (key: string, fallback?: string) => string;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: plugin.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const Icon = plugin.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
    >
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={isCollapsed && !isMobile ? t(`sidebar.${plugin.id}`, plugin.name) : undefined}
          className="rounded-[8px] transition-colors text-[var(--sidebar-text-primary)] hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)]"
          style={{
            height: '30px',
            padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
            gap: '8px',
            fontWeight: pathname.startsWith(plugin.route) || pathname === plugin.route ? 600 : 400,
            fontSize: '12px',
            boxShadow: pathname.startsWith(plugin.route) || pathname === plugin.route ? 'inset 3px 0 0 var(--sidebar-primary)' : undefined,
          }}
        >
          <Link
            to={plugin.route}
            onClick={(e) => {
              if (isDragging) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
            className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center'} group relative`}
            style={{
              pointerEvents: isDragging ? 'none' : 'auto',
            }}
          >
            <IconBadge color={plugin.iconColor} size={18}>
              <Icon size={12} className="w-3 h-3 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
            </IconBadge>
            {!isCollapsed && !isMobile && <span className="ml-1.5">{t(`sidebar.${plugin.id}`, plugin.name)}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </div>
  );
};

const MoreMenuTriggerContent = ({ isCollapsed, isMobile }: { isCollapsed: boolean; isMobile: boolean }) => {
  const { isOpen } = useCollapsible();
  const { t } = useLanguage();
  
  return (
    <CollapsibleTrigger
      className={`${isCollapsed && !isMobile ? 'grid place-items-center w-8 h-8 p-0' : 'flex items-center w-full'} rounded-[8px] transition-colors hover:bg-[var(--sidebar-accent)] hover:text-[var(--sidebar-accent-foreground)] text-[var(--sidebar-text-primary)] cursor-pointer`}
      style={{
        height: '30px',
        padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
        gap: '8px',
        fontWeight: 500,
        fontSize: '12px',
      }}
      title={isCollapsed && !isMobile ? (isOpen ? t('sidebar.less', 'Less') : t('sidebar.more', 'More')) : undefined}
    >
      <IconBadge color="var(--sidebar-accent)" size={18}>
        <MoreHorizontal size={12} className="w-3 h-3 block" style={{ color: 'var(--sidebar-text-primary)', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
      </IconBadge>
      {!isCollapsed && !isMobile && <span className="ml-1.5">{isOpen ? t('sidebar.less', 'Less') : t('sidebar.more', 'More')}</span>}
    </CollapsibleTrigger>
  );
};

const PinnedSidebarTrigger = ({ className }: { className?: string }) => {
  const [isPinned, setIsPinned] = useState(isPinnedGlobal);
  const { t } = useLanguage();

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
      title={isPinned ? t('sidebar.unpinSidebar', 'Unpin Sidebar') : t('sidebar.pinSidebar', 'Pin Sidebar')}
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
        {isPinned ? t('sidebar.unpinSidebar', 'Unpin Sidebar') : t('sidebar.pinSidebar', 'Pin Sidebar')}
      </span>
    </Button>
  );
};

export function AppSidebar({ overlayOnExpand = true }: { overlayOnExpand?: boolean }) {
  const { state, setOpen, isMobile } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;
  const isCollapsed = state === 'collapsed';
  const { t } = useLanguage();
  const { config } = useBranding();
  
  // Check if primary color is a gradient
  const isPrimaryGradient = useMemo(() => {
    const primaryColor = config.primaryColor || '';
    return primaryColor.trim().startsWith('linear-gradient');
  }, [config.primaryColor]);

  // Extract toggleSidebar to suppress unused warning
  // const { toggleSidebar } = useSidebar();

  const [, setIsPinned] = useState(getPinnedState());
  const [pluginsConfig, setPluginsConfigState] = useState<PluginConfig[]>(getPluginsConfig());
  const [workspaceIcons, setWorkspaceIcons] = useState<{ [key: string]: any }>({});
  const [defaultIcon, setDefaultIcon] = useState<any>(null);
  const [pinnedBoards, setPinnedBoardsState] = useState<number[]>([]);
  const [pinnedBoardsOrder, setPinnedBoardsOrderState] = useState<number[]>([]);
  const hoverOpenTimerRef = useRef<number | null>(null);
  const hoverCloseTimerRef = useRef<number | null>(null);
  // const [boards, setBoards] = useState<{ id: string; name: string }[]>([]);
  // const [createBoardOpen, setCreateBoardOpen] = useState(false);

  const workspacesState = useSelector(
    (state: RootState) => state.workspaces
  );
  const { value: workspaces = [] } = workspacesState || {};

  // Boards state
  const boardsState = useSelector(
    (state: RootState) => (state as any).boards || { value: [] }
  );
  const { value: boards = [] } = boardsState;

  // Load boards on mount if boards plugin is enabled
  useEffect(() => {
    const boardsPlugin = pluginsConfig.find(p => p.id === 'boards');
    if (boardsPlugin?.enabled && boards.length === 0) {
      // Try to load boards from IndexedDB
      const loadBoards = async () => {
        try {
          const cache = (genericCaches as any)?.boards;
          if (cache && typeof cache.getAll === 'function') {
            await cache.getAll();
          }
        } catch (error) {
          console.error('Error loading boards:', error);
        }
      };
      loadBoards();
    }
  }, [pluginsConfig, boards.length]);

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

  // Subscribe to plugins config changes
  useEffect(() => {
    const unsubscribe = subscribeToPluginsConfig(setPluginsConfigState);
    return unsubscribe;
  }, []);

  // Load pinned boards from localStorage
  useEffect(() => {
    const loadPinnedBoards = () => {
      try {
        const stored = localStorage.getItem('pinnedBoards');
        const storedOrder = localStorage.getItem('pinnedBoardsOrder');
        if (stored) {
          setPinnedBoardsState(JSON.parse(stored));
        }
        if (storedOrder) {
          setPinnedBoardsOrderState(JSON.parse(storedOrder));
        }
      } catch (error) {
        console.error('Error loading pinned boards:', error);
      }
    };
    
    loadPinnedBoards();
    
    // Listen for storage changes (when boards are pinned/unpinned from settings)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pinnedBoards' || e.key === 'pinnedBoardsOrder') {
        loadPinnedBoards();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (same-window updates)
    const handleCustomStorageChange = () => {
      loadPinnedBoards();
    };
    
    window.addEventListener('pinnedBoardsChanged', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pinnedBoardsChanged', handleCustomStorageChange);
    };
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

  // Separate pinned and unpinned plugins (excluding boards since it's now a collapsible section)
  const [pinnedPluginsOrder, setPinnedPluginsOrderState] = useState<string[]>(getPinnedPluginsOrder());
  
  // Sort pinned plugins by saved order (excluding boards)
  const pinnedPlugins = useMemo(() => {
    const pinned = pluginsConfig.filter(p => p.enabled && p.pinned && p.id !== 'boards');
    const order = pinnedPluginsOrder;
    
    if (order.length === 0) return pinned;
    
    // Sort by saved order, putting unordered items at the end
    return [...pinned].sort((a, b) => {
      const aIndex = order.indexOf(a.id);
      const bIndex = order.indexOf(b.id);
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [pluginsConfig, pinnedPluginsOrder]);
  
  const unpinnedPlugins = pluginsConfig.filter(p => p.enabled && !p.pinned && p.id !== 'boards');

  // Check if boards plugin is enabled
  const boardsPluginEnabled = useMemo(() => {
    return pluginsConfig.find(p => p.id === 'boards')?.enabled ?? false;
  }, [pluginsConfig]);

  // DnD sensors for pinned plugins
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  const [activePluginId, setActivePluginId] = useState<string | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    setActivePluginId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) {
      setActivePluginId(null);
      return;
    }

    const oldIndex = pinnedPlugins.findIndex(p => p.id === active.id);
    const newIndex = pinnedPlugins.findIndex(p => p.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(pinnedPlugins, oldIndex, newIndex).map(p => p.id);
      setPinnedPluginsOrderState(newOrder);
      setPinnedPluginsOrder(newOrder);
    }
    
    setActivePluginId(null);
  };

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
              color={config.primaryColor || 'var(--sidebar-primary)'}
            />
            {showExpandedContent && (
              <div
                className="pl-2 font-semibold"
                style={{
                  fontFamily: 'Montserrat',
                  fontSize: '20px',
                  fontWeight: 600,
                  ...(isPrimaryGradient
                    ? {
                        background: 'var(--sidebar-primary)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                      }
                    : {
                        color: 'var(--sidebar-primary)',
                      }),
                }}
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
            
            {/* Boards section - shown below workspaces if boards plugin is enabled */}
            {boardsPluginEnabled && (
              <AppSidebarBoards
                boards={boards}
                pathname={pathname}
              />
            )}
            
            {/* Pinned plugins - shown below workspaces */}
            {pinnedPlugins.length > 0 && (
              <>
                <SidebarSeparator className="my-2 border-[var(--sidebar-border)]" />
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setActivePluginId(null)}
                >
                  <SortableContext
                    items={pinnedPlugins.map(p => p.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <SidebarMenu className="space-y-1">
                      {pinnedPlugins.map(plugin => (
                        <SortablePluginMenuItem 
                          key={plugin.id} 
                          plugin={plugin}
                          isCollapsed={isCollapsed}
                          isMobile={isMobile}
                          pathname={pathname}
                          t={t}
                        />
                      ))}
                    </SidebarMenu>
                  </SortableContext>
                  <DragOverlay zIndex={10000}>
                    {activePluginId ? (() => {
                      const plugin = pinnedPlugins.find(p => p.id === activePluginId);
                      if (!plugin) return null;
                      const Icon = plugin.icon;
                      const isActive = pathname.startsWith(plugin.route) || pathname === plugin.route;
                      
                      return (
                        <div
                          className="rounded-[8px] shadow-lg flex items-center"
                          style={{
                            height: '30px',
                            padding: isCollapsed && !isMobile ? '4px' : '6px 10px',
                            gap: '8px',
                            background: 'var(--sidebar)',
                            color: 'var(--sidebar-text-primary)',
                            fontWeight: isActive ? 600 : 400,
                            fontSize: '12px',
                            pointerEvents: 'none',
                          }}
                        >
                          <IconBadge color={plugin.iconColor} size={18}>
                            <Icon size={12} className="w-3 h-3 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                          </IconBadge>
                          {!isCollapsed && !isMobile && <span className="ml-1.5">{t(`sidebar.${plugin.id}`, plugin.name)}</span>}
                        </div>
                      );
                    })() : null}
                  </DragOverlay>
                </DndContext>
              </>
            )}

          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar flex flex-col" style={{ borderTop: '1px solid var(--sidebar-border)', paddingLeft: isCollapsed && !isMobile ? '8px' : '20px', paddingRight: isCollapsed && !isMobile ? '8px' : '20px', flexShrink: 0 }}>
        <Collapsible defaultOpen={false} className="w-full">
          <MoreMenuTriggerContent isCollapsed={isCollapsed} isMobile={isMobile} />

          <CollapsibleContent keepRendered={true} className="mt-2 space-y-1">
            <SidebarGroup style={{ flexShrink: 0 }}>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {/* Unpinned plugins */}
                  {unpinnedPlugins.map(plugin => (
                    <PluginMenuItem 
                      key={plugin.id} 
                      plugin={plugin}
                      isCollapsed={isCollapsed}
                      isMobile={isMobile}
                      pathname={pathname}
                      t={t}
                    />
                  ))}

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? t('sidebar.plugins', 'Plugins') : undefined}
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
                        <IconBadge color="#f59e0b" size={18}>
                          <Plug size={12} className="w-3 h-3 block" style={{ color: '#ffffff', strokeWidth: 2, position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' }} />
                        </IconBadge>
                        {!isCollapsed && !isMobile && <span className="ml-1.5">{t('sidebar.plugins', 'Plugins')}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarSeparator className="my-1 border-[var(--sidebar-border)]" />

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? t('sidebar.settings', 'Settings') : undefined}
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
                        <Settings size={16} className="w-4 h-4 block flex-shrink-0" style={{ color: 'var(--sidebar-text-primary)', strokeWidth: 2.5 }} />
                        {!isCollapsed && !isMobile && <span className="ml-1.5">{t('sidebar.settings', 'Settings')}</span>}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      tooltip={isCollapsed && !isMobile ? t('sidebar.globalSettings', 'Global Settings') : undefined}
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
                        <Globe size={16} className="w-4 h-4 block flex-shrink-0" style={{ color: 'var(--sidebar-text-primary)', strokeWidth: 2.5 }} />
                        {!isCollapsed && !isMobile && <span className="ml-1.5">{t('sidebar.globalSettings', 'Global Settings')}</span>}
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
                title={t('sidebar.copilot', 'Copilot')}
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
