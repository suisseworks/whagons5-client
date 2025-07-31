import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Team } from "../types";
import { TeamsCache } from "../indexedDB/TeamsCache";
import api from "@/api/whagonsApi";

// Helper function to ensure team has all required properties
const ensureTeamDefaults = (team: any): Team => {
    const defaultDescription = team.description || `Team for ${team.name}`;
    
    return {
        ...team,
        color: team.color || '#374151',
        description: defaultDescription,
        deleted_at: team.deleted_at || null
    };
};

export const getTeamsFromIndexedDB = createAsyncThunk('loadTeams', async () => {
    const teams = await TeamsCache.getTeams();
    return teams;
});

// Async thunk for adding team with optimistic updates
export const addTeamAsync = createAsyncThunk(
    'teams/addTeamAsync',
    async (team: Omit<Team, 'id' | 'created_at' | 'updated_at'>, { rejectWithValue }) => {
        try {
            // Call API to create team
            const response = await api.post('/teams', team);
            const newTeam = {
                ...response.data.rows?.[0] || response.data,
                created_at: response.data.created_at,
                updated_at: response.data.updated_at
            };
            
            // Update IndexedDB on success
            await TeamsCache.addTeam(newTeam);
            
            return newTeam;
        } catch (error: any) {
            console.error('Failed to add team:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to add team');
        }
    }
);

// Async thunk for updating team with optimistic updates
export const updateTeamAsync = createAsyncThunk(
    'teams/updateTeamAsync',
    async ({ id, updates }: { id: number; updates: Partial<Team> }, { rejectWithValue }) => {
        try {
            // Call API to update team using PATCH (only send updated fields)
            const response = await api.patch(`/teams/${id}`, updates);
            const updatedTeam = {
                ...response.data.rows?.[0] || response.data,
                created_at: response.data.created_at,
                updated_at: response.data.updated_at
            };
            
            // Update IndexedDB on success
            await TeamsCache.updateTeam(id.toString(), updatedTeam);
            
            return updatedTeam;
        } catch (error: any) {
            console.error('Failed to update team:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to update team');
        }
    }
);

// Async thunk for removing team with optimistic updates
export const removeTeamAsync = createAsyncThunk(
    'teams/removeTeamAsync',
    async (teamId: number, { rejectWithValue }) => {
        try {
            // Call API to delete team
            await api.delete(`/teams/${teamId}`);
            
            // Remove from IndexedDB on success
            await TeamsCache.deleteTeam(teamId.toString());
            
            return teamId;
        } catch (error: any) {
            console.error('Failed to remove team:', error);
            return rejectWithValue(error.response?.data?.message || 'Failed to remove team');
        }
    }
);

const initialState = {
    value: [] as Team[],
    loading: false,
    error: null as string | null,
    // Store previous state for optimistic update rollbacks
    previousState: null as Team[] | null
};

export const teamsSlice = createSlice({
    name: 'teams',
    initialState,
    reducers: {
        getTeams: (state) => {
            state.loading = true;
        },
        getTeamsSuccess: (state, action) => {
            state.loading = false;
            state.value = action.payload.map(ensureTeamDefaults);
        },
        getTeamsFailure: (state, action) => {  
            state.loading = false;
            state.error = action.payload;
        },
        // Clear any stored error
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // Load teams from IndexedDB
        builder.addCase(getTeamsFromIndexedDB.pending, (state) => {
            state.loading = true;
        });
        builder.addCase(getTeamsFromIndexedDB.fulfilled, (state, action) => {
            state.loading = false;
            state.value = action.payload.map(ensureTeamDefaults);
        });
        builder.addCase(getTeamsFromIndexedDB.rejected, (state, action) => {
            state.loading = false;
            state.error = action.error.message || null;
        });

        // Add team with optimistic updates
        builder.addCase(addTeamAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update: create temporary team with negative ID
            const tempTeam = ensureTeamDefaults({
                ...action.meta.arg,
                id: Date.now() * -1, // Temporary negative ID
                created_at: new Date(),
                updated_at: new Date()
            });
            state.value.push(tempTeam);
        });
        builder.addCase(addTeamAsync.fulfilled, (state, action) => {
            // Replace temporary team with real one from API
            const tempIndex = state.value.findIndex(t => t.id < 0);
            if (tempIndex !== -1) {
                state.value[tempIndex] = ensureTeamDefaults(action.payload);
            }
            state.previousState = null;
        });
        builder.addCase(addTeamAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });

        // Update team with optimistic updates
        builder.addCase(updateTeamAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update
            const { id, updates } = action.meta.arg;
            const index = state.value.findIndex(team => team.id === id);
            if (index !== -1) {
                state.value[index] = ensureTeamDefaults({
                    ...state.value[index],
                    ...updates,
                    updated_at: new Date()
                });
            }
        });
        builder.addCase(updateTeamAsync.fulfilled, (state, action) => {
            // Replace optimistic update with real data from API
            const index = state.value.findIndex(team => team.id === action.payload.id);
            if (index !== -1) {
                state.value[index] = ensureTeamDefaults(action.payload);
            }
            state.previousState = null;
        });
        builder.addCase(updateTeamAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });

        // Remove team with optimistic updates
        builder.addCase(removeTeamAsync.pending, (state, action) => {
            // Store current state for potential rollback
            state.previousState = [...state.value];
            state.error = null;
            
            // Optimistic update: remove team immediately
            state.value = state.value.filter(team => team.id !== action.meta.arg);
        });
        builder.addCase(removeTeamAsync.fulfilled, (state, action) => {
            // Keep the optimistic removal, clear previous state
            state.previousState = null;
        });
        builder.addCase(removeTeamAsync.rejected, (state, action) => {
            // Rollback to previous state
            if (state.previousState) {
                state.value = state.previousState;
                state.previousState = null;
            }
            state.error = action.payload as string;
        });
    }
}); 