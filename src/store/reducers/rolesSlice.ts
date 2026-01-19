import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../api/internalApi';
import { Role } from '../types';

interface RolesState {
  value: Role[];
  loading: boolean;
  error: string | null;
}

const initialState: RolesState = {
  value: [],
  loading: false,
  error: null,
};

// Fetch roles from API
export const fetchRoles = createAsyncThunk(
  'roles/fetchRoles',
  async () => {
    const response = await api.get('/roles');
    return response.data.data || [];
  }
);

const rolesSlice = createSlice({
  name: 'roles',
  initialState,
  reducers: {
    setRoles: (state, action: PayloadAction<Role[]>) => {
      state.value = action.payload;
      state.error = null;
    },
    addRole: (state, action: PayloadAction<Role>) => {
      state.value.push(action.payload);
    },
    updateRole: (state, action: PayloadAction<Role>) => {
      const index = state.value.findIndex(r => r.id === action.payload.id);
      if (index !== -1) {
        state.value[index] = action.payload;
      }
    },
    removeRole: (state, action: PayloadAction<number>) => {
      state.value = state.value.filter(r => r.id !== action.payload);
    },
    clearRoles: (state) => {
      state.value = [];
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchRoles.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchRoles.fulfilled, (state, action) => {
        state.loading = false;
        state.value = action.payload;
        state.error = null;
      })
      .addCase(fetchRoles.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch roles';
      });
  },
});

export const { setRoles, addRole, updateRole, removeRole, clearRoles, setLoading, setError } = rolesSlice.actions;
export default rolesSlice.reducer;
