import { configureStore, combineReducers, ReducersMapObject, Reducer, AnyAction } from '@reduxjs/toolkit';
import { persistStore, persistReducer, PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { createEncryptor } from './encryptor';
import { StateFromReducersMapObject, StoreConfig, StoreInstance } from "../types";
import { PersistState } from "redux-persist/es/types";
import { authSlice } from "../slices/auth.slice"; // Asegúrate de tener esto

// Reducer por defecto
const defaultReducers: ReducersMapObject = {
    auth: authSlice.reducer,
};

export function createStoreFactory<Slices extends ReducersMapObject>(config: StoreConfig<Slices>): StoreInstance {
    const { initialState, keyName, secretKey } = config;

    // Reducers registrados inicialmente (default + personalizados)
    const registeredReducers: ReducersMapObject = {
        ...defaultReducers,
        ...config.slices,
    };

    const encryptor = createEncryptor(secretKey);

    const buildReducer = () => {
        // Validar que los reducers sean funciones válidas
        const validReducers = Object.fromEntries(
            Object.entries(registeredReducers).filter(([_, reducer]) => typeof reducer === 'function')
        );

        const appReducer = combineReducers(validReducers) as Reducer<StateFromReducersMapObject<Slices>> & {
            _persist: PersistState;
        };

        const rootReducer = (
            state: StateFromReducersMapObject<Slices> | undefined,
            action: AnyAction
        ) => {
            if (action.type === 'RESET_STATE') {
                return appReducer(undefined, action);
            }
            return appReducer(state, action);
        };

        const persistConfig: PersistConfig<any> = {
            key: keyName,
            storage,
            transforms: [encryptor],
            whitelist: Object.keys(validReducers),
        };

        return persistReducer(persistConfig, rootReducer);
    };

    const store = configureStore({
        reducer: buildReducer(),
        preloadedState: initialState as StateFromReducersMapObject<Slices>,
        middleware: (getDefaultMiddleware) =>
            getDefaultMiddleware({
                serializableCheck: {
                    ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
                    ignoredPaths: ['_persist'],
                },
            }),
    });

    const persist = persistStore(store);

    const addReducers = (newSlices: ReducersMapObject) => {
        let hasNew = false;

        for (const key in newSlices) {
            const newReducer = newSlices[key];
            if (typeof newReducer === 'function') {
                registeredReducers[key] = newReducer;
                hasNew = true;
            } else {
                console.warn(`Reducer "${key}" is invalid and was not added.`);
            }
        }

        if (hasNew) {
            store.replaceReducer(buildReducer());
        }
    };

    return {
        store,
        persist,
        addReducers,
        registeredReducers, // opcional, útil para debug
    };
}

export type AppDispatch = ReturnType<typeof createStoreFactory>['store']['dispatch'];