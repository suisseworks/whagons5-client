import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useAuth } from '@/providers/AuthProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { actionsApi } from '@/api/whagonsActionsApi';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogClose } from '@/components/ui/dialog';
import { User as UserIcon, Camera, Save, X, Loader2, Mail, Calendar, UserCheck, Users, Shield, Cake, Phone, Sparkles, Heart, Plus } from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUpload, faXmark, faSpinner } from '@fortawesome/free-solid-svg-icons';
import { uploadImageAsset, getAssetDisplayUrl, createImagePreview } from '@/lib/assetHelpers';
import { ImageCropper } from '@/components/ImageCropper';
import { RootState } from '@/store/store';
import { UserTeam, Team } from '@/store/types';

// Helper functions to get translated arrays
const getMonths = (t: (key: string, fallback?: string) => string) => [
    { value: 1, label: t('profile.months.january', 'January') },
    { value: 2, label: t('profile.months.february', 'February') },
    { value: 3, label: t('profile.months.march', 'March') },
    { value: 4, label: t('profile.months.april', 'April') },
    { value: 5, label: t('profile.months.may', 'May') },
    { value: 6, label: t('profile.months.june', 'June') },
    { value: 7, label: t('profile.months.july', 'July') },
    { value: 8, label: t('profile.months.august', 'August') },
    { value: 9, label: t('profile.months.september', 'September') },
    { value: 10, label: t('profile.months.october', 'October') },
    { value: 11, label: t('profile.months.november', 'November') },
    { value: 12, label: t('profile.months.december', 'December') },
];

const getZodiacSigns = (t: (key: string, fallback?: string) => string) => [
    { key: 'aries', label: t('profile.zodiac.aries', 'Aries') },
    { key: 'taurus', label: t('profile.zodiac.taurus', 'Taurus') },
    { key: 'gemini', label: t('profile.zodiac.gemini', 'Gemini') },
    { key: 'cancer', label: t('profile.zodiac.cancer', 'Cancer') },
    { key: 'leo', label: t('profile.zodiac.leo', 'Leo') },
    { key: 'virgo', label: t('profile.zodiac.virgo', 'Virgo') },
    { key: 'libra', label: t('profile.zodiac.libra', 'Libra') },
    { key: 'scorpio', label: t('profile.zodiac.scorpio', 'Scorpio') },
    { key: 'sagittarius', label: t('profile.zodiac.sagittarius', 'Sagittarius') },
    { key: 'capricorn', label: t('profile.zodiac.capricorn', 'Capricorn') },
    { key: 'aquarius', label: t('profile.zodiac.aquarius', 'Aquarius') },
    { key: 'pisces', label: t('profile.zodiac.pisces', 'Pisces') },
];

const getGenders = (t: (key: string, fallback?: string) => string) => [
    t('profile.gender.male', 'Male'),
    t('profile.gender.female', 'Female'),
    t('profile.gender.nonBinary', 'Non-binary'),
    t('profile.gender.other', 'Other'),
    t('profile.gender.preferNotToSay', 'Prefer not to say'),
];

// Calculate zodiac sign from birthday (returns English key for translation)
const calculateZodiacSign = (month: number | null, day: number | null): string | null => {
    if (!month || !day) return null;
    
    const zodiacDates = [
        { sign: 'capricorn', start: [12, 22], end: [1, 19] },
        { sign: 'aquarius', start: [1, 20], end: [2, 18] },
        { sign: 'pisces', start: [2, 19], end: [3, 20] },
        { sign: 'aries', start: [3, 21], end: [4, 19] },
        { sign: 'taurus', start: [4, 20], end: [5, 20] },
        { sign: 'gemini', start: [5, 21], end: [6, 20] },
        { sign: 'cancer', start: [6, 21], end: [7, 22] },
        { sign: 'leo', start: [7, 23], end: [8, 22] },
        { sign: 'virgo', start: [8, 23], end: [9, 22] },
        { sign: 'libra', start: [9, 23], end: [10, 22] },
        { sign: 'scorpio', start: [10, 23], end: [11, 21] },
        { sign: 'sagittarius', start: [11, 22], end: [12, 21] },
    ];

    for (const zodiac of zodiacDates) {
        const [startMonth, startDay] = zodiac.start;
        const [endMonth, endDay] = zodiac.end;
        
        if (startMonth === endMonth) {
            if (month === startMonth && day >= startDay && day <= endDay) {
                return zodiac.sign;
            }
        } else {
            if ((month === startMonth && day >= startDay) || (month === endMonth && day <= endDay)) {
                return zodiac.sign;
            }
        }
    }
    
    return null;
};

