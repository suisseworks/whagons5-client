import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Task } from "../types";
import { TasksCache } from "../indexedDB/TasksCache";
import { TaskEvents } from "../eventEmiters/taskEvents";
import { api } from "@/store/api/internalApi";

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
            
            // Verify task was added correctly to IndexedDB
            console.log('[addTaskAsync] Task added to IndexedDB:', {
                id: newTask.id,
                name: newTask.name,
                start_date: newTask.start_date,
                due_date: newTask.due_date,
                user_ids: newTask.user_ids,
                workspace_id: newTask.workspace_id,
            });
            
            // Verify it can be retrieved
            const verifyTask = await TasksCache.getTask(newTask.id.toString());
            if (!verifyTask) {
                console.error('[addTaskAsync] WARNING: Task not found in IndexedDB after adding!');
            } else {
                console.log('[addTaskAsync] Verified task in IndexedDB:', {
                    id: verifyTask.id,
                    hasStartDate: !!verifyTask.start_date,
                    hasUserIds: !!verifyTask.user_ids,
                    userIdsCount: verifyTask.user_ids?.length || 0,
                });
            }
            
            return newTask;
        } catch (error: any) {
            console.error('Failed to add task:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to add task';
            // Preserve status code for permission checking
            const errorWithStatus = new Error(errorMessage) as any;
            errorWithStatus.response = error.response;
            errorWithStatus.status = error.response?.status;
            return rejectWithValue(errorWithStatus);
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
            // Merge with cached task and submitted updates to avoid dropping fields the API might omit (e.g., user_ids)
            const cachedTask = await TasksCache.getTask(id.toString());
            const updatedTask = ensureTaskDefaults({
                ...cachedTask,
                ...payload,
                // Ensure the fields we sent (like user_ids) are preserved even if API omits them
                ...updates,
                id: payload?.id ?? id,
                created_at: payload?.created_at ?? response.data?.created_at ?? cachedTask?.created_at ?? undefined,
                updated_at: payload?.updated_at ?? response.data?.updated_at ?? new Date().toISOString(),
            });
            
            // Update IndexedDB on success
            await TasksCache.updateTask(id.toString(), updatedTask);
            
            return updatedTask;
        } catch (error: any) {
            console.error('Failed to update task:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to update task';
            // Preserve status code for permission checking (prevents duplicate toast for 403 errors)
            const errorWithStatus = new Error(errorMessage) as any;
            errorWithStatus.response = error.response;
            errorWithStatus.status = error.response?.status;
            return rejectWithValue(errorWithStatus);
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
            const status = error.response?.status;
            // Only log non-403 errors (403 errors are expected permission denials)
            if (status !== 403) {
                console.error('Failed to remove task:', error);
            }
            const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to remove task';
            // Preserve status code for permission checking
            const errorWithStatus = new Error(errorMessage) as any;
            errorWithStatus.response = error.response;
            errorWithStatus.status = status;
            return rejectWithValue(errorWithStatus);
        }
    }
);

// Async thunk for restoring a deleted task
export const restoreTaskAsync = createAsyncThunk(
    'tasks/restoreTaskAsync',
    async (taskId: number, { rejectWithValue }) => {
        try {
            // Call API to restore task
            const response = await api.post(`/tasks/${taskId}/restore`);
            const payload = (response.data?.data ?? response.data) as any;
            const restoredTask = ensureTaskDefaults({
                ...payload,
                id: payload?.id ?? taskId,
            });
            
            // Add back to IndexedDB on success - this will emit TASK_CREATED event
            await TasksCache.addTask(restoredTask);
            
            // Also emit TASK_UPDATED event to ensure grid refreshes
            TaskEvents.emit(TaskEvents.EVENTS.TASK_UPDATED, restoredTask);
            
            return restoredTask;
        } catch (error: any) {
            console.error('Failed to restore task:', error);
            const errorMessage = error.response?.data?.message || error.response?.data?.error || 'Failed to restore task';
            return rejectWithValue(errorMessage);
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

        // Restore task
        builder.addCase(restoreTaskAsync.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(restoreTaskAsync.fulfilled, (state, action) => {
            // Add restored task back to the list
            const index = state.value.findIndex(task => task.id === action.payload.id);
            if (index === -1) {
                state.value.push(ensureTaskDefaults(action.payload));
            } else {
                state.value[index] = ensureTaskDefaults(action.payload);
            }
            state.loading = false;
        });
        builder.addCase(restoreTaskAsync.rejected, (state, action) => {
            state.loading = false;
            state.error = action.payload as string;
        });
    }
});

export const { getTasks, getTasksSuccess, getTasksFailure, clearError } = tasksSlice.actions;
export default tasksSlice.reducer;
