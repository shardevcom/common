import {Middleware, Reducer, ReducersMapObject, Store} from "@reduxjs/toolkit";
import {Persistor, PersistState} from "redux-persist/es/types";
import {createStoreFactory} from "../../store/factory";


export type StateFromReducersMapObject<T extends ReducersMapObject> = {
    [K in keyof T]: T[K] extends Reducer<infer S, any> ? S : never;
}  & { _persist: PersistState };

export interface StoreConfig<TSlices extends ReducersMapObject> {
    initialState?: Partial<StateFromReducersMapObject<TSlices>>; // ✅ Estado inicial parcial
    keyName: string;
    secretKey: string;
    slices?: TSlices;
    middlewares?: Middleware[];
}

export interface StoreInstance<TSlices extends ReducersMapObject = ReducersMapObject> {
    store: Store<StateFromReducersMapObject<TSlices>>;
    persist: Persistor;
    addReducers: (slices: ReducersMapObject) => void;
    registeredReducers: TSlices;
}

export type StoreContextType = ReturnType<typeof createStoreFactory>;
