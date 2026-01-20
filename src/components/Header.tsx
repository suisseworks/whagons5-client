import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { logout } from "@/pages/authentication/auth";
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Plus, Layers, Search, Bell, X } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ModeToggle } from "./ModeToggle";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "@/store/store";
import {
  setFilterModel,
  setSearchText,
  setGroupBy,
  setCollapseGroups,
  setPresets,
  selectFilterModel,
  selectSearchText,
  selectGroupBy,
  selectCollapseGroups,
  selectQuickPresets,
  selectAllPresets,
} from "@/store/reducers/uiStateSlice";
import TaskDialog from '@/pages/spaces/components/TaskDialog';
import { AvatarCache } from '@/store/indexedDB/AvatarCache';
import { getAssetDisplayUrl } from '@/lib/assetHelpers';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { MultiStateBadge } from "@/animated/Status";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconService } from '@/database/iconService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ApiLoadingTracker } from '@/api/apiLoadingTracker';
import { useLanguage } from "@/providers/LanguageProvider";
import { ActiveFilterChips } from "@/components/ActiveFilterChips";
import { genericActions, genericInternalActions } from "@/store/genericSlices";
import { cleanupExpiredNotifications, markAllViewedNotifications } from "@/store/reducers/notificationThunks";
import { DB } from "@/store/indexedDB/DB";


// Avatars are now cached globally in IndexedDB via AvatarCache

