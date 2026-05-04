import { configureStore, combineReducers, ReducersMapObject, Reducer, UnknownAction } from '@reduxjs/toolkit';
import { persistStore, persistReducer, PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { createEncryptor } from './encryptor';
import { authReducer} from "../slices/auth.slice";
import { StateFromReducersMapObject, StoreConfig, StoreInstance } from "../types";
import { PersistState } from "redux-persist/es/types";


export const defaultSlices: ReducersMapObject = {
    auth: authReducer,
};

export function createStoreFactory<Slices extends ReducersMapObject>(config: StoreConfig<Slices>): StoreInstance {
    const { initialState, keyName, secretKey } = config;

    const registeredReducers: ReducersMapObject = {
        ...defaultSlices,
        ...config.slices,
    };

    const encryptor = createEncryptor(secretKey);

    const buildReducer = () => {
        // Validar que los reducers sean funciones válidas
        /**const validReducers = Object.fromEntries(
            Object.entries(registeredReducers).filter(([_, reducer]) => typeof reducer === 'function')
        ); **/

        const appReducer = combineReducers(registeredReducers) as Reducer<StateFromReducersMapObject<Slices>> & {
            _persist: PersistState;
        };

        const rootReducer = (
            state: StateFromReducersMapObject<Slices> | undefined,
            action: UnknownAction
        ) => {
            if (action.type === 'RESET_STATE') {
                return appReducer(undefined, action);
            }
            return appReducer(state, action);
        };

        const persistConfig: PersistConfig<ReturnType<typeof appReducer>> = {
            key: keyName,
            storage,
            transforms: [encryptor],
            whitelist: Object.keys(registeredReducers),
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