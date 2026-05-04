import {useEffect, useMemo, useRef} from "react";
import {useStoreContext} from "../../../store";
import {RealtimeReverbAdapter, RealtimeReverbAdapterConfig} from "../../../adapters";

export const useReverbAdapter = (
    config: Omit<RealtimeReverbAdapterConfig, "token" | "onUnauthorized" | "onError">
): RealtimeReverbAdapter | null => {
    const { store } = useStoreContext();
    const adapterRef = useRef<RealtimeReverbAdapter | null>(null);

    const token = useMemo(() => {
        return store?.getState()?.auth?.authUser?.access_token;
    }, [store]);

    useEffect(() => {
        if (adapterRef.current) return;

        const adapterConfig: RealtimeReverbAdapterConfig = {
            ...config,
            token,
            onUnauthorized: () => {
                console.warn("[Reverb] Unauthorized - session may have expired");
                store?.dispatch?.({ type: "auth/logout" });
            },
            onError: (error) => {
                console.error("[Reverb] Connection error:", error);
            },
        };

        const adapter = new RealtimeReverbAdapter(adapterConfig);
        adapterRef.current = adapter;
        adapter.connect();

        return () => {
            if (adapterRef.current) {
                adapterRef.current.disconnect();
                adapterRef.current = null;
            }
        };
    }, []);

    useEffect(() => {
        if (!adapterRef.current || !token) return;
        return store?.subscribe(() => {
            const newToken = store.getState()?.auth?.authUser?.access_token;
            if (newToken !== token) {
                adapterRef.current?.setAuthToken?.(newToken);
            }
        });
    }, [store, token]);

    return adapterRef.current;
};
