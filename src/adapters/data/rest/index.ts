import axios, {
    AxiosHeaders,
    AxiosInstance,
    AxiosRequestConfig,
    CreateAxiosDefaults,
    InternalAxiosRequestConfig,
    AxiosResponse,
    isAxiosError,
    AxiosError,
} from "axios";
import {
    BaseDataAdapter,
    DataAdapter,
    DataAdapterConfig,
    DataProviderResponse,
    FileType,
    QueryFilter,
    RateLimitConfig,
    RateLimitInfo,
    SortCondition,
    StorageConfig,
} from "../../../data";
import { AuthUser } from "../../../auth";
import { CircuitBreaker, CircuitState, CircuitOpenError, CircuitBreakerConfig } from "../../../utils/circuit-breaker";

export interface DataRestAdapterConfig extends DataAdapterConfig {
    csrfTokenProvider?: () => string | undefined;
    apiTokenProvider?: () => string | undefined;
    circuitBreaker?: Partial<CircuitBreakerConfig>;
}

export class DataRestAdapter extends BaseDataAdapter implements DataAdapter {
    private client: AxiosInstance;
    private readonly abortControllers = new Map<string, AbortController>();
    private readonly pendingRequests: Map<string, number> = new Map();
    private readonly csrfTokenProvider: () => string | undefined;
    private readonly apiTokenProvider: () => string | undefined;
    private readonly circuitBreaker: CircuitBreaker;

