import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Priority } from "../types";
import { GenericCache } from "../indexedDB/GenericCache";

const cache = new GenericCache({ table: 'wh_priorities', endpoint: '/priorities', store: 'priorities' });

export const getPrioritiesFromIndexedDB = createAsyncThunk('loadPriorities', async () => {
	return await cache.getAll();
});

export const fetchPriorities = createAsyncThunk('priorities/fetch', async () => {
    await cache.fetchAll({ per_page: 500, page: 1 });
    return await cache.getAll();
});

const initialState = {
	value: [] as Priority[],
	loading: false,
	error: null as string | null,
};

export const prioritiesSlice = createSlice({
	name: 'priorities',
	initialState,
	reducers: {
		getPriorities: (state) => { state.loading = true; },
		getPrioritiesSuccess: (state, action) => { state.loading = false; state.value = action.payload; },
		getPrioritiesFailure: (state, action) => { state.loading = false; state.error = action.payload; },
		clearError: (state) => { state.error = null; },
	},
	extraReducers: (builder) => {
		builder.addCase(getPrioritiesFromIndexedDB.pending, (state) => { state.loading = true; });
		builder.addCase(getPrioritiesFromIndexedDB.fulfilled, (state, action) => { state.loading = false; state.value = action.payload; });
		builder.addCase(getPrioritiesFromIndexedDB.rejected, (state, action) => { state.loading = false; state.error = action.error.message || null; });

		builder.addCase(fetchPriorities.pending, (state) => { state.loading = true; });
		builder.addCase(fetchPriorities.fulfilled, (state, action) => { state.loading = false; state.value = action.payload; });
		builder.addCase(fetchPriorities.rejected, (state, action) => { state.loading = false; state.error = action.error.message || null; });
	}
});