// Extended User type to match actual API response
interface ExtendedUser {
    id: number;
    name?: string;
    email: string;
    url_picture?: string | null;
    color?: string | null;
    birthday_month?: number | null;
    birthday_day?: number | null;
    gender?: string | null;
    zodiac_sign?: string | null;
    phone?: string | null;
    bio?: string | null;
    hobbies?: string[] | null;
    organization_name?: string | null;
    created_at?: string;
    updated_at?: string;
    teams?: Array<{ id: number; name: string; description?: string; color?: string; role_id?: number; role_name?: string }>;
    [key: string]: any;
}

function Profile() {
    const { t } = useLanguage();
    const { user: userData, userLoading, refetchUser } = useAuth();
    // Keep previous userData to prevent blank screen during refetch
    const [previousUserData, setPreviousUserData] = useState<ExtendedUser | null>(userData ? (userData as unknown as ExtendedUser) : null);
    const { value: userTeams } = useSelector((state: RootState) => state.userTeams) as { value: UserTeam[]; loading: boolean };
    const { value: teams } = useSelector((state: RootState) => state.teams) as { value: Team[]; loading: boolean };
    const [error, setError] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Update previousUserData when userData changes, but keep it if userData becomes null during loading
    useEffect(() => {
        if (userData) {
            setPreviousUserData(userData as unknown as ExtendedUser);
        }
    }, [userData]);
    
    // Use previousUserData if current userData is null but we're loading (prevents blank screen)
    const displayUserData: ExtendedUser | null = (userData ? (userData as unknown as ExtendedUser) : null) || (userLoading ? previousUserData : null);
    const [editForm, setEditForm] = useState({
        name: '',
        url_picture: '',
        birthday_month: null as number | null,
        birthday_day: null as number | null,
        gender: '',
        zodiac_sign: '',
        phone: '',
        bio: '',
        hobbies: [] as string[],
    });
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [showCropper, setShowCropper] = useState(false);
    const [imageToCrop, setImageToCrop] = useState<string | null>(null);
    const [originalFile, setOriginalFile] = useState<File | null>(null);
    const [newHobby, setNewHobby] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // DataManager handles data loading, no need to call internal functions here

    // Initialize form when user data is available
    useEffect(() => {
        if (displayUserData) {
            try {
                // Normalize zodiac_sign to lowercase key if it exists
                let normalizedZodiacSign = '';
                if (displayUserData.zodiac_sign) {
                    const zodiacKey = displayUserData.zodiac_sign.toLowerCase();
                    // Check if it's a valid key
                    const validKeys = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
                    normalizedZodiacSign = validKeys.includes(zodiacKey) ? zodiacKey : '';
                }
                
                setEditForm({
                    name: displayUserData.name || '',
                    url_picture: displayUserData.url_picture || '',
                    birthday_month: displayUserData.birthday_month || null,
                    birthday_day: displayUserData.birthday_day || null,
                    gender: displayUserData.gender || '',
                    zodiac_sign: normalizedZodiacSign,
                    phone: displayUserData.phone || '',
                    bio: displayUserData.bio || '',
                    hobbies: displayUserData.hobbies || [],
                });
                // Set preview using getAssetDisplayUrl to handle both URLs and asset IDs
                if (displayUserData.url_picture) {
                    setPreviewImage(getAssetDisplayUrl(displayUserData.url_picture));
                } else {
                    setPreviewImage(null);
                }
            } catch (error) {
                console.error('Error initializing form:', error);
                setError(t('profile.failedToLoad', 'Failed to load profile data'));
            }
        }
    }, [displayUserData, t]);

    // Auto-calculate zodiac sign when birthday changes
    useEffect(() => {
        if (editForm.birthday_month && editForm.birthday_day) {
            const calculatedZodiac = calculateZodiacSign(editForm.birthday_month, editForm.birthday_day);
            if (calculatedZodiac && !editForm.zodiac_sign) {
                setEditForm(prev => ({ ...prev, zodiac_sign: calculatedZodiac }));
            }
        }
    }, [editForm.birthday_month, editForm.birthday_day]);

    // Handle form input changes
    const handleInputChange = (field: string, value: any) => {
        setEditForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle adding hobby
    const handleAddHobby = () => {
        if (newHobby.trim() && !editForm.hobbies.includes(newHobby.trim())) {
            setEditForm(prev => ({
                ...prev,
                hobbies: [...prev.hobbies, newHobby.trim()]
            }));
            setNewHobby('');
        }
    };

    // Handle removing hobby
    const handleRemoveHobby = (hobby: string) => {
        setEditForm(prev => ({
            ...prev,
            hobbies: prev.hobbies.filter(h => h !== hobby)
        }));
    };

    // Handle image file selection - show cropper instead of uploading immediately
    const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate image type
        if (!file.type.startsWith('image/')) {
            setUploadError(t('profile.pleaseSelectImageFile', 'Please select an image file'));
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
            setUploadError(t('profile.failedToLoadImage', 'Failed to load image'));
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
            setUploadError(error.message || t('profile.failedToUploadImage', 'Failed to upload image'));
            setPreviewImage(displayUserData?.url_picture ? getAssetDisplayUrl(displayUserData.url_picture) : null);
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
            setError(null);
            
            // Convert empty strings to null for nullable fields
            const payload = {
                ...editForm,
                zodiac_sign: editForm.zodiac_sign || null,
                gender: editForm.gender || null,
                phone: editForm.phone || null,
                bio: editForm.bio || null,
                url_picture: editForm.url_picture || null,
            };
            
            const response = await actionsApi.patch('/users/me', payload);
            
            if (response.status === 200) {
                console.log('Profile: Saving profile with url_picture:', editForm.url_picture);
                
                // Clear avatar cache BEFORE refreshing to ensure fresh image loads
                const { AvatarCache } = await import('@/store/indexedDB/AvatarCache');
                const firebaseUser = (window as any).firebase?.auth?.currentUser;
                if (firebaseUser?.uid && displayUserData?.id) {
                    console.log('Profile: Clearing cache for', [firebaseUser.uid, displayUserData.google_uuid, displayUserData.id]);
                    await AvatarCache.deleteByAny([firebaseUser.uid, displayUserData.google_uuid, displayUserData.id]);
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
                
                // Close dialog immediately to prevent blank screen during refetch
                setIsEditing(false);
                
                // Refresh user data in the background (non-blocking)
                // This prevents the blank screen flash since dialog is already closed
                refetchUser().then(() => {
                    console.log('Profile: User data refetched');
                }).catch((err) => {
                    console.error('Error refetching user:', err);
                });
                
                // Also set localStorage for cross-tab communication
                localStorage.setItem('profile_updated', Date.now().toString());
            }
        } catch (err: any) {
            console.error('Error updating profile:', err);
            // Extract error message from API response if available
            const errorMessage = err?.response?.data?.message || 
                                err?.response?.data?.errors?.zodiac_sign?.[0] ||
                                err?.message || 
                                t('profile.failedToUpdate', 'Failed to update profile');
            setError(errorMessage);
            // Don't close the dialog on error so user can see the error and retry
        } finally {
            setSaving(false);
        }
    };

    // Cancel editing
    const handleCancelEdit = () => {
        if (displayUserData) {
            setEditForm({
                name: displayUserData.name || '',
                url_picture: displayUserData.url_picture || '',
                birthday_month: displayUserData.birthday_month || null,
                birthday_day: displayUserData.birthday_day || null,
                gender: displayUserData.gender || '',
                zodiac_sign: displayUserData.zodiac_sign || '',
                phone: displayUserData.phone || '',
                bio: displayUserData.bio || '',
                hobbies: displayUserData.hobbies || [],
            });
            if (displayUserData.url_picture) {
                setPreviewImage(getAssetDisplayUrl(displayUserData.url_picture));
            } else {
                setPreviewImage(null);
            }
        }
        setUploadError(null);
        setError(null);
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
        if (!dateString) return t('common.unknown', 'N/A');
        const locale = t('common.locale', 'en-US');
        return new Date(dateString).toLocaleDateString(locale, {
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

    // Format birthday for display
    const formatBirthday = (month?: number | null, day?: number | null) => {
        if (!month || !day) return t('profile.notSpecified', 'Not specified');
        const months = getMonths(t);
        const monthName = months.find(m => m.value === month)?.label || '';
        return `${monthName} ${day}`;
    };

    // Get current user's teams and roles
    const getUserTeamsAndRoles = () => {
        if (!displayUserData?.id) return [];
        
        const userTeamRelationships = userTeams.filter((ut: UserTeam) => ut.user_id === displayUserData.id);
        
        return userTeamRelationships.map((ut: UserTeam) => {
            const team = teams.find((t: Team) => t.id === ut.team_id);
            // Extract role info from userData if teams are loaded with role info
            let role: { id: number; name: string; description: string | null } | null = null;
            if (ut.role_id) {
                // Check if role info comes with userData teams (userData might have teams array with role_id)
                const userDataTyped = userData ? (userData as unknown as ExtendedUser) : null;
                const teamFromUserData = userDataTyped?.teams?.find((t) => t.id === ut.team_id);
                if (teamFromUserData?.role_id === ut.role_id && teamFromUserData?.role_name) {
                    role = {
                        id: ut.role_id,
                        name: teamFromUserData.role_name,
                        description: null
                    };
                } else {
                    // Fallback to showing role_id
                    role = {
                        id: ut.role_id,
                        name: `Role #${ut.role_id}`,
                        description: null
                    };
                }
            }
            
            return {
                team: team ? {
                    id: team.id,
                    name: team.name,
                    color: team.color,
                    description: team.description
                } : null,
                role: role
            };
        }).filter(item => item.team !== null);
    };

    const userTeamsAndRoles = getUserTeamsAndRoles();

    if (userLoading) {
        return (
            <div className="container mx-auto p-6 max-w-6xl">
                <Card>
                    <CardContent className="p-6">
                        <div className="flex items-center space-x-4 mb-6">
                            <Skeleton className="w-24 h-24 rounded-full" />
                            <div className="space-y-2">
                                <Skeleton className="h-8 w-64" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                            <Skeleton className="h-4 w-1/2" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <div className="container mx-auto p-6 max-w-6xl">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                    <div className="flex items-center space-x-2">
                        <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                        <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">{t('profile.error', 'Error')}</h3>
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
                        {t('profile.tryAgain', 'Try Again')}
                    </Button>
                </div>
            </div>
        );
    }

    // Don't show blank screen - only show "no data" if we're truly not loading
    if (!displayUserData && !userLoading) {
        return (
            <div className="container mx-auto p-6 max-w-6xl">
                <div className="text-center text-gray-500 dark:text-gray-400">
                    {t('profile.noProfileData', 'No profile data available')}
                </div>
            </div>
        );
    }

    // Guard: displayUserData should not be null at this point, but TypeScript doesn't know that
    if (!displayUserData) {
        return null;
    }

    return (
        <div className="container mx-auto p-6 max-w-6xl space-y-6">
            {/* Profile Header Card */}
            <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border-none shadow-lg">
                <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                        <Avatar className="w-32 h-32 border-4 border-white dark:border-gray-700 shadow-xl">
                            <AvatarImage 
                                src={displayUserData.url_picture ? getAssetDisplayUrl(displayUserData.url_picture) : undefined} 
                                alt={displayUserData.name || 'Profile'} 
                            />
                            <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                                {getUserInitials(displayUserData.name, displayUserData.email)}
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-center md:text-left">
                            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                                {displayUserData.name || t('profile.unnamedUser', 'Unnamed User')}
                            </h1>
                            <p className="text-lg text-gray-600 dark:text-gray-300 mb-4">
                                {displayUserData.organization_name || displayUserData.email}
                            </p>
                            {displayUserData.bio && (
                                <p className="text-gray-700 dark:text-gray-400 max-w-2xl">
                                    {displayUserData.bio}
                                </p>
                            )}
                        </div>
                        <Button 
                            onClick={() => {
                                setError(null);
                                setIsEditing(true);
                            }}
                            disabled={isEditing}
                            size="lg"
                            className="flex items-center space-x-2"
                        >
                            <UserIcon className="w-5 h-5" />
                            <span>{t('profile.editProfile', 'Edit Profile')}</span>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Main Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Basic Information */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <UserIcon className="w-5 h-5" />
                            {t('profile.basicInformation', 'Basic Information')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <Mail className="w-4 h-4" />
                                <span className="font-medium">{t('profile.email', 'Email')}</span>
                            </div>
                            <div className="text-gray-900 dark:text-white font-medium">
                                {displayUserData.email}
                            </div>
                        </div>

                        {displayUserData.phone && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <Phone className="w-4 h-4" />
                                    <span className="font-medium">{t('profile.phoneNumber', 'Phone')}</span>
                                </div>
                                <div className="text-gray-900 dark:text-white font-medium">
                                    {displayUserData.phone}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <UserCheck className="w-4 h-4" />
                                <span className="font-medium">{t('profile.organization', 'Organization')}</span>
                            </div>
                            <div className="text-gray-900 dark:text-white font-medium">
                                {displayUserData.organization_name || t('profile.notSpecified', 'Not specified')}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                <Calendar className="w-4 h-4" />
                                <span className="font-medium">{t('profile.memberSince', 'Member Since')}</span>
                            </div>
                            <div className="text-gray-900 dark:text-white font-medium">
                                {formatDate(displayUserData.created_at)}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Personal Details */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5" />
                            {t('profile.personalDetails', 'Personal Details')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(displayUserData.birthday_month || displayUserData.birthday_day) && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <Cake className="w-4 h-4" />
                                    <span className="font-medium">{t('profile.birthday', 'Birthday')}</span>
                                </div>
                                <div className="text-gray-900 dark:text-white font-medium">
                                    {formatBirthday(displayUserData.birthday_month, displayUserData.birthday_day)}
                                </div>
                            </div>
                        )}

                        {displayUserData.zodiac_sign && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <Sparkles className="w-4 h-4" />
                                    <span className="font-medium">{t('profile.zodiacSign', 'Zodiac Sign')}</span>
                                </div>
                                <div className="text-gray-900 dark:text-white font-medium">
                                    {t(`profile.zodiac.${displayUserData.zodiac_sign.toLowerCase()}`, displayUserData.zodiac_sign)}
                                </div>
                            </div>
                        )}

                        {displayUserData.gender && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                    <UserIcon className="w-4 h-4" />
                                    <span className="font-medium">{t('profile.gender', 'Gender')}</span>
                                </div>
                                <div className="text-gray-900 dark:text-white font-medium">
                                    {displayUserData.gender}
                                </div>
                            </div>
                        )}

                        {(!displayUserData.birthday_month && !displayUserData.birthday_day && !displayUserData.zodiac_sign && !displayUserData.gender) && (
                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                {t('profile.noPersonalDetails', 'No personal details added yet')}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Hobbies & Interests */}
            {displayUserData.hobbies && displayUserData.hobbies.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Heart className="w-5 h-5" />
                            {t('profile.hobbiesInterests', 'Hobbies & Interests')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-wrap gap-2">
                            {displayUserData.hobbies.map((hobby, index) => (
                                <Badge 
                                    key={index} 
                                    variant="secondary" 
                                    className="px-4 py-2 text-sm bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 border-none"
                                >
                                    {hobby}
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Teams and Roles Section */}
            {userTeamsAndRoles.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            {t('profile.teamsRoles', 'Teams & Roles')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {userTeamsAndRoles.map((item, index) => {
                                if (!item.team) return null;
                                
                                const team = item.team;
                                const role = item.role;
                                const initial = (team.name || '').charAt(0).toUpperCase();
                                const hex = String(team.color || '').trim();
                                let bg = hex || '#6b7280';
                                let fg = '#fff';
                                
                                try {
                                    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) {
                                        const h = hex.length === 4
                                            ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
                                            : hex;
                                        const r = parseInt(h.slice(1, 3), 16);
                                        const g = parseInt(h.slice(3, 5), 16);
                                        const b = parseInt(h.slice(5, 7), 16);
                                        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                                        fg = brightness > 128 ? '#000' : '#fff';
                                        bg = h;
                                    }
                                } catch (e) {
                                    bg = '#6b7280';
                                }
                                
                                return (
                                    <div
                                        key={`${team.id}-${index}`}
                                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-center space-x-3">
                                            <div
                                                className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 shadow-md"
                                                style={{ backgroundColor: bg, color: fg }}
                                            >
                                                {initial}
                                            </div>
                                            <div>
                                                <div className="font-semibold text-gray-900 dark:text-white">
                                                    {team.name}
                                                </div>
                                                {team.description && (
                                                    <div className="text-sm text-gray-600 dark:text-gray-400">
                                                        {team.description}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {role && (
                                            <Badge variant="outline" className="flex items-center gap-2">
                                                <Shield className="w-3 h-3" />
                                                {role.name}
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Edit Profile Dialog */}
            <Dialog open={isEditing} onOpenChange={(open) => {
                if (!saving) {
                    if (!open) {
                        setError(null);
                    }
                    setIsEditing(open);
                }
            }}>
                <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-2xl">{t('profile.editProfile', 'Edit Profile')}</DialogTitle>
                        <DialogDescription>
                            {t('profile.updateProfileInfo', 'Update your profile information below.')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-4">
                        {/* Top Section: Profile Picture + Name + Email in compact layout */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Profile Picture - Compact */}
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">{t('profile.profilePicture', 'Profile Picture')}</Label>
                                {previewImage ? (
                                    <div className="space-y-2">
                                        <div className="relative inline-block">
                                            <img
                                                src={previewImage}
                                                alt={t('profile.profilePreview', 'Profile preview')}
                                                className="w-20 h-20 rounded-full object-cover border-2 border-border"
                                            />
                                            <Button
                                                type="button"
                                                variant="destructive"
                                                size="icon"
                                                className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                                                onClick={handleRemoveImage}
                                                disabled={uploading}
                                            >
                                                <FontAwesomeIcon icon={faXmark} className="h-2.5 w-2.5" />
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
                                            className="w-full text-xs"
                                        >
                                            <Camera className="w-3 h-3 mr-1" />
                                            {t('profile.changePicture', 'Change')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
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
                                            className={`cursor-pointer flex flex-col items-center gap-1 ${uploading ? 'opacity-50' : ''}`}
                                        >
                                            {uploading ? (
                                                <>
                                                    <FontAwesomeIcon icon={faSpinner} className="h-4 w-4 text-muted-foreground animate-spin" />
                                                    <span className="text-xs text-muted-foreground">{t('profile.uploading', 'Uploading...')}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <FontAwesomeIcon icon={faUpload} className="h-4 w-4 text-muted-foreground" />
                                                    <span className="text-xs text-muted-foreground">{t('profile.clickToUpload', 'Upload')}</span>
                                                </>
                                            )}
                                        </label>
                                        {uploadError && (
                                            <div className="mt-1 text-xs text-destructive">{uploadError}</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name">{t('profile.fullName', 'Full Name')}</Label>
                                <Input
                                    id="name"
                                    value={editForm.name}
                                    onChange={(e) => handleInputChange('name', e.target.value)}
                                    placeholder={t('profile.placeholders.enterFullName', 'Enter your full name')}
                                />
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email">{t('profile.email', 'Email')}</Label>
                                <Input
                                    id="email"
                                    value={displayUserData.email}
                                    disabled
                                    className="bg-gray-50 dark:bg-gray-700"
                                />
                                <p className="text-xs text-gray-500">
                                    {t('profile.emailCannotBeChanged', 'Cannot be changed')}
                                </p>
                            </div>
                        </div>

                        <Separator />

                        {/* Personal Details - Moved up for easy access */}
                        <div className="space-y-4">
                            <h3 className="text-base font-semibold">{t('profile.personalDetails', 'Personal Details')}</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="birthday-month">{t('profile.birthdayMonth', 'Birthday Month')}</Label>
                                    <Select
                                        value={editForm.birthday_month?.toString() || ''}
                                        onValueChange={(value) => handleInputChange('birthday_month', value ? parseInt(value) : null)}
                                    >
                                        <SelectTrigger id="birthday-month">
                                            <SelectValue placeholder={t('profile.placeholders.selectMonth', 'Select month')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {getMonths(t).map(month => (
                                                <SelectItem key={month.value} value={month.value.toString()}>
                                                    {month.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="birthday-day">{t('profile.birthdayDay', 'Birthday Day')}</Label>
                                    <Select
                                        value={editForm.birthday_day?.toString() || ''}
                                        onValueChange={(value) => handleInputChange('birthday_day', value ? parseInt(value) : null)}
                                    >
                                        <SelectTrigger id="birthday-day">
                                            <SelectValue placeholder={t('profile.placeholders.selectDay', 'Select day')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                                                <SelectItem key={day} value={day.toString()}>
                                                    {day}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="zodiac">{t('profile.zodiacSign', 'Zodiac Sign')}</Label>
                                    <Select
                                        value={editForm.zodiac_sign && getZodiacSigns(t).some(s => s.key === editForm.zodiac_sign) ? editForm.zodiac_sign : ''}
                                        onValueChange={(value) => handleInputChange('zodiac_sign', value || null)}
                                    >
                                        <SelectTrigger id="zodiac">
                                            <SelectValue placeholder={t('profile.placeholders.selectZodiacSign', 'Select zodiac sign')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {getZodiacSigns(t).map(sign => (
                                                <SelectItem key={sign.key} value={sign.key}>
                                                    {sign.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {editForm.birthday_month && editForm.birthday_day && (
                                        <p className="text-xs text-gray-500">
                                            {t('profile.autoCalculatedFromBirthday', 'Auto-calculated')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="gender">{t('profile.gender', 'Gender')}</Label>
                                    <Select
                                        value={editForm.gender}
                                        onValueChange={(value) => handleInputChange('gender', value)}
                                    >
                                        <SelectTrigger id="gender">
                                            <SelectValue placeholder={t('profile.placeholders.selectGender', 'Select gender')} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {getGenders(t).map(gender => (
                                                <SelectItem key={gender} value={gender}>
                                                    {gender}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="phone">{t('profile.phoneNumber', 'Phone Number')}</Label>
                                    <Input
                                        id="phone"
                                        value={editForm.phone}
                                        onChange={(e) => handleInputChange('phone', e.target.value)}
                                        placeholder={t('profile.placeholders.phoneNumber', '+1 234 567 8900')}
                                    />
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Additional Info - Bio and Hobbies side by side */}
                        <div className="space-y-4">
                            <h3 className="text-base font-semibold">{t('profile.additionalInformation', 'Additional Information')}</h3>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Bio - Left side */}
                                <div className="space-y-2">
                                    <Label htmlFor="bio">{t('profile.bio', 'Bio')}</Label>
                                    <Textarea
                                        id="bio"
                                        value={editForm.bio}
                                        onChange={(e) => handleInputChange('bio', e.target.value)}
                                        placeholder={t('profile.placeholders.tellAboutYourself', 'Tell us about yourself...')}
                                        rows={3}
                                        maxLength={1000}
                                    />
                                    <p className="text-xs text-gray-500">
                                        {editForm.bio.length}/1000 {t('profile.characters', 'characters')}
                                    </p>
                                </div>

                                {/* Hobbies - Right side */}
                                <div className="space-y-2">
                                    <Label>{t('profile.hobbiesInterests', 'Hobbies & Interests')}</Label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={newHobby}
                                            onChange={(e) => setNewHobby(e.target.value)}
                                            placeholder={t('profile.placeholders.addHobby', 'Add a hobby...')}
                                            onKeyPress={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddHobby();
                                                }
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            onClick={handleAddHobby}
                                            disabled={!newHobby.trim()}
                                        >
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>

                                    {editForm.hobbies.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {editForm.hobbies.map((hobby, index) => (
                                                <Badge 
                                                    key={index} 
                                                    variant="secondary"
                                                    className="px-3 py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                                                    onClick={() => handleRemoveHobby(hobby)}
                                                >
                                                    {hobby}
                                                    <X className="w-3 h-3 ml-2" />
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                            <div className="flex items-center space-x-2">
                                <X className="w-5 h-5 text-red-600 dark:text-red-400" />
                                <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button
                                variant="outline"
                                disabled={saving}
                            >
                                {t('profile.cancel', 'Cancel')}
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
                            <span>{saving ? t('profile.saving', 'Saving...') : t('profile.saveChanges', 'Save Changes')}</span>
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
