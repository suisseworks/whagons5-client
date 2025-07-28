import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { iconService } from '@/database/iconService';
import { ChevronDown } from "lucide-react";
import { 
  faTags, 
  faArrowLeft,
  faPlus,
  faEdit,
  faTrash,
  faSpinner,
  faBroom,
  faWrench,
  faSeedling,
  faTools,
  faHome,
  faCar,
  faUtensils,
  faLaptop,
  faBook
} from "@fortawesome/free-solid-svg-icons";
import { api } from '@/api/whagonsApi';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Popular icons list to show initially
const POPULAR_ICONS = [
  'building', 'briefcase', 'user', 'users', 'settings', 'home', 'folder',
  'file', 'star', 'heart', 'check', 'times', 'plus', 'minus', 'edit',
  'trash', 'search', 'filter', 'sort', 'calendar', 'clock', 'bell',
  'envelope', 'phone', 'map', 'tag', 'bookmark', 'share', 'link',
  'broom', 'wrench', 'seedling', 'tools', 'car', 'utensils', 'laptop', 'book'
];

const ICONS_PER_PAGE = 100;

// Custom cell renderer for category name with icon
const CategoryNameCellRenderer = (props: ICellRendererParams) => {
  const categoryIcon = props.data?.icon;
  const categoryColor = props.data?.color || '#6B7280';
  const categoryName = props.value;
  
  if (!categoryIcon) {
    return <span>{categoryName}</span>;
  }
  
  // Parse FontAwesome icon class (e.g., "fas fa-broom")
  const iconClasses = categoryIcon.split(' ');
  const iconName = iconClasses[iconClasses.length - 1]; // Get the last part (fa-broom)
  
  // Map common FontAwesome icons to their equivalents
  const iconMap: { [key: string]: any } = {
    'fa-broom': faBroom,
    'fa-wrench': faWrench,
    'fa-seedling': faSeedling,
    'fa-tools': faTools,
    'fa-home': faHome,
    'fa-car': faCar,
    'fa-utensils': faUtensils,
    'fa-laptop': faLaptop,
    'fa-book': faBook,
    'fa-tags': faTags,
  };
  
  const icon = iconMap[iconName] || faTags;
  
  return (
    <div className="flex items-center space-x-3 h-full">
      <FontAwesomeIcon 
        icon={icon} 
        className="w-4 h-4" 
        style={{ color: categoryColor }}
      />
      <span>{categoryName}</span>
    </div>
  );
};

// Custom cell renderer for enabled status
const EnabledCellRenderer = (props: ICellRendererParams) => {
  const isEnabled = props.value;
  
  return (
    <Badge 
      variant={isEnabled ? "default" : "secondary"} 
      className={isEnabled ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-gray-100 text-gray-800 hover:bg-gray-100"}
    >
      {isEnabled ? "Enabled" : "Disabled"}
    </Badge>
  );
};

// Custom cell renderer for actions
const ActionsCellRenderer = (props: ICellRendererParams) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`Edit category ${props.data.id}`);
    // TODO: Implement edit functionality
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`Delete category ${props.data.id}`);
    // TODO: Implement delete functionality
  };

  return (
    <div className="flex items-center space-x-2 h-full">
      <Button 
        size="sm" 
        variant="outline"
        onClick={handleEdit}
        className="p-1 h-7 w-7"
      >
        <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
      </Button>
      <Button 
        size="sm" 
        variant="destructive"
        onClick={handleDelete}
        className="p-1 h-7 w-7"
      >
        <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
      </Button>
    </div>
  );
};

