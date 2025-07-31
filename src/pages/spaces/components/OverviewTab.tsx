import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { iconService } from '@/database/iconService';

import { Users, Building, Tag, Edit, Check, X, ChevronDown, Trash2 } from "lucide-react";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { AppDispatch, RootState } from "@/store";
import { removeWorkspaceAsync } from "@/store/reducers/workspacesSlice";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TeamSharingInfo {
  id: string;
  name: string;
  organization_name: string;
  user_count: number;
  shared_date: string;
}

interface WorkspaceOverview {
  teams: TeamSharingInfo[];
  total_users: number;
  categories: string[];
  workspace_name: string;
}

interface WorkspaceInfo {
  name: string;
  icon: string;
  color: string;
  description: string;
}

interface OverviewTabProps {
  workspaceOverview: WorkspaceOverview | null;
  workspaceInfo: WorkspaceInfo | null;
  workspaceId: number | null;
  workspaceTeams: number[] | null;
  workspaceType: string | null;
  loading: boolean;
  onTeamClick: (teamName: string) => void;
  onUpdateWorkspace: (updates: Partial<WorkspaceInfo>) => void;
}

// Common colors for icon selection
const COMMON_COLORS = [
  '#000000', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#F3F4F6',
  '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D', '#16A34A',
  '#059669', '#0891B2', '#0284C7', '#2563EB', '#4F46E5', '#7C3AED',
  '#A855F7', '#C026D3', '#DB2777', '#E11D48'
];

// Popular icons list to show initially
const POPULAR_ICONS = [
  'building', 'briefcase', 'user', 'users', 'settings', 'home', 'folder',
  'file', 'star', 'heart', 'check', 'times', 'plus', 'minus', 'edit',
  'trash', 'search', 'filter', 'sort', 'calendar', 'clock', 'bell',
  'envelope', 'phone', 'map', 'tag', 'bookmark', 'share', 'link'
];

const ICONS_PER_PAGE = 100;

