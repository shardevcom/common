import { io, Socket } from "socket.io-client";
import {
    BaseRealtimeAdapter,
    RealtimeAdapter,
    RealtimeAdapterConfig,
    RealtimeEvent,
    RealtimeFilter,
    RealtimeSubscription
} from "@/realtime";

export class RealtimeReverbAdapter extends BaseRealtimeAdapter implements RealtimeAdapter {
    protected socket?: Socket;

    constructor(config: RealtimeAdapterConfig) {
        super(config);
        this.socket = io(this.baseURL, this.options);

        this.socket.on("connect", () => {
            console.log("✅ Conectado a Laravel Reverb");
        });

        this.socket.on("disconnect", () => {
            console.log("❌ Desconectado de Laravel Reverb");
        });

        this.socket.on("connect_error", (err) => {
            console.error("🚨 Error en WebSocket:", err.message);
        });
    }

    connect() {
        console.log("🔌 Conectando a Laravel Reverb...");
        this.socket?.connect();
    }

    disconnect() {
        this.socket?.disconnect();
        console.log("❌ Desconectado de Laravel Reverb");
    }

    async subscribe(
        channel: string,
        filter: RealtimeFilter,
        callback: (event: RealtimeEvent) => void
    ): Promise<RealtimeSubscription> {
        if (!this.socket) {
            throw new Error("🚨 WebSocket no inicializado.");
        }

        const channelName = this.getChannelName(channel, filter);
        this.socket.emit("subscribe", { channel: channelName });

        const eventHandler = (payload: any) => {
            callback({
                eventType: this.mapLaravelEvent(payload.event),
                table: filter.table!,
                schema: filter.schema || "public",
                record: payload.model,
                oldRecord: payload.original,
            });
        };

        this.socket.on(channelName, eventHandler);

        return {
            unsubscribe: () => {
                this.socket?.emit("unsubscribe", { channel: channelName });
                this.socket?.off(channelName, eventHandler);
            },
        };
    }

    unsubscribe(channel: string) {
        this.socket?.emit("unsubscribe", { channel });
        this.socket?.off(channel);
    }

    private getChannelName(channel: string, filter: RealtimeFilter): string {
        return `private-${channel}.${filter.table}`;
    }

    private mapLaravelEvent(event: string): 'INSERT' | 'UPDATE' | 'DELETE' {
        const eventMap: Record<string, 'INSERT' | 'UPDATE' | 'DELETE'> = {
            created: "INSERT",
            updated: "UPDATE",
            deleted: "DELETE",
        };
        return eventMap[event] || "INSERT";
    }
}
