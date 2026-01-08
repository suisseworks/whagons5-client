import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import api from "@/api/whagonsApi";
import { Team } from "@/store/types";

// State interface
interface CategoryReportingTeamsState {
  // Mapping of categoryId -> teamIds[]
  data: Record<number, number[]>;
  // Loading state per category (for fetch operations)
  loading: Record<number, boolean>;
  // Saving state per category (for update operations)
  saving: Record<number, boolean>;
  // Error state per category
  error: Record<number, string | null>;
}

const initialState: CategoryReportingTeamsState = {
  data: {},
  loading: {},
  saving: {},
  error: {},
};

/**
 * Fetch reporting teams for a specific category
 */
export const fetchCategoryReportingTeams = createAsyncThunk<
  { categoryId: number; teamIds: number[] },
  number,
  { rejectValue: { categoryId: number; error: string } }
>(
  "categoryReportingTeams/fetch",
  async (categoryId: number, { rejectWithValue }) => {
    try {
      const response = await api.get(`/categories/${categoryId}/reporting-teams`);
      const reportingTeams = (response.data?.data || []) as Team[];
      const teamIds = reportingTeams.map((team: Team) => team.id);
      return { categoryId, teamIds };
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || "Failed to load reporting teams";
      return rejectWithValue({ categoryId, error: errorMessage });
    }
  }
);

/**
 * Update reporting teams for a specific category
 */
export const updateCategoryReportingTeams = createAsyncThunk<
  { categoryId: number; teamIds: number[] },
  { categoryId: number; teamIds: number[] },
  { rejectValue: { categoryId: number; error: string } }
>(
  "categoryReportingTeams/update",
  async ({ categoryId, teamIds }, { rejectWithValue }) => {
    try {
      await api.patch(`/categories/${categoryId}/reporting-teams`, {
        team_ids: teamIds,
      });
      return { categoryId, teamIds };
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || "Failed to save reporting teams";
      return rejectWithValue({ categoryId, error: errorMessage });
    }
  }
);

const categoryReportingTeamsSlice = createSlice({
  name: "categoryReportingTeams",
  initialState,
  reducers: {
    // Clear error for a specific category
    clearError: (state, action: PayloadAction<number>) => {
      const categoryId = action.payload;
      state.error[categoryId] = null;
    },
    // Clear all data (useful for logout)
    clearAll: (state) => {
      state.data = {};
      state.loading = {};
      state.saving = {};
      state.error = {};
    },
  },
  extraReducers: (builder) => {
    // Fetch thunk
    builder
      .addCase(fetchCategoryReportingTeams.pending, (state, action) => {
        const categoryId = action.meta.arg;
        state.loading[categoryId] = true;
        state.error[categoryId] = null;
      })
      .addCase(fetchCategoryReportingTeams.fulfilled, (state, action) => {
        const { categoryId, teamIds } = action.payload;
        state.data[categoryId] = teamIds;
        state.loading[categoryId] = false;
        state.error[categoryId] = null;
      })
      .addCase(fetchCategoryReportingTeams.rejected, (state, action) => {
        const categoryId = action.meta.arg;
        state.loading[categoryId] = false;
        if (action.payload) {
          state.error[categoryId] = action.payload.error;
        } else {
          state.error[categoryId] = "Failed to load reporting teams";
        }
      });

    // Update thunk
    builder
      .addCase(updateCategoryReportingTeams.pending, (state, action) => {
        const categoryId = action.meta.arg.categoryId;
        state.saving[categoryId] = true;
        state.error[categoryId] = null;
      })
      .addCase(updateCategoryReportingTeams.fulfilled, (state, action) => {
        const { categoryId, teamIds } = action.payload;
        state.data[categoryId] = teamIds;
        state.saving[categoryId] = false;
        state.error[categoryId] = null;
      })
      .addCase(updateCategoryReportingTeams.rejected, (state, action) => {
        const categoryId = action.meta.arg.categoryId;
        state.saving[categoryId] = false;
        if (action.payload) {
          state.error[categoryId] = action.payload.error;
        } else {
          state.error[categoryId] = "Failed to save reporting teams";
        }
      });
  },
});

export const { clearError, clearAll } = categoryReportingTeamsSlice.actions;
export default categoryReportingTeamsSlice.reducer;

// Selectors
export const selectReportingTeamsByCategoryId = (state: { categoryReportingTeams: CategoryReportingTeamsState }, categoryId: number): number[] => {
  return state.categoryReportingTeams.data[categoryId] || [];
};

export const selectReportingTeamsLoading = (state: { categoryReportingTeams: CategoryReportingTeamsState }, categoryId: number): boolean => {
  return state.categoryReportingTeams.loading[categoryId] || false;
};

export const selectReportingTeamsError = (state: { categoryReportingTeams: CategoryReportingTeamsState }, categoryId: number): string | null => {
  return state.categoryReportingTeams.error[categoryId] || null;
};

export const selectReportingTeamsSaving = (state: { categoryReportingTeams: CategoryReportingTeamsState }, categoryId: number): boolean => {
  return state.categoryReportingTeams.saving[categoryId] || false;
};