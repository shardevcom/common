import {useContext, useMemo} from "react";
import {DataContext} from "../context";
import {useStoreContext} from "../../store";
import {DataRestAdapter} from "../../adapters";
import {useBaseUrl} from "../../utils/url";

export const useData = () => {
    const context = useContext(DataContext);
    if (!context) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context.adapter;
};

export const useDataRestApi = () => {
    const storeContext = useStoreContext();
    const baseUrl = useBaseUrl();

    return useMemo(() => new DataRestAdapter({
        baseURL: baseUrl,
        store: storeContext.store
    }), [baseUrl, storeContext.store]);
};