import { createSlice } from '@reduxjs/toolkit';

import { persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';


export const authSlice = createSlice({
    name: 'auth',
    initialState: {
        status: 'checking', // 'checking' | 'authenticated' | 'not-authenticated'
        user: {},
        errorMessage: undefined,
    },
    reducers: {
        checking: (state) => {
            state.status = 'checking';
            state.user = {};
            state.errorMessage = undefined;
        },
        onLogin: (state, { payload }) => {
            state.status = 'authenticated';
            state.user = payload;
            state.errorMessage = undefined;
        },
        OnLogout: (state) => {
            state.status = 'not-authenticated';
            state.user = {};
            state.errorMessage = undefined;
        },
        OnLoadingError: (state, { payload }) => {
            state.status = 'not-authenticated';
            state.user = {};
            state.errorMessage = payload;
        },
        clearErrorMessage: (state) => {
            state.errorMessage = undefined
        }
    }
});

const persistConfig = {
    key: 'auth',
    storage,
};

export const persistedAuthReducer = persistReducer(persistConfig, authSlice.reducer);
 
 
export const { 
    checking, 
    onLogin,
    OnLoadingError,
    clearErrorMessage,
    OnLogout
 } = authSlice.actions;