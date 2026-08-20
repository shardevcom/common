import {Middleware, Reducer, ReducersMapObject, Store} from "@reduxjs/toolkit";
import {Persistor, PersistState} from "redux-persist/es/types";
import {createStoreFactory} from "../../store/factory";
import {PurgeResult, PurgeTarget, StorageBackend} from "../../utils/storage";


export type StateFromReducersMapObject<T extends ReducersMapObject> = {
    [K in keyof T]: T[K] extends Reducer<infer S, any> ? S : never;
}  & { _persist: PersistState };

export interface StoreConfig<TSlices extends ReducersMapObject> {
    initialState?: Partial<StateFromReducersMapObject<TSlices>>; // ✅ Estado inicial parcial
    keyName: string;
    secretKey: string;
    slices?: TSlices;
    middlewares?: Middleware[];
    /**
     * Backend de almacenamiento a usar para persistencia y versionado.
     * Por defecto usa `localStorage` (vía redux-persist). Inyectable para pruebas y SSR.
     */
    storage?: StorageBackend;
    /**
     * Clave de storage donde se refleja el `access_token` autenticado.
     * Si no se declara, NO se escribe ninguna clave externa (el token solo
     * vive en el estado Redux persistido). Agnóstico de nombres de claves.
     */
    authStorageKey?: string;
    /**
     * Claves de storage adicionales que deben purgarse cuando cambia la versión
     * (p. ej. tokens sensibles de la app). La purga es dirigida: NUNCA se llama
     * a `clear()` global, para cumplir con estándares tipo CASA.
     */
    purgeKeys?: string[];
}

export interface StoreInstance<TSlices extends ReducersMapObject = ReducersMapObject> {
    store: Store<StateFromReducersMapObject<TSlices>>;
    persist: Persistor;
    addReducers: (slices: ReducersMapObject) => void;
    registeredReducers: TSlices;
    /**
     * Purga dirigida de storage. Por defecto elimina la clave de persistencia
     * de la app (`persist:${keyName}`) y las claves declaradas en `purgeKeys`.
     */
    purge: (target?: PurgeTarget) => Promise<PurgeResult>;
}

export type StoreContextType = ReturnType<typeof createStoreFactory>;
