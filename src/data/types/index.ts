import {Store} from "redux";
import {StoreConfig} from "../../types";
import {AuthUser} from "../../auth";

export interface DataProviderResponse<T = any> {
    success: boolean,
    message: string,
    errors: any,
    data: T | null,
    status: string
    originalError?: unknown;
}

export interface DataAdapterConfig extends StoreConfig {
    token?: string
    baseURL?: string;
    store?: Store;
    reducers?: Record<string, any>;
    options?: Record<string, any>;
    headers?: Record<string, string>;
}

export interface DataAdapter {
    fetch<TData>(resource: string, params?: {
        sort?: { field: string; order: 'asc' | 'desc' } | { field: string; order: 'asc' | 'desc' }[];
        filter?: Record<string, any>;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TData>>
    upload<TData>(resource: string, params: {
        file: File | Blob | Buffer | (File | Blob | Buffer)[];
        metadata?: Record<string, any>;
        allowedTypes?: string | string[];
    }): Promise<DataProviderResponse<TData>>
    fetchById<TData>(resource: string, id: string | number): Promise<DataProviderResponse<TData>>;
    insert<TData, TParams>(resource: string, data: Partial<TParams>): Promise<DataProviderResponse<TData>>;
    modify<TData, TParams>(resource: string, id: string | number, data: Partial<TParams>): Promise<DataProviderResponse<TData>>;
    remove<TData>(resource: string, params: { id?: string | number; filter?: Record<string, any> }): Promise<DataProviderResponse<TData>>;
    fetchMany<TData>(resource: string, params?: {
        pagination?: { page: number; perPage: number };
        sort?: { field: string; order: 'asc' | 'desc' } | { field: string; order: 'asc' | 'desc' }[];
        filter?: Record<string, any>;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TData>>;
    fetchOne<TData>(resource: string, params?: {
        fields?: string | string[];
        filter?: Record<string, any>;
        sort?: { field: string; order: 'asc' | 'desc' } | { field: string; order: 'asc' | 'desc' }[];
    }): Promise<DataProviderResponse<TData>>;
    count<TData = number>(resource: string, filter?: Record<string, any>): Promise<DataProviderResponse<TData>>;
    subscribe<TData>(resource: string, callback: (data: TData) => void): void;
    unsubscribe(resource: string): void;
    signIn<TData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TData>>;
    signUp<TData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TData>>;
    signOut(): Promise<DataProviderResponse>;
}

export interface DataProviderConfig {
    adapter?: Partial<DataAdapter>;
}

export abstract class BaseDataAdapter {
    protected baseURL?: string;
    protected token?: string;
    protected reducers?: Record<string, string>;
    protected headers?: Record<string, string>;
    protected options?: Record<string, any>;
    protected store?: Store;

    constructor(config?: DataAdapterConfig) {
        this.baseURL = config?.baseURL;
        this.token = config?.token;
        this.headers = config?.headers;
        this.store = config?.store;
        this.reducers = config?.reducers;
        this.options = config?.options;
    }
}
