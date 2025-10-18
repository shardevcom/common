import {Store, UnknownAction} from "redux";
import {AuthUser} from "@/auth";
import {Reducer} from "@reduxjs/toolkit";

export interface PaginatedData<T> {
    current_page: number;
    data: T[];
    first_page_url: string;
    from: number | null;
    last_page: number;
    last_page_url: string;
    links: PaginationLink[];
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number | null;
    total: number;
}

export interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

export interface DataProviderResponse<T = any, E = Record<string, unknown>> {
    success: boolean;
    message: string;
    errors?: E; // 👈 Flexible y opcional
    data: T | null;
    status: 'success' | 'error' | 'pending' | string;
    originalError?: unknown;
}

export function ProcessApiResponse<T, E = Record<string, unknown>>(
    response: DataProviderResponse<T, E> | unknown
): DataProviderResponse<T, E> {
    if (response && typeof response === 'object' && 'success' in response) {
        return response as DataProviderResponse<T, E>;
    }

    let message = 'Ocurrió un error';
    let errors: E | undefined;

    if (response instanceof Error) {
        message = response.message;
    } else if (typeof response === 'string') {
        message = response;
    } else if (typeof response === 'object' && response !== null) {
        errors = response as E;
    }

    return {
        success: false,
        data: null,
        message,
        errors,
        status: 'error',
        originalError: response
    };
}


export interface StorageConfig {
    disk?: string;
    directory?: string;
    public?: boolean;
    allowedTypes?: string[];
    [key: string]: any;
}

export interface DataAdapterConfig {
    token?: string
    baseURL: string;
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

export type QueryFilter = {
    [field: string]: GenericFilterValue | QueryFilter[] | undefined;
    AND?: QueryFilter[];
    OR?: QueryFilter[];
};

export interface DataAdapter {
    fetch<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        search?: string;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>>;
    upload?<TResponseData>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, any>;
        storage?: StorageConfig;
    }): Promise<DataProviderResponse<TResponseData>>;
    fetchById<TResponseData>(resource: string, id: string | number, params?: {
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>>;
    insert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>>;
    modify<TResponseData, TParams = TResponseData>(resource: string, params: { id?: string | number; filter?: QueryFilter; }, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>>;
    upsert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>, uniqueFields?: [string, ...string[]]): Promise<DataProviderResponse<TResponseData>>
    remove<TResponseData>(resource: string, params: { id?: string | number; filter?: QueryFilter; }): Promise<DataProviderResponse<TResponseData>>;
    fetchMany<TResponseData>(resource: string, params?: {
        pagination?: { page: number; perPage: number };
        sort?: SortCondition | SortCondition[];
        search?: string;
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>>;
    fetchOne<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        search?: string;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>>;

    uploadFile?<TResponseData>(resource: string, formData: FormData): Promise<DataProviderResponse<TResponseData>>;
    downloadFile?(resource: string, params?: Record<string, any>): Promise<Blob>;
    removeMany?<TResponseData>(resource: string, params: { ids: Array<string | number> }): Promise<DataProviderResponse<TResponseData>>;
    modifyMany?<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>[]): Promise<DataProviderResponse<TResponseData>>;

    count?<TResponseData = number>(resource: string, filter?: QueryFilter): Promise<DataProviderResponse<TResponseData>>;
    subscribe?<TResponseData>(resource: string, callback: (data: TResponseData) => void): void;
    unsubscribe?(resource: string): void;
    signIn?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams, uri?: string, ): Promise<DataProviderResponse<TResponseData>>;
    signInWithOAuth?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TResponseData>>;
    signUp?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams, uri?: string,): Promise<DataProviderResponse<TResponseData>>;
    setCurrentAuthUser?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(data: TParams): Promise<DataProviderResponse<TResponseData>>;
    getCurrentAuthUser?<TResponseData extends AuthUser = AuthUser>(): Promise<DataProviderResponse<TResponseData>>;
    createAuthUser?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(data: TParams): Promise<DataProviderResponse<TResponseData>>;
    modifyAuthUser?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(id: string, data?: TParams): Promise<DataProviderResponse<TResponseData>>;
    removeAuthUser?<TResponseData extends AuthUser = AuthUser, TOptions = unknown>(id: string, options?: TOptions): Promise<DataProviderResponse<TResponseData>>;
    inviteAuthUserByEmail?<TResponseData, TOptions = unknown>(email: string, options?: TOptions): Promise<DataProviderResponse<TResponseData>>;
    signOut?(uri?: string): Promise<DataProviderResponse>;
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
