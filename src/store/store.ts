import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from 'redux-persist';
import { pizzaSlice } from "./reducers/pizzaSlice";
import createIdbStorage from '@piotr-cz/redux-persist-idb-storage'




const persistConfig = {
    key: 'root',
    storage: createIdbStorage({ name: 'WhagonsAPP', storeName: 'redux' }),
    version: 1,
  }

const persistedReducer = persistReducer(persistConfig, 
    combineReducers({
        pizza: pizzaSlice.reducer
    })
)

const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) => getDefaultMiddleware({
        serializableCheck: false
    }),
});

const persistor = persistStore(store);

export { store, persistor };