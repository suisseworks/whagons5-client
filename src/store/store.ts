import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from 'redux-persist';
import { workspacesSlice } from "./reducers/workspacesSlice";
import { teamsSlice } from "./reducers/teamsSlice";
import createIdbStorage from '@piotr-cz/redux-persist-idb-storage'
import { tasksSlice } from "./reducers/tasksSlice";

const persistConfig = {
    key: 'root',
    storage: createIdbStorage({ name: 'WhagonsAPP', storeName: 'redux' }),
    version: 1,
}

const persistedReducer = persistReducer(persistConfig, 
    combineReducers({
        workspaces: workspacesSlice.reducer,
        teams: teamsSlice.reducer,
        tasks: tasksSlice.reducer
    })
)

const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false
    }),
});

const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export { store, persistor };