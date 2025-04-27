import {ReducersMapObject} from "@reduxjs/toolkit";
import {PersistState} from "redux-persist/es/types";
import {createStoreFactory} from "../factory";


export type StateFromReducersMapObject<Slices extends ReducersMapObject> = {
    [K in keyof Slices]: Slices[K] extends (...args: any) => any ? ReturnType<Slices[K]> : never;
} & { _persist: PersistState }; // 🔥 Asegurar que _persist SIEMPRE esté presente


export interface StoreConfig<Slices extends ReducersMapObject> {
    initialState?: Partial<StateFromReducersMapObject<Slices>>; // ✅ Estado inicial parcial
    keyName: string;
    secretKey: string;
    slices: Slices;
}

export type StoreContextType = ReturnType<typeof createStoreFactory>;
