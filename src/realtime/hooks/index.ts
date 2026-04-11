import {useContext, useEffect, useMemo, useRef, useState} from "react";
import {RealtimeContext} from "../context";
import {RealtimeEvent, RealtimeFilter} from "../types";

export const useRealTime = () => {
    const context = useContext(RealtimeContext);
    if (!context) {
        throw new Error('useRealTime must be used within a RealTimeProvider');
    }
    return context.adapter;
};

interface UseRealtimeSubscriptionOptions<TRecord> {
    channel: string | null;
    filter: RealtimeFilter;
    onEvent?: (event: RealtimeEvent<TRecord>) => void;
    enabled?: boolean;
    statusIntervalMs?: number;
}

export function useRealtimeSubscription<TRecord = any>({
    channel,
    filter,
    onEvent,
    enabled = true,
    statusIntervalMs = 1000,
}: UseRealtimeSubscriptionOptions<TRecord>) {
    const adapter = useRealTime();
    const handlerRef = useRef(onEvent);
    handlerRef.current = onEvent;

    const initialStatus = adapter.getStatus?.() ?? {
        connected: false,
        lastEventAt: null,
        lastError: null,
    };

    const [connected, setConnected] = useState(initialStatus.connected);
    const [lastEventAt, setLastEventAt] = useState<number | null>(initialStatus.lastEventAt);
    const [error, setError] = useState<unknown>(initialStatus.lastError);

    const filterKey = useMemo(() => JSON.stringify(filter), [filter]);

    useEffect(() => {
        if (!enabled || !channel) {
            const status = adapter.getStatus?.();
            setConnected(status?.connected ?? false);
            setLastEventAt(status?.lastEventAt ?? null);
            setError(status?.lastError ?? null);
            return;
        }

        let active = true;
        let subscription: { unsubscribe: () => void } | undefined;

        adapter
            .subscribe<TRecord>(channel, filter, (event) => {
                if (!active) return;

                setConnected(adapter.getStatus?.().connected ?? true);
                setLastEventAt(event.receivedAt);
                setError(null);
                handlerRef.current?.(event);
            })
            .then((result) => {
                if (!active) {
                    result.unsubscribe();
                    return;
                }

                subscription = result;
                const status = adapter.getStatus?.();
                setConnected(status?.connected ?? false);
                setLastEventAt(status?.lastEventAt ?? null);
                setError(status?.lastError ?? null);
            })
            .catch((err) => {
                if (!active) return;
                setError(err);
            });

        const intervalId = globalThis.setInterval(() => {
            const status = adapter.getStatus?.();
            if (!status) return;

            setConnected(status.connected);
            setLastEventAt(status.lastEventAt);
            setError(status.lastError);
        }, statusIntervalMs);

        return () => {
            active = false;
            globalThis.clearInterval(intervalId);
            subscription?.unsubscribe();
        };
    }, [adapter, channel, enabled, filterKey, statusIntervalMs]);

    return {
        connected,
        lastEventAt,
        error,
    };
}
