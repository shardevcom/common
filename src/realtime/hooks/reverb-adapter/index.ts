import {useEffect, useRef} from "react";
import {useStoreContext} from "../../../store";
import {RealtimeReverbAdapter, RealtimeReverbAdapterConfig} from "../../../adapters";

export const useReverbAdapter = (
    config: Omit<RealtimeReverbAdapterConfig, "token" | "onUnauthorized" | "onError">
): RealtimeReverbAdapter | null => {
    const { store } = useStoreContext();
    const adapterRef = useRef<RealtimeReverbAdapter | null>(null);
    const lastTokenRef = useRef<string | undefined>(undefined);
    const unsubscribeRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (adapterRef.current) return;
        if (!store) return;

        const initialToken = store?.getState()?.auth?.authUser?.access_token;
        lastTokenRef.current = initialToken;

        const adapterConfig: RealtimeReverbAdapterConfig = {
            ...config,
            token: initialToken,
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

        const unsubscribe = store.subscribe(() => {
            const newToken = store.getState()?.auth?.authUser?.access_token;
            if (newToken !== lastTokenRef.current && adapterRef.current) {
                lastTokenRef.current = newToken;
                adapterRef.current.setAuthToken?.(newToken);
            }
        });
        unsubscribeRef.current = unsubscribe;

        return () => {
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }
            if (adapterRef.current) {
                adapterRef.current.disconnect();
                adapterRef.current = null;
            }
        };
    }, [store, config]);

    return adapterRef.current;
};