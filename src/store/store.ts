import { combineReducers, configureStore } from "@reduxjs/toolkit";

// Custom slice with advanced features (only tasks)
import { tasksSlice } from "./reducers/tasksSlice";

// Roles slice (not a wh_* table, special slice for Spatie roles)
import rolesReducer from "./reducers/rolesSlice";

// Tenant availability slice
import tenantAvailabilityReducer from "./reducers/tenantAvailabilitySlice";

// UI state slice
import uiStateReducer from "./reducers/uiStateSlice";

// Notification preferences slice
import notificationPreferencesReducer from "./reducers/notificationPreferencesSlice";

// All other slices (30+ tables) handled by generic factory
import { genericSlices } from "./genericSlices";

const appReducer = combineReducers({
    // Only custom slice with advanced features (tasks)
    tasks: tasksSlice.reducer,

    // Roles slice (Spatie roles table, not wh_*)
    roles: rolesReducer,

    // Tenant availability checking
    tenantAvailability: tenantAvailabilityReducer,

    // UI state (filter model, search text, grouping, presets)
    uiState: uiStateReducer,

    // Notification preferences
    notificationPreferences: notificationPreferencesReducer,

    // All other slices (30+ tables) handled by generic factory
    ...genericSlices.reducers,
}) as any;

const rootReducer = (state: ReturnType<typeof appReducer> | undefined, action: any) => {
    if (action?.type === 'auth/logout/reset') {
        state = undefined;
    }
    return appReducer(state, action);
};

const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export { store };