import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { Tag } from "../types";
import { GenericCache } from "../indexedDB/GenericCache";

const cache = new GenericCache({ table: 'wh_tags', endpoint: '/tags', store: 'tags' });

export const getTagsFromIndexedDB = createAsyncThunk('loadTags', async () => {
    return await cache.getAll();
});

const initialState = {
    value: [] as Tag[],
    loading: false,
    error: null as string | null,
};

export const tagsSlice = createSlice({
    name: 'tags',
    initialState,
    reducers: {
        getTags: (state) => { state.loading = true; },
        getTagsSuccess: (state, action) => { state.loading = false; state.value = action.payload; },
        getTagsFailure: (state, action) => { state.loading = false; state.error = action.payload; },
        clearError: (state) => { state.error = null; },
    },
    extraReducers: (builder) => {
        builder.addCase(getTagsFromIndexedDB.pending, (state) => { state.loading = true; });
        builder.addCase(getTagsFromIndexedDB.fulfilled, (state, action) => { state.loading = false; state.value = action.payload; });
        builder.addCase(getTagsFromIndexedDB.rejected, (state, action) => { state.loading = false; state.error = action.error.message || null; });
    }
});


