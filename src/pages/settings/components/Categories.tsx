import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import SettingsHeader from "@/components/SettingsHeader";
import { useSelector, useDispatch } from "react-redux";
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
  faBook,
  faCubes
} from "@fortawesome/free-solid-svg-icons";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from '@/store/genericSlices';
import { Category, Task, Team } from "@/store/types";

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
const ActionsCellRenderer = (props: ICellRendererParams & { onEdit: (category: Category) => void; onDelete: (category: Category) => void; onManageFields: (category: Category) => void }) => {
  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onEdit(props.data);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onDelete(props.data);
  };

  const handleManageFields = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onManageFields(props.data);
  };

  return (
    <div className="flex items-center space-x-2 h-full">
      <Button 
        size="sm" 
        variant="outline"
        onClick={handleManageFields}
        className="p-1 h-7"
      >
        <FontAwesomeIcon icon={faCubes} className="w-3 h-3 mr-1" />
        Fields
      </Button>
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
  const dispatch = useDispatch<AppDispatch>();
  const gridRef = useRef<AgGridReact>(null);
  
  // Redux state
  const { value: categories, loading, error } = useSelector((state: RootState) => state.categories) as { value: Category[]; loading: boolean; error: string | null };
  const { value: teams } = useSelector((state: RootState) => state.teams) as { value: Team[] };
  const { value: tasks } = useSelector((state: RootState) => state.tasks) as { value: Task[] };
  const { value: customFields } = useSelector((state: RootState) => state.customFields) as { value: any[] };
  const { value: categoryFieldAssignments } = useSelector((state: RootState) => state.categoryFieldAssignments) as { value: any[] };
  
  const [rowData, setRowData] = useState<Category[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: 'fas fa-tags',
    enabled: true,
    team_id: '',
    workspace_id: 1, // You might want to get this from context or props
    sla_id: 1 // You might want to get this from context or props
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: '#4ECDC4',
    icon: 'fas fa-tags',
    enabled: true,
    team_id: '',
    workspace_id: 1,
    sla_id: 1
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
  // Manage Fields dialog state
  const [isFieldsDialogOpen, setIsFieldsDialogOpen] = useState(false);
  const [fieldsCategory, setFieldsCategory] = useState<Category | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [newFieldId, setNewFieldId] = useState<string>("");

  type CategoryFieldAssignment = { id: number; field_id: number; category_id: number; is_required: boolean; order: number; default_value: string | null; updated_at?: string };
  type CustomField = { id: number; name: string; field_type: string; options?: any; validation_rules?: any; updated_at?: string };

  const assignmentCountByCategory = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    (categoryFieldAssignments as CategoryFieldAssignment[]).forEach((a) => {
      map[a.category_id] = (map[a.category_id] || 0) + 1;
    });
    return map;
  }, [categoryFieldAssignments]);

  const openManageFields = useCallback(async (category: Category) => {
    setFieldsCategory(category);
    setIsFieldsDialogOpen(true);
    // Load reference data
    try {
      await Promise.all([
        dispatch(genericActions.customFields.getFromIndexedDB()),
        dispatch(genericActions.categoryFieldAssignments.getFromIndexedDB()),
      ]);
      await Promise.all([
        dispatch(genericActions.customFields.fetchFromAPI() as any),
        dispatch(genericActions.categoryFieldAssignments.fetchFromAPI({ category_id: category.id }) as any),
      ]);
    } catch (e) {
      console.error('Error loading fields/assignments', e);
    }
  }, [dispatch]);

  const closeManageFields = () => {
    setIsFieldsDialogOpen(false);
    setFieldsCategory(null);
    setNewFieldId("");
  };

  const currentAssignments = useMemo(() => {
    if (!fieldsCategory) return [] as CategoryFieldAssignment[];
    return (categoryFieldAssignments as CategoryFieldAssignment[])
      .filter(a => a.category_id === fieldsCategory.id)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [categoryFieldAssignments, fieldsCategory]);

  const assignedFieldIds = useMemo(() => new Set(currentAssignments.map(a => a.field_id)), [currentAssignments]);
  const availableFields = useMemo(() => {
    return (customFields as CustomField[]).filter(f => !assignedFieldIds.has(f.id));
  }, [customFields, assignedFieldIds]);

  const addAssignment = async () => {
    if (!fieldsCategory || !newFieldId) return;
    setAssignSubmitting(true);
    try {
      const nextOrder = currentAssignments.length > 0 ? Math.max(...currentAssignments.map(a => a.order || 0)) + 1 : 0;
      await dispatch(genericActions.categoryFieldAssignments.addAsync({
        field_id: parseInt(newFieldId, 10),
        category_id: fieldsCategory.id,
        is_required: false,
        order: nextOrder,
        default_value: null,
      } as any)).unwrap();
      setNewFieldId("");
    } catch (e) {
      console.error('Error adding assignment', e);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const removeAssignment = async (assignment: CategoryFieldAssignment) => {
    setAssignSubmitting(true);
    try {
      await dispatch(genericActions.categoryFieldAssignments.removeAsync(assignment.id)).unwrap();
    } catch (e) {
      console.error('Error removing assignment', e);
    } finally {
      setAssignSubmitting(false);
    }
  };

  const updateAssignment = async (assignmentId: number, updates: Partial<CategoryFieldAssignment>) => {
    try {
      await dispatch(genericActions.categoryFieldAssignments.updateAsync({ id: assignmentId, updates } as any)).unwrap();
    } catch (e) {
      console.error('Error updating assignment', e);
    }
  };

  const reorderAssignments = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= currentAssignments.length) return;
    const reordered = [...currentAssignments];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    for (let i = 0; i < reordered.length; i++) {
      const a = reordered[i];
      const desired = i;
      if ((a.order ?? i) !== desired) {
        updateAssignment(a.id, { order: desired } as any);
      }
    }
  };

  // Helpers to render default value editor by field type
  const coerceBoolean = (v: any): boolean => {
    if (typeof v === 'boolean') return v;
    if (v == null) return false;
    const s = String(v).toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'y';
  };

  const parseFieldOptions = (f?: CustomField): Array<{ value: string; label: string }> => {
    if (!f) return [];
    const raw = (f as any).options;
    try {
      if (Array.isArray(raw)) {
        return raw.map((o: any) => {
          if (typeof o === 'string') return { value: o, label: o };
          if (o && typeof o === 'object') {
            const val = String(o.value ?? o.id ?? o.name ?? '');
            const lab = String(o.label ?? o.name ?? val);
            return { value: val, label: lab };
          }
          return { value: String(o), label: String(o) };
        });
      }
      if (typeof raw === 'string' && raw.trim().length) {
        // Try JSON first
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            return parsed.map((o: any) => {
              if (typeof o === 'string') return { value: o, label: o };
              const val = String(o.value ?? o.id ?? o.name ?? '');
              const lab = String(o.label ?? o.name ?? val);
              return { value: val, label: lab };
            });
          }
        } catch {}
        // Fallback: comma-separated
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        return parts.map(s => ({ value: s, label: s }));
      }
    } catch {}
    return [];
  };

  const parseMultiDefault = (val: string | null | undefined): string[] => {
    if (!val) return [];
    // Try JSON array, else comma-separated
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {}
    return String(val).split(',').map(s => s.trim()).filter(Boolean);
  };

  const renderDefaultValueEditor = (a: CategoryFieldAssignment, f?: CustomField) => {
    const type = (f?.field_type || '').toLowerCase();
    const onText = (v: string) => updateAssignment(a.id, { default_value: v } as any);
    if (type === 'checkbox') {
      const checked = coerceBoolean(a.default_value);
      return (
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => updateAssignment(a.id, { default_value: e.target.checked ? 'true' : 'false' } as any)}
          className="rounded"
        />
      );
    }
    if (type === 'select') {
      const opts = parseFieldOptions(f);
      return (
        <select
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          value={a.default_value ?? ''}
          onChange={(e) => onText(e.target.value)}
        >
          <option value="">—</option>
          {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    }
    if (type === 'multi_select') {
      const opts = parseFieldOptions(f);
      const selected = new Set(parseMultiDefault(a.default_value));
      const toggle = (val: string) => {
        const next = new Set(selected);
        if (next.has(val)) next.delete(val); else next.add(val);
        const arr = Array.from(next.values());
        onText(arr.join(','));
      };
      return (
        <div className="flex flex-wrap gap-2">
          {opts.map(o => (
            <label key={o.value} className="flex items-center space-x-1 text-xs border rounded px-2 py-1">
              <input type="checkbox" checked={selected.has(o.value)} onChange={() => toggle(o.value)} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      );
    }
    if (type === 'date') {
      return (
        <input
          type="date"
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          value={a.default_value ?? ''}
          onChange={(e) => onText(e.target.value)}
        />
      );
    }
    if (type === 'datetime' || type === 'datetime_local' || type === 'datetime-local') {
      return (
        <input
          type="datetime-local"
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          value={a.default_value ?? ''}
          onChange={(e) => onText(e.target.value)}
        />
      );
    }
    if (type === 'number') {
      return (
        <input
          type="number"
          className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
          value={a.default_value ?? ''}
          onChange={(e) => onText(e.target.value)}
        />
      );
    }
    // Fallback text
    return (
      <Input
        value={a.default_value ?? ''}
        onChange={(e) => onText(e.target.value)}
      />
    );
  };

  const [isSearching, setIsSearching] = useState(false);
  const iconDropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Edit dialog icon states
  const [editIconSearch, setEditIconSearch] = useState('');
  const [showEditIconDropdown, setShowEditIconDropdown] = useState(false);
  const [editDisplayedIcons, setEditDisplayedIcons] = useState<Array<{name: string, icon: any, keywords: string[]}>>([]);
  const [editLoadedIconsCount, setEditLoadedIconsCount] = useState(0);
  const [editLoadingIcons, setEditLoadingIcons] = useState(false);
  const [editLoadingMoreIcons, setEditLoadingMoreIcons] = useState(false);
  const [currentEditFormIcon, setCurrentEditFormIcon] = useState<any>(null);
  const [editIsSearching, setEditIsSearching] = useState(false);
  const editIconDropdownRef = useRef<HTMLDivElement>(null);
  const editScrollContainerRef = useRef<HTMLDivElement>(null);

  // Get task count for a category
  const getCategoryTaskCount = useCallback((categoryId: number) => {
    return tasks.filter((task: Task) => task.category_id === categoryId).length;
  }, [tasks]);

  // Handle delete category
  const handleDeleteCategory = useCallback((category: Category) => {
    setDeletingCategory(category);
    // Note: clearError not available in generic slices
    setIsDeleteDialogOpen(true);
  }, [dispatch]);

  // Handle close delete dialog
  const handleCloseDeleteDialog = () => {
    setIsDeleteDialogOpen(false);
    setDeletingCategory(null);
    // Note: clearError not available in generic slices
  };

  // Delete category with validation
  const deleteCategory = async () => {
    if (!deletingCategory) return;
    
    const taskCount = getCategoryTaskCount(deletingCategory.id);
    if (taskCount > 0) {
      // This should not happen as the dialog already shows the count
      // But adding extra validation just in case
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      await dispatch(genericActions.categories.removeAsync(deletingCategory.id)).unwrap();
      
      // Reset state and close dialog
      handleCloseDeleteDialog();
    } catch (error) {
      console.error('Error deleting category:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit category
  const handleEditCategory = useCallback((category: Category) => {
    setEditingCategory(category);
    setEditFormData({
      name: category.name,
      description: category.description || '',
      color: category.color || '#4ECDC4',
      icon: category.icon || 'fas fa-tags',
      enabled: category.enabled,
      team_id: category.team_id ? category.team_id.toString() : '',
      workspace_id: category.workspace_id,
      sla_id: category.sla_id
    });
    // Reset edit icon search state
    setEditIconSearch('');
    setShowEditIconDropdown(false);
    setEditIsSearching(false);
    setEditDisplayedIcons(popularIcons);
    setEditLoadedIconsCount(popularIcons.length);
    // Clear any existing errors
    // Note: clearError not available in generic slices
    setIsEditDialogOpen(true);
  }, [popularIcons, dispatch]);

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
      field: 'fields',
      headerName: 'Fields',
      width: 100,
      valueGetter: (params: any) => assignmentCountByCategory[params.data?.id] || 0,
      sortable: true,
      filter: true
    },
    { 
      field: 'team_id', 
      headerName: 'Team',
      width: 180,
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
      cellRenderer: (params: ICellRendererParams) => ActionsCellRenderer({...params, onEdit: handleEditCategory, onDelete: handleDeleteCategory, onManageFields: openManageFields}),
      sortable: false,
      filter: false,
      resizable: false,
      pinned: 'right'
    }
  ], [teams, handleEditCategory, handleDeleteCategory, assignmentCountByCategory, openManageFields]);

  // Removed on-mount IndexedDB loads; AuthProvider hydrates core slices

  // Update rowData when categories change
  useEffect(() => {
    setRowData(categories);
  }, [categories]);

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

  // Removed redundant createCategory/updateCategory wrappers; inline in submit handlers

  const handleAddCategory = () => {
    // Reset form data when opening dialog
    setFormData({
      name: '',
      description: '',
      color: '#4ECDC4',
      icon: 'fas fa-tags',
      enabled: true,
      team_id: '',
      workspace_id: 1,
      sla_id: 1
    });
    setFormError(null);
    // Reset icon search state
    setIconSearch('');
    setShowIconDropdown(false);
    setIsSearching(false);
    setDisplayedIcons(popularIcons);
    setLoadedIconsCount(popularIcons.length);
    // Reset form icon to default
    setCurrentFormIcon(defaultIcon);
    // Clear any existing errors
    // Note: clearError not available in generic slices
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

  const handleEditIconSelect = (iconName: string) => {
    setEditFormData({ ...editFormData, icon: `fas fa-${iconName}` });
    setShowEditIconDropdown(false);
    setEditIconSearch('');
    // Update the edit form icon for preview
    iconService.getIcon(iconName).then(icon => {
      setCurrentEditFormIcon(icon);
    }).catch(error => {
      console.error('Error loading selected edit icon:', error);
    });
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (iconDropdownRef.current && !iconDropdownRef.current.contains(event.target as Node)) {
        setShowIconDropdown(false);
        setIconSearch('');
      }
      if (editIconDropdownRef.current && !editIconDropdownRef.current.contains(event.target as Node)) {
        setShowEditIconDropdown(false);
        setEditIconSearch('');
      }
    };

    if (showIconDropdown || showEditIconDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showIconDropdown, showEditIconDropdown]);

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

  // Update edit form icon when editFormData.icon changes
  useEffect(() => {
    const updateEditFormIcon = async () => {
      if (editFormData.icon) {
        try {
          // Extract icon name from fas fa-* format
          const iconName = editFormData.icon.replace('fas fa-', '');
          const icon = await iconService.getIcon(iconName);
          setCurrentEditFormIcon(icon);
        } catch (error) {
          console.error('Error loading edit form icon:', error);
          setCurrentEditFormIcon(defaultIcon);
        }
      }
    };

    if (defaultIcon) {
      updateEditFormIcon();
    }
  }, [editFormData.icon, defaultIcon]);

  // Handle edit icon search
  useEffect(() => {
    const searchEditIcons = async () => {
      if (!editIconSearch.trim()) {
        // Reset to popular icons when search is cleared
        setEditIsSearching(false);
        setEditDisplayedIcons(popularIcons);
        setEditLoadedIconsCount(popularIcons.length);
        return;
      }

      setEditIsSearching(true);
      setEditLoadingIcons(true);
      try {
        const searchResults = await iconService.searchIcons(editIconSearch);
        setEditDisplayedIcons(searchResults);
        setEditLoadedIconsCount(searchResults.length);
      } catch (error) {
        console.error('Error searching edit icons:', error);
        setEditDisplayedIcons([]);
        setEditLoadedIconsCount(0);
      } finally {
        setEditLoadingIcons(false);
      }
    };

    // Add a small delay to avoid searching on every keystroke
    const debounceTimer = setTimeout(searchEditIcons, 300);
    return () => clearTimeout(debounceTimer);
  }, [editIconSearch, popularIcons]);

  // Handle edit icon scroll to load more icons
  const handleEditIconScroll = useCallback(async () => {
    if (!editScrollContainerRef.current || editLoadingMoreIcons || editIsSearching) return;
    
    const container = editScrollContainerRef.current;
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    // Load more when user scrolls to within 200px of bottom
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      if (editLoadedIconsCount < totalIconsCount) {
        setEditLoadingMoreIcons(true);
        
        try {
          const startIndex = editLoadedIconsCount;
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
          
          setEditDisplayedIcons(prev => [...prev, ...loadedIconsData]);
          setEditLoadedIconsCount(endIndex);
        } catch (error) {
          console.error('Error loading more edit icons:', error);
        } finally {
          setEditLoadingMoreIcons(false);
        }
      }
    }
  }, [editLoadedIconsCount, totalIconsCount, allIconsMetadata, editLoadingMoreIcons, editIsSearching]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    try {
      if (!formData.team_id) {
        setFormError('Please select a team for this category.');
        return;
      }
      setFormError(null);
      setIsSubmitting(true);
      const categoryData: Omit<Category, 'id' | 'created_at' | 'updated_at'> = {
        name: formData.name,
        description: formData.description,
        color: formData.color,
        icon: formData.icon,
        enabled: formData.enabled,
        team_id: parseInt(formData.team_id),
        workspace_id: formData.workspace_id,
        sla_id: formData.sla_id,
        deleted_at: null
      };
      await dispatch(genericActions.categories.addAsync(categoryData)).unwrap();
      setFormData({
        name: '',
        description: '',
        color: '#4ECDC4',
        icon: 'fas fa-tags',
        enabled: true,
        team_id: '',
        workspace_id: 1,
        sla_id: 1
      });
      setFormError(null);
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating category:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editFormData.name.trim() || !editingCategory) return;
    try {
      setIsSubmitting(true);
      const updates: Partial<Category> = {
        name: editFormData.name,
        description: editFormData.description,
        color: editFormData.color,
        icon: editFormData.icon,
        enabled: editFormData.enabled,
        team_id: editFormData.team_id ? parseInt(editFormData.team_id) : 0,
        workspace_id: editFormData.workspace_id,
        sla_id: editFormData.sla_id
      };
      await dispatch(genericActions.categories.updateAsync({ id: editingCategory.id, updates })).unwrap();
      setEditFormData({
        name: '',
        description: '',
        color: '#4ECDC4',
        icon: 'fas fa-tags',
        enabled: true,
        team_id: '',
        workspace_id: 1,
        sla_id: 1
      });
      setEditingCategory(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating category:', error);
    } finally {
      setIsSubmitting(false);
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
      const filteredData = categories.filter((category: Category) => {
        const enabledText = category.enabled ? 'enabled active' : 'disabled inactive';
        const team = teams.find((t: Team) => t.id === category.team_id);
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
      <div className="p-6 space-y-6 bg-[#f8fafc] min-h-screen">
        <SettingsHeader
          title="Categories"
          sectionLabel="Categories"
          subtitle="Manage task categories and labels for better organization"
          icon={<FontAwesomeIcon icon={faTags} className="text-2xl" style={{ color: '#10b981' }} />}
          onBack={handleBackClick}
        />
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
      <div className="p-6 space-y-6 bg-[#f8fafc] min-h-screen">
        <SettingsHeader
          title="Categories"
          sectionLabel="Categories"
          subtitle="Manage task categories and labels for better organization"
          icon={<FontAwesomeIcon icon={faTags} className="text-2xl" style={{ color: '#10b981' }} />}
          onBack={handleBackClick}
        />
        <Separator />
        <div className="flex flex-col items-center justify-center h-64 space-y-4">
          <p className="text-destructive">{error}</p>
          <Button onClick={() => dispatch(genericActions.categories.getFromIndexedDB())} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#f8fafc] min-h-screen">
      <SettingsHeader
        title="Categories"
        sectionLabel="Categories"
        subtitle="Manage task categories and labels for better organization"
        icon={<FontAwesomeIcon icon={faTags} className="text-2xl" style={{ color: '#10b981' }} />}
        onBack={handleBackClick}
        actions={(
          <>
            <Link to="/settings/categories/custom-fields">
              <Button variant="outline" className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#10b981]">Manage custom fields</Button>
            </Link>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleAddCategory} className="flex items-center space-x-2 font-semibold text-white bg-[linear-gradient(90deg,#ff6b35,#f59e0b)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#f59e0b]">
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
                                    const iconsPerRow = 10;
                                    const totalRows = Math.ceil(displayedIcons.length / iconsPerRow);
                                    const iconHeight = 32;
                                    const gapSize = 4;
                                    const calculatedHeight = totalRows * iconHeight + Math.max(0, totalRows - 1) * gapSize;
                                    if (displayedIcons.length > 50 || (!isSearching && loadedIconsCount > 50)) {
                                      return '240px';
                                    } else if (totalRows <= 3) {
                                      return `${calculatedHeight}px`;
                                    } else {
                                      return 'auto';
                                    }
                                  })(),
                                  maxHeight: '240px',
                                  minHeight: (() => {
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
                        {teams.map((team: Team) => (
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
                              {teams.find((t: Team) => t.id === parseInt(formData.team_id))?.name?.charAt(0).toUpperCase() || 'T'}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {teams.find((t: Team) => t.id === parseInt(formData.team_id))?.name || `Team ${formData.team_id}`}
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
                    {(formError || error) && (
                      <div className="text-sm text-destructive mb-2 text-left">
                        {formError || error}
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
          </>
        )}
      />
        {/* Edit Category Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Category</DialogTitle>
              <DialogDescription>
                Update the category information.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditFormSubmit} className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-name" className="text-right">
                    Name
                  </Label>
                  <Input
                    id="edit-name"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="col-span-3"
                    required
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-description" className="text-right">
                    Description
                  </Label>
                  <Input
                    id="edit-description"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-color" className="text-right">
                    Color
                  </Label>
                  <Input
                    type="color"
                    id="edit-color"
                    value={editFormData.color}
                    onChange={(e) => setEditFormData({ ...editFormData, color: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-icon" className="text-right">
                    Icon
                  </Label>
                  <div className="col-span-3 relative" ref={editIconDropdownRef}>
                    <div
                      className="flex items-center justify-between w-full px-3 py-2 border border-input bg-background rounded-md cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => setShowEditIconDropdown(!showEditIconDropdown)}
                    >
                      <div className="flex items-center space-x-2">
                        <FontAwesomeIcon 
                          icon={currentEditFormIcon || defaultIcon} 
                          className="w-4 h-4" 
                          style={{ color: editFormData.color }}
                        />
                        <span className="text-sm">{editFormData.icon.replace('fas fa-', '')}</span>
                      </div>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                    
                    {showEditIconDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-96 bg-white dark:bg-gray-800 border rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
                        <div className="p-3">
                          <Input
                            placeholder="Search icons... (e.g., heart, user, star)"
                            value={editIconSearch}
                            onChange={(e) => setEditIconSearch(e.target.value)}
                            className="mb-3"
                            autoFocus
                          />
                          <div className="text-xs text-muted-foreground mb-2">
                            {editLoadingIcons ? 'Searching icons...' : 
                             editIsSearching ? 
                               `${editDisplayedIcons.length} icons found for "${editIconSearch}"` :
                               `${editDisplayedIcons.length} popular icons • ${totalIconsCount} total icons available`}
                          </div>
                          <div 
                            ref={editScrollContainerRef}
                            className="grid grid-cols-10 gap-1 overflow-y-auto pr-2"
                            style={{ 
                              height: (() => {
                                // Calculate number of rows needed
                                const iconsPerRow = 10;
                                const totalRows = Math.ceil(editDisplayedIcons.length / iconsPerRow);
                                const iconHeight = 32; // w-8 h-8 = 32px
                                const gapSize = 4; // gap-1 = 4px
                                const calculatedHeight = totalRows * iconHeight + Math.max(0, totalRows - 1) * gapSize;
                                
                                // Use calculated height for small grids, fixed height for large grids
                                if (editDisplayedIcons.length > 50 || (!editIsSearching && editLoadedIconsCount > 50)) {
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
                                if (editDisplayedIcons.length > 50 || (!editIsSearching && editLoadedIconsCount > 50)) {
                                  return '240px';
                                }
                                return 'auto';
                              })()
                            }}
                            onScroll={handleEditIconScroll}
                          >
                            {editLoadingIcons ? (
                              <div className="col-span-10 text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                              </div>
                            ) : (
                              <>
                                {editDisplayedIcons.map((item, index) => (
                                  <button
                                    key={`edit-${item.name}-${index}`}
                                    onClick={() => handleEditIconSelect(item.name)}
                                    className="w-8 h-8 text-sm hover:bg-accent rounded-md transition-colors flex items-center justify-center"
                                    title={item.name}
                                  >
                                    <FontAwesomeIcon icon={item.icon} />
                                  </button>
                                ))}
                                {editLoadingMoreIcons && (
                                  <div className="col-span-10 text-center py-2">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {!editLoadingIcons && !editIsSearching && editLoadedIconsCount < totalIconsCount && (
                            <div className="text-xs text-muted-foreground mt-2 text-center">
                              Scroll down to load more icons ({editLoadedIconsCount} of {totalIconsCount} loaded)
                            </div>
                          )}
                          {!editLoadingIcons && editDisplayedIcons.length === 0 && (
                            <div className="text-center text-muted-foreground py-4">
                              {editIconSearch.trim() ? 'No icons found. Try different search terms.' : 'No popular icons available.'}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-team" className="text-right">
                    Team
                  </Label>
                  <select
                    id="edit-team"
                    value={editFormData.team_id}
                    onChange={(e) => setEditFormData({ ...editFormData, team_id: e.target.value })}
                    className="col-span-3 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  >
                    <option value="">No Team</option>
                    {teams.map((team: Team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="edit-enabled" className="text-right">
                    Status
                  </Label>
                  <div className="col-span-3 flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit-enabled"
                      checked={editFormData.enabled}
                      onChange={(e) => setEditFormData({ ...editFormData, enabled: e.target.checked })}
                      className="rounded"
                    />
                    <Label htmlFor="edit-enabled" className="text-sm">
                      {editFormData.enabled ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                </div>
                {/* Preview */}
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Preview</Label>
                  <div className="col-span-3 flex items-center space-x-3 p-2 border rounded">
                    <FontAwesomeIcon 
                      icon={currentEditFormIcon || defaultIcon} 
                      className="w-4 h-4" 
                      style={{ color: editFormData.color }}
                    />
                    <span>{editFormData.name || 'Category Name'}</span>
                    {editFormData.team_id && (
                      <div className="flex items-center space-x-1">
                        <div className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                          {teams.find((t: Team) => t.id === parseInt(editFormData.team_id))?.name?.charAt(0).toUpperCase() || 'T'}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {teams.find((t: Team) => t.id === parseInt(editFormData.team_id))?.name || `Team ${editFormData.team_id}`}
                        </span>
                      </div>
                    )}
                    <Badge 
                      variant={editFormData.enabled ? "default" : "secondary"} 
                      className={editFormData.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}
                    >
                      {editFormData.enabled ? "Enabled" : "Disabled"}
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
                <Button type="submit" disabled={isSubmitting || !editFormData.name.trim()}>
                  {isSubmitting ? (
                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                  ) : (
                    <FontAwesomeIcon icon={faEdit} className="mr-2" />
                  )}
                  {isSubmitting ? 'Updating...' : 'Update Category'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Manage Fields Dialog */}
        <Dialog open={isFieldsDialogOpen} onOpenChange={(open) => { if (!open) closeManageFields(); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Manage Fields{fieldsCategory ? ` • ${fieldsCategory.name}` : ''}</DialogTitle>
              <DialogDescription>
                Assign custom fields to this category and configure their requirements, defaults, and order.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <select
                  value={newFieldId}
                  onChange={(e) => setNewFieldId(e.target.value)}
                  className="px-3 py-2 border border-input bg-background rounded-md text-sm"
                >
                  <option value="">Select field to add</option>
                  {availableFields.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <Button onClick={addAssignment} disabled={!newFieldId || assignSubmitting}>
                  {assignSubmitting ? <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" /> : <FontAwesomeIcon icon={faPlus} className="mr-2" />}
                  Add Field
                </Button>
              </div>

              <div className="border rounded-md">
                <div className="grid grid-cols-12 gap-2 p-2 text-sm font-medium text-muted-foreground">
                  <div className="col-span-5">Field</div>
                  <div className="col-span-2">Required</div>
                  <div className="col-span-3">Default</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                <div className="divide-y">
                  {currentAssignments.map((a, idx) => {
                    const f = (customFields as CustomField[]).find(cf => cf.id === a.field_id);
                    return (
                      <div key={a.id} className="grid grid-cols-12 gap-2 items-center p-2">
                        <div className="col-span-5 truncate">
                          <div className="font-medium">{f?.name || `Field #${a.field_id}`}</div>
                          <div className="text-xs text-muted-foreground">{f?.field_type || ''}</div>
                        </div>
                        <div className="col-span-2">
                          <input
                            type="checkbox"
                            checked={!!a.is_required}
                            onChange={(e) => updateAssignment(a.id, { is_required: e.target.checked } as any)}
                            className="rounded"
                          />
                        </div>
                        <div className="col-span-3">
                          {renderDefaultValueEditor(a, f)}
                        </div>
                        <div className="col-span-2 flex items-center justify-end space-x-2">
                          <Button variant="outline" size="sm" onClick={() => reorderAssignments(idx, idx - 1)}>Up</Button>
                          <Button variant="outline" size="sm" onClick={() => reorderAssignments(idx, idx + 1)}>Down</Button>
                          <Button variant="destructive" size="sm" onClick={() => removeAssignment(a)}>
                            <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                  {currentAssignments.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">No fields assigned yet.</div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={closeManageFields}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Delete Category Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={handleCloseDeleteDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FontAwesomeIcon icon={faTrash} className="text-destructive" />
                <span>Delete Category</span>
              </DialogTitle>
              <DialogDescription>
                {deletingCategory && (() => {
                  const taskCount = getCategoryTaskCount(deletingCategory.id);
                  
                  if (taskCount > 0) {
                    return (
                      <div className="space-y-2">
                        <p>This category cannot be deleted because it contains {taskCount} task{taskCount !== 1 ? 's' : ''}.</p>
                        <p className="text-sm text-muted-foreground">
                          Please reassign or delete all tasks in this category before attempting to delete it.
                        </p>
                      </div>
                    );
                  } else {
                    return (
                      <div className="space-y-2">
                        <p>Are you sure you want to delete the category "{deletingCategory.name}"?</p>
                        <p className="text-sm text-muted-foreground">
                          This action cannot be undone.
                        </p>
                      </div>
                    );
                  }
                })()}
              </DialogDescription>
            </DialogHeader>
            
            {deletingCategory && (
              <div className="py-4">
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-3">
                    <FontAwesomeIcon 
                      icon={(() => {
                        // Parse FontAwesome icon class (e.g., "fas fa-broom")
                        const iconClasses = deletingCategory.icon?.split(' ');
                        const iconName = iconClasses?.[iconClasses.length - 1]; // Get the last part (fa-broom)
                        
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
                        
                        return iconMap[iconName] || faTags;
                      })()} 
                      className="w-5 h-5" 
                      style={{ color: deletingCategory.color }}
                    />
                    <div>
                      <div className="font-medium">{deletingCategory.name}</div>
                      <div className="text-sm text-muted-foreground">{deletingCategory.description}</div>
                      <div className="flex items-center space-x-2 mt-1">
                        {deletingCategory.team_id && (
                          <div className="flex items-center space-x-1">
                            <div className="w-4 h-4 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs font-medium">
                              {teams.find((t: Team) => t.id === deletingCategory.team_id)?.name?.charAt(0).toUpperCase() || 'T'}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {teams.find((t: Team) => t.id === deletingCategory.team_id)?.name || `Team ${deletingCategory.team_id}`}
                            </span>
                          </div>
                        )}
                        <Badge 
                          variant={deletingCategory.enabled ? "default" : "secondary"} 
                          className={`text-xs ${deletingCategory.enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                        >
                          {deletingCategory.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getCategoryTaskCount(deletingCategory.id)} task{getCategoryTaskCount(deletingCategory.id) !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              {error && (
                <div className="text-sm text-destructive mb-2 text-left">
                  {error}
                </div>
              )}
              <Button variant="outline" onClick={handleCloseDeleteDialog}>
                Cancel
              </Button>
              {deletingCategory && getCategoryTaskCount(deletingCategory.id) === 0 && (
                <Button 
                  variant="destructive" 
                  onClick={deleteCategory}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <FontAwesomeIcon icon={faSpinner} className="mr-2 animate-spin" />
                  ) : (
                    <FontAwesomeIcon icon={faTrash} className="mr-2" />
                  )}
                  {isSubmitting ? 'Deleting...' : 'Delete Category'}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                {categories.filter((cat: Category) => cat.enabled).length}
              </div>
              <div className="text-sm text-muted-foreground">Enabled Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">
                {categories.filter((cat: Category) => !cat.enabled).length}
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