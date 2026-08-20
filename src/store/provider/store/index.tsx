import React, { ReactNode } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import {StoreConfig} from "../../types";
import {StoreContext} from "../../context";
import {createStoreFactory, createPersistKey} from "../../factory";
import {purgeStorageKeys} from "../../../utils/storage";

interface StoreProviderProps<Slices extends Record<string, any>> {
    config: StoreConfig<Slices>;
    children: ReactNode;
}

export const StoreProvider = <Slices extends Record<string, any>>({
                                                                      config,
                                                                      children,
                                                                  }: StoreProviderProps<Slices>) => {
    const storage = config.storage ?? window.localStorage;
    const versionKey = `version${config.keyName}`;
    const storedVersion = storage.getItem(versionKey);

    if (storedVersion !== config.secretKey) {
        // Purga dirigida: solo las claves propias de la app. Nunca clear() global,
        // para no borrar sesiones de otras apps del mismo origen (estándares tipo CASA).
        purgeStorageKeys(storage, [
            versionKey,
            createPersistKey(config.keyName),
            ...(config.purgeKeys ?? []),
        ]);
        storage.setItem(versionKey, config.secretKey);
    }

    const storeInstance = createStoreFactory(config);

    return (
        <StoreContext.Provider value={storeInstance}>
            <Provider store={storeInstance.store}>
                <PersistGate loading={null} persistor={storeInstance.persist}>
                    {children}
                </PersistGate>
            </Provider>
        </StoreContext.Provider>
    );
};