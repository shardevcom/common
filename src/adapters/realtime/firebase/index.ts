import { initializeApp, FirebaseApp } from "firebase/app";
import { getDatabase, ref, onValue, off, Database } from "firebase/database";
import {
    BaseRealtimeAdapter,
    EventTypeRealtime,
    RealtimeAdapter,
    RealtimeAdapterConfig,
    RealtimeEvent,
    RealtimeFilter,
    RealtimeSubscription
} from "@/realtime";

export class RealtimeFirebaseAdapter extends BaseRealtimeAdapter implements RealtimeAdapter {
    private app: FirebaseApp;
    private db: Database;
    private subscriptions = new Map<string, () => void>();

    constructor(config: RealtimeAdapterConfig) {
        super(config);

        if (!config?.options) {
            throw new Error("FirebaseRealtimeAdapter requires configuration options.");
        }

        this.app = initializeApp(config.options);
        this.db = getDatabase(this.app);
    }

    connect() {
        this.markConnected(true);
    }

    disconnect() {
        this.subscriptions.forEach((unsubscribe) => unsubscribe());
        this.subscriptions.clear();
        this.markConnected(false);
    }

    async subscribe<TRecord = any>(
        channel: string,
        filter: RealtimeFilter,
        callback: (event: RealtimeEvent<TRecord>) => void
    ): Promise<RealtimeSubscription> {
        if (!channel) {
            throw new Error("Cannot subscribe: channel name is required.");
        }

        const dbRef = ref(this.db, channel);
        this.markConnected(true);

        const unsubscribe = onValue(dbRef, (snapshot) => {
            const data = snapshot.val();
            if (data === null || data === undefined) {
                return;
            }

            const receivedAt = Date.now();
            this.markEvent(receivedAt);

            const events: EventTypeRealtime[] = filter.event === '*'
                ? ['INSERT', 'UPDATE', 'DELETE']
                : [filter?.event];

            events.forEach((event) => {
                callback({
                    channel,
                    eventType: event || "UPDATE",
                    table: filter.table ?? channel,
                    schema: "firebase",
                    eventName: filter.eventName,
                    record: data as TRecord,
                    oldRecord: null,
                    raw: data,
                    receivedAt,
                });
            });
        }, (error) => {
            this.markError(error);
        });

        this.subscriptions.set(channel, unsubscribe);

        return {
            unsubscribe: () => {
                unsubscribe();
                this.subscriptions.delete(channel);
                off(dbRef);
            },
        };
    }

    unsubscribe(channel: string) {
        if (!channel) {
            return;
        }

        const dbRef = ref(this.db, channel);
        this.subscriptions.get(channel)?.();
        this.subscriptions.delete(channel);
        off(dbRef);
    }
}
