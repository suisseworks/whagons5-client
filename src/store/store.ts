import { configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from 'redux-persist';


import { persistedAuthReducer } from "./auth/authSlice";


const store = configureStore({
    reducer: {
        auth: persistedAuthReducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false
    }),
});

const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>

export { store, persistor };