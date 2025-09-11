import { initializeApp, FirebaseApp } from "firebase/app";
import { getDatabase, ref, onValue, off, Database } from "firebase/database";
import {
    BaseRealtimeAdapter, EventTypeRealtime,
    RealtimeAdapter,
    RealtimeAdapterConfig,
    RealtimeEvent, RealtimeFilter,
    RealtimeSubscription
} from "@/realtime";

export class RealtimeFirebaseAdapter extends BaseRealtimeAdapter implements RealtimeAdapter {
    private app: FirebaseApp;
    private db: Database;

    constructor(config: RealtimeAdapterConfig) {
        super(config);

        if (!config?.options) {
            throw new Error("FirebaseRealtimeAdapter requires configuration options.");
        }

        this.app = initializeApp(config.options);
        this.db = getDatabase(this.app);
    }

    connect() {
        console.log("🔌 Firebase Realtime Database connected.");
    }

    disconnect() {
        console.log("❌ Firebase Realtime Database disconnected.");
    }

    async subscribe(
        channel: string,
        filter: RealtimeFilter,
        callback: (event: RealtimeEvent) => void
    ): Promise<RealtimeSubscription> {
        if (!channel) {
            throw new Error("Cannot subscribe: channel name is required.");
        }

        const dbRef = ref(this.db, channel);
        console.log(`📡 Subscribed to Firebase Realtime channel: ${channel}`);

        onValue(dbRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const events: EventTypeRealtime[] = filter.event === '*'
                    ? ['INSERT', 'UPDATE', 'DELETE']
                    : [filter?.event];

                events.forEach(event => {
                    callback({
                        eventType: event || "UPDATE",
                        table: channel,
                        schema: "firebase",
                        record: data,
                        oldRecord: null, // Firebase no maneja registros previos
                    });
                });
            }
        });

        return {
            unsubscribe: () => {
                off(dbRef);
                console.log(`🔕 Unsubscribed from Firebase channel: ${channel}`);
            },
        };
    }

    unsubscribe(channel: string) {
        if (!channel) {
            console.warn("⚠️ Cannot unsubscribe: channel name is required.");
            return;
        }

        const dbRef = ref(this.db, channel);
        off(dbRef);
        console.log(`🔕 Unsubscribed from Firebase channel: ${channel}`);
    }
}
