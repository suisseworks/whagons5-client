import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { workspacesSlice } from "./reducers/workspacesSlice";
import { teamsSlice } from "./reducers/teamsSlice";
import { categoriesSlice } from "./reducers/categoriesSlice";
import { tasksSlice } from "./reducers/tasksSlice";

const rootReducer = combineReducers({
    workspaces: workspacesSlice.reducer,
    teams: teamsSlice.reducer,
    categories: categoriesSlice.reducer,
    tasks: tasksSlice.reducer
});

const store = configureStore({
    reducer: rootReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export { store };