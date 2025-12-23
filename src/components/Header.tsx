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
import { User, LogOut, Bell, Plus, Layers, Search } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ModeToggle } from "./ModeToggle";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
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


// Avatars are now cached globally in IndexedDB via AvatarCache

function Header() {
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

    const isSettings = useMemo(() => location.pathname.startsWith('/settings'), [location.pathname]);
    const isAnalytics = useMemo(() => location.pathname.startsWith('/analytics'), [location.pathname]);
    const { t } = useLanguage();



    const breadcrumbs = useMemo(() => {
        const parts = location.pathname.split('/').filter(Boolean);
        const labelDefaults: Record<string, string> = {
            tasks: 'Tasks',
            workspace: 'Workspace',
            settings: 'Settings',
            categories: 'Categories',
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
        };
        const getLabel = (seg: string) => {
            const fallback = labelDefaults[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
            return t(`breadcrumbs.${seg}`, fallback);
        };
        const acc: Array<{ label: string; to?: string }> = [];
        let path = '';

        // Special handling for settings subpages
        if (parts[0] === 'settings' && parts.length > 1) {
            // For settings subpages, create breadcrumbs like: Settings > Subpage
            acc.push({ label: t('breadcrumbs.settings', 'Settings'), to: '/settings' });
            for (let i = 1; i < parts.length; i++) {
                const seg = parts[i];
                path += `/${seg}`;
                const label = getLabel(seg);
                acc.push({ label, to: `/settings${path}` });
            }
        } else {
            // Regular breadcrumbs for non-settings pages
            for (const seg of parts) {
                path += `/${seg}`;
                const label = getLabel(seg);
                acc.push({ label, to: path });
            }
        }
        return acc;
    }, [location.pathname, t]);

    // Current workspace context (for replacing breadcrumbs with just workspace name)
    const { currentWorkspaceName, currentWorkspaceId, currentWorkspaceIcon, currentWorkspaceColor } = useMemo(() => {
        const numMatch = location.pathname.match(/\/workspace\/(\d+)/);
        const allMatch = /^\/workspace\/all/.test(location.pathname);
        if (!numMatch && !allMatch) return { currentWorkspaceName: null as string | null, currentWorkspaceId: null as number | null, currentWorkspaceIcon: null as string | null, currentWorkspaceColor: undefined as string | undefined };
        if (allMatch) return { currentWorkspaceName: 'Everything', currentWorkspaceId: null as number | null, currentWorkspaceIcon: null as string | null, currentWorkspaceColor: undefined as string | undefined };
        const wid = parseInt(numMatch![1], 10);
        const ws = workspaces.find((w: any) => w.id === wid);
        return { currentWorkspaceName: ws?.name || `Workspace ${wid}`, currentWorkspaceId: wid, currentWorkspaceIcon: ws?.icon || null, currentWorkspaceColor: ws?.color };
    }, [location.pathname, workspaces]);
    const [openCreateTask, setOpenCreateTask] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [groupBy, setGroupBy] = useState<'none' | 'spot_id' | 'status_id' | 'priority_id'>('none');
    const [collapseGroups, setCollapseGroups] = useState<boolean>(true);
    const [quickPresets, setQuickPresets] = useState<any[]>([]);
    const [allPresets, setAllPresets] = useState<any[]>([]);

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
                setSearchText(saved);
            } else {
                setSearchText('');
            }
        } catch {}
    }, [currentWorkspaceName]);

    // Listen for search changes from Workspace component
    useEffect(() => {
        const handleSearchChange = (event: CustomEvent<{ searchText: string }>) => {
            const newSearchText = event.detail.searchText;
            // Only update if different to prevent unnecessary re-renders
            if (newSearchText !== searchText) {
                setSearchText(newSearchText);
            }
        };
        window.addEventListener('workspace-search-changed', handleSearchChange as EventListener);
        return () => {
            window.removeEventListener('workspace-search-changed', handleSearchChange as EventListener);
        };
    }, [searchText]);

    // Save search text to localStorage and dispatch custom event
    useEffect(() => {
        const key = `wh_workspace_search_global`;
        try {
            if (searchText) {
                localStorage.setItem(key, searchText);
            } else {
                localStorage.removeItem(key);
            }
            // Dispatch custom event to notify Workspace component
            window.dispatchEvent(new CustomEvent('workspace-search-changed', { detail: { searchText } }));
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
            if (savedGroup) setGroupBy(savedGroup);
            if (savedCollapse !== null) setCollapseGroups(savedCollapse === 'true');
        } catch {}
    }, [currentWorkspaceName, currentWorkspaceId]);

    const isInternalGroupChange = useRef(false);

    // Listen for groupBy changes from Workspace component
    useEffect(() => {
        const handleGroupChange = (event: CustomEvent<{ groupBy: string; collapseGroups?: boolean }>) => {
            // Only update if different to prevent loops
            if (event.detail.groupBy !== groupBy) {
                isInternalGroupChange.current = true;
                setGroupBy(event.detail.groupBy as any);
                setTimeout(() => { isInternalGroupChange.current = false; }, 0);
            }
            if (event.detail.collapseGroups !== undefined && event.detail.collapseGroups !== collapseGroups) {
                isInternalGroupChange.current = true;
                setCollapseGroups(event.detail.collapseGroups);
                setTimeout(() => { isInternalGroupChange.current = false; }, 0);
            }
        };
        window.addEventListener('workspace-group-changed', handleGroupChange as EventListener);
        return () => {
            window.removeEventListener('workspace-group-changed', handleGroupChange as EventListener);
        };
    }, [groupBy, collapseGroups]);

    // Listen for filter presets from Workspace component
    useEffect(() => {
        const handlePresetsChange = (event: CustomEvent<{ quickPresets: any[]; allPresets: any[] }>) => {
            setQuickPresets(event.detail.quickPresets || []);
            setAllPresets(event.detail.allPresets || []);
        };
        window.addEventListener('workspace-presets-changed', handlePresetsChange as EventListener);
        return () => {
            window.removeEventListener('workspace-presets-changed', handlePresetsChange as EventListener);
        };
    }, []);

    // Save groupBy and dispatch event when changed (only if changed internally)
    useEffect(() => {
        if (!currentWorkspaceName || isInternalGroupChange.current) return;
        const workspaceId = currentWorkspaceId || 'all';
        try {
            localStorage.setItem(`wh_workspace_group_by_${workspaceId}`, groupBy);
            window.dispatchEvent(new CustomEvent('workspace-group-changed', { 
                detail: { groupBy, collapseGroups } 
            }));
        } catch {}
    }, [groupBy, currentWorkspaceName, currentWorkspaceId, collapseGroups]);

    // Save collapseGroups and dispatch event when changed (only if changed internally)
    useEffect(() => {
        if (!currentWorkspaceName || isInternalGroupChange.current) return;
        const workspaceId = currentWorkspaceId || 'all';
        try {
            localStorage.setItem(`wh_workspace_group_collapse_${workspaceId}`, String(collapseGroups));
            window.dispatchEvent(new CustomEvent('workspace-group-changed', { 
                detail: { groupBy, collapseGroups } 
            }));
        } catch {}
    }, [collapseGroups, currentWorkspaceName, currentWorkspaceId, groupBy]);

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

    // Subtle gradient background for workspace headers
    const headerBackgroundStyle = useMemo<React.CSSProperties | undefined>(() => {
        if (!currentWorkspaceName) return undefined;
        if (isDarkTheme) {
            // Solid dark per spec. Border/shadow are handled by the header class so we
            // don't accidentally create an extra 1px border that misaligns with the sidebar header.
            return { backgroundColor: '#0A0A0A' } as React.CSSProperties;
        }
        // Light mode: very soft neutral gradient
        const grayTop = `color-mix(in oklab, #6B7280 6%, #ffffff 94%)`;
        return { backgroundImage: `linear-gradient(180deg, ${grayTop} 0%, var(--color-card) 70%)` } as React.CSSProperties;
    }, [currentWorkspaceName, isDarkTheme]);

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
                ? "Syncing"
                : hydrationState === "success"
                ? "Synced"
                : hydrationState === "error"
                ? "Sync failed"
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
    }, [hydrationError, hydrationState]);



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

    // Loading/error header gradient style
    const loadingHeaderGradientStyle = useMemo<React.CSSProperties>(() => {
        if (isDarkTheme) {
            return { background: 'linear-gradient(90deg, #000000 0%, #1a5d52 100%)' };
        }
        return { background: 'linear-gradient(90deg, #ffffff 0%, #27C1A7 100%)' };
    }, [isDarkTheme]);

    if (!firebaseUser || userLoading) {
        return (
            <header className="sticky top-0 z-50 w-full border-b-2 border-[#D1D5DB] dark:border-[#2A2A2A] backdrop-blur-xl shadow-[0_4px_12px_0_rgba(0,0,0,0.12),0_2px_4px_0_rgba(0,0,0,0.08)]" style={loadingHeaderGradientStyle}>
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
            <header className="sticky top-0 z-50 w-full border-b-2 border-[#D1D5DB] dark:border-[#2A2A2A] backdrop-blur-xl shadow-[0_4px_12px_0_rgba(0,0,0,0.12),0_2px_4px_0_rgba(0,0,0,0.08)]" style={loadingHeaderGradientStyle}>
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

    // Main header gradient style - soft gradient for settings pages
    const mainHeaderGradientStyle = useMemo<React.CSSProperties>(() => {
        if (isDarkTheme) {
            // Very soft dark gradient: black to subtle dark teal
            return { background: 'linear-gradient(90deg, #000000 0%, #0a1f1c 100%)' };
        }
        // Very soft light gradient: white to very light teal tint
        return { background: 'linear-gradient(90deg, #ffffff 0%, #f0fdfa 100%)' };
    }, [isDarkTheme]);

    return (
        <>
        <header className="sticky top-0 z-50 w-full backdrop-blur-xl wh-header border-b-2 border-[#D1D5DB] dark:border-[#2A2A2A] shadow-[0_4px_12px_0_rgba(0,0,0,0.12),0_2px_4px_0_rgba(0,0,0,0.08)]" style={currentWorkspaceName ? headerBackgroundStyle : mainHeaderGradientStyle}>
            {isMobile && (
                <SidebarTrigger className='absolute left-2 top-3 z-1000 text-primary' />
            )}
            
            <div className="flex items-center justify-between px-6 h-[var(--app-header-height)] relative z-10">
                {/* Left: Workspace name (if in workspace), Settings/Analytics (if in those pages), otherwise breadcrumbs */}
                <div className="flex items-center space-x-2 min-w-0">
                    {currentWorkspaceName ? (
                        <div className="flex items-center space-x-2">
                            {workspaceIcon ? (
                                <FontAwesomeIcon
                                    icon={workspaceIcon}
                                    className="flex-shrink-0 text-base sm:text-xl lg:text-2xl leading-none"
                                    style={{ color: currentWorkspaceColor || 'var(--color-primary)' }}
                                />
                            ) : (
                                currentWorkspaceName === 'Everything' ? (
                                    <Layers className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" style={{ color: '#27C1A7' }} />
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
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </div>
                    </div>
                )}

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {(typeof currentWorkspaceId === 'number' || currentWorkspaceName === 'Everything') && (
                        <button
                            className="group inline-flex items-center gap-2 pl-3 pr-4 py-2 rounded-full border border-primary/20 bg-primary/10 dark:bg-primary/20 text-primary font-medium text-sm transition-all duration-200 hover:bg-primary hover:text-white hover:border-primary hover:shadow-lg hover:shadow-primary/25 active:scale-[0.97]"
                            onClick={() => setOpenCreateTask(true)}
                            title="Create Task"
                        >
                            <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                            <span>New Task</span>
                        </button>
                    )}
                    <ModeToggle className="h-9 w-9 hover:bg-accent/50 rounded-md transition-colors" />

                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent/50 text-foreground relative transition-colors">
                                <Bell className="h-5 w-5" />
                                <span className="absolute bottom-0.5 left-0.5 bg-red-500 rounded-full w-2 h-2 ring-2 ring-background"></span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-2">
                            <div className="text-sm text-muted-foreground">No notifications</div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
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
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-30">
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
                <div className="flex items-center gap-4">
                    {/* Quick filter chips */}
                    <div className="flex items-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground"
                            title="All tasks"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('workspace-filter-apply', { 
                                    detail: { filterModel: null, clearSearch: true } 
                                }));
                            }}
                        >
                            All
                        </Button>
                        {quickPresets.map((p: any, idx: number) => (
                            <Button
                                key={p.id || idx}
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground"
                                title={p.name}
                                onClick={() => {
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
                            title="Custom filters"
                            onClick={() => {
                                window.dispatchEvent(new CustomEvent('workspace-filter-dialog-open', { detail: {} }));
                            }}
                        >
                            Filters…
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 px-3 rounded-lg text-[12px] text-foreground/70 border border-border/30 hover:bg-foreground/5 hover:text-foreground" 
                                    title="More presets"
                                >
                                    More…
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-[240px]">
                                <DropdownMenuLabel>Apply preset</DropdownMenuLabel>
                                {allPresets.length === 0 ? (
                                    <DropdownMenuItem disabled>No presets yet</DropdownMenuItem>
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
                        <Label className="text-xs text-muted-foreground whitespace-nowrap">Group</Label>
                        <Select value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
                            <SelectTrigger size="sm" className="h-8 rounded-lg px-3 text-[12px] text-foreground/65 border-border/30 hover:bg-foreground/5 w-[120px]">
                                <SelectValue placeholder="Group" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                <SelectItem value="spot_id">Location</SelectItem>
                                <SelectItem value="status_id">Status</SelectItem>
                                <SelectItem value="priority_id">Priority</SelectItem>
                            </SelectContent>
                        </Select>
                        {groupBy !== 'none' && (
                            <div className="flex items-center gap-2">
                                <Switch checked={collapseGroups} onCheckedChange={setCollapseGroups} />
                                <Label className="text-xs text-muted-foreground whitespace-nowrap">Collapse</Label>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {typeof currentWorkspaceId === 'number' && (
            <TaskDialog open={openCreateTask} onOpenChange={setOpenCreateTask} mode="create" workspaceId={currentWorkspaceId} />
        )}
        {currentWorkspaceName === 'Everything' && (
            <TaskDialog open={openCreateTask} onOpenChange={setOpenCreateTask} mode="create-all" />
        )}

        </>
    );
}

export default Header;