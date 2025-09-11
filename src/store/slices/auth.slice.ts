import {createSlice, PayloadAction} from '@reduxjs/toolkit';
import {AuthUser} from "@/auth";

interface AuthState {
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
            localStorage.removeItem('access_token');
        },

        setAuth: (state: AuthState, action: PayloadAction<AuthUser>) => {
            const user = {...state.authUser, ...action.payload};
            state.authUser = user;
            if (user?.access_token) {
                localStorage.setItem('access_token', user?.access_token);
            }
        }
    },
});

export const { initAuth, setAuth} = authSlice.actions
export default authSlice.reducer;
