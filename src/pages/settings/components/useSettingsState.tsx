import { useState, useCallback, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useSearchParams } from "react-router-dom";
import { RootState, AppDispatch } from "@/store/store";
import { genericActions } from '@/store/genericSlices';

export interface UseSettingsStateOptions<T> {
  entityName: keyof RootState;
  searchFields?: (keyof T)[];
  onError?: (error: string) => void;
}

export interface UseSettingsStateReturn<T> {
  // Data
  items: T[];
  filteredItems: T[];
  loading: boolean;
  error: string | null;
  
  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  handleSearch: (query: string) => void;
  
  // CRUD operations
  createItem: (data: Omit<T, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateItem: (id: number, updates: Partial<T>) => Promise<void>;
  deleteItem: (id: number) => Promise<void>;
  
  // Form state
  isSubmitting: boolean;
  formError: string | null;
  setFormError: (error: string | null) => void;
  
  // Dialog state
  isCreateDialogOpen: boolean;
  setIsCreateDialogOpen: (open: boolean) => void;
  isEditDialogOpen: boolean;
  setIsEditDialogOpen: (open: boolean) => void;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (open: boolean) => void;
  
  // Selected items
  editingItem: T | null;
  setEditingItem: (item: T | null) => void;
  deletingItem: T | null;
  setDeletingItem: (item: T | null) => void;
  
  // Handlers
  handleEdit: (item: T) => void;
  handleDelete: (item: T) => void;
  handleCloseDeleteDialog: () => void;
}

export function useSettingsState<T extends { id: number; [key: string]: any }>({
  entityName,
  searchFields = [],
  onError
}: UseSettingsStateOptions<T>): UseSettingsStateReturn<T> {
  const dispatch = useDispatch<AppDispatch>();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Redux state
  const { value: items, loading, error } = useSelector((state: RootState) => state[entityName] as { value: T[]; loading: boolean; error: string | null });
  
  // Local state
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<T[]>(items || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Selected items
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [deletingItem, setDeletingItem] = useState<T | null>(null);
  
  // Search functionality
  const handleSearch = useCallback((query: string) => {
    const lowerCaseQuery = query.toLowerCase();
    if (!lowerCaseQuery) {
      setFilteredItems(items);
      return;
    }
    
    const filtered = items.filter((item) => {
      // Search in specified fields
      if (searchFields.length > 0) {
        return searchFields.some(field => {
          const value = item[field];
          return value && String(value).toLowerCase().includes(lowerCaseQuery);
        });
      }
      
      // Default: search in all string fields
      return Object.values(item).some(value => {
        return value && typeof value === 'string' && value.toLowerCase().includes(lowerCaseQuery);
      });
    });
    
    setFilteredItems(filtered);
  }, [items, searchFields]);
  
  // Update filtered items when items change
  useEffect(() => {
    handleSearch(searchQuery);
  }, [items, searchQuery, handleSearch]);
  
  // Ensure filteredItems is always synced with items
  useEffect(() => {
    if (!searchQuery) {
      setFilteredItems(items || []);
    }
  }, [items, searchQuery]);
  
  // CRUD operations
  const createItem = useCallback(async (data: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setFormError(null);
      setIsSubmitting(true);
      // Type assertion to handle dynamic key access
      const actions = (genericActions as any)[entityName];
      await dispatch(actions.addAsync(data)).unwrap();
      setIsCreateDialogOpen(false);
    } catch (err: any) {
      const backendErrors = err?.response?.data?.errors;
      const backendMessage = err?.response?.data?.message;
      const errorMessage = backendErrors
        ? Object.entries(backendErrors).map(([k, v]: any) => `${k}: ${(v?.[0] || v)}`).join(', ')
        : (backendMessage || err?.message || 'Failed to create item');
      setFormError(errorMessage);
      onError?.(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, entityName, onError]);
  
  const updateItem = useCallback(async (id: number, updates: Partial<T>) => {
    try {
      setFormError(null);
      setIsSubmitting(true);
      // Type assertion to handle dynamic key access
      const actions = (genericActions as any)[entityName];
      await dispatch(actions.updateAsync({ id, updates })).unwrap();
      setIsEditDialogOpen(false);
      setEditingItem(null);
    } catch (err: any) {
      const backendErrors = err?.response?.data?.errors;
      const backendMessage = err?.response?.data?.message;
      const errorMessage = backendErrors
        ? Object.entries(backendErrors).map(([k, v]: any) => `${k}: ${(v?.[0] || v)}`).join(', ')
        : (backendMessage || err?.message || 'Failed to update item');
      setFormError(errorMessage);
      onError?.(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, entityName, onError]);
  
  const deleteItem = useCallback(async (id: number) => {
    try {
      setIsSubmitting(true);
      // Type assertion to handle dynamic key access
      const actions = (genericActions as any)[entityName];
      await dispatch(actions.removeAsync(id)).unwrap();
      setIsDeleteDialogOpen(false);
      setDeletingItem(null);
      
      // If the deleted item was being edited, close the edit dialog and clear the editing item
      if (editingItem && editingItem.id === id) {
        setIsEditDialogOpen(false);
        setEditingItem(null);
      }
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to delete item';
      onError?.(errorMessage);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [dispatch, entityName, onError, editingItem]);
  
  // Handlers
  const handleEdit = useCallback((item: T) => {
    setEditingItem(item);
    setFormError(null);
    setIsEditDialogOpen(true);
  }, []);
  
  const handleDelete = useCallback((item: T) => {
    setDeletingItem(item);
    setIsDeleteDialogOpen(true);
  }, []);
  
  const handleCloseDeleteDialog = useCallback(() => {
    setIsDeleteDialogOpen(false);
    setDeletingItem(null);
  }, []);

  // Auto-open edit dialog if edit parameter is in URL
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && items.length > 0 && !isEditDialogOpen) {
      const itemId = parseInt(editId, 10);
      const itemToEdit = items.find((item: T) => item.id === itemId);
      if (itemToEdit) {
        setEditingItem(itemToEdit);
        setIsEditDialogOpen(true);
        // Remove edit parameter from URL
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('edit');
        setSearchParams(newSearchParams, { replace: true });
      }
    }
  }, [searchParams, items, isEditDialogOpen, setEditingItem, setIsEditDialogOpen, setSearchParams]);
  
  return {
    // Data
    items,
    filteredItems,
    loading,
    error,
    
    // Search
    searchQuery,
    setSearchQuery,
    handleSearch,
    
    // CRUD operations
    createItem,
    updateItem,
    deleteItem,
    
    // Form state
    isSubmitting,
    formError,
    setFormError,
    
    // Dialog state
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    
    // Selected items
    editingItem,
    setEditingItem,
    deletingItem,
    setDeletingItem,
    
    // Handlers
    handleEdit,
    handleDelete,
    handleCloseDeleteDialog
  };
}

export default useSettingsState;
