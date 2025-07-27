import { configureStore, combineReducers, ReducersMapObject, Reducer } from '@reduxjs/toolkit';
import { persistStore, persistReducer, PersistConfig } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { createEncryptor } from './encryptor';
import {StateFromReducersMapObject, StoreConfig, StoreInstance} from "../types";
import {PersistState} from "redux-persist/es/types";

export function createStoreFactory<Slices extends ReducersMapObject>(config: StoreConfig<Slices>): StoreInstance {
    const { initialState, keyName, secretKey } = config;

    const registeredReducers: ReducersMapObject = { ...config.slices };

    const encryptor = createEncryptor(secretKey);

    const buildReducer = () => {
        const appReducer = combineReducers(registeredReducers) as Reducer<StateFromReducersMapObject<Slices>>& {
            _persist: PersistState
        };

        const rootReducer = (state: StateFromReducersMapObject<Slices> | undefined, action: any) => {
            if (action.type === 'RESET_STATE') {
                return appReducer(undefined, action);
            }
            return appReducer(state, action);
        };

        const persistConfig: PersistConfig<any> = {
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
            if (!registeredReducers[key]) {
                registeredReducers[key] = newSlices[key];
                hasNew = true;
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
        registeredReducers, // opcional, solo para debug
    };
}

export type AppDispatch = ReturnType<typeof createStoreFactory>['store']['dispatch'];
