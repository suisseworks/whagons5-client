import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Status } from "../types";
import { GenericCache } from "../indexedDB/GenericCache";

const cache = new GenericCache({ table: 'wh_statuses', endpoint: '/statuses', store: 'statuses' });

export const getStatusesFromIndexedDB = createAsyncThunk('loadStatuses', async () => {
	return await cache.getAll();
});

const initialState = {
	value: [] as Status[],
	loading: false,
	error: null as string | null,
};

export const statusesSlice = createSlice({
	name: 'statuses',
	initialState,
	reducers: {
		getStatuses: (state) => { state.loading = true; },
		getStatusesSuccess: (state, action) => { state.loading = false; state.value = action.payload; },
		getStatusesFailure: (state, action) => { state.loading = false; state.error = action.payload; },
		clearError: (state) => { state.error = null; },
	},
	extraReducers: (builder) => {
		builder.addCase(getStatusesFromIndexedDB.pending, (state) => { state.loading = true; });
		builder.addCase(getStatusesFromIndexedDB.fulfilled, (state, action) => { state.loading = false; state.value = action.payload; });
		builder.addCase(getStatusesFromIndexedDB.rejected, (state, action) => { state.loading = false; state.error = action.error.message || null; });

		// handle network fetch to keep store in sync
		builder.addCase(fetchStatuses.pending, (state) => { state.loading = true; });
		builder.addCase(fetchStatuses.fulfilled, (state, action) => { state.loading = false; state.value = action.payload; });
		builder.addCase(fetchStatuses.rejected, (state, action) => { state.loading = false; state.error = action.error.message || null; });
	}
});

export const fetchStatuses = createAsyncThunk('statuses/fetch', async () => {
	await cache.fetchAll();
	return await cache.getAll();
});


