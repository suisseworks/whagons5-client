import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Template } from "../types";
import { TemplatesCache } from "../indexedDB/TemplatesCache";
import api from "@/api/whagonsApi";

// Helper function to ensure template has all required properties
const ensureTemplateDefaults = (template: any): Template => {
    return {
        ...template,
        enabled: template.enabled !== undefined ? template.enabled : true,
        deleted_at: template.deleted_at || null,
        description: template.description || null,
        instructions: template.instructions || null
    };
};

export const getTemplatesFromIndexedDB = createAsyncThunk('loadTemplates', async () => {
    const templates = await TemplatesCache.getTemplates();
    return templates;
});

// Async thunk for adding template with optimistic updates
export const addTemplateAsync = createAsyncThunk(
    'templates/addTemplateAsync',
    async (template: Omit<Template, 'id' | 'created_at' | 'updated_at'>, { rejectWithValue }) => {
        try {
            // Call API to create template
            const response = await api.post('/templates', template);
            const newTemplate = {
                ...response.data,
                created_at: response.data.created_at,
                updated_at: response.data.updated_at
            };
            
            // Update IndexedDB on success
            await TemplatesCache.addTemplate(newTemplate);
            
            return newTemplate;
        } catch (error: any) {
            console.error('Failed to add template:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to add template');
        }
    }
);

// Async thunk for updating template with optimistic updates
export const updateTemplateAsync = createAsyncThunk(
    'templates/updateTemplateAsync',
    async ({ id, updates }: { id: number; updates: Partial<Template> }, { rejectWithValue }) => {
        try {
            // Call API to update template using PATCH (only send updated fields)
            const response = await api.patch(`/templates/${id}`, updates);
            const updatedTemplate = {
                ...response.data,
                created_at: response.data.created_at,
                updated_at: response.data.updated_at
            };
            
            // Update IndexedDB on success
            await TemplatesCache.updateTemplate(id.toString(), updatedTemplate);
            
            return updatedTemplate;
        } catch (error: any) {
            console.error('Failed to update template:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to update template');
        }
    }
);

// Async thunk for removing template with optimistic updates
export const removeTemplateAsync = createAsyncThunk(
    'templates/removeTemplateAsync',
    async (templateId: number, { rejectWithValue }) => {
        try {
            // Call API to delete template
            await api.delete(`/templates/${templateId}`);
            
            // Remove from IndexedDB on success
            await TemplatesCache.deleteTemplate(templateId.toString());
            
            return templateId;
        } catch (error: any) {
            console.error('Failed to remove template:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to remove template');
        }
    }
);

const initialState = {
    value: [] as Template[],
    loading: false,
    error: null as string | null,
    // Store previous state for optimistic update rollbacks
    previousState: null as Template[] | null
};

export const templatesSlice = createSlice({
    name: 'templates',
    initialState,
    reducers: {
        getTemplates: (state) => {
            state.loading = true;
        },
        getTemplatesSuccess: (state, action) => {
            state.loading = false;
            state.value = action.payload.map(ensureTemplateDefaults);
        },
        getTemplatesFailure: (state, action) => {  
            state.loading = false;
            state.error = action.payload;
        },
        // Clear any stored error
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Load templates from IndexedDB
        builder.addCase(getTemplatesFromIndexedDB.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getTemplatesFromIndexedDB.fulfilled, (state, action) => {
            state.loading = false;
            state.value = action.payload.map(ensureTemplateDefaults);
        });
        builder.addCase(getTemplatesFromIndexedDB.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || null;
        });

        // Add template with optimistic updates
        builder.addCase(addTemplateAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update: create temporary template with negative ID
            const tempTemplate = ensureTemplateDefaults({
                ...action.meta.arg,
                id: Date.now() * -1, // Temporary negative ID
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            state.value.push(tempTemplate);
        });
        builder.addCase(addTemplateAsync.fulfilled, (state, action) => {
            // Replace temporary template with real one from API
            const tempIndex = state.value.findIndex(t => t.id < 0);
            if (tempIndex !== -1) {
                state.value[tempIndex] = ensureTemplateDefaults(action.payload);
            }
            state.previousState = null;
        });
        builder.addCase(addTemplateAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });

        // Update template with optimistic updates
        builder.addCase(updateTemplateAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update
            const { id, updates } = action.meta.arg;
            const index = state.value.findIndex(template => template.id === id);
            if (index !== -1) {
                state.value[index] = ensureTemplateDefaults({
                    ...state.value[index],
                    ...updates,
                    updated_at: new Date().toISOString()
                });
            }
        });
        builder.addCase(updateTemplateAsync.fulfilled, (state, action) => {
            // Replace optimistic update with real data from API
            const index = state.value.findIndex(template => template.id === action.payload.id);
            if (index !== -1) {
                state.value[index] = ensureTemplateDefaults(action.payload);
            }
            state.previousState = null;
        });
        builder.addCase(updateTemplateAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });

        // Remove template with optimistic updates
        builder.addCase(removeTemplateAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update: remove template immediately
            state.value = state.value.filter(template => template.id !== action.meta.arg);
        });
        builder.addCase(removeTemplateAsync.fulfilled, (state, action) => {
            // Keep the optimistic removal, clear previous state
            state.previousState = null;
        });
        builder.addCase(removeTemplateAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });
    }
});

export default templatesSlice.reducer;

