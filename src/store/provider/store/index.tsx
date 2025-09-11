import React, { ReactNode } from "react";
import { Provider } from "react-redux";
import { PersistGate } from "redux-persist/integration/react";
import {createStoreFactory, StoreConfig, StoreContext} from "@/store";

interface StoreProviderProps<Slices extends Record<string, any>> {
    config: StoreConfig<Slices>;
    children: ReactNode;
}

export const StoreProvider = <Slices extends Record<string, any>>({
                                                                      config,
                                                                      children,
                                                                  }: StoreProviderProps<Slices>) => {
    const storedVersion = localStorage.getItem("version");

    if (storedVersion !== config.keyName) {
        localStorage.clear();
        localStorage.setItem("version", config.keyName);
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