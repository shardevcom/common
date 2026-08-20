import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {AuthUser} from "../../auth/types";

export interface AuthState {
    authUser: AuthUser
}

const initialState: AuthState = {
    authUser: {
        id: '',
        name: '',
        email: '',
        refresh_token: '',
        access_token: '',
        token_type: '',
        expires_at: '',
        roles: [],
        permissions: []
    }
}
export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        initAuth: (state: AuthState) => {
            state.authUser = initialState.authUser
        },

        logout: (state: AuthState) => {
            state.authUser = initialState.authUser
        },

        setAuth: (state: AuthState, action: PayloadAction<AuthUser>) => {
            state.authUser = {...state.authUser, ...action.payload};
        }
    },
});

export const { initAuth, logout, setAuth} = authSlice.actions
export const authReducer = authSlice.reducer;