function Categories() {
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact>(null);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [rowData, setRowData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: 'fas fa-tags',
    enabled: true,
    team_id: ''
  });

  // Icon search states
  const [iconSearch, setIconSearch] = useState('');
  const [showIconDropdown, setShowIconDropdown] = useState(false);
  const [displayedIcons, setDisplayedIcons] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [popularIcons, setPopularIcons] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [allIconsMetadata, setAllIconsMetadata] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [loadedIconsCount, setLoadedIconsCount] = useState(0);
  const [totalIconsCount, setTotalIconsCount] = useState(0);
  const [loadingIcons, setLoadingIcons] = useState(false);
  const [loadingMoreIcons, setLoadingMoreIcons] = useState(false);
  const [currentFormIcon, setCurrentFormIcon] = useState<any>(null);
  const [defaultIcon, setDefaultIcon] = useState<any>(null);
  const [hasLoadedPopular, setHasLoadedPopular] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const iconDropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Teams state
  const [teams, setTeams] = useState<any[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);

  // Column definitions for AG Grid (using useMemo to access teams state)
  const colDefs = useMemo<ColDef[]>(() => [
    { 
      field: 'name', 
      headerName: 'Category Name',
      flex: 2,
      minWidth: 150,
      cellRenderer: CategoryNameCellRenderer
    },
    { 
      field: 'description', 
      headerName: 'Description',
      flex: 2,
      minWidth: 150
    },
    { 
      field: 'team_id', 
      headerName: 'Team',
      width: 120,
      cellRenderer: (params: ICellRendererParams) => {
        const teamId = params.value;
        
        if (!teamId) {
          return <span className="text-muted-foreground">No Team</span>;
        }
        
        const team = teams.find((t: any) => t.id === teamId);
        
        return (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
              {team?.name ? team.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <span>{team?.name || `Team ${teamId}`}</span>
          </div>
        );
      },
      sortable: true,
      filter: true
    },
    { 
      field: 'enabled', 
      headerName: 'Status',
      width: 100,
      cellRenderer: EnabledCellRenderer,
      sortable: true,
      filter: true
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [teams]);

  // Load categories from API
  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await api.get('/categories');
      
      if (res.data && Array.isArray(res.data)) {
        setCategories(res.data);
        setRowData(res.data);
      } else {
        // Handle case where API returns different structure
        const categoriesData = res.data.categories || res.data.data || [];
        setCategories(categoriesData);
        setRowData(categoriesData);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      setError('Failed to load categories');
      // Fallback to empty array
      setCategories([]);
      setRowData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load categories on component mount
  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Load teams from API
  const loadTeams = useCallback(async () => {
    try {
      setLoadingTeams(true);
      const res = await api.get('/teams');
      
      if (res.data && Array.isArray(res.data)) {
        setTeams(res.data);
      } else {
        // Handle case where API returns different structure
        const teamsData = res.data.teams || res.data.data || [];
        setTeams(teamsData);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  }, []);

  // Load teams on component mount
  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Load default icon and popular icons
  useEffect(() => {
    const loadDefaultAndPopularIcons = async () => {
      try {
        // Load default icon
        const icon = await iconService.getIcon('tags');
        setDefaultIcon(icon);
        setCurrentFormIcon(icon);
        
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
  const handleIconScroll = useCallback(async () => {
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

  // Create new category via API
  const createCategory = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      const res = await api.post('/categories', formData);
      
      if (res.data) {
        // Refresh the categories list
        await loadCategories();
        // Reset form and close dialog
        setFormData({
          name: '',
          description: '',
          color: '#4ECDC4',
          icon: 'fas fa-tags',
          enabled: true,
          team_id: ''
        });
        setIsCreateDialogOpen(false);
      }
    } catch (error) {
      console.error('Error creating category:', error);
      setError('Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCategory = () => {
    // Reset form data and clear errors when opening dialog
    setFormData({
      name: '',
      description: '',
      color: '#4ECDC4',
      icon: 'fas fa-tags',
      enabled: true,
      team_id: ''
    });
    setError(null);
    // Reset icon search state
    setIconSearch('');
    setShowIconDropdown(false);
    setIsSearching(false);
    setDisplayedIcons(popularIcons);
    setLoadedIconsCount(popularIcons.length);
    // Reset form icon to default
    setCurrentFormIcon(defaultIcon);
  };

  const handleIconSelect = (iconName: string) => {
    setFormData({ ...formData, icon: `fas fa-${iconName}` });
    setShowIconDropdown(false);
    setIconSearch('');
    // Update the form icon for preview
    iconService.getIcon(iconName).then(icon => {
      setCurrentFormIcon(icon);
    }).catch(error => {
      console.error('Error loading selected icon:', error);
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconDropdownRef.current && !iconDropdownRef.current.contains(event.target as Node)) {
        setShowIconDropdown(false);
        setIconSearch('');
      }
    };

    if (showIconDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIconDropdown]);

  // Update form icon when formData.icon changes
  useEffect(() => {
    const updateFormIcon = async () => {
      if (formData.icon) {
        try {
          // Extract icon name from fas fa-* format
          const iconName = formData.icon.replace('fas fa-', '');
          const icon = await iconService.getIcon(iconName);
          setCurrentFormIcon(icon);
        } catch (error) {
          console.error('Error loading form icon:', error);
          setCurrentFormIcon(defaultIcon);
        }
      }
    };

    if (defaultIcon) {
      updateFormIcon();
    }
  }, [formData.icon, defaultIcon]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name.trim() && formData.description.trim()) {
      createCategory();
    }
  };

  const handleBackClick = () => {
    navigate('/settings');
  };

  const handleSearch = (value: string) => {
    const lowerCaseValue = value.toLowerCase();
    if (lowerCaseValue === '') {
      setRowData(categories);
    } else {
      const filteredData = categories.filter((category) => {
        const enabledText = category.enabled ? 'enabled active' : 'disabled inactive';
        const team = teams.find(t => t.id === category.team_id);
        const teamText = team ? team.name.toLowerCase() : (category.team_id ? `team ${category.team_id}` : 'no team');
        
        return category.name?.toLowerCase().includes(lowerCaseValue) ||
               category.description?.toLowerCase().includes(lowerCaseValue) ||
               enabledText.includes(lowerCaseValue) ||
               teamText.includes(lowerCaseValue);
      });
      setRowData(filteredData);
    }
  };

  const onGridReady = useCallback(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit();
    }
  }, []);

  // Handle window resize
  useEffect(() => {
    const handleWindowResize = () => {
      if (gridRef.current?.api) {
        gridRef.current.api.sizeColumnsToFit();
      }
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <button 
              onClick={handleBackClick}
              className="flex items-center space-x-1 hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
              <span>Settings</span>
            </button>
            <span>»</span>
            <span className="text-foreground">Categories</span>
          </nav>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faTags} className="text-red-500 text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          </div>
        </div>
        <Separator />
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
            <span>Loading categories...</span>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div className="space-y-2">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <button 
              onClick={handleBackClick}
              className="flex items-center space-x-1 hover:text-foreground transition-colors"
            >
              <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
              <span>Settings</span>
            </button>
            <span>»</span>
            <span className="text-foreground">Categories</span>
          </nav>
          <div className="flex items-center space-x-3">
            <FontAwesomeIcon icon={faTags} className="text-red-500 text-2xl" />
            <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          </div>
        </div>
        <Separator />
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={loadCategories} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
          <button 
            onClick={handleBackClick}
            className="flex items-center space-x-1 hover:text-foreground transition-colors"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
            <span>Settings</span>
          </button>
          <span>»</span>
          <span className="text-foreground">Categories</span>
        </nav>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <FontAwesomeIcon icon={faTags} className="text-red-500 text-2xl" />
              <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
            </div>
            <p className="text-muted-foreground">
              Manage task categories and labels for better organization
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleAddCategory} className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                <span>Add Category</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Category</DialogTitle>
                <DialogDescription>
                  Add a new category to organize your tasks.
                </DialogDescription>
              </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="description" className="text-right">
                    Description
                  </Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="color" className="text-right">
                    Color
                  </Label>
                  <Input
                    type="color"
                    id="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="icon" className="text-right">
                    Icon
                  </Label>
                  <div className="col-span-3 relative" ref={iconDropdownRef}>
                    <div
                      className="flex items-center justify-between w-full px-3 py-2 border border-input bg-background rounded-md cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setShowIconDropdown(!showIconDropdown)}
                    >
                      <div className="flex items-center space-x-2">
                        <FontAwesomeIcon 
                          icon={currentFormIcon || defaultIcon} 
                          className="w-4 h-4" 
                          style={{ color: formData.color }}
                        />
                        <span className="text-sm">{formData.icon.replace('fas fa-', '')}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
                            onScroll={handleIconScroll}
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
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="team" className="text-right">
                    Team
                  </Label>
                  <select
                    id="team"
                    value={formData.team_id}
                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  >
                    <option value="">No Team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="enabled" className="text-right">
                    Status
                  </Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="enabled" className="text-sm">
                      {formData.enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                </div>
                {/* Preview */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Preview</Label>
                  <div className="col-span-3 flex items-center space-x-3 p-2 border rounded">
                    <FontAwesomeIcon 
                      icon={currentFormIcon || defaultIcon} 
                      className="w-4 h-4" 
                      style={{ color: formData.color }}
                    />
                    <span>{formData.name || 'Category Name'}</span>
                    {formData.team_id && (
                      <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                          {teams.find(t => t.id === parseInt(formData.team_id))?.name?.charAt(0).toUpperCase() || 'T'}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {teams.find(t => t.id === parseInt(formData.team_id))?.name || `Team ${formData.team_id}`}
                        </span>
                      </div>
                    )}
                    <Badge 
                      variant={formData.enabled ? "default" : "secondary"} 
                      className={formData.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                    >
                      {formData.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </div>
              <DialogFooter>
                {error && (
                  <div className="text-sm text-destructive mb-2 text-left">
                    {error}
                  </div>
                )}
                <Button type="submit" disabled={isSubmitting || !formData.name.trim()}>
                  {isSubmitting ? (
                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                  ) : (
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                  )}
                  {isSubmitting ? 'Adding...' : 'Add Category'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <Separator />

    {/* Search and Grid */}
    <div className="space-y-4">
      <Input
        placeholder="Search categories..."
        className="w-full max-w-md"
        onChange={(e) => handleSearch(e.target.value)}
      />
      
      <div className="ag-theme-quartz h-[400px] w-full">
        <AgGridReact
          ref={gridRef}
          rowData={rowData}
          columnDefs={colDefs}
          onGridReady={onGridReady}
          suppressColumnVirtualisation={true}
          animateRows={true}
          rowHeight={50}
          headerHeight={40}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true
          }}
          noRowsOverlayComponent={() => (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">No categories found</p>
            </div>
          )}
        />
      </div>
    </div>

    <Separator />

    {/* Stats Section */}
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Category Statistics</CardTitle>
        <CardDescription>Overview of your category usage</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold">{categories.length}</div>
            <div className="text-sm text-muted-foreground">Total Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {categories.filter(cat => cat.enabled).length}
            </div>
            <div className="text-sm text-muted-foreground">Enabled Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {categories.filter(cat => !cat.enabled).length}
            </div>
            <div className="text-sm text-muted-foreground">Disabled Categories</div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);
}

export default Categories;