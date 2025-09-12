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


// Cache key prefix for the user's avatar
const AVATAR_CACHE_KEY = 'user_avatar_cache_';
const AVATAR_CACHE_TIMESTAMP_KEY = 'user_avatar_timestamp_';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

interface CachedAvatar {
    data: string;
    timestamp: number;
}

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
        for (const seg of parts) {
            path += `/${seg}`;
            const label = labelMap[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
            acc.push({ label, to: path });
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



    const getCachedAvatar = useCallback((userId: string): CachedAvatar | null => {
        try {
            const cachedData = localStorage.getItem(AVATAR_CACHE_KEY + userId);
            const cachedTimestamp = localStorage.getItem(AVATAR_CACHE_TIMESTAMP_KEY + userId);
            
            if (!cachedData || !cachedTimestamp) return null;
            
            const timestamp = parseInt(cachedTimestamp, 10);
            const now = Date.now();
            
            if (now - timestamp > CACHE_DURATION) {
                localStorage.removeItem(AVATAR_CACHE_KEY + userId);
                localStorage.removeItem(AVATAR_CACHE_TIMESTAMP_KEY + userId);
                return null;
            }
            
            return {
                data: cachedData,
                timestamp: timestamp
            };
        } catch (error) {
            return null;
        }
    }, []);

    const setCachedAvatar = useCallback((userId: string, data: string) => {
        try {
            const timestamp = Date.now();
            localStorage.setItem(AVATAR_CACHE_KEY + userId, data);
            localStorage.setItem(AVATAR_CACHE_TIMESTAMP_KEY + userId, timestamp.toString());
        } catch (error) {
            setImageUrl(data);
        }
    }, []);

    const cacheImage = useCallback(async (url: string) => {
        if (!url || !firebaseUser?.uid) return;
        
        const cached = getCachedAvatar(firebaseUser.uid);
        if (cached) {
            setImageUrl(cached.data);
            setImageError(false);
            return;
        }

        setIsLoading(true);
        
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 429) {
                    setImageError(true);
                    return;
                }
                throw new Error(`Failed to fetch image: ${response.status}`);
            }
            
            const blob = await response.blob();
            const reader = new FileReader();
            
            reader.onloadend = () => {
                const base64data = reader.result as string;
                setCachedAvatar(firebaseUser.uid, base64data);
                setImageUrl(base64data);
                setImageError(false);
            };
            
            reader.onerror = () => {
                setImageError(true);
            };
            
            reader.readAsDataURL(blob);
        } catch (error) {
            setImageError(true);
        } finally {
            setIsLoading(false);
        }
    }, [firebaseUser?.uid, getCachedAvatar, setCachedAvatar]);

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
                <div className="flex items-center space-x-4 p-4">
                    {isMobile && <SidebarTrigger />}
                    <div className="flex items-center space-x-2">
                        <div className="animate-pulse bg-gray-300 rounded-full h-8 w-8"></div>
                        <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                </div>
            </header>
        );
    }

    if (!user) {
        return (
            <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="flex items-center space-x-4 p-4">
                    {isMobile && <SidebarTrigger />}
                    <div className="flex items-center space-x-2">
                        <div className="bg-gray-300 rounded-full h-8 w-8"></div>
                        <span className="text-sm text-muted-foreground">User not found</span>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <>
        <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-1 shadow-md">
            {isMobile && (
                <SidebarTrigger className='absolute left-2 top-5 z-1000 text-primary' />
            )}
            
            <div className="flex items-center justify-between px-4 py-3">
                {/* Left: Workspace name (if in workspace), Settings/Analytics (if in those pages), otherwise breadcrumbs */}
                <div className="flex items-center space-x-3 min-w-0">
                    {currentWorkspaceName ? (
                        <h1 className="text-lg sm:text-xl font-semibold truncate max-w-[18rem]">
                            {currentWorkspaceName}
                        </h1>
                    ) : isSettings ? (
                        <h1 className="text-lg sm:text-xl font-semibold">
                            Settings
                        </h1>
                    ) : isAnalytics ? (
                        <h1 className="text-lg sm:text-xl font-semibold">
                            Analytics
                        </h1>
                    ) : (
                        <nav className="hidden sm:flex items-center space-x-2 text-sm text-muted-foreground">
                            <Link to="/" className="hover:text-foreground">Home</Link>
                            {breadcrumbs.map((bc, idx) => (
                                <div key={idx} className="flex items-center space-x-2">
                                    <span>›</span>
                                    {idx < breadcrumbs.length - 1 ? (
                                        <Link to={bc.to || '#'} className="hover:text-foreground truncate max-w-[10rem]">
                                            {bc.label}
                                        </Link>
                                    ) : (
                                        <span className="text-foreground truncate max-w-[10rem]">{bc.label}</span>
                                    )}
                                </div>
                            ))}
                        </nav>
                    )}
                </div>



                {/* Right: Actions */}
                <div className="flex items-center space-x-2">
                    {typeof currentWorkspaceId === 'number' && (
                        <button
                            className="h-9 px-3 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
                            onClick={() => setOpenCreateTask(true)}
                            title="Create Task"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            <span className="hidden sm:inline">New Task</span>
                        </button>
                    )}
                    <ModeToggle />

                    {/* Notifications */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-accent text-foreground relative">
                                <Bell className="h-5 w-5" />
                                <span className="absolute -top-1 -right-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1">0</span>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-64 p-2">
                            <div className="text-sm text-muted-foreground">No notifications</div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
                                <Avatar className="h-8 w-8">
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
                                <span className="hidden sm:inline text-sm font-medium">
                                    {getDisplayName()}
                                </span>
                            </button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-30">
                            <DropdownMenuItem onClick={() => {
                                console.log('Profile clicked');
                                navigate('/profile');
                            }}>
                                <User className="mr-2 h-4 w-4" />
                                Profile
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {
                                console.log('Logout clicked');
                                logout();
                            }}>
                                <LogOut className="mr-2 h-4 w-4" />
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