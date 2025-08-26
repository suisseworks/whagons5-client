import { combineReducers, configureStore } from "@reduxjs/toolkit";

// Custom slice with advanced features (only tasks)
import { tasksSlice } from "./reducers/tasksSlice";

// All other slices (30+ tables) handled by generic factory
import { genericSlices } from "./genericSlices";

const rootReducer = combineReducers({
    // Only custom slice with advanced features (tasks)
    tasks: tasksSlice.reducer,

    // All other slices (30+ tables) handled by generic factory
    ...genericSlices.reducers,
}) as any;

const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export { store };