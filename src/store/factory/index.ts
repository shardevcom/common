import { configureStore, combineReducers, ReducersMapObject, Reducer } from '@reduxjs/toolkit';
import { persistStore, persistReducer, PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { createEncryptor } from './encryptor';
import { StateFromReducersMapObject, StoreConfig, StoreInstance, authSlice } from "@/store";
import { PersistState } from "redux-persist/es/types";

// Reducer por defecto
const defaultReducers: ReducersMapObject = {
    auth: authSlice.reducer,
};

export type CombinedState<Slices extends ReducersMapObject> =
    StateFromReducersMapObject<typeof defaultReducers> &
    StateFromReducersMapObject<Slices>;

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

        const appReducer = combineReducers(validReducers) as Reducer<CombinedState<Slices>> & {
            _persist: PersistState;
        };

        const rootReducer = (
            state: CombinedState<Slices> | undefined,
            action: UnknownAction
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
        middleware: (getDefaultMiddleware) => {
            const baseMiddleware = getDefaultMiddleware({
                serializableCheck: {
                    ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
                    ignoredPaths: ['_persist'],
                },
            });

            return config.middlewares
                ? baseMiddleware.concat(config.middlewares)
                : baseMiddleware;
        },
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