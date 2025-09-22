import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { logout } from "@/pages/authentication/auth";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut, Bell, Plus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ModeToggle } from "./ModeToggle";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import CreateTaskDialog from '@/pages/spaces/components/CreateTaskDialog';
import { AvatarCache } from '@/store/indexedDB/AvatarCache';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";


// Avatars are now cached globally in IndexedDB via AvatarCache

function Header() {
    const { firebaseUser, user, userLoading } = useAuth();
    const { isMobile } = useSidebar();
    const navigate = useNavigate();
    const location = useLocation();
    const [imageUrl, setImageUrl] = useState<string>('');
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const workspacesState = useSelector((s: RootState) => s.workspaces);
    const { value: workspaces = [] } = workspacesState || {};

    const isSettings = useMemo(() => location.pathname.startsWith('/settings'), [location.pathname]);
    const isAnalytics = useMemo(() => location.pathname.startsWith('/analytics'), [location.pathname]);



    const breadcrumbs = useMemo(() => {
        const parts = location.pathname.split('/').filter(Boolean);
        const labelMap: Record<string, string> = {
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
        };
        const acc: Array<{ label: string; to?: string }> = [];
        let path = '';

        // Special handling for settings subpages
        if (parts[0] === 'settings' && parts.length > 1) {
            // For settings subpages, create breadcrumbs like: Settings > Subpage
            acc.push({ label: 'Settings', to: '/settings' });
            for (let i = 1; i < parts.length; i++) {
                const seg = parts[i];
                path += `/${seg}`;
                const label = labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
                acc.push({ label, to: `/settings${path}` });
            }
        } else {
            // Regular breadcrumbs for non-settings pages
            for (const seg of parts) {
                path += `/${seg}`;
                const label = labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
                acc.push({ label, to: path });
            }
        }
        return acc;
    }, [location.pathname]);

    // Current workspace context (for replacing breadcrumbs with just workspace name)
    const { currentWorkspaceName, currentWorkspaceId } = useMemo(() => {
        // Supports /workspace/:id and /workspace/all
        const numMatch = location.pathname.match(/\/workspace\/(\d+)/);
        const allMatch = /\/workspace\/all$/.test(location.pathname);
        if (!numMatch && !allMatch) return { currentWorkspaceName: null as string | null, currentWorkspaceId: null as number | null };
        if (allMatch) return { currentWorkspaceName: 'Everything', currentWorkspaceId: null as number | null };
        const wid = parseInt(numMatch![1], 10);
        const ws = workspaces.find((w: any) => w.id === wid);
        return { currentWorkspaceName: ws?.name || `Workspace ${wid}`, currentWorkspaceId: wid };
    }, [location.pathname, workspaces]);
    const [openCreateTask, setOpenCreateTask] = useState(false);



    const cacheImage = useCallback(async (url: string) => {
        if (!url || !firebaseUser?.uid) return;

        setIsLoading(true);
        try {
            // Try IDB cache first
            const cached = await AvatarCache.getByAny([firebaseUser.uid, user?.google_uuid, user?.id]);
            if (cached) {
                setImageUrl(cached);
                setImageError(false);
                return;
            }
            // Fetch and populate cache
            const dataUrl = await AvatarCache.fetchAndCache(firebaseUser.uid, url, [user?.google_uuid, user?.id]);
            if (dataUrl) {
                setImageUrl(dataUrl);
                setImageError(false);
            } else {
                setImageError(true);
            }
        } catch (error) {
            setImageError(true);
        } finally {
            setIsLoading(false);
        }
    }, [firebaseUser?.uid]);

    // Update avatar when user data changes
    useEffect(() => {
        if (user?.id) {
            if (user.url_picture) {
                cacheImage(user.url_picture);
            } else {
                setImageUrl('');
                setImageError(true);
            }
        } else {
            setImageUrl('');
            setImageError(false);
        }
    }, [user, cacheImage]);


        

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

    if (!firebaseUser || userLoading) {
        return (
            <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center space-x-3 p-2">
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
            <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center space-x-3 p-2">
                    {isMobile && <SidebarTrigger />}
                    <div className="flex items-center space-x-2">
                        <div className="bg-gray-300 rounded-full h-7 w-7"></div>
                        <span className="text-xs text-muted-foreground">User not found</span>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <>
        <header className="sticky top-0 z-50 w-full bg-card border-b border-border/50 shadow-sm">
            {isMobile && (
                <SidebarTrigger className='absolute left-2 top-3 z-1000 text-primary' />
            )}
            
            <div className="flex items-center justify-between px-5 py-4">
                {/* Left: Workspace name (if in workspace), Settings/Analytics (if in those pages), otherwise breadcrumbs */}
                <div className="flex items-center space-x-2 min-w-0">
                    {currentWorkspaceName ? (
                        <h1 className="text-lg sm:text-xl font-semibold truncate max-w-[20rem]">
                            {currentWorkspaceName}
                        </h1>
                    ) : isSettings ? (
                        <Breadcrumb>
                            <BreadcrumbList className="gap-1.5 sm:gap-2">
                                {breadcrumbs.map((bc, idx) => (
                                    <>
                                    {idx > 0 && <BreadcrumbSeparator />}
                                    <BreadcrumbItem key={idx}>
                                        {idx < breadcrumbs.length - 1 ? (
                                            <BreadcrumbLink asChild className="font-medium text-foreground/80 hover:text-foreground">
                                                <Link to={bc.to || '#'} className="truncate max-w-[10rem]">
                                                    {bc.label}
                                                </Link>
                                            </BreadcrumbLink>
                                        ) : (
                                            <BreadcrumbPage className="truncate max-w-[10rem] font-semibold">{bc.label}</BreadcrumbPage>
                                        )}
                                    </BreadcrumbItem>
                                    </>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                    ) : isAnalytics ? (
                        <h1 className="text-lg sm:text-xl font-semibold">
                            Analytics
                        </h1>
                    ) : (
                        <Breadcrumb>
                            <BreadcrumbList className="gap-1.5 sm:gap-2">
                                <BreadcrumbItem>
                                    <BreadcrumbLink asChild className="font-medium text-foreground/80 hover:text-foreground">
                                        <Link to="/" className="truncate max-w-[6rem]">Home</Link>
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                {breadcrumbs.map((bc, idx) => (
                                    <>
                                    <BreadcrumbSeparator key={`sep-${idx}`} />
                                    <BreadcrumbItem key={idx}>
                                        {idx < breadcrumbs.length - 1 ? (
                                            <BreadcrumbLink asChild className="font-medium text-foreground/80 hover:text-foreground">
                                                <Link to={bc.to || '#'} className="truncate max-w-[10rem]">
                                                    {bc.label}
                                                </Link>
                                            </BreadcrumbLink>
                                        ) : (
                                            <BreadcrumbPage className="truncate max-w-[10rem] font-semibold">{bc.label}</BreadcrumbPage>
                                        )}
                                    </BreadcrumbItem>
                                    </>
                                ))}
                            </BreadcrumbList>
                        </Breadcrumb>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2">
                    {typeof currentWorkspaceId === 'number' && (
                        <button
                            className="inline-flex items-center justify-center h-9 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                            onClick={() => setOpenCreateTask(true)}
                            title="Create Task"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Task
                        </button>
                    )}
                    <ModeToggle className="h-9 w-9" />

                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent text-foreground relative">
                                <Bell className="h-5 w-5" />
                                <span className="absolute bottom-0.5 left-0.5 bg-red-500 rounded-full w-2 h-2"></span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-2">
                            <div className="text-sm text-muted-foreground">No notifications</div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-9 w-9 inline-flex items-center justify-center rounded-full hover:opacity-80 transition-opacity overflow-hidden">
                                <Avatar className="h-9 w-9">
                                    {!imageError && imageUrl && !isLoading && (
                                        <AvatarImage 
                                            src={imageUrl} 
                                            onError={handleImageError}
                                            alt={getDisplayName()}
                                        />
                                    )}
                                    <AvatarFallback>
                                        {isLoading ? '...' : getInitials()}
                                    </AvatarFallback>
                                </Avatar>
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-30">
                            <DropdownMenuItem onClick={() => {
                                console.log('Profile clicked');
                                navigate('/profile');
                            }}>
                                <User className="mr-2 h-3 w-3" />
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                console.log('Logout clicked');
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

        {typeof currentWorkspaceId === 'number' && (
            <CreateTaskDialog open={openCreateTask} onOpenChange={setOpenCreateTask} workspaceId={currentWorkspaceId} />
        )}

        </>
    );
}

export default Header;