function OverviewTab({ 
  workspaceOverview, 
  workspaceInfo, 
  workspaceId,
  workspaceTeams,
  workspaceType,
  loading, 
  onTeamClick,
  onUpdateWorkspace 
}: OverviewTabProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  
  // Get teams from Redux store
  const { value: allTeams } = useSelector((state: RootState) => state.teams);
  
  // Get teams for this workspace based on workspace.teams array
  const workspaceTeamDetails = useMemo(() => {
    if (!workspaceTeams || !allTeams.length) return [];
    return workspaceTeams
      .map(teamId => allTeams.find(team => team.id === teamId))
      .filter((team): team is NonNullable<typeof team> => team !== undefined);
  }, [workspaceTeams, allTeams]);

  // Check if workspace is default (cannot be deleted)
  const isDefaultWorkspace = workspaceType === "DEFAULT";
  
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingIcon, setEditingIcon] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [tempName, setTempName] = useState(workspaceInfo?.name || '');
  const [tempDescription, setTempDescription] = useState(workspaceInfo?.description || '');
  const [tempIcon, setTempIcon] = useState(workspaceInfo?.icon || '');
  const [tempIconColor, setTempIconColor] = useState(workspaceInfo?.color || '#374151');
  const [iconSearch, setIconSearch] = useState('');
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [displayedIcons, setDisplayedIcons] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [popularIcons, setPopularIcons] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [allIconsMetadata, setAllIconsMetadata] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [loadedIconsCount, setLoadedIconsCount] = useState(0);
  const [totalIconsCount, setTotalIconsCount] = useState(0);
  const [loadingIcons, setLoadingIcons] = useState(false);
  const [loadingMoreIcons, setLoadingMoreIcons] = useState(false);
  const [currentIcon, setCurrentIcon] = useState<any>(null);
  const [defaultIcon, setDefaultIcon] = useState<any>(null);
  const [hasLoadedPopular, setHasLoadedPopular] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const nameEditRef = useRef<HTMLDivElement>(null);
  const descriptionEditRef = useRef<HTMLDivElement>(null);

  // Load default icon and popular icons
  useEffect(() => {
    const loadDefaultAndPopularIcons = async () => {
      try {
        // Load default icon
        const icon = await iconService.getIcon('building');
        setDefaultIcon(icon);
        setCurrentIcon(icon);
        
        // Load popular icons immediately
        const popularIconsData = await Promise.all(
          POPULAR_ICONS.map(async (iconName) => {
            const icon = await iconService.getIcon(iconName);
            return {
              name: iconName,
              icon: icon,
              keywords: [iconName]
            };
          })
        );
        
        setPopularIcons(popularIconsData);
        setDisplayedIcons(popularIconsData);
        setLoadedIconsCount(popularIconsData.length);
        setHasLoadedPopular(true);
        
        // Get total icons count without loading all icons
        const allIcons = await iconService.getAllIcons();
        setTotalIconsCount(allIcons.length);
        setAllIconsMetadata(allIcons);
      } catch (error) {
        console.error('Error loading default and popular icons:', error);
      }
    };
    loadDefaultAndPopularIcons();
  }, []);

  // Handle scroll to load more icons
  const handleScroll = useCallback(async () => {
    if (!scrollContainerRef.current || loadingMoreIcons || isSearching) return;
    
    const container = scrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Load more when user scrolls to within 200px of bottom
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      if (loadedIconsCount < totalIconsCount) {
        setLoadingMoreIcons(true);
        
        try {
          const startIndex = loadedIconsCount;
          const endIndex = Math.min(startIndex + ICONS_PER_PAGE, totalIconsCount);
          const iconsToLoad = allIconsMetadata.slice(startIndex, endIndex);
          
          // Load the actual icon data for this batch
          const loadedIconsData = await Promise.all(
            iconsToLoad.map(async (iconMeta) => {
              const icon = await iconService.getIcon(iconMeta.name);
              return {
                name: iconMeta.name,
                icon: icon,
                keywords: iconMeta.keywords
              };
            })
          );
          
          setDisplayedIcons(prev => [...prev, ...loadedIconsData]);
          setLoadedIconsCount(endIndex);
        } catch (error) {
          console.error('Error loading more icons:', error);
        } finally {
          setLoadingMoreIcons(false);
        }
      }
    }
  }, [loadedIconsCount, totalIconsCount, allIconsMetadata, loadingMoreIcons, isSearching]);

  // Handle icon search
  useEffect(() => {
    const searchIcons = async () => {
      if (!iconSearch.trim()) {
        // Reset to popular icons when search is cleared
        setIsSearching(false);
        setDisplayedIcons(popularIcons);
        setLoadedIconsCount(popularIcons.length);
        return;
      }

      setIsSearching(true);
      setLoadingIcons(true);
      try {
        const searchResults = await iconService.searchIcons(iconSearch);
        setDisplayedIcons(searchResults);
        setLoadedIconsCount(searchResults.length);
      } catch (error) {
        console.error('Error searching icons:', error);
        setDisplayedIcons([]);
        setLoadedIconsCount(0);
      } finally {
        setLoadingIcons(false);
      }
    };

    // Add a small delay to avoid searching on every keystroke
    const debounceTimer = setTimeout(searchIcons, 300);
    return () => clearTimeout(debounceTimer);
  }, [iconSearch, popularIcons]);

  const handleUpdateWorkspace = useCallback((updates: Partial<WorkspaceInfo>) => {
    onUpdateWorkspace(updates);
  }, [onUpdateWorkspace]);

  const handleSaveName = useCallback(() => {
    handleUpdateWorkspace({ name: tempName });
    setEditingName(false);
  }, [tempName, handleUpdateWorkspace]);

  const handleSaveDescription = useCallback(() => {
    handleUpdateWorkspace({ description: tempDescription });
    setEditingDescription(false);
  }, [tempDescription, handleUpdateWorkspace]);

  const handleSaveIcon = () => {
            handleUpdateWorkspace({ icon: tempIcon, color: tempIconColor });
    setEditingIcon(false);
    setShowIconDropdown(false);
    setShowColorPicker(false);
    setIconSearch('');
  };

  const handleCancelName = () => {
    setTempName(workspaceInfo?.name || '');
    setEditingName(false);
  };

  const handleCancelDescription = () => {
    setTempDescription(workspaceInfo?.description || '');
    setEditingDescription(false);
  };

  const handleCancelIcon = () => {
    setTempIcon(workspaceInfo?.icon || '');
    setTempIconColor(workspaceInfo?.color || '#374151');
    setEditingIcon(false);
    setShowIconDropdown(false);
    setShowColorPicker(false);
    setIconSearch('');
    setIsSearching(false);
    // Reset to popular icons when canceling
    setDisplayedIcons(popularIcons);
    setLoadedIconsCount(popularIcons.length);
  };

  const handleIconSelect = (iconName: string) => {
    setTempIcon(iconName);
    setShowIconDropdown(false);
    setShowColorPicker(true); // Show color picker after selecting icon
  };

  const handleColorSelect = (color: string) => {
    setTempIconColor(color);
    setShowColorPicker(false);
    handleUpdateWorkspace({ icon: tempIcon, color: color });
    setEditingIcon(false);
    setIconSearch('');
  };

  // Load current workspace icon
  useEffect(() => {
    const loadCurrentIcon = async () => {
      if (workspaceInfo?.icon) {
        try {
          const icon = await iconService.getIcon(workspaceInfo.icon);
          setCurrentIcon(icon);
        } catch (error) {
          console.error('Error loading current icon:', error);
          setCurrentIcon(defaultIcon);
        }
      }
    };

    if (defaultIcon) {
      loadCurrentIcon();
    }
  }, [workspaceInfo?.icon, defaultIcon]);

  // Load temp icon when it changes
  useEffect(() => {
    const loadTempIcon = async () => {
      if (tempIcon) {
        try {
          const icon = await iconService.getIcon(tempIcon);
          setCurrentIcon(icon);
        } catch (error) {
          console.error('Error loading temp icon:', error);
          setCurrentIcon(defaultIcon);
        }
      }
    };

    if (editingIcon && defaultIcon) {
      loadTempIcon();
    }
  }, [tempIcon, editingIcon, defaultIcon]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        handleCancelIcon();
      }
    };

    if (showIconDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIconDropdown]);

  // Update temp values when workspaceInfo changes
  useEffect(() => {
    setTempName(workspaceInfo?.name || '');
    setTempDescription(workspaceInfo?.description || '')
    setTempIcon(workspaceInfo?.icon || '');
    setTempIconColor(workspaceInfo?.color || '#374151');
  }, [workspaceInfo]);

  // Handle click outside for name editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (nameEditRef.current && !nameEditRef.current.contains(event.target as Node)) {
        if (editingName) {
          handleSaveName();
        }
      }
    };

    if (editingName) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingName, handleSaveName]);

  // Handle click outside for description editing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (descriptionEditRef.current && !descriptionEditRef.current.contains(event.target as Node)) {
        if (editingDescription) {
          handleSaveDescription();
        }
      }
    };

    if (editingDescription) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editingDescription, handleSaveDescription]);

  // Handle workspace deletion with confirmation
  const handleDeleteWorkspace = useCallback(async () => {
    if (!workspaceId) return;
    
    setIsDeleting(true);
    try {
      await dispatch(removeWorkspaceAsync(workspaceId)).unwrap();
      setShowDeleteDialog(false);
      // Navigate to home or workspace list after successful deletion
      navigate('/tasks'); // or wherever you want to redirect after deletion
    } catch (error) {
      console.error('Failed to delete workspace:', error);
      // Error is handled by the slice and will show in UI
    } finally {
      setIsDeleting(false);
    }
  }, [workspaceId, dispatch, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <i className="fas fa-spinner fa-pulse fa-2x"></i>
      </div>
    );
  }

  if (!workspaceOverview) {
    return (
      <div className="text-center text-muted-foreground">
        Failed to load workspace overview
      </div>
    );
  }

  // Don't render until default icon is loaded
  if (!defaultIcon) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Simplified Workspace Info Section */}
      <Card className="py-3">
        <CardContent className="py-3">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-4 flex-1">
              {/* Icon editing */}
              <div className="relative group" ref={dropdownRef}>
              {editingIcon ? (
                <div className="relative">
                  <div
                    className="w-16 h-16 border border-input bg-background hover:bg-accent rounded-lg cursor-pointer flex items-center justify-center relative transition-colors"
                    onClick={() => setShowIconDropdown(!showIconDropdown)}
                  >
                    <FontAwesomeIcon 
                      icon={currentIcon || defaultIcon} 
                      style={{ color: tempIconColor, fontSize: '2.25rem' }}
                    />
                    <ChevronDown className="w-3 h-3 absolute bottom-1 right-1" />
                  </div>
                  
                  {showIconDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-96 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
                      <div className="p-3">
                        <Input
                          placeholder="Search icons... (e.g., heart, user, star)"
                          value={iconSearch}
                          onChange={(e) => setIconSearch(e.target.value)}
                          className="mb-3"
                          autoFocus
                        />
                        <div className="text-xs text-muted-foreground mb-2">
                          {loadingIcons ? 'Searching icons...' : 
                           isSearching ? 
                             `${displayedIcons.length} icons found for "${iconSearch}"` :
                             `${displayedIcons.length} popular icons • ${totalIconsCount} total icons available`}
                        </div>
                        <div 
                          ref={scrollContainerRef}
                          className="grid grid-cols-10 gap-1 overflow-y-auto pr-2"
                          style={{ 
                            height: (() => {
                              // Calculate number of rows needed
                              const iconsPerRow = 10;
                              const totalRows = Math.ceil(displayedIcons.length / iconsPerRow);
                              const iconHeight = 32; // w-8 h-8 = 32px
                              const gapSize = 4; // gap-1 = 4px
                              const calculatedHeight = totalRows * iconHeight + Math.max(0, totalRows - 1) * gapSize;
                              
                              // Use calculated height for small grids, fixed height for large grids
                              if (displayedIcons.length > 50 || (!isSearching && loadedIconsCount > 50)) {
                                return '240px';
                              } else if (totalRows <= 3) {
                                // For 3 rows or less, use exact calculated height
                                return `${calculatedHeight}px`;
                              } else {
                                // For more than 3 rows but less than 50 icons, use auto with max
                                return 'auto';
                              }
                            })(),
                            maxHeight: '240px',
                            minHeight: (() => {
                              // Only set minHeight when there are actually many icons
                              if (displayedIcons.length > 50 || (!isSearching && loadedIconsCount > 50)) {
                                return '240px';
                              }
                              return 'auto';
                            })()
                          }}
                          onScroll={handleScroll}
                        >
                          {loadingIcons ? (
                            <div className="col-span-10 text-center py-4">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                            </div>
                          ) : (
                            <>
                              {displayedIcons.map((item, index) => (
                                <button
                                  key={`${item.name}-${index}`}
                                  onClick={() => handleIconSelect(item.name)}
                                  className="w-8 h-8 text-sm hover:bg-accent rounded-md transition-colors flex items-center justify-center"
                                  title={item.name}
                                >
                                  <FontAwesomeIcon icon={item.icon} />
                                </button>
                              ))}
                              {loadingMoreIcons && (
                                <div className="col-span-10 text-center py-2">
                                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                        {!loadingIcons && !isSearching && loadedIconsCount < totalIconsCount && (
                          <div className="text-xs text-muted-foreground mt-2 text-center">
                            Scroll down to load more icons ({loadedIconsCount} of {totalIconsCount} loaded)
                          </div>
                        )}
                        {!loadingIcons && displayedIcons.length === 0 && (
                          <div className="text-center text-muted-foreground py-4">
                            {iconSearch.trim() ? 'No icons found. Try different search terms.' : 'No popular icons available.'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {showColorPicker && (
                    <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-50">
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-medium">Choose Icon Color</span>
                          <div className="flex items-center space-x-2">
                            <FontAwesomeIcon 
                              icon={currentIcon || defaultIcon} 
                              style={{ color: tempIconColor, fontSize: '2.25rem' }}
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          {/* Color Input */}
                          <div className="flex items-center space-x-2">
                            <input
                              type="color"
                              value={tempIconColor}
                              onChange={(e) => setTempIconColor(e.target.value)}
                              className="w-8 h-8 border rounded cursor-pointer"
                            />
                            <Input
                              type="text"
                              value={tempIconColor}
                              onChange={(e) => setTempIconColor(e.target.value)}
                              placeholder="#000000"
                              className="text-sm"
                            />
                          </div>

                          {/* Preset Colors */}
                          <div>
                            <div className="text-xs text-muted-foreground mb-2">Common Colors</div>
                            <div className="grid grid-cols-11 gap-1">
                              {COMMON_COLORS.map((color) => (
                                <button
                                  key={color}
                                  onClick={() => setTempIconColor(color)}
                                  className={`w-6 h-6 rounded border-2 transition-all hover:scale-110 ${
                                    tempIconColor === color ? 'border-blue-500' : 'border-gray-300'
                                  }`}
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 p-3 border-t">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => handleColorSelect(tempIconColor)}
                          className="h-8 px-3"
                        >
                          Apply Color
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={handleCancelIcon}
                          className="h-8 w-8 p-0"
                        >
                          <X className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end space-x-2 mt-2">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handleSaveIcon}
                      className="h-8 w-8 p-0"
                    >
                      <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={handleCancelIcon}
                      className="h-8 w-8 p-0"
                    >
                      <X className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="text-4xl cursor-pointer hover:bg-accent rounded-lg p-2 transition-colors"
                  onClick={() => {
                    setTempIcon(workspaceInfo?.icon || '');
                    setTempIconColor(workspaceInfo?.color || '#374151');
                    setEditingIcon(true);
                    setShowIconDropdown(true);
                  }}
                >
                  <FontAwesomeIcon 
                    icon={currentIcon || defaultIcon} 
                    style={{ color: workspaceInfo?.color || '#374151' }}
                  />
                </div>
              )}
            </div>

            {/* Name editing */}
            <div className="flex-1">
              {editingName ? (
                <div className="flex items-center space-x-2 h-10" ref={nameEditRef}>
                  <Input
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    placeholder="Enter workspace name"
                    className="font-semibold text-lg flex-1 h-10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelName();
                    }}
                    autoFocus
                  />
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleSaveName}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleCancelName}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <h3 
                  className="font-semibold text-lg cursor-pointer border-2 border-transparent hover:border-gray-300 hover:bg-background hover:shadow-sm rounded-md px-3 transition-all duration-200 flex items-center h-10"
                  style={{ width: 'calc(100% - 80px)' }}
                  onClick={() => {
                    setTempName(workspaceInfo?.name || '');
                    setEditingName(true);
                  }}
                >
                  {workspaceInfo?.name}
                </h3>
              )}
              
              {/* Description editing - separate section */}
              {editingDescription ? (
                <div className="flex items-center space-x-2 h-10" ref={descriptionEditRef}>
                  <Input
                    value={tempDescription}
                    onChange={(e) => setTempDescription(e.target.value)}
                    placeholder="Enter workspace description"
                    className="text-sm text-muted-foreground flex-1 h-10"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveDescription();
                      if (e.key === 'Escape') handleCancelDescription();
                    }}
                    autoFocus
                  />
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleSaveDescription}
                    className="h-8 w-8 p-0"
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={handleCancelDescription}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              ) : (
                <p 
                  className="text-muted-foreground text-sm cursor-pointer border-2 border-transparent hover:border-gray-300 hover:bg-background hover:shadow-sm rounded-md px-3 transition-all duration-200 flex items-center h-10"
                  style={{ width: 'calc(100% - 80px)' }}
                  onClick={() => {
                    setTempDescription(workspaceInfo?.description || '');
                    setEditingDescription(true);
                  }}
                >
                  {workspaceInfo?.description || `Main development workspace for ${workspaceInfo?.name}`}
                </p>
              )}
            </div>
            </div>

            {/* Delete Button */}
            <div className="flex-shrink-0">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => !isDefaultWorkspace && setShowDeleteDialog(true)}
                        disabled={isDefaultWorkspace}
                        className={`h-10 w-10 p-0 ${
                          isDefaultWorkspace 
                            ? 'text-muted-foreground cursor-not-allowed' 
                            : 'text-destructive hover:text-destructive hover:bg-destructive/10'
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isDefaultWorkspace 
                      ? "Default workspaces cannot be deleted. They are removed when their category is deleted." 
                      : "Delete Workspace"
                    }
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Users Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaceTeamDetails.length > 0 ? 'N/A' : '0'}</div>
            <p className="text-xs text-muted-foreground">
              {workspaceTeamDetails.length > 0 ? 'User count not available' : 'No teams assigned'}
            </p>
          </CardContent>
        </Card>

        {/* Teams Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Teams</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaceTeamDetails.length}</div>
            <p className="text-xs text-muted-foreground">
              Teams with access
            </p>
          </CardContent>
        </Card>

        {/* Categories Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workspaceOverview.categories.length}</div>
            <p className="text-xs text-muted-foreground">
              Active categories
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Teams List */}
      <Card className="md:col-span-2 lg:col-span-3">
        <CardHeader>
          <CardTitle>Teams</CardTitle>
          <CardDescription>
            Teams that have access to this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workspaceTeamDetails.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                No teams assigned to this workspace
              </div>
            ) : (
              workspaceTeamDetails.map((team) => (
                <div 
                  key={team.id} 
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  onClick={() => onTeamClick(team.name)}
                >
                  <div className="flex items-center space-x-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center font-medium text-white"
                      style={{ backgroundColor: team.color || '#374151' }}
                    >
                      {team.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-medium">{team.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {team.description || 'No description'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(team.created_at).toLocaleDateString()}
                      </p>
                      {team.updated_at && (
                        <p className="text-xs text-muted-foreground">
                          Updated: {new Date(team.updated_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge 
                      variant="secondary" 
                      style={{ 
                        backgroundColor: team.color ? `${team.color}20` : undefined,
                        color: team.color || undefined 
                      }}
                    >
                      Team
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Categories List */}
      <Card className="md:col-span-2 lg:col-span-3 mb-6">
        <CardHeader>
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            Categories owned by this workspace - tasks created with these categories will be sent to this workspace
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {workspaceOverview.categories.map((category) => (
              <Badge key={category} variant="outline" className="text-sm">
                {category}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{workspaceInfo?.name}"? This action cannot be undone.
              All data associated with this workspace will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWorkspace}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Workspace
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default OverviewTab; 