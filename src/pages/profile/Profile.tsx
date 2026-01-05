import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/api/whagonsApi';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogClose } from '@/components/ui/dialog';
import { User as UserIcon, Camera, Save, X, Loader2, Mail, Calendar, UserCheck } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faXmark, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { uploadImageAsset, getAssetDisplayUrl, createImagePreview } from '@/lib/assetHelpers';
import { ImageCropper } from '@/components/ImageCropper';

function Profile() {
    const { user: userData, userLoading, refetchUser } = useAuth();
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        url_picture: ''
    });
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize form when user data is available
    useEffect(() => {
        if (userData) {
            setEditForm({
                name: userData.name || '',
                url_picture: userData.url_picture || ''
            });
            // Set preview using getAssetDisplayUrl to handle both URLs and asset IDs
            if (userData.url_picture) {
                setPreviewImage(getAssetDisplayUrl(userData.url_picture));
            } else {
                setPreviewImage(null);
            }
        }
    }, [userData]);

    // Handle form input changes
    const handleInputChange = (field: string, value: string) => {
        setEditForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle image file selection - show cropper instead of uploading immediately
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate image type
        if (!file.type.startsWith('image/')) {
            setUploadError('Please select an image file');
            return;
        }

        setUploadError(null);
        
        // Create preview and show cropper
        try {
            const previewUrl = await createImagePreview(file);
            setImageToCrop(previewUrl);
            setOriginalFile(file);
            setShowCropper(true);
        } catch (error: any) {
            setUploadError('Failed to load image');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle cropped image - convert to file and upload
    const handleCropComplete = async (croppedImageUrl: string) => {
        if (!originalFile) return;

        setUploading(true);
        setUploadError(null);
        setShowCropper(false);

        try {
            // Convert data URL to File
            const response = await fetch(croppedImageUrl);
            const blob = await response.blob();
            const croppedFile = new File([blob], originalFile.name, {
                type: originalFile.type || 'image/png',
                lastModified: Date.now(),
            });

            // Set preview
            setPreviewImage(croppedImageUrl);

            // Upload to asset service
            const uploadedFile = await uploadImageAsset(croppedFile, {
                maxSize: 10 * 1024 * 1024, // 10MB
            });

            // Store the uploaded file URL (this is what the backend expects to persist for `url_picture`)
            setEditForm(prev => ({
                ...prev,
                url_picture: uploadedFile.url || ''
            }));

            // Clean up
            URL.revokeObjectURL(croppedImageUrl);
        } catch (error: any) {
            setUploadError(error.message || 'Failed to upload image');
            setPreviewImage(userData?.url_picture ? getAssetDisplayUrl(userData.url_picture) : null);
        } finally {
            setUploading(false);
            setOriginalFile(null);
            setImageToCrop(null);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle image removal
    const handleRemoveImage = () => {
        setPreviewImage(null);
        setEditForm(prev => ({
            ...prev,
            url_picture: ''
        }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle profile update
    const handleSaveProfile = async () => {
        try {
            setSaving(true);
            const response = await api.patch('/users/me', editForm);
            
            if (response.status === 200) {
                console.log('Profile: Saving profile with url_picture:', editForm.url_picture);
                
                // Clear avatar cache BEFORE refreshing to ensure fresh image loads
                const { AvatarCache } = await import('@/store/indexedDB/AvatarCache');
                const firebaseUser = (window as any).firebase?.auth?.currentUser;
                if (firebaseUser?.uid && userData?.id) {
                    console.log('Profile: Clearing cache for', [firebaseUser.uid, userData.google_uuid, userData.id]);
                    await AvatarCache.deleteByAny([firebaseUser.uid, userData.google_uuid, userData.id]);
                    console.log('Profile: Cache cleared');
                }
                
                // Notify other components (like header) that profile was updated WITH THE NEW URL
                // Dispatch BEFORE refetchUser so Header can use the new URL immediately
                window.dispatchEvent(new CustomEvent('profileUpdated', {
                    detail: { 
                        timestamp: Date.now(),
                        url_picture: editForm.url_picture 
                    }
                }));
                console.log('Profile: Dispatched profileUpdated event with url_picture:', editForm.url_picture);
                
                // Refresh user data through AuthContext (this will update the user object)
                await refetchUser();
                console.log('Profile: User data refetched');
                
                setIsEditing(false);
                
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
                url_picture: userData.url_picture || ''
            });
            if (userData.url_picture) {
                setPreviewImage(getAssetDisplayUrl(userData.url_picture));
            } else {
                setPreviewImage(null);
            }
        }
        setUploadError(null);
        setIsEditing(false);
    };

    // Handle keyboard events
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isEditing && !saving) {
                handleCancelEdit();
            }
        };

        if (isEditing) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isEditing, saving]);

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

    if (userLoading) {
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
                        onClick={() => {
                            setError(null);
                            refetchUser();
                        }} 
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
                                    src={isEditing && previewImage 
                                        ? previewImage 
                                        : userData.url_picture 
                                            ? getAssetDisplayUrl(userData.url_picture) 
                                            : undefined} 
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
                                    {userData.organization_name || userData.email}
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

                        {/* Organization Name */}
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <UserCheck className="w-4 h-4 text-gray-500" />
                                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Organization
                                </Label>
                            </div>
                            <div className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 p-3 rounded-md">
                                {userData.organization_name || 'Not specified'}
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
            <Dialog open={isEditing} onOpenChange={(open) => !saving && setIsEditing(open)}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader className="relative pr-10">
                        <DialogTitle>Edit Profile</DialogTitle>
                        <DialogDescription>
                            Update your profile information below.
                        </DialogDescription>
                        <DialogClose asChild>
                            <button
                                type="button"
                                aria-label="Close"
                                className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
                                disabled={saving}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </DialogClose>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Profile Picture Section */}
                        <div className="space-y-4">
                            <Label className="text-sm font-medium">Profile Picture</Label>
                            {previewImage ? (
                                <div className="space-y-3">
                                    <div className="relative inline-block">
                                        <img
                                            src={previewImage}
                                            alt="Profile preview"
                                            className="w-32 h-32 rounded-full object-cover border-2 border-border"
                                        />
                                        <Button
                                            type="button"
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-0 right-0 h-6 w-6 rounded-full"
                                            onClick={handleRemoveImage}
                                            disabled={uploading}
                                        >
                                            <FontAwesomeIcon icon={faXmark} className="h-3 w-3" />
                                        </Button>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            if (originalFile) {
                                                createImagePreview(originalFile).then(url => {
                                                    setImageToCrop(url);
                                                    setShowCropper(true);
                                                });
                                            } else {
                                                fileInputRef.current?.click();
                                            }
                                        }}
                                        disabled={uploading}
                                        className="w-full"
                                    >
                                        <Camera className="w-4 h-4 mr-2" />
                                        Adjust & Center
                                    </Button>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="hidden"
                                        id="profile-image-upload"
                                        disabled={uploading}
                                    />
                                    <label
                                        htmlFor="profile-image-upload"
                                        className={`cursor-pointer flex flex-col items-center gap-2 ${uploading ? 'opacity-50' : ''}`}
                                    >
                                        {uploading ? (
                                            <>
                                                <FontAwesomeIcon icon={faSpinner} className="h-6 w-6 text-muted-foreground animate-spin" />
                                                <span className="text-sm text-muted-foreground">Uploading...</span>
                                            </>
                                        ) : (
                                            <>
                                                <FontAwesomeIcon icon={faUpload} className="h-6 w-6 text-muted-foreground" />
                                                <span className="text-sm text-muted-foreground">Click to upload an image</span>
                                            </>
                                        )}
                                    </label>
                                    {uploadError && (
                                        <div className="mt-2 text-sm text-destructive">{uploadError}</div>
                                    )}
                                </div>
                            )}
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
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                        </DialogClose>
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

            {/* Image Cropper Dialog */}
            {imageToCrop && (
                <ImageCropper
                    image={imageToCrop}
                    open={showCropper}
                    onClose={() => {
                        setShowCropper(false);
                        setImageToCrop(null);
                        setOriginalFile(null);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    }}
                    onCropComplete={handleCropComplete}
                    aspect={1}
                    circularCrop={true}
                />
            )}
        </div>
    );
}

export default Profile;