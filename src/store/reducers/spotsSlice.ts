import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Spot } from "../types";
import { GenericCache } from "../indexedDB/GenericCache";

const cache = new GenericCache({ table: 'wh_spots', endpoint: '/spots', store: 'spots' });

export const getSpotsFromIndexedDB = createAsyncThunk('loadSpots', async () => {
	return await cache.getAll();
});

export const fetchSpots = createAsyncThunk('spots/fetch', async () => {
    await cache.fetchAll({ per_page: 500, page: 1 });
    return await cache.getAll();
});

const initialState = {
	value: [] as Spot[],
	loading: false,
	error: null as string | null,
};

export const spotsSlice = createSlice({
	name: 'spots',
	initialState,
	reducers: {
		getSpots: (state) => { state.loading = true; },
		getSpotsSuccess: (state, action) => { state.loading = false; state.value = action.payload; },
		getSpotsFailure: (state, action) => { state.loading = false; state.error = action.payload; },
		clearError: (state) => { state.error = null; },
	},
	extraReducers: (builder) => {
		builder.addCase(getSpotsFromIndexedDB.pending, (state) => { state.loading = true; });
		builder.addCase(getSpotsFromIndexedDB.fulfilled, (state, action) => { state.loading = false; state.value = action.payload; });
		builder.addCase(getSpotsFromIndexedDB.rejected, (state, action) => { state.loading = false; state.error = action.error.message || null; });

		builder.addCase(fetchSpots.pending, (state) => { state.loading = true; });
		builder.addCase(fetchSpots.fulfilled, (state, action) => { state.loading = false; state.value = action.payload; });
		builder.addCase(fetchSpots.rejected, (state, action) => { state.loading = false; state.error = action.error.message || null; });
	}
});


