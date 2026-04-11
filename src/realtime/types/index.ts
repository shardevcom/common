
export type RealtimeSubscription = {
  unsubscribe: () => void;
};

export type RealtimeChannelType = 'public' | 'private' | 'presence';

export type GenericRealtimeFilterOperator = string;

export interface GenericRealtimeFilterCondition {
    operator: GenericRealtimeFilterOperator;
    value: unknown;
}

export type EventTypeRealtime = '*' | 'INSERT' | 'UPDATE' | 'DELETE' | 'MESSAGE' | undefined;

export type RealtimeEvent<TRecord = any> = {
    eventType: EventTypeRealtime;
    channel: string;
    table?: string;
    schema?: string;
    eventName?: string;
    record: TRecord;
    oldRecord?: any;
    raw?: unknown;
    receivedAt: number;
};

export type GenericRealtimeFilterValue =
    | string
    | number
    | boolean
    | Array<string | number | boolean | EventTypeRealtime>
    | GenericRealtimeFilterCondition
    | EventTypeRealtime;

export type RealtimeQueryFilter = {
    [field: string]: GenericRealtimeFilterValue | RealtimeQueryFilter[] | undefined;
    AND?: RealtimeQueryFilter[];
    OR?: RealtimeQueryFilter[];
};

export type RealtimeFilter = {
    table?: string;
    schema?: string;
    filter?: string | RealtimeQueryFilter;
    event?: EventTypeRealtime;
    eventName?: string;
    channelType?: RealtimeChannelType;
};

export interface RealtimeAdapterStatus {
    connected: boolean;
    lastEventAt: number | null;
    lastError: unknown | null;
}

export interface RealtimeAdapter {
    subscribe: <TRecord = any>(
        channel: string,
        filter: RealtimeFilter,
        callback: (event: RealtimeEvent<TRecord>) => void
    ) => Promise<RealtimeSubscription>;
    connect(): void | Promise<void>;
    disconnect(): void | Promise<void>;
    unsubscribe(channel: string): void;
    getStatus?(): RealtimeAdapterStatus;
    setAuthToken?(token?: string): void;
}

export interface RealtimeProviderConfig {
    adapter?: RealtimeAdapter;
}

export interface RealtimeAdapterConfig {
    baseURL?: string;
    token?: string;
    options?: Record<string, any>;
    onUnauthorized?: () => void;
    onError?: (error: unknown) => void;
}

export abstract class BaseRealtimeAdapter {
    protected baseURL?: string;
    protected token?: string;
    protected options?: Record<string, any>;
    protected onUnauthorized?: () => void;
    protected onError?: (error: unknown) => void;
    protected connected = false;
    protected lastEventAt: number | null = null;
    protected lastError: unknown | null = null;

    constructor(config?: RealtimeAdapterConfig) {
        this.baseURL = config?.baseURL;
        this.token = config?.token;
        this.options = config?.options;
        this.onUnauthorized = config?.onUnauthorized;
        this.onError = config?.onError;
    }

    public setAuthToken(token?: string): void {
        this.token = token;
    }

    public getStatus(): RealtimeAdapterStatus {
        return {
            connected: this.connected,
            lastEventAt: this.lastEventAt,
            lastError: this.lastError,
        };
    }

    protected markConnected(connected: boolean): void {
        this.connected = connected;
    }

    protected markEvent(receivedAt = Date.now()): void {
        this.lastEventAt = receivedAt;
        this.lastError = null;
    }

    protected markError(error: unknown): void {
        this.lastError = error;
        this.onError?.(error);
    }

    protected handleUnauthorized(): void {
        this.onUnauthorized?.();
    }

    protected readonly eventMap: Record<string, 'INSERT' | 'UPDATE' | 'DELETE'> = {
        created: 'INSERT',
        updated: 'UPDATE',
        deleted: 'DELETE',
    };
}