function Header() {
    const dispatch = useDispatch();
    const { firebaseUser, user, userLoading, hydrating, hydrationError } = useAuth();
    const [apiLoading, setApiLoading] = useState<boolean>(false);
    const { isMobile } = useSidebar();
    const navigate = useNavigate();
    const location = useLocation();
    const [imageUrl, setImageUrl] = useState<string>('');
    const [imageError, setImageError] = useState(false);
    const [, setIsLoading] = useState(false);

    const workspacesState = useSelector((s: RootState) => s.workspaces);
    const { value: workspaces = [] } = workspacesState || {};

    // Get boards for breadcrumb
    const boardsState = useSelector((s: RootState) => (s as any).boards);
    const { value: boards = [] } = boardsState || {};

    // Get notifications
    const notificationsState = useSelector((s: RootState) => (s as any).notifications);
    const { value: allNotifications = [] } = notificationsState || {};

    // Redux UI state selectors
    const currentFilterModel = useSelector(selectFilterModel);
    const searchText = useSelector(selectSearchText);
    const groupBy = useSelector(selectGroupBy);
    const collapseGroups = useSelector(selectCollapseGroups);
    const quickPresets = useSelector(selectQuickPresets);
    const allPresets = useSelector(selectAllPresets);

    const isSettings = useMemo(() => location.pathname.startsWith('/settings'), [location.pathname]);
    const isAnalytics = useMemo(() => location.pathname.startsWith('/analytics'), [location.pathname]);
    const { t } = useLanguage();

    // Filter and sort notifications: remove expired (24h after viewed), show newest first
    const notifications = useMemo(() => {
        const now = Date.now();
        const valid = allNotifications.filter((n: any) => {
            if (!n.viewed_at) return true; // Keep unviewed notifications
            const viewedTime = new Date(n.viewed_at).getTime();
            return (now - viewedTime) < (24 * 60 * 60 * 1000); // 24 hours after viewed
        });
        return valid.sort((a: any, b: any) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());
    }, [allNotifications]);

    const unviewedCount = useMemo(() => {
        return notifications.filter((n: any) => !n.viewed_at).length;
    }, [notifications]);

    // Cleanup expired notifications (24h after viewed) on mount and load notifications
    useEffect(() => {
        dispatch(cleanupExpiredNotifications() as any);
    }, [dispatch]);


    // Mark all notifications as viewed when dropdown opens
    const handleDropdownOpenChange = useCallback(async (open: boolean) => {
        if (open && unviewedCount > 0) {
            dispatch(markAllViewedNotifications(notifications) as any);
        }
    }, [unviewedCount, notifications, dispatch]);



    const breadcrumbs = useMemo(() => {
        const parts = location.pathname.split('/').filter(Boolean);
        const labelDefaults: Record<string, string> = {
            tasks: 'Tasks',
            workspace: 'Workspace',
            settings: 'Settings',
            categories: 'Categories',
            'custom-fields': 'Custom fields',
            templates: 'Templates',
            teams: 'Teams',
            spots: 'Spots',
            users: 'Users',
            profile: 'Profile',
            analytics: 'Analytics',
            stripe: 'Stripe',
            tags: 'Tags',
            priorities: 'Priorities',
            global: 'Global',
            forms: 'Forms',
            approvals: 'Approvals',
            slas: 'SLAs',
            workflows: 'Workflows',
            invitations: 'Invitations',
            'job-positions': 'Job Positions',
            statuses: 'Statuses',
            status: 'Status',
            'spot-types': 'Spot Types',
            boards: 'Boards',
            plugins: 'Plugins',
        };
        const getLabel = (seg: string, index: number) => {
            // Special handling for boards board ID
            if (parts[0] === 'boards' && index === 1 && !isNaN(Number(seg))) {
                const boardId = parseInt(seg);
                const board = boards.find((b: any) => b.id === boardId);
                return board?.name || seg;
            }
            const fallback = labelDefaults[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
            return t(`breadcrumbs.${seg}`, fallback);
        };
        const acc: Array<{ label: string; to?: string }> = [];
        let path = '';

        // Special handling for plugin settings pages
        if (parts[0] === 'plugins' && parts.length === 3 && parts[2] === 'settings') {
            // For plugin settings, show: Plugins > Plugin Name (skip "settings")
            const pluginId = parts[1];
            const pluginName = t(`plugins.${pluginId}.title`, pluginId.charAt(0).toUpperCase() + pluginId.slice(1));
            acc.push({ label: t('breadcrumbs.plugins', 'Plugins'), to: '/plugins' });
            acc.push({ label: pluginName, to: location.pathname });
        } else if (parts[0] === 'settings' && parts.length > 1) {
            // For settings subpages, create breadcrumbs like: Settings > Subpage
            acc.push({ label: t('breadcrumbs.settings', 'Settings'), to: '/settings' });
            for (let i = 1; i < parts.length; i++) {
                const seg = parts[i];
                path += `/${seg}`;
                const label = getLabel(seg, i);
                acc.push({ label, to: `/settings${path}` });
            }
        } else if (parts[0] === 'boards' && parts.length > 1) {
            // For boards, skip the "boards" segment and show: Board Name (or Board Name > Subpage)
            // Start from index 1 to skip "boards"
            for (let i = 1; i < parts.length; i++) {
                const seg = parts[i];
                path += `/${seg}`;
                const label = getLabel(seg, i);
                acc.push({ label, to: `/boards${path}` });
            }
        } else {
            // Regular breadcrumbs for non-settings pages
            for (let i = 0; i < parts.length; i++) {
                const seg = parts[i];
                path += `/${seg}`;
                const label = getLabel(seg, i);
                acc.push({ label, to: path });
            }
        }
        return acc;
    }, [location.pathname, t, boards]);

    // Current workspace context (for replacing breadcrumbs with just workspace name)
    const { currentWorkspaceName, currentWorkspaceId, currentWorkspaceIcon, currentWorkspaceColor } = useMemo(() => {
        const numMatch = location.pathname.match(/\/workspace\/(\d+)/);
        const allMatch = /^\/workspace\/all/.test(location.pathname);
        if (!numMatch && !allMatch) return { currentWorkspaceName: null as string | null, currentWorkspaceId: null as number | null, currentWorkspaceIcon: null as string | null, currentWorkspaceColor: undefined as string | undefined };
        if (allMatch) return { currentWorkspaceName: t('sidebar.everything', 'Everything'), currentWorkspaceId: null as number | null, currentWorkspaceIcon: null as string | null, currentWorkspaceColor: undefined as string | undefined };
        const wid = parseInt(numMatch![1], 10);
        const ws = workspaces.find((w: any) => w.id === wid);
        return { currentWorkspaceName: ws?.name || `Workspace ${wid}`, currentWorkspaceId: wid, currentWorkspaceIcon: ws?.icon || null, currentWorkspaceColor: ws?.color };
    }, [location.pathname, workspaces, t]);
    const [openCreateTask, setOpenCreateTask] = useState(false);

    const [workspaceIcon, setWorkspaceIcon] = useState<any>(null);
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                if (currentWorkspaceIcon) {
                    const icon = await iconService.getIcon(currentWorkspaceIcon);
                    if (!cancelled) setWorkspaceIcon(icon);
                } else {
                    if (!cancelled) setWorkspaceIcon(null);
                }
            } catch {
                if (!cancelled) setWorkspaceIcon(null);
            }
        })();
        return () => { cancelled = true; };
    }, [currentWorkspaceIcon]);

    // Load search text from localStorage on mount and when workspace changes
    useEffect(() => {
        const key = `wh_workspace_search_global`;
        try {
            const saved = localStorage.getItem(key);
            if (saved != null) {
                dispatch(setSearchText(saved));
            } else {
                dispatch(setSearchText(''));
            }
        } catch {}
    }, [currentWorkspaceName, dispatch]);

    // Save search text to localStorage when it changes
    useEffect(() => {
        const key = `wh_workspace_search_global`;
        try {
            if (searchText) {
                localStorage.setItem(key, searchText);
            } else {
                localStorage.removeItem(key);
            }
        } catch {}
    }, [searchText]);

    // Load groupBy and collapseGroups from localStorage when workspace changes
    useEffect(() => {
        if (!currentWorkspaceName) return;
        const workspaceId = currentWorkspaceId || 'all';
        try {
            const groupKey = `wh_workspace_group_by_${workspaceId}`;
            const collapseKey = `wh_workspace_group_collapse_${workspaceId}`;
            const savedGroup = localStorage.getItem(groupKey) as any;
            const savedCollapse = localStorage.getItem(collapseKey);
            if (savedGroup) {
                dispatch(setGroupBy(savedGroup));
            }
            if (savedCollapse !== null) {
                dispatch(setCollapseGroups(savedCollapse === 'true'));
            }
        } catch {}
    }, [currentWorkspaceName, currentWorkspaceId, dispatch]);

    // Save groupBy to localStorage when changed
    useEffect(() => {
        if (!currentWorkspaceName) return;
        const workspaceId = currentWorkspaceId || 'all';
        try {
            localStorage.setItem(`wh_workspace_group_by_${workspaceId}`, groupBy);
        } catch {}
    }, [groupBy, currentWorkspaceName, currentWorkspaceId]);

    // Save collapseGroups to localStorage when changed
    useEffect(() => {
        if (!currentWorkspaceName) return;
        const workspaceId = currentWorkspaceId || 'all';
        try {
            localStorage.setItem(`wh_workspace_group_collapse_${workspaceId}`, String(collapseGroups));
        } catch {}
    }, [collapseGroups, currentWorkspaceName, currentWorkspaceId]);

    // Track theme changes (dark/light) so the gradient updates without hard refresh
    const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => {
        if (typeof document === 'undefined') return false;
        return document.documentElement.classList.contains('dark');
    });

    useEffect(() => {
        if (typeof document === 'undefined') return;

        const updateThemeState = () => {
            setIsDarkTheme(document.documentElement.classList.contains('dark'));
        };

        // Observe class changes on <html> to catch theme toggles
        const observer = new MutationObserver(() => updateThemeState());
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

        // Also react to system preference changes as a fallback
        const mql = window.matchMedia('(prefers-color-scheme: dark)');
        const handleMqlChange = () => updateThemeState();
        try {
            mql.addEventListener('change', handleMqlChange);
        } catch {
            // Safari fallback
            // @ts-ignore
            mql.addListener(handleMqlChange);
        }

        return () => {
            observer.disconnect();
            try {
                mql.removeEventListener('change', handleMqlChange);
            } catch {
                // @ts-ignore
                mql.removeListener(handleMqlChange);
            }
        };
    }, []);

    // Use navbar/header background color, not sidebar header
    // Use CSS variable directly so it updates reactively when branding changes
    const headerSurfaceColor = 'var(--header-background, var(--navbar, var(--sidebar-header)))';
    
    // Detect if header has dark background for text contrast
    const [isDarkHeader, setIsDarkHeader] = useState(() => {
        if (typeof window === 'undefined') return false;
        const headerBg = getComputedStyle(document.documentElement).getPropertyValue('--header-background').trim() || 
                         getComputedStyle(document.documentElement).getPropertyValue('--navbar').trim();
        // Quick check for known dark values
        return headerBg.includes('#08111f') || headerBg.includes('oklch(0.0') || headerBg.includes('oklch(0.1') || 
               headerBg.includes('#0F0F0F') || headerBg.includes('#0a0a0a');
    });
    
    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const checkHeaderBrightness = () => {
            // Get the actual computed color of --header-background or --navbar
            const headerBg = getComputedStyle(document.documentElement).getPropertyValue('--header-background').trim() || 
                           getComputedStyle(document.documentElement).getPropertyValue('--navbar').trim();
            const computedColor = headerBg;
            
            // Parse and check brightness
            let isDark = isDarkTheme;
            
            if (computedColor && computedColor !== '') {
                // Quick string checks for known dark colors
                if (computedColor.includes('#08111f') || computedColor.includes('#000000') || 
                    computedColor.includes('oklch(0.0') || computedColor.includes('oklch(0.1')) {
                    isDark = true;
                } else {
                    // Try to parse the color using canvas
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 1;
                        canvas.height = 1;
                        const ctx = canvas.getContext('2d');
                        
                        if (ctx) {
                            ctx.fillStyle = computedColor;
                            const computed = ctx.fillStyle;
                            
                            // Parse RGB
                            const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                            if (match) {
                                const r = parseInt(match[1]);
                                const g = parseInt(match[2]);
                                const b = parseInt(match[3]);
                                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                                isDark = luminance < 0.45;
                            }
                        }
                    } catch (e) {
                        // Silent fail
                    }
                }
            }
            
            setIsDarkHeader(isDark);
        };
        
        // Check immediately
        checkHeaderBrightness();
        
        // Check after styles load
        const timeout1 = setTimeout(checkHeaderBrightness, 50);
        const timeout2 = setTimeout(checkHeaderBrightness, 200);
        const timeout3 = setTimeout(checkHeaderBrightness, 500);
        
        // Re-check when theme or branding changes
        const observer = new MutationObserver(() => {
            checkHeaderBrightness();
        });
        
        const styleObserver = new MutationObserver(() => {
            checkHeaderBrightness();
        });
        
        observer.observe(document.documentElement, { 
            attributes: true, 
            attributeFilter: ['style', 'class'],
            subtree: false
        });
        
        // Watch for style tag changes (branding updates)
        const head = document.querySelector('head');
        if (head) {
            styleObserver.observe(head, {
                childList: true,
                subtree: true
            });
        }
        
        return () => {
            clearTimeout(timeout1);
            clearTimeout(timeout2);
            clearTimeout(timeout3);
            observer.disconnect();
            styleObserver.disconnect();
        };
    }, [isDarkTheme]);

    const headerBackgroundStyle = useMemo<React.CSSProperties | undefined>(() => {
        if (!currentWorkspaceName) return undefined;
        // Use CSS variable directly - browser will handle gradients automatically
        return { 
            background: 'var(--header-background, var(--navbar, var(--sidebar-header)))',
            backgroundSize: 'cover'
        } as React.CSSProperties;
    }, [currentWorkspaceName]);

    // Track API GET requests for syncing indicator (debounced to prevent flickering)
    useEffect(() => {
        const unsubscribe = ApiLoadingTracker.on(
            ApiLoadingTracker.EVENTS.LOADING_CHANGED,
            (isLoading) => {
                setApiLoading(isLoading);
            }
        );
        return unsubscribe;
    }, []);

    // Hydration status badge: processing while hydrating or API loading, success briefly when done, hidden otherwise
    const [hydrationState, setHydrationState] = useState<"start" | "processing" | "success" | "error" | "custom">("custom");
    const prevHydrating = useRef(false);
    const isSyncing = hydrating || apiLoading;
    
    useEffect(() => {
        if (hydrationError) {
            setHydrationState("error");
            prevHydrating.current = false;
            return;
        }
        if (isSyncing) {
            setHydrationState("processing");
        } else {
            if (prevHydrating.current) {
                setHydrationState("success");
                const t = setTimeout(() => setHydrationState("custom"), 1200);
                return () => clearTimeout(t);
            } else {
                setHydrationState("custom");
            }
        }
        prevHydrating.current = isSyncing;
    }, [hydrationError, isSyncing]);

    const hydrationBadge = useMemo(() => {
        if (hydrationState === "custom") return null;
        const label =
            hydrationState === "processing"
                ? t("sync.syncing", "Syncing")
                : hydrationState === "success"
                ? t("sync.synced", "Synced")
                : hydrationState === "error"
                ? t("sync.failed", "Sync failed")
                : undefined;
        const badge = (
            <MultiStateBadge
                state={hydrationState}
                label={label}
                className="h-6 px-2 py-1 text-xs"
            />
        );
        if (hydrationState === "error" && hydrationError) {
            return (
                <span title={hydrationError}>
                    {badge}
                </span>
            );
        }
        return badge;
    }, [hydrationError, hydrationState, t]);



    const cacheImage = useCallback(async (url: string, forceRefresh: boolean = false) => {
        // IMPORTANT: Never block avatar rendering on the caching path.
        // Always display the real url_picture directly, and only cache opportunistically.
        if (!url || !firebaseUser?.uid) return;

        // Always show the real URL immediately (same behavior as Profile page)
        setImageUrl(url);
        setImageError(false);

        // Opportunistic cache refresh (best effort)
        setIsLoading(true);
        try {
            if (!forceRefresh) {
                const cachedRow = await AvatarCache.getByAnyRow([firebaseUser.uid, user?.google_uuid, user?.id]);
                if (cachedRow?.data && (!cachedRow.url || cachedRow.url === url)) {
                    setImageUrl(cachedRow.data);
                    setImageError(false);
                    return;
                }
            }

            const aliases = [user?.google_uuid, user?.id].filter(Boolean) as Array<string | number>;
            const dataUrl = await AvatarCache.fetchAndCache(firebaseUser.uid, url, aliases);
            if (dataUrl) {
                setImageUrl(dataUrl);
                setImageError(false);
            }
        } catch {
            // ignore cache failures (CORS etc). UI already uses direct URL.
        } finally {
            setIsLoading(false);
        }
    }, [firebaseUser?.uid, user?.google_uuid, user?.id]);

    // Update avatar when user data changes
    useEffect(() => {
        if (user?.id) {
            if (user.url_picture) {
                // Convert asset ID to URL if needed
                const displayUrl = getAssetDisplayUrl(user.url_picture);
                cacheImage(displayUrl);
            } else {
                setImageUrl('');
                setImageError(true);
            }
        } else {
            setImageUrl('');
            setImageError(false);
        }
    }, [user, cacheImage]);

    // Listen for profile updates and clear cache to force refresh
    useEffect(() => {
        const handleProfileUpdate = async (event?: CustomEvent) => {
            if (firebaseUser?.uid && user?.id) {
                // Clear avatar cache for all user identifiers FIRST
                await AvatarCache.deleteByAny([String(firebaseUser.uid), String(user.google_uuid), String(user.id)]);
                
                // ALWAYS use the URL from event detail if available (it's the new one)
                // Only fall back to user.url_picture if event detail doesn't have it
                const newUrl = event?.detail?.url_picture ?? user.url_picture;
                
                // Reload avatar with force refresh to bypass any remaining cache
                if (newUrl) {
                    const displayUrl = getAssetDisplayUrl(newUrl);
                    // Force refresh by passing true as second parameter
                    await cacheImage(displayUrl, true);
                } else {
                    setImageUrl('');
                    setImageError(true);
                }
            }
        };

        // Listen for custom event
        const eventHandler = (e: Event) => handleProfileUpdate(e as CustomEvent);
        window.addEventListener('profileUpdated', eventHandler);
        
        // Also check localStorage for cross-tab updates
        const checkStorage = () => {
            const lastUpdate = localStorage.getItem('profile_updated');
            if (lastUpdate) {
                handleProfileUpdate();
                localStorage.removeItem('profile_updated');
            }
        };
        window.addEventListener('storage', checkStorage);
        
        return () => {
            window.removeEventListener('profileUpdated', eventHandler);
            window.removeEventListener('storage', checkStorage);
        };
    }, [firebaseUser?.uid, user?.id, user?.google_uuid, user?.url_picture, cacheImage]);


        

    const handleImageError = () => {
        setImageError(true);
    };

    const getInitials = () => {
        if (user?.name) {
            return user.name.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2);
        }
        if (user?.email) {
            return user.email.slice(0, 2).toUpperCase();
        }
        return 'U';
    };

    const getDisplayName = () => {
        return user?.name || user?.email || 'User';
    };

    // Loading/error header gradient style - use CSS variable directly
    const loadingHeaderGradientStyle = useMemo<React.CSSProperties>(() => {
        // Use CSS variable directly - browser will handle gradients automatically
        return { 
            background: 'var(--header-background, var(--navbar, var(--sidebar-header)))',
            backgroundSize: 'cover'
        };
    }, []);

    if (!firebaseUser || userLoading) {
        return (
            <header className="sticky top-0 z-50 w-full backdrop-blur-xl" style={loadingHeaderGradientStyle}>
                <div className="flex items-center space-x-3 px-6 h-[var(--app-header-height)]">
                    {isMobile && <SidebarTrigger />}
                    <div className="flex items-center space-x-2">
                        <div className="animate-pulse bg-gray-300 rounded-full h-6 w-6"></div>
                        <span className="text-xs text-muted-foreground">Loading...</span>
                    </div>
                </div>
            </header>
        );
    }

    if (!user) {
        return (
            <header className="sticky top-0 z-50 w-full backdrop-blur-xl" style={loadingHeaderGradientStyle}>
                <div className="flex items-center space-x-3 px-6 h-[var(--app-header-height)]">
                    {isMobile && <SidebarTrigger />}
                    <div className="flex items-center space-x-2">
                        <div className="bg-gray-300 rounded-full h-7 w-7"></div>
                        <span className="text-xs text-muted-foreground">User not found</span>
                    </div>
                </div>
            </header>
        );
    }

    // Main header gradient style - use CSS variable directly
    const mainHeaderGradientStyle = useMemo<React.CSSProperties>(() => {
        // Use CSS variable directly - browser will handle gradients automatically
        return { 
            background: 'var(--header-background, var(--navbar, var(--sidebar-header)))',
            backgroundSize: 'cover'
        };
    }, []);

    return (
        <>
        <header 
            className={`sticky top-0 z-50 w-full backdrop-blur-xl wh-header ${(isDarkTheme || isDarkHeader) ? 'wh-header-dark' : ''}`}
            style={currentWorkspaceName ? headerBackgroundStyle : mainHeaderGradientStyle}
        >
            {isMobile && (
                <SidebarTrigger className='absolute left-2 top-3 z-1000 text-primary' />
            )}
            
            <div className="flex items-center justify-between px-6 h-[var(--app-header-height)] relative z-10">
                {/* Left: Workspace name (if in workspace), Settings/Analytics (if in those pages), otherwise breadcrumbs */}
                <div className="flex items-center space-x-2 min-w-0">
                    {currentWorkspaceName ? (
                        <div className="flex items-center space-x-2">
                            {workspaceIcon ? (
                                <div 
                                    className="flex-shrink-0 workspace-icon-wrapper"
                                    style={{ 
                                        color: currentWorkspaceColor || '#3b82f6',
                                        ['--workspace-color' as any]: currentWorkspaceColor || '#3b82f6'
                                    }}
                                >
                                    <FontAwesomeIcon
                                        icon={workspaceIcon}
                                        className="text-base sm:text-xl lg:text-2xl leading-none"
                                    />
                                </div>
                            ) : (
                                currentWorkspaceName === t('sidebar.everything', 'Everything') ? (
                                    <Layers className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
                                ) : null
                            )}
                            <h1 className="font-title tracking-tight text-base sm:text-xl lg:text-2xl font-extrabold truncate max-w-[32rem]">
                                {currentWorkspaceName}
                            </h1>
                            {hydrationBadge}
                        </div>
                    ) : isSettings ? (
                        <Breadcrumb>
                            <BreadcrumbList className="gap-1.5 sm:gap-2">
                                {breadcrumbs.map((bc, idx) => (
                                    <React.Fragment key={idx}>
                                        {idx > 0 && <BreadcrumbSeparator />}
                                        <BreadcrumbItem>
                                            {idx < breadcrumbs.length - 1 ? (
                                                <BreadcrumbLink asChild className="font-medium text-foreground/80 hover:text-foreground">
                                                    <Link to={bc.to || '#'} className="truncate max-w-[10rem]">
                                                        {bc.label}
                                                    </Link>
                                                </BreadcrumbLink>
                                            ) : (
                                                <BreadcrumbPage className="truncate max-w-[10rem] text-lg sm:text-xl font-semibold">{bc.label}</BreadcrumbPage>
                                            )}
                                        </BreadcrumbItem>
                                    </React.Fragment>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                    ) : isAnalytics ? (
                        <div className="flex items-center space-x-2">
                            <h1 className="text-lg sm:text-xl font-semibold">Analytics</h1>
                            {hydrationBadge}
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2">
                        <Breadcrumb>
                            <BreadcrumbList className="gap-1.5 sm:gap-2">
                                <BreadcrumbItem>
                                    <BreadcrumbLink asChild className="font-medium text-foreground/80 hover:text-foreground">
                                        <Link to="/welcome" className="truncate max-w-[6rem]">{t('breadcrumbs.home', 'Home')}</Link>
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                {breadcrumbs.map((bc, idx) => (
                                    <React.Fragment key={idx}>
                                        <BreadcrumbSeparator />
                                        <BreadcrumbItem>
                                            {idx < breadcrumbs.length - 1 ? (
                                                <BreadcrumbLink asChild className="font-medium text-foreground/80 hover:text-foreground">
                                                    <Link to={bc.to || '#'} className="truncate max-w-[10rem]">
                                                        {bc.label}
                                                    </Link>
                                                </BreadcrumbLink>
                                            ) : (
                                                <BreadcrumbPage className="truncate max-w-[10rem] text-lg sm:text-xl font-semibold">{bc.label}</BreadcrumbPage>
                                            )}
                                        </BreadcrumbItem>
                                    </React.Fragment>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                        {hydrationBadge}
                        </div>
                    )}
                </div>

                {/* Center: Search bar (only shown in workspace) */}
                {currentWorkspaceName && (
                    <div className="flex-1 flex items-center justify-center px-4 max-w-md mx-auto">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
                            <Input
                                placeholder="Search…"
                                className="h-9 pl-9 pr-9 rounded-[8px] border border-border/40 placeholder:text-muted-foreground/50 dark:bg-[#252b36] dark:border-[#2A2A2A] dark:placeholder-[#6B7280] focus-visible:border-[#6366F1]"
                                value={searchText}
                                onChange={(e) => dispatch(setSearchText(e.target.value))}
                            />
                        </div>
                    </div>
                )}

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {(typeof currentWorkspaceId === 'number' || currentWorkspaceName === t('sidebar.everything', 'Everything')) && (
                        <button
                            className="group inline-flex items-center gap-2 pl-4 pr-5 py-2.5 rounded-full border-2 border-primary bg-primary text-primary-foreground font-semibold text-sm transition-all duration-200 hover:bg-primary/90 hover:border-primary/90 hover:shadow-lg hover:shadow-primary/30 hover:scale-105 active:scale-[0.98]"
                            onClick={() => setOpenCreateTask(true)}
                            title={t('task.createTask', 'Create Task')}
                        >
                            <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                            <span>{t('task.newTask', 'New Task')}</span>
                        </button>
                    )}
                    <ModeToggle className="h-9 w-9 hover:bg-accent/50 rounded-md transition-colors" />
                    
                    {/* Profile with notification badge */}
                    <DropdownMenu onOpenChange={handleDropdownOpenChange}>
                        <DropdownMenuTrigger asChild>
                            <div className="relative inline-block">
                                <button className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:ring-2 hover:ring-accent/50 transition-all overflow-hidden">
                                    <Avatar className="h-9 w-9 bg-accent text-accent-foreground ring-1 ring-border shadow-sm">
                                        {!imageError && imageUrl && (
                                            <AvatarImage 
                                                src={imageUrl} 
                                                onError={handleImageError}
                                                alt={getDisplayName()}
                                            />
                                        )}
                                        <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
                                            {getInitials()}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                                {/* Notification badge */}
                                {unviewedCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[11px] font-extrabold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 ring-2 ring-background shadow-sm z-10" style={{ fontFeatureSettings: '"tnum"', textRendering: 'optimizeLegibility', WebkitFontSmoothing: 'antialiased' }}>
                                        {unviewedCount}
                                    </span>
                                )}
                            </div>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-80">
                            {/* Notifications section */}
                            <div className="px-2 py-1.5 border-b border-border/50">
                                <div className="flex items-center justify-between mb-2">
                                    <DropdownMenuLabel className="px-0 py-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
                                    {notifications.length > 0 && (
                                        <button
                                            onClick={async () => {
                                                // Clear all notifications
                                                if (DB.db) {
                                                    const tx = DB.db.transaction(['notifications'], 'readwrite');
                                                    const store = tx.objectStore('notifications');
                                                    await store.clear();
                                                    // Reload from IndexedDB (which is now empty)
                                                    dispatch(genericInternalActions.notifications.getFromIndexedDB({ force: true }) as any);
                                                }
                                            }}
                                            className="text-xs text-destructive hover:underline"
                                        >
                                            Clear all
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-[300px] overflow-y-auto space-y-1">
                                    {notifications.length === 0 ? (
                                        <div className="text-sm text-muted-foreground px-2 py-4 text-center">
                                            No notifications
                                        </div>
                                    ) : (
                                        notifications.map((notification: any) => (
                                            <div
                                                key={notification.id}
                                                className="group relative px-3 py-2 rounded-md hover:bg-accent/50 cursor-pointer transition-colors"
                                                onClick={async (e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    
                                                    // Navigate to notification URL if available
                                                    if (notification.url) {
                                                        navigate(notification.url);
                                                    }
                                                    
                                                    // Delete notification after navigation
                                                    await dispatch(genericActions.notifications.removeAsync(notification.id) as any);
                                                }}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <Bell className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium text-foreground line-clamp-1">
                                                            {notification.title}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                                            {notification.body}
                                                        </div>
                                                        <div className="text-[10px] text-muted-foreground mt-1">
                                                            {new Date(notification.received_at).toLocaleString()}
                                                        </div>
                                                    </div>
                                                    <X className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                            <DropdownMenuItem onClick={() => {
                                navigate('/profile');
                            }}>
                                <User className="mr-2 h-3 w-3" />
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                logout();
                            }}>
                                <LogOut className="mr-2 h-3 w-3" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

        </header>

        {/* Secondary Toolbar: Filters and Grouping (only shown in workspace) */}
        {currentWorkspaceName && (
            <div className="sticky top-16 z-40 w-full border-b border-border/40 bg-background/95 backdrop-blur-sm px-6 py-2">
                <div className="flex flex-col gap-2">
                    {/* Active filter chips - shown inline */}
                    <ActiveFilterChips
                        filterModel={currentFilterModel}
                        onRemoveFilter={(filterKey) => {
                            // Remove specific filter from model
                            const newModel = { ...currentFilterModel };
                            if (filterKey === 'text') {
                                delete newModel.name;
                                delete newModel.description;
                                // Clear search input and signal Workspace to not re-apply the filter
                                dispatch(setSearchText(''));
                                const finalModel = Object.keys(newModel).length > 0 ? newModel : null;
                                dispatch(setFilterModel(finalModel));
                                // Dispatch to Workspace component for table update with clearSearch: true
                                window.dispatchEvent(new CustomEvent('workspace-filter-apply', { 
                                    detail: { filterModel: finalModel, clearSearch: true } 
                                }));
                                return;
                            } else {
                                delete newModel[filterKey];
                            }
                            const finalModel = Object.keys(newModel).length > 0 ? newModel : null;
                            dispatch(setFilterModel(finalModel));
                            // Dispatch to Workspace component for table update
                            window.dispatchEvent(new CustomEvent('workspace-filter-apply', { 
                                detail: { filterModel: finalModel, clearSearch: false } 
                            }));
                        }}
                        onClearAll={() => {
                            dispatch(setFilterModel(null));
                            dispatch(setSearchText(''));
                            // Dispatch to Workspace component for table update
                            window.dispatchEvent(new CustomEvent('workspace-filter-apply', { 
                                detail: { filterModel: null, clearSearch: true } 
                            }));
                        }}
                    />
                    <div className="flex items-center gap-4">
                        {/* Quick filter chips */}
                        <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground"
                            title={t('workspace.filters.allTasks', 'All tasks')}
                            onClick={() => {
                                dispatch(setFilterModel(null));
                                dispatch(setSearchText(''));
                                // Dispatch to Workspace component for table update
                                window.dispatchEvent(new CustomEvent('workspace-filter-apply', { 
                                    detail: { filterModel: null, clearSearch: true } 
                                }));
                            }}
                        >
                            {t('workspace.filters.all', 'All')}
                        </Button>
                        {quickPresets.map((p: any, idx: number) => (
                            <Button
                                key={p.id || idx}
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground"
                                title={p.name}
                                onClick={() => {
                                    dispatch(setFilterModel(p.model));
                                    dispatch(setSearchText(''));
                                    // Dispatch to Workspace component for table update
                                    window.dispatchEvent(new CustomEvent('workspace-filter-apply', { 
                                        detail: { filterModel: p.model, clearSearch: true } 
                                    }));
                                }}
                            >
                                {p.name}
                            </Button>
                        ))}
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground"
                            title={t('workspace.filters.customFilters', 'Custom filters')}
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('workspace-filter-dialog-open', { detail: {} }));
                            }}
                        >
                            {t('workspace.filters.filters', 'Filters…')}
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground" 
                                    title={t('workspace.filters.morePresets', 'More presets')}
                                >
                                    {t('workspace.filters.more', 'More…')}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[240px]">
                                <DropdownMenuLabel>{t('workspace.filters.applyPreset', 'Apply preset')}</DropdownMenuLabel>
                                {allPresets.length === 0 ? (
                                    <DropdownMenuItem disabled>{t('workspace.filters.noPresets', 'No presets yet')}</DropdownMenuItem>
                                ) : (
                                    allPresets.map((p: any) => (
                                        <DropdownMenuItem 
                                            key={p.id} 
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('workspace-filter-apply', { 
                                                    detail: { filterModel: p.model, clearSearch: true } 
                                                }));
                                            }}
                                        >
                                            {p.name}
                                        </DropdownMenuItem>
                                    ))
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        </div>

                        {/* Group by control */}
                        <div className="flex items-center gap-2 ml-auto">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">{t('workspace.group.group', 'Group')}</Label>
                            <Select value={groupBy} onValueChange={(v) => dispatch(setGroupBy(v as any))}>
                                <SelectTrigger size="sm" className="h-8 rounded-lg px-3 text-[12px] text-foreground/65 border-border/30 hover:bg-foreground/5 w-[120px]">
                                    <SelectValue placeholder={t('workspace.group.group', 'Group')} />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">{t('workspace.group.none', 'None')}</SelectItem>
                                    <SelectItem value="spot_id">{t('workspace.group.location', 'Location')}</SelectItem>
                                    <SelectItem value="status_id">{t('workspace.group.status', 'Status')}</SelectItem>
                                    <SelectItem value="priority_id">{t('workspace.group.priority', 'Priority')}</SelectItem>
                                </SelectContent>
                            </Select>
                            {groupBy !== 'none' && (
                                <div className="flex items-center gap-2">
                                    <Switch checked={collapseGroups} onCheckedChange={(checked) => dispatch(setCollapseGroups(checked))} />
                                    <Label className="text-xs text-muted-foreground whitespace-nowrap">{t('workspace.group.collapse', 'Collapse')}</Label>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {typeof currentWorkspaceId === 'number' && (
            <TaskDialog open={openCreateTask} onOpenChange={setOpenCreateTask} mode="create" workspaceId={currentWorkspaceId} />
        )}
        {currentWorkspaceName === t('sidebar.everything', 'Everything') && (
            <TaskDialog open={openCreateTask} onOpenChange={setOpenCreateTask} mode="create-all" />
        )}

        </>
    );
}

export default Header;