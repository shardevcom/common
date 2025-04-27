import {PersistedState} from "redux-persist";

export interface RootAppState {
    [key: string]: ReturnType<any>;
}

export interface AppSetting {
    initialState?: RootAppState & PersistedState
    appKey?: string
    guardName?: string
    secretKey?: string
    reducers?: { [key: string]: any };
}
