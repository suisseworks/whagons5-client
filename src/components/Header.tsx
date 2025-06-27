import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "./ui/sidebar";
import { logout } from "@/pages/authentication/auth";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/providers/AuthProvider";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "./ModeToggle";

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
    const navigate = useNavigate();
    const [imageUrl, setImageUrl] = useState<string>('');
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

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
                    <SidebarTrigger />
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
                    <SidebarTrigger />
                    <div className="flex items-center space-x-2">
                        <div className="bg-gray-300 rounded-full h-8 w-8"></div>
                        <span className="text-sm text-muted-foreground">User not found</span>
                    </div>
                </div>
            </header>
        );
    }

    return (
        <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center space-x-4">
                    <SidebarTrigger />
                </div>

                <div className="flex items-center space-x-4">
                    <ModeToggle />
                    
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
    );
}

export default Header;