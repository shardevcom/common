import {configureStore, combineReducers, ReducersMapObject, Reducer} from '@reduxjs/toolkit';
import { persistStore, persistReducer, PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { createEncryptor } from './encryptor';
import {StateFromReducersMapObject, StoreConfig} from "../types";


export function createStoreFactory<Slices extends ReducersMapObject>(config: StoreConfig<Slices>) {
    const { initialState, keyName, secretKey, slices } = config;

    // Crear el rootReducer asegurando que sea del tipo correcto
    const appReducer = combineReducers(slices) as unknown as Reducer<StateFromReducersMapObject<Slices>>;

    const rootReducer = (state: StateFromReducersMapObject<Slices> | undefined, action: any) => {
        if (action.type === 'RESET_STATE') {
            return appReducer(undefined, action); // Reinicia el estado a undefined (o initialState si se define en los slices)
        }
        return appReducer(state, action);
    };


    // Crear el encriptador/desencriptador
    const encryptor = createEncryptor(secretKey);

    // Configuración de persistencia
    const persistConfig: PersistConfig<StateFromReducersMapObject<Slices>> = {
        key: keyName,
        storage,
        transforms: [encryptor],
        whitelist: Object.keys(slices), // Persistir solo los slices indicados
    };

    // Reducer persistente
    const persistedReducer = persistReducer(persistConfig, rootReducer);

    // Configuración del store con middleware mejorado
    const store = configureStore({
        reducer: persistedReducer,
        preloadedState: initialState as StateFromReducersMapObject<Slices>, // ✅ Asegurar que el estado inicial sea correcto
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: {
                    ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
                    ignoredPaths: ['_persist'],
                },
            }),
    });

    const persist = persistStore(store);

    return { store, persist };
}


export type AppDispatch = ReturnType<typeof createStoreFactory>['store']['dispatch'];



