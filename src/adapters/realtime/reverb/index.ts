import Echo from "laravel-echo";
import Pusher from "pusher-js";
import {
    BaseRealtimeAdapter,
    RealtimeAdapter,
    RealtimeAdapterConfig,
    RealtimeChannelType,
    RealtimeEvent,
    RealtimeFilter,
    RealtimeSubscription
} from "@/realtime";

interface EchoChannelLike {
    listen(event: string, callback: (payload: unknown) => void): EchoChannelLike;
    stopListening(event: string): EchoChannelLike;
}

interface ReverbChannelSubscription {
    type: RealtimeChannelType;
    instance: EchoChannelLike;
    listeners: Map<string, (payload: unknown) => void>;
}

export interface ReverbEchoOptions extends Record<string, any> {
    key: string;
    wsHost: string;
    wsPort?: number;
    wssPort?: number;
    forceTLS?: boolean;
    enabledTransports?: Array<"ws" | "wss">;
    authEndpoint?: string;
    auth?: {
        headers?: Record<string, string>;
    };
}

export interface RealtimeReverbAdapterConfig extends RealtimeAdapterConfig {
    options: ReverbEchoOptions;
}

export class RealtimeReverbAdapter extends BaseRealtimeAdapter implements RealtimeAdapter {
    private echo?: Echo<any>;
    private channels = new Map<string, ReverbChannelSubscription>();
    private connectionBound = false;

    constructor(config: RealtimeReverbAdapterConfig) {
        super(config);
        this.createEcho(config);
    }

    connect() {
        this.echo?.connector?.connect?.();
    }

    disconnect() {
        const channelNames = Array.from(this.channels.keys());
        channelNames.forEach((channel) => this.unsubscribe(channel));

        this.echo?.connector?.disconnect?.();
        this.echo?.disconnect?.();
        this.markConnected(false);
    }

    public override setAuthToken(token?: string): void {
        const changed = this.token !== token;
        super.setAuthToken(token);

        if (!changed) return;

        const options = this.options as ReverbEchoOptions | undefined;
        if (!options) {
            throw new Error("RealtimeReverbAdapter options are required to refresh the auth token.");
        }

        const listenersSnapshot = this.snapshotListeners();

        this.disconnect();
        this.connectionBound = false;

        this.createEcho({
            baseURL: this.baseURL,
            token,
            options,
            onUnauthorized: this.onUnauthorized,
            onError: this.onError,
        });

        this.restoreListeners(listenersSnapshot);
    }

    async subscribe<TRecord = any>(
        channel: string,
        filter: RealtimeFilter,
        callback: (event: RealtimeEvent<TRecord>) => void
    ): Promise<RealtimeSubscription> {
        if (!this.echo) {
            throw new Error("Reverb adapter is not initialized.");
        }

        const eventName = filter.eventName;
        if (!eventName) {
            throw new Error("RealtimeReverbAdapter requires filter.eventName.");
        }

        const channelType = filter.channelType ?? "private";
        const subscription = this.getOrCreateSubscription(channel, channelType);
        const existingListener = subscription.listeners.get(eventName);

        if (existingListener) {
            subscription.instance.stopListening(eventName);
        }

        const eventHandler = (raw: unknown) => {
            try {
                const receivedAt = Date.now();
                const record = this.normalizePayload<TRecord>(raw);
                this.markEvent(receivedAt);

                callback({
                    channel,
                    eventType: "MESSAGE",
                    table: filter.table,
                    schema: filter.schema,
                    eventName,
                    record,
                    raw,
                    receivedAt,
                });
            } catch (error) {
                this.markError(error);
            }
        };

        subscription.instance.listen(eventName, eventHandler);
        subscription.listeners.set(eventName, eventHandler);

        return {
            unsubscribe: () => {
                this.removeListener(channel, eventName);
            },
        };
    }

    unsubscribe(channel: string) {
        const subscription = this.channels.get(channel);
        if (!subscription || !this.echo) return;

        subscription.listeners.forEach((_, eventName) => {
            subscription.instance.stopListening(eventName);
        });

        this.echo.leave(channel);
        this.channels.delete(channel);
    }

