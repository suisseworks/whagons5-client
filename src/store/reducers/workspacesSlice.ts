import { createSlice } from "@reduxjs/toolkit";



export interface Workspace {
    id: string
    name: string
    path: string
    description: string
    createdAt: string
    updatedAt: string
}

const initialState = {
    value: [
        {
            id: "1",
            name: "Tasks",
            path: "/tasks",
            description: "Tasks workspace",
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
            state.value = action.payload
        },
        getWorkspacesFailure: (state, action) => {  
            state.loading = false
            state.error = action.payload
        },
        addWorkspace: (state, action) => {
            state.value.push(action.payload)
        },
        removeWorkspace: (state, action) => {
            state.value = state.value.filter((workspace) => workspace.id !== action.payload)
        },
        updateWorkspace: (state, action) => {
            const index = state.value.findIndex((workspace) => workspace.id === action.payload.id)
            if (index !== -1) {
                state.value[index] = action.payload
            }
        }
    }
})