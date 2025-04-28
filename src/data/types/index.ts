import {Store, UnknownAction} from "redux";
import {StoreConfig} from "../../types";
import {AuthUser} from "../../auth";
import {Reducer} from "@reduxjs/toolkit";


export interface DataProviderResponse<T = any> {
    success: boolean,
    message: string,
    errors: Record<string, any> | unknown,
    data: T | null,
    status: 'success' | 'error' | 'pending' | string
    originalError?: unknown;
}

export interface StorageConfig {
    disk?: string;
    directory?: string;
    public?: boolean;
    allowedTypes?: string[];
    [key: string]: any;
}

export interface DataAdapterConfig extends StoreConfig {
    token?: string
    baseURL?: string;
    store?: Store;
    reducers?: Record<string, Reducer<any, UnknownAction>>;
    options?: Record<string, any>;
    headers?: Record<string, string>;
    defaultStorage?: StorageConfig
}

export type GenericFilterOperator = string;

export interface GenericFilterCondition {
    operator: GenericFilterOperator;
    value: unknown;
}

export type GenericFilterValue =
    | string
    | number
    | boolean
    | Array<string | number | boolean>
    | GenericFilterCondition;

export type FileType =
    | File
    | Blob
    | Buffer
    | Array<File | Blob | Buffer>

export interface SortCondition {
    field: string;
    order: 'asc' | 'desc'
}

export interface DataAdapter {
    fetch<TData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: Record<string, GenericFilterValue>;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TData>>
    upload<TData>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, any>;
        storage?: StorageConfig;
    }): Promise<DataProviderResponse<TData>>
    fetchById<TData>(resource: string, id: string | number): Promise<DataProviderResponse<TData>>;
    insert<TData, TParams = TData>(resource: string, data: Partial<TParams>): Promise<DataProviderResponse<TData>>;
    modify<TData, TParams = TData>(resource: string, id: string | number, data: Partial<TParams>): Promise<DataProviderResponse<TData>>;
    upsert<TData, TParams = TData>(resource: string, data: Partial<TParams>, uniqueFields?: [string, ...string[]]): Promise<DataProviderResponse<TData>>
    remove<TData>(resource: string, params: { id?: string | number; filter?: Record<string, GenericFilterValue> }): Promise<DataProviderResponse<TData>>;
    fetchMany<TData>(resource: string, params?: {
        pagination?: { page: number; perPage: number };
        sort?: SortCondition | SortCondition[];
        filter?: Record<string, GenericFilterValue>;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TData>>;
    fetchOne<TData>(resource: string, params?: {
        fields?: string | string[];
        filter?: Record<string, GenericFilterValue>;
        sort?: SortCondition | SortCondition[];
    }): Promise<DataProviderResponse<TData>>;
    count<TData = number>(resource: string, filter?: Record<string, GenericFilterValue>): Promise<DataProviderResponse<TData>>;
    subscribe<TData>(resource: string, callback: (data: TData) => void): void;
    unsubscribe(resource: string): void;
    signIn<TData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TData>>;
    signUp<TData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TData>>;
    setAuthUser<TData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TData>>;
    getAuthUser<TData extends AuthUser = AuthUser>(): Promise<DataProviderResponse<TData>>;
    signOut(): Promise<DataProviderResponse>;
}

export interface DataProviderConfig {
    adapter?: Partial<DataAdapter>;
}

export abstract class BaseDataAdapter {
    protected baseURL?: string;
    protected token?: string;
    protected reducers?: Record<string, Reducer<any, UnknownAction>>;
    protected headers?: Record<string, string>;
    protected options?: Record<string, any>;
    protected store?: Store;
    protected defaultStorage?: StorageConfig;

    constructor(config?: DataAdapterConfig) {
        this.baseURL = config?.baseURL;
        this.token = config?.token;
        this.headers = config?.headers;
        this.store = config?.store;
        this.reducers = config?.reducers;
        this.options = config?.options;
        this.defaultStorage = config?.defaultStorage
    }
}
