import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/api/whagonsApi";

export type CustomFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "checkbox"
  | "select"
  | "multi_select"
  | "user"
  | "team"
  | "spot"
  | "url"
  | "file";

export interface CategoryCustomField {
  id: number;
  workspace_id: number;
  label: string;
  key: string; // slug
  type: CustomFieldType;
  description: string | null;
  options_json: any | null; // array or object depending on type
  required: boolean;
  default_value_json: any | null;
  order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export const getCustomFieldsFromApi = createAsyncThunk(
  "customFields/getAll",
  async () => {
    const resp = await api.get("/category-custom-fields", { params: { per_page: 500, page: 1 } });
    const rows = resp?.data?.data ?? resp?.data?.rows ?? [];
    return rows as CategoryCustomField[];
  }
);

export const createCustomField = createAsyncThunk(
  "customFields/create",
  async (payload: Omit<CategoryCustomField, "id" | "created_at" | "updated_at">) => {
    const resp = await api.post("/category-custom-fields", payload);
    return (resp?.data?.data ?? resp?.data) as CategoryCustomField;
  }
);

export const updateCustomField = createAsyncThunk(
  "customFields/update",
  async ({ id, updates }: { id: number; updates: Partial<CategoryCustomField> }) => {
    const resp = await api.patch(`/category-custom-fields/${id}`, updates);
    return (resp?.data?.data ?? resp?.data) as CategoryCustomField;
  }
);

export const deleteCustomField = createAsyncThunk(
  "customFields/delete",
  async (id: number) => {
    await api.delete(`/category-custom-fields/${id}`);
    return id;
  }
);

const initialState = {
  value: [] as CategoryCustomField[],
  loading: false,
  error: null as string | null,
};

export const customFieldsSlice = createSlice({
  name: "customFields",
  initialState,
  reducers: {
    clearError: (state) => { state.error = null; },
  },
  extraReducers: (builder) => {
    builder.addCase(getCustomFieldsFromApi.pending, (state) => { state.loading = true; });
    builder.addCase(getCustomFieldsFromApi.fulfilled, (state, action) => {
      state.loading = false;
      state.value = action.payload;
    });
    builder.addCase(getCustomFieldsFromApi.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || null;
    });

    builder.addCase(createCustomField.fulfilled, (state, action) => {
      state.value.push(action.payload);
    });
    builder.addCase(updateCustomField.fulfilled, (state, action) => {
      const i = state.value.findIndex((f) => f.id === action.payload.id);
      if (i !== -1) state.value[i] = action.payload;
    });
    builder.addCase(deleteCustomField.fulfilled, (state, action) => {
      state.value = state.value.filter((f) => f.id !== action.payload);
    });
  }
});

export default customFieldsSlice.reducer;


