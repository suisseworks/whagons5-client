import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "./ui/sidebar";
import { logout } from "@/pages/Authentication/auth";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/api";
import { User as UserType } from "@/types/user";
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
    const { user: firebaseUser } = useAuth();
    const navigate = useNavigate();
    const [userData, setUserData] = useState<UserType | null>(null);
    const [imageUrl, setImageUrl] = useState<string>('');
    const [imageError, setImageError] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setUserData(null);
        setImageUrl('');
        setImageError(false);
        setIsLoading(false);
    }, [firebaseUser?.uid]);

    // Fetch user data from API
    const fetchUserData = useCallback(async () => {
        if (!firebaseUser) return;
        
        try {
            const response = await api.get('/users/me');
            if (response.status === 200) {
                const user = response.data.data || response.data;
                setUserData(user);
                
                // Update avatar if URL changed
                if (user.url_picture) {
                    cacheImage(user.url_picture);
                } else {
                    setImageUrl('');
                    setImageError(true);
                }
            }
        } catch (error) {
            console.error('Error fetching user data in header:', error);
        }
    }, [firebaseUser]);

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

    // Initial fetch when Firebase user is available
    useEffect(() => {
        if (firebaseUser) {
            fetchUserData();
        }
    }, [firebaseUser, fetchUserData]);


    // Listen for storage events to update when profile is changed in another tab
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'profile_updated') {
                fetchUserData();
                localStorage.removeItem('profile_updated');
            }
        };

        const handleProfileUpdate = (e: CustomEvent) => {
            // Clear image cache to force reload
            if (firebaseUser?.uid) {
                localStorage.removeItem(AVATAR_CACHE_KEY + firebaseUser.uid);
                localStorage.removeItem(AVATAR_CACHE_TIMESTAMP_KEY + firebaseUser.uid);
            }
            
            // Clear current image state to force reload
            setImageUrl('');
            setImageError(false);
            
            // Fetch updated user data
            fetchUserData();
        };

        // Listen for same-tab profile updates
        window.addEventListener('profileUpdated', handleProfileUpdate as EventListener);
        // Listen for cross-tab profile updates
        window.addEventListener('storage', handleStorageChange);
        
        return () => {
            window.removeEventListener('profileUpdated', handleProfileUpdate as EventListener);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [fetchUserData, firebaseUser?.uid]);

    const handleImageError = () => {
        setImageError(true);
    };

    const getInitials = () => {
        if (userData?.name) {
            return userData.name.split(' ').map(name => name.charAt(0)).join('').toUpperCase().slice(0, 2);
        }
        if (userData?.email) {
            return userData.email.slice(0, 2).toUpperCase();
        }
        return 'U';
    };

    return ( 
        <header className="sticky top-0 z-10 bg-background border-b">
            <div className="flex items-center justify-between h-14 px-4">
                <div className="flex items-center">
                    <SidebarTrigger className="mr-4" />
                    <h1 className="font-medium">
                        {userData?.name ? `Welcome, ${userData.name.split(' ')[0]}` : 'Whagons'}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <ModeToggle />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                                <Avatar className="cursor-pointer">
                                    {!imageError && imageUrl && !isLoading && (
                                        <AvatarImage 
                                            src={imageUrl} 
                                            onError={handleImageError}
                                            alt={userData?.name || 'User avatar'}
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