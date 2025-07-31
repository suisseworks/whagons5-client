import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Workspace } from "../types";
import { WorkspaceCache } from "../indexedDB/WorkspaceCache";
import api from "@/api/whagonsApi";

// Helper function to ensure workspace has all required properties
const ensureWorkspaceDefaults = (workspace: any): Workspace => {
    const defaultDescription = workspace.description || `Main development workspace for ${workspace.name}`;
    
    return {
        ...workspace,
        description: defaultDescription
    };
};



export const getWorkspacesFromIndexedDB = createAsyncThunk('loadWorkspaces', async () => {
    const workspaces = await WorkspaceCache.getWorkspaces();
    return workspaces;
});

// Async thunk for adding workspace with optimistic updates
export const addWorkspaceAsync = createAsyncThunk(
    'workspaces/addWorkspaceAsync',
    async (workspace: Omit<Workspace, 'id' | 'created_at' | 'updated_at'>, { rejectWithValue }) => {
        try {
            // Call API to create workspace
            const response = await api.post('/workspaces', workspace);
            const newWorkspace = {
                ...response.data.data,
                created_at: response.data.data.created_at,
                updated_at: response.data.data.updated_at
            };
            
            // Update IndexedDB on success
            await WorkspaceCache.addWorkspace(newWorkspace);
            
            return newWorkspace;
        } catch (error: any) {
            console.error('Failed to add workspace:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to add workspace');
        }
    }
);

// Async thunk for updating workspace with optimistic updates
export const updateWorkspaceAsync = createAsyncThunk(
    'workspaces/updateWorkspaceAsync',
    async ({ id, updates }: { id: number; updates: Partial<Workspace> }, { rejectWithValue }) => {
        try {
            // Call API to update workspace using PATCH (only send updated fields)
            const response = await api.patch(`/workspaces/${id}`, updates);
            const updatedWorkspace = {
                ...response.data.data,
                created_at: response.data.data.created_at,
                updated_at: response.data.data.updated_at
            };
            
            // Update IndexedDB on success
            await WorkspaceCache.updateWorkspace(id.toString(), updatedWorkspace);
            
            return updatedWorkspace;
        } catch (error: any) {
            console.error('Failed to update workspace:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to update workspace');
        }
    }
);

// Async thunk for removing workspace with optimistic updates
export const removeWorkspaceAsync = createAsyncThunk(
    'workspaces/removeWorkspaceAsync',
    async (workspaceId: number, { rejectWithValue }) => {
        try {
            // Call API to delete workspace
            await api.delete(`/workspaces/${workspaceId}`);
            
            // Remove from IndexedDB on success
            await WorkspaceCache.deleteWorkspace(workspaceId.toString());
            
            return workspaceId;
        } catch (error: any) {
            console.error('Failed to remove workspace:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to remove workspace');
        }
    }
);



const initialState = {
    value: [
    ] as Workspace[],
    loading: false,
    error: null as string | null,
    // Store previous state for optimistic update rollbacks
    previousState: null as Workspace[] | null
}

export const workspacesSlice = createSlice({
    name: 'workspaces',
    initialState,
    reducers: {
        getWorkspaces: (state) => {
            state.loading = true
        },
        getWorkspacesSuccess: (state, action) => {
            state.loading = false
            state.value = action.payload.map(ensureWorkspaceDefaults)
        },
        getWorkspacesFailure: (state, action) => {  
            state.loading = false
            state.error = action.payload
        },
        // Clear any stored error
        clearError: (state) => {
            state.error = null
        }
    },
    extraReducers: (builder) => {
        // Load workspaces from IndexedDB
        builder.addCase(getWorkspacesFromIndexedDB.pending, (state) => {
            state.loading = true
        })
        builder.addCase(getWorkspacesFromIndexedDB.fulfilled, (state, action) => {
            state.loading = false
            state.value = action.payload.map(ensureWorkspaceDefaults)
        })
        builder.addCase(getWorkspacesFromIndexedDB.rejected, (state, action) => {
            state.loading = false
            state.error = action.error.message || null
        })

        // Add workspace with optimistic updates
        builder.addCase(addWorkspaceAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value]
            state.error = null
            
            // Optimistic update: create temporary workspace with negative ID
            const tempWorkspace = ensureWorkspaceDefaults({
                ...action.meta.arg,
                id: Date.now() * -1, // Temporary negative ID
                created_at: new Date(),
                updated_at: new Date()
            })
            state.value.push(tempWorkspace)
        })
        builder.addCase(addWorkspaceAsync.fulfilled, (state, action) => {
            // Replace temporary workspace with real one from API
            const tempId = Date.now() * -1
            const tempIndex = state.value.findIndex(w => w.id < 0)
            if (tempIndex !== -1) {
                state.value[tempIndex] = ensureWorkspaceDefaults(action.payload)
            }
            state.previousState = null
        })
        builder.addCase(addWorkspaceAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState
                state.previousState = null
            }
            state.error = action.payload as string
        })

        // Update workspace with optimistic updates
        builder.addCase(updateWorkspaceAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value]
            state.error = null
            
            // Optimistic update
            const { id, updates } = action.meta.arg
            const index = state.value.findIndex(workspace => workspace.id === id)
            if (index !== -1) {
                state.value[index] = ensureWorkspaceDefaults({
                    ...state.value[index],
                    ...updates,
                    updated_at: new Date()
                })
            }
        })
        builder.addCase(updateWorkspaceAsync.fulfilled, (state, action) => {
            // Replace optimistic update with real data from API
            const index = state.value.findIndex(workspace => workspace.id === action.payload.id)
            if (index !== -1) {
                state.value[index] = ensureWorkspaceDefaults(action.payload)
            }
            state.previousState = null
        })
        builder.addCase(updateWorkspaceAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState
                state.previousState = null
            }
            state.error = action.payload as string
        })

        // Remove workspace with optimistic updates
        builder.addCase(removeWorkspaceAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value]
            state.error = null
            
            // Optimistic update: remove workspace immediately
            state.value = state.value.filter(workspace => workspace.id !== action.meta.arg)
        })
        builder.addCase(removeWorkspaceAsync.fulfilled, (state, action) => {
            // Keep the optimistic removal, clear previous state
            state.previousState = null
        })
        builder.addCase(removeWorkspaceAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState
                state.previousState = null
            }
            state.error = action.payload as string
        })
    }
})