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
import { User, LogOut, Bell } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ModeToggle } from "./ModeToggle";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TasksCache } from "@/store/indexedDB/TasksCache";
import { Task } from "@/store/types";

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
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newTaskName, setNewTaskName] = useState('');
    const [newTaskDescription, setNewTaskDescription] = useState('');

    // Data sources for quick search
    const { value: categories } = useSelector((s: RootState) => s.categories);
    const { value: teams } = useSelector((s: RootState) => s.teams);
    const { value: templates } = useSelector((s: RootState) => s.templates);
    const { value: workspaces } = useSelector((s: RootState) => s.workspaces);

    const isSettings = useMemo(() => location.pathname.startsWith('/settings'), [location.pathname]);

    const searchResults = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return { categories: [], teams: [], templates: [] };
        const filterBy = (arr: any[], key: string) => arr.filter((x) => (x[key] || '').toLowerCase().includes(q)).slice(0, 5);
        return {
            categories: filterBy(categories, 'name'),
            teams: filterBy(teams, 'name'),
            templates: filterBy(templates, 'name'),
        };
    }, [searchQuery, categories, teams, templates]);

    const [taskResults, setTaskResults] = useState<Task[]>([]);
    useEffect(() => {
        let active = true;
        const q = searchQuery.trim();
        if (isSettings) {
            setTaskResults([]);
            return;
        }
        if (!q) {
            setTaskResults([]);
            return;
        }
        const t = setTimeout(async () => {
            try {
                const result: any = await TasksCache.queryTasks({ search: q });
                if (active) setTaskResults((result?.rows || []).slice(0, 10));
            } catch (e) {
                if (active) setTaskResults([]);
            }
        }, 300);
        return () => { active = false; clearTimeout(t); };
    }, [searchQuery, isSettings]);

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

    const handleCreateTask = useCallback(async () => {
        if (!newTaskName.trim() || currentWorkspaceId == null) return;
        const nowIso = new Date().toISOString();
        const task: Task = {
            id: Date.now(),
            name: newTaskName.trim(),
            description: newTaskDescription.trim() || null,
            workspace_id: currentWorkspaceId,
            category_id: 0,
            team_id: 0,
            template_id: 0,
            spot_id: 0,
            status_id: 1,
            priority_id: 1,
            start_date: null,
            due_date: null,
            expected_duration: 0,
            response_date: null,
            resolution_date: null,
            work_duration: 0,
            pause_duration: 0,
            created_at: nowIso,
            updated_at: nowIso,
        };
        try {
            await TasksCache.addTask(task);
            setIsCreateOpen(false);
            setNewTaskName('');
            setNewTaskDescription('');
        } catch (e) {
            console.error('Failed to create task', e);
        }
    }, [newTaskName, newTaskDescription, currentWorkspaceId]);

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
                {/* Left: Workspace name (if in workspace), otherwise breadcrumbs */}
                <div className="flex items-center space-x-3 min-w-0">
                    {currentWorkspaceName ? (
                        <h1 className="text-lg sm:text-xl font-semibold truncate max-w-[18rem]">
                            {currentWorkspaceName}
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

                {/* Center: Global Search */}
                <div className="flex-1 hidden md:flex justify-center">
                    <div className="relative w-full max-w-xl">
                        <Input
                            placeholder={isSettings ? "Search teams, categories, templates..." : "Search tasks..."}
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                            onFocus={() => setIsSearchOpen(true)}
                            className="pl-3 pr-3"
                        />
                        {isSearchOpen && searchQuery.trim() && (
                            <div className="absolute mt-2 w-full bg-popover border rounded-md shadow-lg z-50">
                                {isSettings ? (
                                    <>
                                        <div className="p-2 text-xs text-muted-foreground">
                                            Press Enter to search all. Click an item to navigate.
                                        </div>
                                        <div className="max-h-72 overflow-auto">
                                            {(searchResults.teams.length + searchResults.categories.length + searchResults.templates.length === 0) && (
                                                <div className="p-3 text-sm text-muted-foreground">No results</div>
                                            )}
                                            {searchResults.teams.length > 0 && (
                                                <div className="py-1">
                                                    <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Teams</div>
                                                    {searchResults.teams.map((t: any) => (
                                                        <button key={`team-${t.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { setIsSearchOpen(false); setSearchQuery(''); navigate('/settings/teams'); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm">
                                                            {t.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {searchResults.categories.length > 0 && (
                                                <div className="py-1">
                                                    <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Categories</div>
                                                    {searchResults.categories.map((c: any) => (
                                                        <button key={`cat-${c.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { setIsSearchOpen(false); setSearchQuery(''); navigate('/settings/categories'); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm">
                                                            {c.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {searchResults.templates.length > 0 && (
                                                <div className="py-1">
                                                    <div className="px-3 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Templates</div>
                                                    {searchResults.templates.map((t: any) => (
                                                        <button key={`tpl-${t.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { setIsSearchOpen(false); setSearchQuery(''); navigate('/settings/templates'); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm">
                                                            {t.name}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="p-2 text-xs text-muted-foreground">
                                            Press Enter to search tasks. Click a result to open its workspace.
                                        </div>
                                        <div className="max-h-72 overflow-auto">
                                            {taskResults.length === 0 ? (
                                                <div className="p-3 text-sm text-muted-foreground">No tasks found</div>
                                            ) : (
                                                taskResults.map((task) => (
                                                    <button key={`task-${task.id}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { setIsSearchOpen(false); setSearchQuery(''); navigate(`/workspace/${task.workspace_id}`); }} className="w-full text-left px-3 py-2 hover:bg-accent text-sm">
                                                        <div className="font-medium truncate">{task.name}</div>
                                                        {task.description && <div className="text-xs text-muted-foreground truncate">{task.description}</div>}
                                                    </button>
                                                ))
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center space-x-2">
                    <ModeToggle />
                    {currentWorkspaceId != null && (
                        <Button onClick={() => setIsCreateOpen(true)}>Create Task</Button>
                    )}

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
        {/* Create Task Dialog */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Task</DialogTitle>
                    <DialogDescription>
                        Create a new task in {currentWorkspaceName || 'this workspace'}.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                    <div>
                        <label className="text-sm block mb-1">Name</label>
                        <Input value={newTaskName} onChange={(e) => setNewTaskName(e.target.value)} placeholder="Task name" />
                    </div>
                    <div>
                        <label className="text-sm block mb-1">Description</label>
                        <Input value={newTaskDescription} onChange={(e) => setNewTaskDescription(e.target.value)} placeholder="Optional" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateTask} disabled={!newTaskName.trim() || currentWorkspaceId == null}>Create</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
}

export default Header;