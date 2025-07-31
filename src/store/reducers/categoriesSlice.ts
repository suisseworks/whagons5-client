import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Category } from "../types";
import { CategoriesCache } from "../indexedDB/CategoriesCache";
import api from "@/api/whagonsApi";

// Helper function to ensure category has all required properties
const ensureCategoryDefaults = (category: any): Category => {
    return {
        ...category,
        enabled: category.enabled !== undefined ? category.enabled : true,
        deleted_at: category.deleted_at || null
    };
};

export const getCategoriesFromIndexedDB = createAsyncThunk('loadCategories', async () => {
    const categories = await CategoriesCache.getCategories();
    return categories;
});

// Async thunk for adding category with optimistic updates
export const addCategoryAsync = createAsyncThunk(
    'categories/addCategoryAsync',
    async (category: Omit<Category, 'id' | 'created_at' | 'updated_at'>, { rejectWithValue }) => {
        try {
            // Call API to create category
            const response = await api.post('/categories', category);
            const newCategory = {
                ...response.data,
                created_at: response.data.created_at,
                updated_at: response.data.updated_at
            };
            
            // Update IndexedDB on success
            await CategoriesCache.addCategory(newCategory);
            
            return newCategory;
        } catch (error: any) {
            console.error('Failed to add category:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to add category');
        }
    }
);

// Async thunk for updating category with optimistic updates
export const updateCategoryAsync = createAsyncThunk(
    'categories/updateCategoryAsync',
    async ({ id, updates }: { id: number; updates: Partial<Category> }, { rejectWithValue }) => {
        try {
            // Call API to update category using PATCH (only send updated fields)
            const response = await api.patch(`/categories/${id}`, updates);
            const updatedCategory = {
                ...response.data,
                created_at: response.data.created_at,
                updated_at: response.data.updated_at
            };
            
            // Update IndexedDB on success
            await CategoriesCache.updateCategory(id.toString(), updatedCategory);
            
            return updatedCategory;
        } catch (error: any) {
            console.error('Failed to update category:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to update category');
        }
    }
);

// Async thunk for removing category with optimistic updates
export const removeCategoryAsync = createAsyncThunk(
    'categories/removeCategoryAsync',
    async (categoryId: number, { rejectWithValue }) => {
        try {
            // Call API to delete category
            await api.delete(`/categories/${categoryId}`);
            
            // Remove from IndexedDB on success
            await CategoriesCache.deleteCategory(categoryId.toString());
            
            return categoryId;
        } catch (error: any) {
            console.error('Failed to remove category:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to remove category');
        }
    }
);

const initialState = {
    value: [] as Category[],
    loading: false,
    error: null as string | null,
    // Store previous state for optimistic update rollbacks
    previousState: null as Category[] | null
};

export const categoriesSlice = createSlice({
    name: 'categories',
    initialState,
    reducers: {
        getCategories: (state) => {
            state.loading = true;
        },
        getCategoriesSuccess: (state, action) => {
            state.loading = false;
            state.value = action.payload.map(ensureCategoryDefaults);
        },
        getCategoriesFailure: (state, action) => {  
            state.loading = false;
            state.error = action.payload;
        },
        // Clear any stored error
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Load categories from IndexedDB
        builder.addCase(getCategoriesFromIndexedDB.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getCategoriesFromIndexedDB.fulfilled, (state, action) => {
            state.loading = false;
            state.value = action.payload.map(ensureCategoryDefaults);
        });
        builder.addCase(getCategoriesFromIndexedDB.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || null;
        });

        // Add category with optimistic updates
        builder.addCase(addCategoryAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update: create temporary category with negative ID
            const tempCategory = ensureCategoryDefaults({
                ...action.meta.arg,
                id: Date.now() * -1, // Temporary negative ID
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            state.value.push(tempCategory);
        });
        builder.addCase(addCategoryAsync.fulfilled, (state, action) => {
            // Replace temporary category with real one from API
            const tempIndex = state.value.findIndex(c => c.id < 0);
            if (tempIndex !== -1) {
                state.value[tempIndex] = ensureCategoryDefaults(action.payload);
            }
            state.previousState = null;
        });
        builder.addCase(addCategoryAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });

        // Update category with optimistic updates
        builder.addCase(updateCategoryAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update
            const { id, updates } = action.meta.arg;
            const index = state.value.findIndex(category => category.id === id);
            if (index !== -1) {
                state.value[index] = ensureCategoryDefaults({
                    ...state.value[index],
                    ...updates,
                    updated_at: new Date().toISOString()
                });
            }
        });
        builder.addCase(updateCategoryAsync.fulfilled, (state, action) => {
            // Replace optimistic update with real data from API
            const index = state.value.findIndex(category => category.id === action.payload.id);
            if (index !== -1) {
                state.value[index] = ensureCategoryDefaults(action.payload);
            }
            state.previousState = null;
        });
        builder.addCase(updateCategoryAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });

        // Remove category with optimistic updates
        builder.addCase(removeCategoryAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update: remove category immediately
            state.value = state.value.filter(category => category.id !== action.meta.arg);
        });
        builder.addCase(removeCategoryAsync.fulfilled, (state, action) => {
            // Keep the optimistic removal, clear previous state
            state.previousState = null;
        });
        builder.addCase(removeCategoryAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });
    }
}); 