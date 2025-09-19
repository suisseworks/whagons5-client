import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Task } from "../types";
import { TasksCache } from "../indexedDB/TasksCache";
import api from "@/api/whagonsApi";

// Helper function to ensure task has all required properties
const ensureTaskDefaults = (task: any): Task => {
    return {
        ...task,
        description: task.description || null
    };
};

export const getTasksFromIndexedDB = createAsyncThunk('loadTasks', async () => {
    const tasks = await TasksCache.getTasks();
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
            
            // Update IndexedDB on success
            await TasksCache.addTask(newTask);
            
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
            
            // Update IndexedDB on success
            await TasksCache.updateTask(id.toString(), updatedTask);
            
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
            
            // Remove from IndexedDB on success
            await TasksCache.deleteTask(taskId.toString());
            
            return taskId;
        } catch (error: any) {
            console.error('Failed to remove task:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to remove task');
        }
    }
);

const initialState = {
    value: [] as Task[],
    loading: false,
    error: null as string | null,
    // Store previous state for optimistic update rollbacks
    previousState: null as Task[] | null
};

export const tasksSlice = createSlice({
    name: 'tasks',
    initialState,
    reducers: {
        getTasks: (state) => {
            state.loading = true;
        },
        getTasksSuccess: (state, action) => {
            state.loading = false;
            state.value = action.payload.map(ensureTaskDefaults);
        },
        getTasksFailure: (state, action) => {
            state.loading = false;
            state.error = action.payload;
        },
        // Clear any stored error
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Load tasks from IndexedDB
        builder.addCase(getTasksFromIndexedDB.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getTasksFromIndexedDB.fulfilled, (state, action) => {
            state.loading = false;
            state.value = action.payload.map(ensureTaskDefaults);
        });
        builder.addCase(getTasksFromIndexedDB.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || null;
        });

        // Add task with optimistic updates
        builder.addCase(addTaskAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update: create temporary task with negative ID
            const tempTask = ensureTaskDefaults({
                ...action.meta.arg,
                id: Date.now() * -1, // Temporary negative ID
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
            state.value.push(tempTask);
        });
        builder.addCase(addTaskAsync.fulfilled, (state, action) => {
            // Replace temporary task with real one from API
            const tempIndex = state.value.findIndex(t => t.id < 0);
            if (tempIndex !== -1) {
                state.value[tempIndex] = ensureTaskDefaults(action.payload);
            }
            state.previousState = null;
        });
        builder.addCase(addTaskAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });

        // Update task with optimistic updates
        builder.addCase(updateTaskAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update
            const { id, updates } = action.meta.arg;
            const index = state.value.findIndex(task => task.id === id);
            if (index !== -1) {
                state.value[index] = ensureTaskDefaults({
                    ...state.value[index],
                    ...updates,
                    updated_at: new Date().toISOString()
                });
            }
        });
        builder.addCase(updateTaskAsync.fulfilled, (state, action) => {
            // Replace optimistic update with real data from API
            const index = state.value.findIndex(task => task.id === action.payload.id);
            if (index !== -1) {
                state.value[index] = ensureTaskDefaults(action.payload);
            }
            state.previousState = null;
        });
        builder.addCase(updateTaskAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });

        // Remove task with optimistic updates
        builder.addCase(removeTaskAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update: remove task immediately
            state.value = state.value.filter(task => task.id !== action.meta.arg);
        });
        builder.addCase(removeTaskAsync.fulfilled, (state, action) => {
            // Keep the optimistic removal, clear previous state
            state.previousState = null;
        });
        builder.addCase(removeTaskAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });
    }
});

export const { getTasks, getTasksSuccess, getTasksFailure, clearError } = tasksSlice.actions;
export default tasksSlice.reducer;
