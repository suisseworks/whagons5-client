import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger, useSidebar } from "./ui/sidebar";
import { logout } from "@/pages/Authentication/auth";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";

// Cache key prefix for the user's avatar
const AVATAR_CACHE_KEY = 'user_avatar_cache_';
const AVATAR_CACHE_TIMESTAMP_KEY = 'user_avatar_timestamp_';
const CACHE_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

interface CachedAvatar {
    data: string;
    timestamp: number;
}

function Header() {
    const { user } = useAuth();
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
        if (!url || !user?.uid) return;
        
        const cached = getCachedAvatar(user.uid);
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
                setCachedAvatar(user.uid, base64data);
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
    }, [user?.uid, getCachedAvatar, setCachedAvatar]);

    useEffect(() => {
        if (!user?.photoURL || !user?.uid) {
            setImageUrl('');
            setImageError(true);
            return;
        }

        const cached = getCachedAvatar(user.uid);
        if (cached) {
            setImageUrl(cached.data);
            setImageError(false);
        } else {
            cacheImage(user.photoURL);
        }
    }, [user?.photoURL, user?.uid, cacheImage, getCachedAvatar]);

    const handleImageError = () => {
        setImageError(true);
    };

    const getInitials = () => {
        if (!user?.displayName) return '';
        return user.displayName.split(' ').map(name => name.charAt(0)).join('');
    };

    return ( 
        <header className="sticky top-0 z-10 bg-background border-b">
            <div className="flex items-center justify-between h-14 px-4">
                <div className="flex items-center">
                    <SidebarTrigger className="mr-4" />
                    <h1 className="font-medium">Header</h1>
                </div>
                <div className="flex items-center gap-4">
                    <Avatar
                        onClick={() => {
                            logout()
                        }}
                    >
                        {!imageError && imageUrl && !isLoading && (
                            <AvatarImage 
                                src={imageUrl} 
                                onError={handleImageError}
                                alt={user?.displayName || 'User avatar'}
                            />
                        )}
                        <AvatarFallback>
                            {isLoading ? '...' : getInitials()}
                        </AvatarFallback>
                    </Avatar>
                </div>
            </div>
        </header>
    );
}

export default Header;