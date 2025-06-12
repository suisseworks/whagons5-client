import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/api';
import { User } from '@/types/user';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { User as UserIcon, Camera, Save, X, Loader2, Mail, Calendar, UserCheck } from 'lucide-react';

function Profile() {
    const { user: firebaseUser } = useAuth();
    const [userData, setUserData] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        team_name: '',
        url_picture: ''
    });
    const [previewImage, setPreviewImage] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Fetch user data
    const fetchUserData = async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await api.get('/users/me');
            if (response.status === 200) {
                const user = response.data.data || response.data;
                setUserData(user);
                setEditForm({
                    name: user.name || '',
                    team_name: user.team_name || '',
                    url_picture: user.url_picture || ''
                });
                setPreviewImage(user.url_picture || '');
            }
        } catch (err) {
            console.error('Error fetching user data:', err);
            setError('Failed to load profile data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (firebaseUser) {
            fetchUserData();
        }
    }, [firebaseUser]);

    // Handle form input changes
    const handleInputChange = (field: string, value: string) => {
        setEditForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle image URL change
    const handleImageUrlChange = (url: string) => {
        setEditForm(prev => ({
            ...prev,
            url_picture: url
        }));
        setPreviewImage(url);
    };

    // Handle profile update
    const handleSaveProfile = async () => {
        try {
            setSaving(true);
            const response = await api.patch('/users/me', editForm);
            
            if (response.status === 200) {
                // Refresh user data
                await fetchUserData();
                setIsEditing(false);
                
                // Clear image cache if URL changed to force header to reload image
                if (userData && editForm.url_picture !== userData.url_picture) {
                    const firebaseUser = (window as any).firebase?.auth?.currentUser;
                    if (firebaseUser?.uid) {
                        localStorage.removeItem(`user_avatar_cache_${firebaseUser.uid}`);
                        localStorage.removeItem(`user_avatar_timestamp_${firebaseUser.uid}`);
                    }
                }
                
                // Notify other components (like header) that profile was updated
                // Use custom event for same-tab communication
                window.dispatchEvent(new CustomEvent('profileUpdated', {
                    detail: { timestamp: Date.now() }
                }));
                
                // Also set localStorage for cross-tab communication
                localStorage.setItem('profile_updated', Date.now().toString());
            }
        } catch (err) {
            console.error('Error updating profile:', err);
            setError('Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    // Cancel editing
    const handleCancelEdit = () => {
        if (userData) {
            setEditForm({
                name: userData.name || '',
                team_name: userData.team_name || '',
                url_picture: userData.url_picture || ''
            });
            setPreviewImage(userData.url_picture || '');
        }
        setIsEditing(false);
    };

    // Format date helper
    const formatDate = (dateString?: string) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    // Get user initials for avatar fallback
    const getUserInitials = (name?: string, email?: string) => {
        if (name) {
            return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        }
        if (email) {
            return email.slice(0, 2).toUpperCase();
        }
        return 'U';
    };

    if (loading) {
        return (
            <div className="container mx-auto p-6 max-w-4xl">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                    <div className="p-6">
                        <div className="flex items-center space-x-4 mb-6">
                            <Skeleton className="w-20 h-20 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48" />
                                <Skeleton className="h-4 w-32" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-6 max-w-4xl">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                    <div className="flex items-center space-x-2">
                        <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Error</h3>
                    </div>
                    <p className="text-red-700 dark:text-red-300 mt-2">{error}</p>
                    <Button 
                        onClick={fetchUserData} 
                        className="mt-4"
                        variant="outline"
                    >
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    if (!userData) {
        return (
            <div className="container mx-auto p-6 max-w-4xl">
                <div className="text-center text-gray-500 dark:text-gray-400">
                    No profile data available
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                {/* Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <Avatar className="w-20 h-20">
                                <AvatarImage 
                                    src={isEditing ? previewImage : userData.url_picture} 
                                    alt={userData.name || 'Profile'} 
                                />
                                <AvatarFallback className="text-lg font-semibold">
                                    {getUserInitials(userData.name, userData.email)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {userData.name || 'Unnamed User'}
                                </h1>
                                <p className="text-gray-600 dark:text-gray-400">
                                    {userData.team_name || 'No team specified'}
                                </p>
                            </div>
                        </div>
                        <Button 
                            onClick={() => setIsEditing(true)}
                            disabled={isEditing}
                            className="flex items-center space-x-2"
                        >
                            <UserIcon className="w-4 h-4" />
                            <span>Edit Profile</span>
                        </Button>
                    </div>
                </div>

                {/* Profile Information */}
                <div className="p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Profile Information
                    </h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Email */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Mail className="w-4 h-4 text-gray-500" />
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Email
                                </Label>
                            </div>
                            <div className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                                {userData.email}
                            </div>
                        </div>

                        {/* Name */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <UserIcon className="w-4 h-4 text-gray-500" />
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Full Name
                                </Label>
                            </div>
                            <div className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                                {userData.name || 'Not specified'}
                            </div>
                        </div>

                        {/* Team Name */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <UserCheck className="w-4 h-4 text-gray-500" />
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Team Name
                                </Label>
                            </div>
                            <div className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                                {userData.team_name || 'Not specified'}
                            </div>
                        </div>

                        {/* Join Date */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Calendar className="w-4 h-4 text-gray-500" />
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Member Since
                                </Label>
                            </div>
                            <div className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                                {formatDate(userData.created_at)}
                            </div>
                        </div>
                    </div>

                    {/* Profile Picture URL */}
                    {userData.url_picture && (
                        <div className="mt-6">
                            <Separator className="mb-4" />
                            <div className="space-y-2">
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Profile Picture URL
                                </Label>
                                <div className="text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 p-3 rounded-md text-sm break-all">
                                    {userData.url_picture}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Profile Dialog */}
            <Dialog open={isEditing} onOpenChange={setIsEditing}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                            Update your profile information below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Profile Picture Section */}
                        <div className="space-y-4">
                            <Label className="text-sm font-medium">Profile Picture</Label>
                            <div className="flex items-center space-x-4">
                                <Avatar className="w-16 h-16">
                                    <AvatarImage src={previewImage} alt="Preview" />
                                    <AvatarFallback>
                                        {getUserInitials(editForm.name, userData.email)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                    <Input
                                        placeholder="Enter image URL..."
                                        value={editForm.url_picture}
                                        onChange={(e) => handleImageUrlChange(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Enter a valid image URL (HTTPS recommended)
                                    </p>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Name Field */}
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input
                                id="name"
                                value={editForm.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                placeholder="Enter your full name"
                            />
                        </div>

                        {/* Team Name Field */}
                        <div className="space-y-2">
                            <Label htmlFor="team_name">Team Name</Label>
                            <Input
                                id="team_name"
                                value={editForm.team_name}
                                onChange={(e) => handleInputChange('team_name', e.target.value)}
                                placeholder="Enter your team or organization name"
                            />
                        </div>

                        {/* Email (Read-only) */}
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                value={userData.email}
                                disabled
                                className="bg-gray-50 dark:bg-gray-700"
                            />
                            <p className="text-xs text-gray-500">
                                Email cannot be changed
                            </p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={handleCancelEdit}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="flex items-center space-x-2"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default Profile;