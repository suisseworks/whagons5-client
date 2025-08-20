import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/api/whagonsApi";
import { GenericCache } from "../indexedDB/GenericCache";

export interface CategoryFieldAssignment {
  id: number;
  category_id: number;
  custom_field_id: number;
  order: number;
  required_override: boolean | null;
  default_override_json: any | null;
  help_text: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// Cache holds all assignments; component can filter by category locally if needed
const cfaCache = new GenericCache({
  table: "wh_category_field_assignments",
  endpoint: "/category-field-assignments",
  store: "category_field_assignments",
  hashFields: [
    "id",
    "category_id",
    "custom_field_id",
    "order",
    "active",
    "updated_at",
  ],
});

export const getAssignmentsForCategory = createAsyncThunk(
  "categoryFieldAssignments/getForCategory",
  async (categoryId: number) => {
    // Fetch from API (authoritative), then upsert into cache for reuse
    const resp = await api.get(`/categories/${categoryId}/custom-fields`);
    const rows = (resp?.data?.data ?? resp?.data?.rows ?? []) as CategoryFieldAssignment[];
    for (const r of rows) await cfaCache.add(r);
    return { categoryId, rows };
  }
);

export const bulkAssignFieldToCategories = createAsyncThunk(
  "categoryFieldAssignments/bulkAssign",
  async ({ fieldId, categoryIds }: { fieldId: number; categoryIds: number[] }) => {
    const resp = await api.post(`/category-custom-fields/${fieldId}/assign`, { category_ids: categoryIds });
    // Refresh cache for affected categories
    for (const catId of categoryIds) {
      try {
        const r = await api.get(`/categories/${catId}/custom-fields`);
        const rows = (r?.data?.data ?? r?.data?.rows ?? []) as CategoryFieldAssignment[];
        for (const row of rows) await cfaCache.add(row);
      } catch {}
    }
    return resp?.data ?? { fieldId, categoryIds };
  }
);

// Note: no global fetch endpoint for all assignments is assumed; we populate per-category

const initialState = {
  // Map categoryId -> assignments
  byCategory: {} as Record<number, CategoryFieldAssignment[]>,
  loading: false,
  error: null as string | null,
};

export const categoryFieldAssignmentsSlice = createSlice({
  name: "categoryFieldAssignments",
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder.addCase(getAssignmentsForCategory.pending, (state) => { state.loading = true; });
    builder.addCase(getAssignmentsForCategory.fulfilled, (state, action) => {
      state.loading = false;
      state.byCategory[action.payload.categoryId] = action.payload.rows;
    });
    builder.addCase(getAssignmentsForCategory.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || null;
    });

    builder.addCase(bulkAssignFieldToCategories.rejected, (state, action) => {
      state.error = action.error.message || null;
    });

    // no-op placeholder to keep builder shape consistent
  }
});

export default categoryFieldAssignmentsSlice.reducer;


