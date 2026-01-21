import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { api } from '../api/internalApi';
import toast from 'react-hot-toast';

export interface NotificationPreferences {
  broadcasts: boolean;
  task_assignments: boolean;
  task_mentions: boolean;
  task_comments: boolean;
  task_status_changes: boolean;
  messages: boolean;
  approval_requests: boolean;
  approval_decisions: boolean;
  sla_alerts: boolean;
  workflow_notifications: boolean;
}

const defaultPreferences: NotificationPreferences = {
  broadcasts: true,
  task_assignments: true,
  task_mentions: true,
  task_comments: true,
  task_status_changes: true,
  messages: true,
  approval_requests: true,
  approval_decisions: true,
  sla_alerts: true,
  workflow_notifications: true,
};

interface NotificationPreferencesState {
  preferences: NotificationPreferences;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: NotificationPreferencesState = {
  preferences: defaultPreferences,
  loading: false,
  saving: false,
  error: null,
};

// Fetch notification preferences from API
export const fetchNotificationPreferences = createAsyncThunk(
  'notificationPreferences/fetchNotificationPreferences',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/notification-preferences');
      const data = response.data?.data || response.data;
      return data.notifications || defaultPreferences;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to load notification preferences';
      return rejectWithValue(errorMessage);
    }
  }
);

// Update notification preferences via API
export const updateNotificationPreferences = createAsyncThunk(
  'notificationPreferences/updateNotificationPreferences',
  async (preferences: NotificationPreferences, { rejectWithValue }) => {
    try {
      const response = await api.put('/notification-preferences', {
        notifications: preferences
      });
      const data = response.data?.data || response.data;
      toast.success('Notification preferences saved successfully');
      return data.notifications || preferences;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to save notification preferences';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

const notificationPreferencesSlice = createSlice({
  name: 'notificationPreferences',
  initialState,
  reducers: {
    setPreferences: (state, action: PayloadAction<NotificationPreferences>) => {
      state.preferences = action.payload;
      state.error = null;
    },
    updatePreference: (state, action: PayloadAction<{ key: keyof NotificationPreferences; value: boolean }>) => {
      state.preferences[action.payload.key] = action.payload.value;
    },
    resetPreferences: (state) => {
      state.preferences = defaultPreferences;
      state.error = null;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch preferences
      .addCase(fetchNotificationPreferences.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNotificationPreferences.fulfilled, (state, action) => {
        state.loading = false;
        state.preferences = action.payload;
        state.error = null;
      })
      .addCase(fetchNotificationPreferences.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string || 'Failed to load notification preferences';
        // Keep default preferences on error
      })
      // Update preferences
      .addCase(updateNotificationPreferences.pending, (state) => {
        state.saving = true;
        state.error = null;
      })
      .addCase(updateNotificationPreferences.fulfilled, (state, action) => {
        state.saving = false;
        state.preferences = action.payload;
        state.error = null;
      })
      .addCase(updateNotificationPreferences.rejected, (state, action) => {
        state.saving = false;
        state.error = action.payload as string || 'Failed to save notification preferences';
      });
  },
});

export const { setPreferences, updatePreference, resetPreferences, clearError } = notificationPreferencesSlice.actions;
export default notificationPreferencesSlice.reducer;