    private createEcho(config: RealtimeReverbAdapterConfig) {
        if (!config.options?.key) {
            throw new Error("RealtimeReverbAdapter requires options.key.");
        }

        (globalThis as { Pusher?: typeof Pusher }).Pusher = Pusher;

        // Extraemos las opciones para no duplicarlas en el constructor
        const { key, wsHost, wsPort, wssPort, forceTLS, enabledTransports, authEndpoint, auth, ...restOptions } = config.options;

        this.echo = new Echo({
            broadcaster: "reverb",
            key: key,
            wsHost: wsHost,
            wsPort: wsPort ?? 80,
            wssPort: wssPort ?? 443,
            forceTLS: forceTLS ?? true,
            enabledTransports: enabledTransports ?? ["ws", "wss"],
            authEndpoint: authEndpoint,
            ...restOptions, // Usamos lo que sobre de las opciones aquí
            auth: {
                ...(auth ?? {}),
                headers: {
                    ...(auth?.headers ?? {}),
                    ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
                },
            },
        });

        this.bindConnectionEvents();
    }

    private bindConnectionEvents() {
        if (!this.echo || this.connectionBound) return;

        const connection = this.echo.connector?.pusher?.connection;
        if (!connection) return;

        connection.bind("connected", () => {
            this.markConnected(true);
        });

        connection.bind("disconnected", () => {
            this.markConnected(false);
        });

        connection.bind("error", (error: any) => {
            this.markConnected(false);
            this.markError(error);

            const statusCode = error?.status ?? error?.error?.data?.code;
            if (statusCode === 401) {
                this.handleUnauthorized();
            }
        });

        this.connectionBound = true;
    }

    private getOrCreateSubscription(channel: string, channelType: RealtimeChannelType): ReverbChannelSubscription {
        const existing = this.channels.get(channel);
        if (existing) {
            return existing;
        }

        const instance = this.resolveChannel(channelType, channel);
        const subscription: ReverbChannelSubscription = {
            type: channelType,
            instance,
            listeners: new Map(),
        };

        this.channels.set(channel, subscription);

        return subscription;
    }

    private snapshotListeners() {
        return Array.from(this.channels.entries()).map(([channel, subscription]) => ({
            channel,
            type: subscription.type,
            listeners: Array.from(subscription.listeners.entries()),
        }));
    }

    private restoreListeners(snapshot: Array<{
        channel: string;
        type: RealtimeChannelType;
        listeners: Array<[string, (payload: unknown) => void]>;
    }>) {
        snapshot.forEach(({ channel, type, listeners }) => {
            const subscription = this.getOrCreateSubscription(channel, type);

            listeners.forEach(([eventName, listener]) => {
                subscription.instance.listen(eventName, listener);
                subscription.listeners.set(eventName, listener);
            });
        });
    }

    private removeListener(channel: string, eventName: string) {
        const subscription = this.channels.get(channel);
        if (!subscription || !this.echo) return;

        if (subscription.listeners.has(eventName)) {
            subscription.instance.stopListening(eventName);
            subscription.listeners.delete(eventName);
        }

        if (subscription.listeners.size === 0) {
            this.echo.leave(channel);
            this.channels.delete(channel);
        }
    }

    private resolveChannel(channelType: RealtimeChannelType, channel: string): EchoChannelLike {
        if (!this.echo) {
            throw new Error("Echo is not initialized.");
        }

        switch (channelType) {
            case "public":
                return this.echo.channel(channel) as unknown as EchoChannelLike;
            case "presence":
                return this.echo.join(channel) as unknown as EchoChannelLike;
            case "private":
            default:
                return this.echo.private(channel) as unknown as EchoChannelLike;
        }
    }

    private normalizePayload<TRecord>(raw: unknown): TRecord {
        if (typeof raw === "string") {
            return JSON.parse(raw) as TRecord;
        }

        if (raw && typeof raw === "object" && "data" in (raw as Record<string, unknown>)) {
            const { data } = raw as { data?: unknown };

            if (typeof data === "string") {
                return JSON.parse(data) as TRecord;
            }

            if (data !== undefined) {
                return data as TRecord;
            }
        }

        return raw as TRecord;
    }
}
