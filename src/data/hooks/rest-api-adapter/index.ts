import {useStoreContext} from "@/store";
import {DataRestAdapter} from "@/adapters";
import { DataAdapterConfig } from "@/data";
import {useMemo} from "react";

export const useRestApiAdapter = (config: DataAdapterConfig) => {
    const storeContext = useStoreContext();

    return useMemo(() => new DataRestAdapter({
        store: storeContext.store,
        ...config
    }), [storeContext.store, config]);
};