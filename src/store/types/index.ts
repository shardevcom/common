import {ReducersMapObject, Store} from "@reduxjs/toolkit";
import {Persistor, PersistState} from "redux-persist/es/types";
import {createStoreFactory} from "../factory";


export type StateFromReducersMapObject<TSlices extends ReducersMapObject> = {
    [K in keyof TSlices]: TSlices[K] extends (...args: any) => any ? ReturnType<TSlices[K]> : never;
} & { _persist: PersistState }; // 🔥 Asegurar que _persist SIEMPRE esté presente


export interface StoreConfig<TSlices> {
    initialState?: Partial<StateFromReducersMapObject<ReducersMapObject<TSlices>>>; // ✅ Estado inicial parcial
    keyName: string;
    secretKey: string;
    slices?: ReducersMapObject<TSlices>;
}

export interface StoreInstance {
    store: Store;
    persist: Persistor;
    addReducers: <TSlices>(TSlices: ReducersMapObject<TSlices>) => void;
    registeredReducers?: Record<string, any>; // opcional
}

export type StoreContextType = ReturnType<typeof createStoreFactory>;
