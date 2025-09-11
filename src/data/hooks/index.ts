import {useContext, useMemo} from "react";
import {useStoreContext} from "@/store";
import {DataRestAdapter} from "@/adapters";
import { DataAdapterConfig, DataContext } from "@/data";

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context.adapter;
};

export const useRestApiAdapter = (config: DataAdapterConfig) => {
    const storeContext = useStoreContext();

    return useMemo(() => new DataRestAdapter({
        store: storeContext.store,
        ...config
    }), [storeContext.store, config]);
};