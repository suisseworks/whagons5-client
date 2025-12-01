import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Task } from "../types";
import { DuckTaskCache } from "../database/DuckTaskCache";
import { TaskEvents } from "../eventEmiters/taskEvents";
import api from "@/api/whagonsApi";

// Helper function to ensure task has all required properties
const ensureTaskDefaults = (task: any): Task => {
    return {
        ...task,
        description: task.description || null
    };
};

export const getTasksFromIndexedDB = createAsyncThunk('loadTasks', async () => {
    const tasks = await DuckTaskCache.getAllTasks();
    return tasks;
});

// Async thunk for adding task with optimistic updates
export const addTaskAsync = createAsyncThunk(
    'tasks/addTaskAsync',
    async (task: Omit<Task, 'id' | 'created_at' | 'updated_at'>, { rejectWithValue }) => {
        try {
            // Call API to create task
            const response = await api.post('/tasks', task);
            const payload = (response.data?.data ?? response.data?.row ?? response.data?.rows?.[0] ?? response.data) as any;
            const newTask = ensureTaskDefaults({
                ...payload,
                id: (payload?.id ?? payload?.ID ?? payload?.Id),
                created_at: payload?.created_at ?? response.data?.created_at ?? new Date().toISOString(),
                updated_at: payload?.updated_at ?? response.data?.updated_at ?? new Date().toISOString(),
            });
            
            // Update DuckDB cache on success
            await DuckTaskCache.upsertTask(newTask as any);
            try { TaskEvents.emit(TaskEvents.EVENTS.TASK_CREATED, newTask); } catch {}
            
            return newTask;
        } catch (error: any) {
            console.error('Failed to add task:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to add task');
        }
    }
);

// Async thunk for updating task with optimistic updates
export const updateTaskAsync = createAsyncThunk(
    'tasks/updateTaskAsync',
    async ({ id, updates }: { id: number; updates: Partial<Task> }, { rejectWithValue }) => {
        try {
            // Call API to update task using PATCH (only send updated fields)
            const response = await api.patch(`/tasks/${id}`, updates);
            const payload = (response.data?.data ?? response.data?.row ?? response.data?.rows?.[0] ?? response.data) as any;
            const updatedTask = ensureTaskDefaults({
                ...payload,
                id: payload?.id ?? id,
                created_at: payload?.created_at ?? response.data?.created_at ?? undefined,
                updated_at: payload?.updated_at ?? response.data?.updated_at ?? new Date().toISOString(),
            });
            
            // Update DuckDB cache on success
            await DuckTaskCache.upsertTask(updatedTask as any);
            try { TaskEvents.emit(TaskEvents.EVENTS.TASK_UPDATED, updatedTask); } catch {}
            
            return updatedTask;
        } catch (error: any) {
            console.error('Failed to update task:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to update task');
        }
    }
);

// Async thunk for removing task with optimistic updates
export const removeTaskAsync = createAsyncThunk(
    'tasks/removeTaskAsync',
    async (taskId: number, { rejectWithValue }) => {
        try {
            // Call API to delete task
            await api.delete(`/tasks/${taskId}`);
            
            // Remove from DuckDB cache on success
            await DuckTaskCache.deleteTask(taskId.toString());
            try { TaskEvents.emit(TaskEvents.EVENTS.TASK_DELETED, { id: taskId }); } catch {}
            
            return taskId;
        } catch (error: any) {
            console.error('Failed to remove task:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to remove task');
        }
    }
);

// NOTE: Tasks are NOT stored in Redux memory to avoid loading thousands of tasks.
// This slice only provides async thunks for API calls + DuckDB cache updates.
// All task data is queried directly from DuckDB via DuckTaskCache.queryForAgGrid().
const initialState = {
    // No value array - tasks are never loaded into Redux memory
    // No loading/error states - components handle their own loading states
};

export const tasksSlice = createSlice({
    name: 'tasks',
    initialState,
    reducers: {
        // No reducers needed - this slice is just a container for async thunks
    },
    extraReducers: (builder) => {
        // No reducers needed - async thunks handle API calls and DuckDB updates directly
        // UI updates happen via TaskEvents emitted by DuckTaskCache
    }
});

// Export empty actions for compatibility (in case anything imports them)
export const { } = tasksSlice.actions;
export default tasksSlice.reducer;