    constructor(config?: DataRestAdapterConfig) {
        super(config);

        this.csrfTokenProvider = config?.csrfTokenProvider ?? (() =>
            typeof document !== 'undefined'
                ? (document.head.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? undefined)
                : undefined
        );
        this.apiTokenProvider = config?.apiTokenProvider ?? (() =>
            typeof document !== 'undefined'
                ? (document.head.querySelector('meta[name="api-token"]')?.getAttribute('content') ?? undefined)
                : undefined
        );

        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: config?.circuitBreaker?.failureThreshold ?? 5,
            successThreshold: config?.circuitBreaker?.successThreshold ?? 2,
            timeout: config?.circuitBreaker?.timeout ?? 30000,
            excludedStatusCodes: config?.circuitBreaker?.excludedStatusCodes ?? [401, 403, 404, 422],
            onStateChange: (state) => {
                if (state === CircuitState.OPEN) {
                    console.warn('[DataRestAdapter] Circuit breaker OPEN - requests will fail fast');
                } else if (state === CircuitState.CLOSED) {
                    console.log('[DataRestAdapter] Circuit breaker CLOSED - service recovered');
                }
            },
        });

        const defaultConfig: AxiosRequestConfig = {
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Accept': 'application/json, text/plain, application/pdf, */*',
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
            },
        };

        this.client = axios.create(defaultConfig as CreateAxiosDefaults);
        this.setupRequestInterceptors();
        this.setupResponseInterceptors();
    }

    private setupRequestInterceptors() {
        this.client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
            const state = this.store?.getState();
            const token = state?.auth?.authUser?.access_token;
            const tokenType = state?.auth?.authUser?.token_type;
            const domToken = this.csrfTokenProvider();
            const apiToken = this.apiTokenProvider();

            if (!config.headers) {
                config.headers = new AxiosHeaders();
            }

            config.headers.set('Authorization', token ? `${tokenType ?? 'Bearer'} ${token}` : undefined);
            config.headers.set('X-CSRF-TOKEN', domToken || undefined);
            config.headers.set('X-API-TOKEN', apiToken || undefined);

            return config;
        }, (error) => Promise.reject(error));
    }

    private parseRateLimitHeaders(headers: Record<string, any>): RateLimitInfo | undefined {
        const limit = headers['x-ratelimit-limit'] ?? headers['x-rate-limit-limit'] ?? headers['ratelimit-limit'];
        const remaining = headers['x-ratelimit-remaining'] ?? headers['x-rate-limit-remaining'] ?? headers['ratelimit-remaining'];
        const reset = headers['x-ratelimit-reset'] ?? headers['x-rate-limit-reset'] ?? headers['ratelimit-reset'];
        const retryAfter = headers['retry-after'];

        if (limit === undefined && remaining === undefined && reset === undefined && retryAfter === undefined) {
            return undefined;
        }

        return {
            limit: parseInt(limit as string, 10) || 0,
            remaining: parseInt(remaining as string, 10) || 0,
            reset: parseInt(reset as string, 10) || Math.floor(Date.now() / 1000) + 60,
            retryAfter: retryAfter ? this.parseRetryAfter(retryAfter as string) : undefined,
        };
    }

    private parseRetryAfter(value: string): number {
        const seconds = parseInt(value, 10);
        if (!isNaN(seconds)) {
            return seconds;
        }
        const date = new Date(value).getTime();
        if (!isNaN(date)) {
            return Math.max(0, Math.ceil((date - Date.now()) / 1000));
        }
        return 60;
    }

    private calculateDelay(attempt: number, retryAfter?: number): number {
        const { baseDelayMs, maxDelayMs, respectRetryAfter } = this.rateLimitConfig;

        if (respectRetryAfter && retryAfter !== undefined && retryAfter > 0) {
            return Math.min(retryAfter * 1000, maxDelayMs);
        }

        const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
        const jitter = Math.random() * 0.3 * exponentialDelay;
        return Math.min(exponentialDelay + jitter, maxDelayMs);
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    private getRequestKey(config: InternalAxiosRequestConfig): string {
        const paramsHash = config.params ? JSON.stringify(config.params) : '';
        return `${config.method?.toUpperCase()}:${config.url}:${paramsHash}`;
    }

    private isRateLimitError(error: unknown): error is AxiosError & { response: { status: 429; headers: Record<string, string> } } {
        return isAxiosError(error) && error.response?.status === 429;
    }

    private isAuthError(error: unknown): error is AxiosError & { response: { status: 401 } } {
        return isAxiosError(error) && error.response?.status === 401;
    }

    private isForbiddenError(error: unknown): error is AxiosError & { response: { status: 403 } } {
        return isAxiosError(error) && error.response?.status === 403;
    }

    private isServerError(error: unknown): error is AxiosError & { response: { status: number } } {
        return isAxiosError(error) && error.response?.status !== undefined && error.response.status >= 500;
    }

    private isNetworkError(error: unknown): error is AxiosError & { request: any; response?: undefined } {
        return isAxiosError(error) && !error.response && !!error.request;
    }

    private async executeWithRetry<T>(
        requestFn: () => Promise<AxiosResponse<T>>,
        config: InternalAxiosRequestConfig
    ): Promise<AxiosResponse<T>> {
        const requestKey = this.getRequestKey(config);
        let attempt = 0;
        const maxRetries = this.rateLimitConfig.maxRetries;

        while (true) {
            try {
                const response = await requestFn();

                const rateLimitInfo = this.parseRateLimitHeaders(response.headers as Record<string, any>);
                if (rateLimitInfo) {
                    (response.data as DataProviderResponse<any>).rateLimit = rateLimitInfo;
                }

                this.pendingRequests.delete(requestKey);
                return response;
            } catch (error: unknown) {
                if (this.isRateLimitError(error) && attempt < maxRetries) {
                    attempt++;
                    const rateLimitInfo = this.parseRateLimitHeaders(error.response!.headers as Record<string, any>);
                    const delay = this.calculateDelay(attempt, rateLimitInfo?.retryAfter);

                    if (rateLimitInfo) {
                        this.rateLimitConfig.onRateLimit?.(rateLimitInfo);
                    }

                    console.warn(`Rate limited (429). Attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    continue;
                }

                if (this.isServerError(error) && attempt < maxRetries) {
                    attempt++;
                    const delay = this.calculateDelay(attempt);
                    console.warn(`Server error (${error.response!.status}). Attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    continue;
                }

                if (this.isNetworkError(error) && attempt < maxRetries) {
                    attempt++;
                    const delay = this.calculateDelay(attempt);
                    console.warn(`Network error. Attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
                    await this.sleep(delay);
                    continue;
                }

                const rateLimitInfo = error && typeof error === 'object' && 'response' in error
                    ? this.parseRateLimitHeaders((error as any).response?.headers as Record<string, any>)
                    : undefined;

                if (rateLimitInfo && error && typeof error === 'object' && 'response' in error) {
                    ((error as any).response.data as DataProviderResponse<any>).rateLimit = rateLimitInfo;
                }

                this.pendingRequests.delete(requestKey);
                throw error;
            }
        }
    }

    private setupResponseInterceptors() {
        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response) {
                    console.error("Error en la respuesta del servidor:", error.response.data);
                    console.error("Status:", error.response.status);
                    console.error("Headers:", error.response.headers);

                    if (this.isAuthError(error)) {
                        console.warn("Sesion expirada o no autenticado: reiniciando autenticacion.");
                        this.store?.dispatch({ type: 'RESET_STATE' });
                    }

                    if (this.isForbiddenError(error)) {
                        console.warn("Acceso prohibido (403).");
                        this.rateLimitConfig.onForbidden?.();
                    }

                    const rateLimitInfo = this.parseRateLimitHeaders(error.response.headers as Record<string, any>);

                    const errorResponse: DataProviderResponse<any> = {
                        success: false,
                        message: error.response.data?.message || `Request failed with status ${error.response.status}`,
                        errors: error.response.data?.errors || error.response.data || null,
                        data: null,
                        status: 'error',
                        originalError: error,
                        rateLimit: rateLimitInfo,
                    };
                    return Promise.reject(errorResponse);
                } else if (error.request) {
                    console.error("No se recibio respuesta del servidor:", error.request);
                    const errorResponse: DataProviderResponse<any> = {
                        success: false,
                        message: 'No response received from server.',
                        errors: undefined,
                        data: null,
                        status: 'error',
                        originalError: error,
                    };
                    return Promise.reject(errorResponse);
                } else {
                    console.error('Error configurando la solicitud:', error.message);
                    const errorResponse: DataProviderResponse<any> = {
                        success: false,
                        message: `Request setup error: ${error.message}`,
                        errors: undefined,
                        data: null,
                        status: 'error',
                        originalError: error,
                    };
                    return Promise.reject(errorResponse);
                }
            }
        );
    }

    private async request<TResponseData>(
        method: 'get' | 'post' | 'patch' | 'delete',
        url: string,
        data?: any,
        config?: Omit<AxiosRequestConfig, 'signal'>
    ): Promise<DataProviderResponse<TResponseData>> {
        const controller = new AbortController();
        const requestConfig: InternalAxiosRequestConfig = {
            method,
            url,
            data,
            params: config?.params,
            headers: config?.headers,
            signal: controller.signal,
        } as InternalAxiosRequestConfig;

        const requestKey = this.getRequestKey(requestConfig);
        this.abortControllers.set(requestKey, controller);

        try {
            const response = await this.circuitBreaker.execute(async () => {
                return this.executeWithRetry(
                    () => this.client.request<DataProviderResponse<TResponseData>>(requestConfig),
                    requestConfig
                );
            });
            return response.data;
        } catch (error) {
            if (error instanceof CircuitOpenError) {
                const rateLimitInfo: RateLimitInfo = {
                    limit: 0,
                    remaining: 0,
                    reset: Math.floor(Date.now() / 1000) + error.retryAfter,
                    retryAfter: error.retryAfter,
                };
                throw {
                    response: {
                        data: {
                            success: false,
                            message: error.message,
                            status: 'error',
                            errors: null,
                            data: null,
                            originalError: error,
                            rateLimit: rateLimitInfo,
                        },
                        status: 503,
                        headers: { 'retry-after': String(error.retryAfter) },
                    },
                };
            }
            throw error;
        } finally {
            this.abortControllers.delete(requestKey);
            this.pendingRequests.delete(requestKey);
        }
    }

    cancelRequest(resource: string, params?: Record<string, any>): void {
        const key = this.getRequestKey({ method: 'GET', url: `/${resource}`, params } as InternalAxiosRequestConfig);
        this.abortControllers.get(key)?.abort();
        this.abortControllers.delete(key);
        this.pendingRequests.delete(key);
    }

    cancelAll(): void {
        this.abortControllers.forEach((controller) => controller.abort());
        this.abortControllers.clear();
        this.pendingRequests.clear();
    }

    async fetch<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        search?: string;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('get', `/${resource}`, undefined, { params });
    }

    async upload<TResponseData>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, any>;
        storage?: StorageConfig;
    }): Promise<DataProviderResponse<TResponseData>> {
        const formData = new FormData();

        if (Array.isArray(params.file)) {
            params.file.forEach((f, index) => {
                formData.append(`files[${index}]`, f as Blob);
            });
        } else {
            formData.append('file', params.file as Blob);
        }

        if (params.metadata) {
            formData.append('metadata', JSON.stringify(params.metadata));
        }

        if (params.storage) {
            formData.append('storage', JSON.stringify(params.storage));
        }

        return this.request<TResponseData>('post', `/${resource}/upload`, formData, {
            headers: { 'Content-Type': undefined },
        });
    }

    async fetchById<TResponseData>(resource: string, id: string | number, params?: {
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('get', `/${resource}/${id}`, undefined, { params });
    }

    async insert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('post', `/${resource}`, data);
    }

    async modify<TResponseData, TParams = TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter;
    }, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        const url = params?.id ? `/${resource}/${params.id}` : `/${resource}`;
        const config: AxiosRequestConfig = params?.id ? {} : { params: { filter: params.filter } };
        return this.request<TResponseData>('patch', url, data, config);
    }

    async upsert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>, uniqueFields?: [string, ...string[]]): Promise<DataProviderResponse<TResponseData>> {
        const payload = {
            ...data,
            _uniqueFields: uniqueFields,
        };
        return this.request<TResponseData>('post', `/${resource}`, payload);
    }

    async remove<TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter;
    }): Promise<DataProviderResponse<TResponseData>> {
        const url = params?.id ? `/${resource}/${params.id}` : `/${resource}`;
        const config: AxiosRequestConfig = params?.id ? {} : { params: { filter: params.filter } };
        return this.request<TResponseData>('delete', url, undefined, config);
    }

    async fetchMany<TResponseData>(resource: string, params?: {
        pagination?: {
            page: number;
            perPage: number;
        };
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        search?: string;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('get', `/${resource}`, undefined, { params });
    }

    async fetchOne<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        const queryParams = { ...params, pagination: { page: 1, perPage: 1 } };
        return this.request<TResponseData>('get', `/${resource}`, undefined, { params: queryParams });
    }

    async uploadFile<TResponseData>(resource: string, formData: FormData): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('post', `/${resource}/import`, formData, {
            headers: { "Content-Type": undefined },
        });
    }

    async downloadFile(resource: string, params?: Record<string, any>): Promise<Blob> {
        try {
            const response = await this.client.get(`/${resource}/export`, {
                params,
                responseType: "blob",
            });
            return response.data;
        } catch (error: unknown) {
            console.error("Error al descargar archivo:", error);
            throw error;
        }
    }

    async modifyMany<TResponseData, TParams = TResponseData>(
        resource: string,
        data: Partial<TParams>[]
    ): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('patch', `/${resource}/bulk-update`, { items: data });
    }

    async removeMany<TResponseData>(
        resource: string,
        params: { ids: Array<string | number> }
    ): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('delete', `/${resource}/bulk-delete`, { data: params });
    }

    async count<TResponseData = number>(resource: string, filter?: QueryFilter): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('get', `/${resource}/count`, undefined, { params: { filter } });
    }

    async signIn<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams, uri?: string): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('post', uri ?? '/auth/signin', credentials);
    }

    async signUp<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams, uri?: string): Promise<DataProviderResponse<TResponseData>> {
        return this.request<TResponseData>('post', uri ?? '/auth/signup', credentials);
    }

    async signOut(uri?: string): Promise<DataProviderResponse> {
        try {
            const response = await this.client.post<DataProviderResponse>(uri ?? '/auth/signout');
            this.store?.dispatch({ type: 'RESET_STATE' });
            return response.data;
        } catch (error: unknown) {
            this.store?.dispatch({ type: 'RESET_STATE' });
            return Promise.reject(error);
        }
    }
}