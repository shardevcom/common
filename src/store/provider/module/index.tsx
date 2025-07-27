import { ReactNode, useEffect, useContext } from "react";
import {StoreContext} from "../../context";


interface ModuleStoreProviderProps {
    store: Record<string, any>; // Nuevos reducers
    children: ReactNode;
}

export const ModuleStoreProvider = ({ store: newSlices, children }: ModuleStoreProviderProps) => {
    const storeInstance = useContext(StoreContext);

    useEffect(() => {
        if (!storeInstance?.addReducers) {
            console.warn("Dynamic reducer registration is not available.");
            return;
        }

        storeInstance.addReducers(newSlices);
    }, [storeInstance, newSlices]);

    return <>{children}</>;
};
