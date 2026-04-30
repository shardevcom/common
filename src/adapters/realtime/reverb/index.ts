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
    broadcaster?: string;
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
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;

    constructor(config: RealtimeReverbAdapterConfig) {
        super(config);
        this.createEcho(config);
    }

    connect() {
        if (!this.echo) {
            this.createEcho({
                baseURL: this.baseURL,
                token: this.token,
                options: this.options as ReverbEchoOptions,
                onUnauthorized: this.onUnauthorized,
                onError: this.onError,
            });
        }
        this.echo?.connect();
    }

    disconnect() {
        const channelNames = Array.from(this.channels.keys());
        channelNames.forEach((channel) => this.unsubscribe(channel));

        if (this.echo?.connector) {
            this.echo.connector.disconnect();
        }
        this.markConnected(false);
        this.connectionBound = false;
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
        this.connect();
    }

    async subscribe<TRecord = any>(
        channel: string,
        filter: RealtimeFilter,
        callback: (event: RealtimeEvent<TRecord>) => void
    ): Promise<RealtimeSubscription> {
        if (!this.echo) {
            throw new Error("Reverb adapter is not initialized.");
        }

        // Asegurar que estamos conectados antes de suscribir
        if (!this.connected) {
            this.connect();
            // Esperar un poco a que se conecte
            await this.waitForConnection();
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
                const { record, oldRecord } = this.normalizePayload<TRecord>(raw);

                this.markEvent(receivedAt);

                callback({
                    channel,
                    eventType: this.getEventTypeFromPayload(raw),
                    table: filter.table,
                    schema: filter.schema,
                    eventName,
                    record,
                    oldRecord,
                    raw,
                    receivedAt,
                });
            } catch (error) {
                console.error('Error handling realtime event:', error);
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

        if (this.echo.leave) {
            this.echo.leave(channel);
        }
        this.channels.delete(channel);
    }

    private async waitForConnection(timeoutMs = 5000): Promise<void> {
        if (this.connected) return;

        const startTime = Date.now();
        while (!this.connected && (Date.now() - startTime) < timeoutMs) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!this.connected) {
            throw new Error('Timeout waiting for Reverb connection');
        }
    }

    private createEcho(config: RealtimeReverbAdapterConfig) {
        if (!config.options?.key) {
            throw new Error("RealtimeReverbAdapter requires options.key.");
        }

        // Configurar Pusher globalmente
        (globalThis as { Pusher?: typeof Pusher }).Pusher = Pusher;

        const { key, wsHost, wsPort, wssPort, forceTLS, enabledTransports, authEndpoint, auth } = config.options;

        this.echo = new Echo({
            broadcaster: "reverb",
            key: key,
            wsHost: wsHost,
            wsPort: wsPort ?? 80,
            wssPort: wssPort ?? 443,
            forceTLS: forceTLS ?? false,
            enabledTransports: enabledTransports ?? ["ws", "wss"],
            authEndpoint: authEndpoint ?? `${this.baseURL ?? ''}/broadcasting/auth`,
            auth: {
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    ...(auth?.headers ?? {}),
                    ...(this.token ? { "Authorization": `Bearer ${this.token}` } : {}),
                },
            },
        });

        // Configurar el conector específico si es necesario
        if (this.echo.connector) {
            this.setupConnector(this.echo.connector);
        }

        this.bindConnectionEvents();
        this.connect();
    }

    private setupConnector(connector: any) {
        // Configurar opciones adicionales del conector si es necesario
        if (connector.options) {
            connector.options = {
                ...connector.options,
                cluster: "mt1",
                disableStats: true,
            };
        }
    }

    private bindConnectionEvents() {
        if (!this.echo?.connector || this.connectionBound) return;

        const pusher = this.echo.connector.pusher;
        if (!pusher) return;

        // Eventos de conexión de Pusher
        pusher.connection.bind("connected", () => {
            console.log("Reverb connected");
            this.markConnected(true);
            this.reconnectAttempts = 0;
        });

        pusher.connection.bind("disconnected", () => {
            console.log("Reverb disconnected");
            this.markConnected(false);
            this.attemptReconnection();
        });

        pusher.connection.bind("error", (error: any) => {
            console.error("Reverb connection error:", error);
            this.markConnected(false);
            this.markError(error);

            const statusCode = error?.status ?? error?.error?.data?.code;
            if (statusCode === 401) {
                this.handleUnauthorized();
            }
        });

        pusher.connection.bind("state_change", (states: any) => {
            console.log("Reverb state change:", states);
            if (states.current === "connected") {
                this.markConnected(true);
            } else if (states.current === "disconnected") {
                this.markConnected(false);
            }
        });

        this.connectionBound = true;
    }

    private attemptReconnection() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error("Max reconnection attempts reached");
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        setTimeout(() => {
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.connect();
        }, delay);
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
        if (!this.echo) return;

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

        // Limpiar canal si no tiene más listeners
        if (subscription.listeners.size === 0) {
            if (this.echo.leave) {
                this.echo.leave(channel);
            }
            this.channels.delete(channel);
        }
    }

    private resolveChannel(channelType: RealtimeChannelType, channel: string): EchoChannelLike {
        if (!this.echo) {
            throw new Error("Echo is not initialized.");
        }

        let channelInstance;
        switch (channelType) {
            case "public":
                channelInstance = this.echo.channel(channel);
                break;
            case "presence":
                channelInstance = this.echo.join(channel);
                break;
            case "private":
            default:
                channelInstance = this.echo.private(channel);
                break;
        }

        // Verificar errores de autorización para canales privados
        if (channelType !== "public") {
            channelInstance.error((error: any) => {
                console.error(`Authorization error for channel ${channel}:`, error);
                if (error.status === 401) {
                    this.handleUnauthorized();
                }
            });
        }

        return channelInstance as unknown as EchoChannelLike;
    }

    private normalizePayload<TRecord>(raw: unknown): { record: TRecord; oldRecord?: any } {
        try {
            // Si es string, parsear JSON
            if (typeof raw === "string") {
                const parsed = JSON.parse(raw);
                return this.extractRecordFromPayload<TRecord>(parsed);
            }

            // Si es objeto con data, extraer data
            if (raw && typeof raw === "object") {
                const obj = raw as Record<string, unknown>;

                if ("data" in obj) {
                    const dataObj = obj.data;
                    if (typeof dataObj === "string") {
                        const parsed = JSON.parse(dataObj);
                        return this.extractRecordFromPayload<TRecord>(parsed);
                    }
                    return this.extractRecordFromPayload<TRecord>(dataObj);
                }

                return this.extractRecordFromPayload<TRecord>(obj);
            }

            return { record: raw as TRecord };
        } catch (error) {
            console.error("Error normalizing payload:", error);
            return { record: {} as TRecord };
        }
    }

    private extractRecordFromPayload<TRecord>(payload: any): { record: TRecord; oldRecord?: any } {
        // Manejar formato de Laravel Reverb
        if (payload && typeof payload === "object") {
            // Si tiene estructura de evento de Laravel
            if ("record" in payload) {
                return {
                    record: payload.record as TRecord,
                    oldRecord: payload.old_record || payload.oldRecord
                };
            }

            // Si el payload directamente es el registro
            return { record: payload as TRecord };
        }

        return { record: {} as TRecord };
    }

    private getEventTypeFromPayload(raw: unknown): "INSERT" | "UPDATE" | "DELETE" | "MESSAGE" | undefined {
        try {
            let payload: any = raw;

            if (typeof raw === "string") {
                payload = JSON.parse(raw);
            }

            if (payload && typeof payload === "object") {
                // Buscar indicadores del tipo de evento
                if (payload.event_type) return payload.event_type;
                if (payload.type) return payload.type;
                if (payload.action) {
                    const action = payload.action.toLowerCase();
                    if (action === "create") return "INSERT";
                    if (action === "update") return "UPDATE";
                    if (action === "delete") return "DELETE";
                }
            }

            return "MESSAGE";
        } catch {
            return "MESSAGE";
        }
    }
}