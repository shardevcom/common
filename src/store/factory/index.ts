import { configureStore, combineReducers, ReducersMapObject, Reducer, UnknownAction } from '@reduxjs/toolkit';
import { persistStore, persistReducer, PersistConfig } from 'redux-persist';
import storageImport from 'redux-persist/lib/storage';
import { createEncryptor } from './encryptor';
import { createAuthStorageMiddleware } from './auth-storage';
import { authReducer} from "../slices/auth.slice";
import { StateFromReducersMapObject, StoreConfig, StoreInstance } from "../types";
import { PersistState } from "redux-persist/es/types";
import { StorageBackend, purgeStorage, purgeStorageByPredicate, purgeStorageByPrefix, purgeStorageKeys, PurgeTarget } from "../../utils/storage";


export * from './encryptor';
export * from './auth-storage';
export const defaultSlices: ReducersMapObject = {
    auth: authReducer,
};

export const KEY_PREFIX = 'persist:';

export const createPersistKey = (keyName: string) => `${KEY_PREFIX}${keyName}`;

export function createStoreFactory<Slices extends ReducersMapObject>(config: StoreConfig<Slices>): StoreInstance {
    const { initialState, keyName, secretKey, purgeKeys } = config;

    const registeredReducers: ReducersMapObject = {
        ...defaultSlices,
        ...config.slices,
    };

    const encryptor = createEncryptor(secretKey);

    const storage: StorageBackend =
        config.storage ??
        ((storageImport as any).default ?? storageImport);

    const buildReducer = () => {
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

            const authMiddleware = createAuthStorageMiddleware(storage, config.authStorageKey);
            const middlewares = [
                ...(config.middlewares ?? []),
                ...(authMiddleware ? [authMiddleware] : []),
            ];

            return baseMiddleware.concat(middlewares);
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

    const purge = async (target: PurgeTarget = {}) => {
        const ownKeys = [createPersistKey(keyName), ...(purgeKeys ?? [])];
        const keys = [...ownKeys, ...(target.keys ?? [])];

        if (target.prefix !== undefined || target.predicate) {
            const byTarget = target.prefix !== undefined
                ? await purgeStorageByPrefix(storage, target.prefix)
                : await purgeStorageByPredicate(storage, target.predicate!);
            const byKeys = await purgeStorageKeys(storage, keys);

            const purged = Array.from(new Set([...byKeys.purged, ...byTarget.purged])).sort();
            return { purged, remaining: byTarget.remaining };
        }

        return purgeStorage(storage, { ...target, keys });
    };

    return {
        store,
        persist,
        addReducers,
        purge,
        registeredReducers, // opcional, útil para debug
    };
}

export type AppDispatch = ReturnType<typeof createStoreFactory>['store']['dispatch'];