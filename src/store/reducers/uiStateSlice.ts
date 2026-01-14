import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  // Filter model for workspace table
  currentFilterModel: any | null;
  // Search text for workspace
  searchText: string;
  // Grouping option
  groupBy: 'none' | 'spot_id' | 'status_id' | 'priority_id';
  // Whether groups should be collapsed
  collapseGroups: boolean;
  // Quick filter presets (pinned, shown in header)
  quickPresets: any[];
  // All filter presets (shown in dropdown)
  allPresets: any[];
}

const initialState: UIState = {
  currentFilterModel: null,
  searchText: '',
  groupBy: 'none',
  collapseGroups: true,
  quickPresets: [],
  allPresets: [],
};

export const uiStateSlice = createSlice({
  name: 'uiState',
  initialState,
  reducers: {
    setFilterModel: (state, action: PayloadAction<any | null>) => {
      state.currentFilterModel = action.payload;
    },
    setSearchText: (state, action: PayloadAction<string>) => {
      state.searchText = action.payload;
    },
    setGroupBy: (state, action: PayloadAction<'none' | 'spot_id' | 'status_id' | 'priority_id'>) => {
      state.groupBy = action.payload;
    },
    setCollapseGroups: (state, action: PayloadAction<boolean>) => {
      state.collapseGroups = action.payload;
    },
    setPresets: (state, action: PayloadAction<{ quickPresets: any[]; allPresets: any[] }>) => {
      state.quickPresets = action.payload.quickPresets;
      state.allPresets = action.payload.allPresets;
    },
    // Clear all UI state (useful for workspace changes)
    clearUIState: (state) => {
      state.currentFilterModel = null;
      state.searchText = '';
      state.groupBy = 'none';
      state.collapseGroups = true;
      state.quickPresets = [];
      state.allPresets = [];
    },
  },
});

export const {
  setFilterModel,
  setSearchText,
  setGroupBy,
  setCollapseGroups,
  setPresets,
  clearUIState,
} = uiStateSlice.actions;

// Selectors (using RootState for proper typing)
import type { RootState } from '../store';

export const selectFilterModel = (state: RootState) => state.uiState.currentFilterModel;
export const selectSearchText = (state: RootState) => state.uiState.searchText;
export const selectGroupBy = (state: RootState) => state.uiState.groupBy;
export const selectCollapseGroups = (state: RootState) => state.uiState.collapseGroups;
export const selectQuickPresets = (state: RootState) => state.uiState.quickPresets;
export const selectAllPresets = (state: RootState) => state.uiState.allPresets;

export default uiStateSlice.reducer;
