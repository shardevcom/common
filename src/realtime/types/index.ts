
export type RealtimeSubscription = {
  unsubscribe: () => void;
};

export type GenericRealtimeFilterOperator = string;

export interface GenericRealtimeFilterCondition {
    operator: GenericRealtimeFilterOperator;
    value: unknown;
}

export type EventTypeRealtime = '*' | 'INSERT' | 'UPDATE' | 'DELETE' | undefined;

export type RealtimeEvent = {
    eventType: EventTypeRealtime;
    table: string;
    schema: string;
    record: any;
    oldRecord?: any;
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
  table: string;
  schema?: string;
  filter?: string | RealtimeQueryFilter;
  event?: EventTypeRealtime;
};

export interface RealtimeAdapter {
  subscribe: (
    channel: string,
    filter: RealtimeFilter,
    callback: (event: RealtimeEvent) => void
  ) => Promise<RealtimeSubscription>;
  connect(): void;
  disconnect(): void;
  unsubscribe(channel: string): void;
}

export interface RealtimeProviderConfig {
  adapter?: RealtimeAdapter;
}

export interface RealtimeAdapterConfig {
    baseURL?: string;
    token?: string;
    options?: Record<string, any>;
}

export abstract class BaseRealtimeAdapter {
    protected baseURL?: string;
    protected token?: string;
    protected options?: Record<string, any>;

    constructor(config?: RealtimeAdapterConfig) {
        this.baseURL = config?.baseURL;
        this.token = config?.token;
        this.options = config?.options;
    }

    protected readonly eventMap: Record<string, 'INSERT' | 'UPDATE' | 'DELETE'> = {
        created: 'INSERT',
        updated: 'UPDATE',
        deleted: 'DELETE',
    };
}
