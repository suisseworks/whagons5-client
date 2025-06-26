import { api } from "@/api/whagonsApi";
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export interface Task {
    id: string
    name: string
    workspaceId: string
    templateId: string
    spotId: string
    teamId: string
    statusId: string
    responseDate: string
    resolutionDate: string
    workDuration: number
    pauseDuration: number
    createdAt: string
    updatedAt: string
}

const initialState = {
    value: [] as Task[],
    loading: false,
    error: null as string | null
}


export const fetchTasks = createAsyncThunk('tasks/fetchTasks', async () => {
    try {
        const response = await api.get('/tasks',
            {
                params: {
                workspace_id: '1'
            }
        }
    )
    return response.data
    } catch (error) {
        throw error
    }
})  


export const tasksSlice = createSlice({
    name: 'tasks',
    initialState,
    reducers: {
        getTasks: (state) => {
            state.loading = true
        },
        getTasksSuccess: (state, action) => {
            state.loading = false
            state.value = action.payload
        },
        getTasksFailure: (state, action) => {
            state.loading = false
            state.error = action.payload
        }
    },
    extraReducers: (builder) => {
        builder
        .addCase(fetchTasks.pending, (state) => {
            state.loading = true
        })
        .addCase(fetchTasks.fulfilled, (state, action) => {
            state.loading = false
            console.log(action.payload)
            //we merge new tasks with existing tasks filtering out repeated ids
            // const newTasks = action.payload.data.filter((task: Task) => !state.value.some((t: Task) => t.id === task.id))
            // state.value = [...state.value, ...newTasks]

            state.value = action.payload.data
        })
        .addCase(fetchTasks.rejected, (state, action) => {
            state.loading = false
            state.error = action.error.message || null
        })
    }
})

export const { getTasks, getTasksSuccess, getTasksFailure } = tasksSlice.actions
export default tasksSlice.reducer
