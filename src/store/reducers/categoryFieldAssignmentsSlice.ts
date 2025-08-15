import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/api/whagonsApi";

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

export const getAssignmentsForCategory = createAsyncThunk(
  "categoryFieldAssignments/getForCategory",
  async (categoryId: number) => {
    const resp = await api.get(`/categories/${categoryId}/custom-fields`);
    const rows = resp?.data?.data ?? resp?.data?.rows ?? [];
    return { categoryId, rows: rows as CategoryFieldAssignment[] };
  }
);

export const bulkAssignFieldToCategories = createAsyncThunk(
  "categoryFieldAssignments/bulkAssign",
  async ({ fieldId, categoryIds }: { fieldId: number; categoryIds: number[] }) => {
    const resp = await api.post(`/category-custom-fields/${fieldId}/assign`, { category_ids: categoryIds });
    return resp?.data ?? { fieldId, categoryIds };
  }
);

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
  }
});

export default categoryFieldAssignmentsSlice.reducer;


