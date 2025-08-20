import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "@/api/whagonsApi";
import { GenericCache } from "../indexedDB/GenericCache";

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

// Generic cache instance for custom fields
const customFieldsCache = new GenericCache({
  table: "wh_category_custom_fields",
  endpoint: "/category-custom-fields",
  store: "custom_fields",
  hashFields: [
    "id",
    "workspace_id",
    "label",
    "key",
    "type",
    "order",
    "active",
    "updated_at",
  ],
});

export const getCustomFieldsFromIndexedDB = createAsyncThunk(
  "customFields/loadFromIndexedDB",
  async () => {
    return (await customFieldsCache.getAll()) as CategoryCustomField[];
  }
);

export const fetchCustomFields = createAsyncThunk(
  "customFields/fetch",
  async () => {
    await customFieldsCache.fetchAll({ per_page: 500, page: 1 });
    return (await customFieldsCache.getAll()) as CategoryCustomField[];
  }
);

export const createCustomField = createAsyncThunk(
  "customFields/create",
  async (payload: Omit<CategoryCustomField, "id" | "created_at" | "updated_at">) => {
    const resp = await api.post("/category-custom-fields", payload);
    const row = (resp?.data?.data ?? resp?.data) as CategoryCustomField;
    await customFieldsCache.add(row);
    return row;
  }
);

export const updateCustomField = createAsyncThunk(
  "customFields/update",
  async ({ id, updates }: { id: number; updates: Partial<CategoryCustomField> }) => {
    const resp = await api.patch(`/category-custom-fields/${id}`, updates);
    const row = (resp?.data?.data ?? resp?.data) as CategoryCustomField;
    await customFieldsCache.update(id, row);
    return row;
  }
);

export const deleteCustomField = createAsyncThunk(
  "customFields/delete",
  async (id: number) => {
    await api.delete(`/category-custom-fields/${id}`);
    await customFieldsCache.remove(id);
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
    builder.addCase(getCustomFieldsFromIndexedDB.pending, (state) => { state.loading = true; });
    builder.addCase(getCustomFieldsFromIndexedDB.fulfilled, (state, action) => {
      state.loading = false;
      state.value = action.payload;
    });
    builder.addCase(getCustomFieldsFromIndexedDB.rejected, (state, action) => {
      state.loading = false;
      state.error = action.error.message || null;
    });

    // network fetch to refresh cache
    builder.addCase(fetchCustomFields.pending, (state) => { state.loading = true; });
    builder.addCase(fetchCustomFields.fulfilled, (state, action) => { state.loading = false; state.value = action.payload; });
    builder.addCase(fetchCustomFields.rejected, (state, action) => { state.loading = false; state.error = action.error.message || null; });

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


