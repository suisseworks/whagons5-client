import { createSlice } from "@reduxjs/toolkit";

export interface Workspace {
    id: string
    name: string
    path: string
    description: string
    icon: string
    iconColor: string
    createdAt: string
    updatedAt: string
}

// Helper function to ensure workspace has all required properties
const ensureWorkspaceDefaults = (workspace: any): Workspace => {
    const defaultDescription = workspace.description || `Main development workspace for ${workspace.name}`;
    
    return {
        ...workspace,
        icon: workspace.icon || 'briefcase',
        iconColor: workspace.iconColor || '#374151',
        description: defaultDescription
    };
};

const initialState = {
    value: [
        {
            id: "1",
            name: "Tasks",
            path: "/tasks",
            description: "Tasks workspace",
            icon: "briefcase",
            iconColor: "#374151",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
    ] as Workspace[],
    loading: false,
    error: null
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
        addWorkspace: (state, action) => {
            state.value.push(ensureWorkspaceDefaults(action.payload))
        },
        removeWorkspace: (state, action) => {
            state.value = state.value.filter((workspace) => workspace.id !== action.payload)
        },
        updateWorkspace: (state, action) => {
            const index = state.value.findIndex((workspace) => workspace.id === action.payload.id)
            if (index !== -1) {
                state.value[index] = ensureWorkspaceDefaults(action.payload)
            }
        },
        // New reducer to migrate existing workspaces
        migrateWorkspaces: (state) => {
            state.value = state.value.map(ensureWorkspaceDefaults)
        }
    }
})