import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Team } from "../Types";
import { TeamsCache } from "../indexedDB/TeamsCache";

// Helper function to ensure team has all required properties
const ensureTeamDefaults = (team: any): Team => {
    const defaultDescription = team.description || `Team for ${team.name}`;
    
    return {
        ...team,
        color: team.color || '#374151',
        description: defaultDescription
    };
};

export const getTeamsFromIndexedDB = createAsyncThunk('loadTeams', async () => {
    const teams = await TeamsCache.getTeams();
    return teams;
})  

const initialState = {
    value: [
    ] as Team[],
    loading: false,
    error: null as string | null
}

export const teamsSlice = createSlice({
    name: 'teams',
    initialState,
    reducers: {
        getTeams: (state) => {
            state.loading = true
        },
        getTeamsSuccess: (state, action) => {
            state.loading = false
            state.value = action.payload.map(ensureTeamDefaults)
        },
        getTeamsFailure: (state, action) => {  
            state.loading = false
            state.error = action.payload
        },
        addTeam: (state, action) => {
            state.value.push(ensureTeamDefaults(action.payload))
        },
        removeTeam: (state, action) => {
            state.value = state.value.filter((team) => team.id !== action.payload)
        },
        updateTeam: (state, action) => {
            const index = state.value.findIndex((team) => team.id === action.payload.id)
            if (index !== -1) {
                state.value[index] = ensureTeamDefaults(action.payload)
            }
        }
    },
    extraReducers: (builder) => {
        builder.addCase(getTeamsFromIndexedDB.pending, (state) => {
            state.loading = true
        })
        builder.addCase(getTeamsFromIndexedDB.fulfilled, (state, action) => {
            state.loading = false
            state.value = action.payload.map(ensureTeamDefaults)
        })
        builder.addCase(getTeamsFromIndexedDB.rejected, (state, action) => {
            state.loading = false
            state.error = action.error.message || null
        })
    }
}) 