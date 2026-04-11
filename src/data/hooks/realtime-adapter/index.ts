import { useEffect, useMemo, useState } from "react";
import { RealtimeReverbAdapterConfig } from "@/adapters/realtime/reverb";
import { RealtimeReverbAdapter } from "@/adapters";
import { useStoreContext } from "@/store";

export const useReverbAdapter = (
    config: Omit<RealtimeReverbAdapterConfig, "token">
) => {
    const { store } = useStoreContext();

    const [token, setToken] = useState(() => store.getState()?.auth?.authUser?.access_token);

    useEffect(() => {
        const unsubscribe = store.subscribe(() => {
            const nextToken = store.getState()?.auth?.authUser?.access_token;
            setToken((prevToken: string | undefined) =>
                prevToken === nextToken ? prevToken : nextToken
            );
        });

        return unsubscribe;
    }, [store]);

    const adapter = useMemo(() => {
        return new RealtimeReverbAdapter({
            ...config,
            token,
        });
    }, [config]);

    useEffect(() => {
        adapter.setAuthToken?.(token);
    }, [adapter, token]);

    return adapter;
};
