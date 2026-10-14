import {
    createClient,
    RealtimeChannel,
    SignInWithPasswordCredentials,
    SupabaseClient,
    PostgrestError,
} from "@supabase/supabase-js";

import {v4 as uuidv4} from 'uuid';
import localStorage from "redux-persist/es/storage";

import {
    BaseDataAdapter,
    DataAdapter,
    DataAdapterConfig,
    DataProviderResponse,
    FileType,
    QueryFilter,
    RateLimitConfig,
    RateLimitInfo,
    StorageConfig,
} from "../../../data";

import {AuthUser} from "../../../auth";
import {buildQuery} from "../../../utils";
import { CircuitBreaker, CircuitState, CircuitOpenError, CircuitBreakerConfig } from "../../../utils/circuit-breaker";

interface SupabaseQueryError {
    status: number;
    message: string;
    code?: string;
    headers?: Record<string, string>;
    response?: { headers?: Record<string, string> };
}

export interface DataSupabaseAdapterConfig extends DataAdapterConfig {
    circuitBreaker?: Partial<CircuitBreakerConfig>;
}

export class DataSupabaseAdapter extends BaseDataAdapter implements DataAdapter {
    private client: SupabaseClient;
    private subscriptions: Record<string, RealtimeChannel> = {};
    private readonly circuitBreaker: CircuitBreaker;

    constructor(config: DataSupabaseAdapterConfig) {
        super(config);

        if (!config.baseURL) {
            throw new Error("Supabase baseURL is required");
        }

        if (!config.token) {
            throw new Error("Supabase anon key is required");
        }

        this.circuitBreaker = new CircuitBreaker({
            failureThreshold: config?.circuitBreaker?.failureThreshold ?? 5,
            successThreshold: config?.circuitBreaker?.successThreshold ?? 2,
            timeout: config?.circuitBreaker?.timeout ?? 30000,
            excludedStatusCodes: config?.circuitBreaker?.excludedStatusCodes ?? [401, 403, 404, 422],
            onStateChange: (state) => {
                if (state === CircuitState.OPEN) {
                    console.warn('[DataSupabaseAdapter] Circuit breaker OPEN - requests will fail fast');
                } else if (state === CircuitState.CLOSED) {
                    console.log('[DataSupabaseAdapter] Circuit breaker CLOSED - service recovered');
                }
            },
        });

        const authToken = this.getAuthToken();

        this.client = createClient(config.baseURL, config.token, {
            ...config.options,
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true,
                flowType: 'pkce',
                storage: localStorage
            },
            global: {
                headers: {
                    'Content-Type': 'application/json',
                    ...(authToken ? {Authorization: `Bearer ${authToken}`} : {})
                }
            }
        });
    }

    private getAuthToken(): string | undefined {
        return this.store?.getState()?.auth?.authUser?.access_token;
    }

    private async resetSession() {
        this.store?.dispatch({type: 'RESET_STATE'});
    }

    private isAuthError(err: unknown): err is SupabaseQueryError & { status: 401 } {
        if (!err || typeof err !== 'object') return false;
        const e = err as SupabaseQueryError;
        const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';
        return (
            e.status === 401 ||
            e.code === "PGRST301" ||
            message.includes('jwt expired') ||
            message.includes('invalid api key')
        );
    }

    private isRateLimitError(err: unknown): err is SupabaseQueryError & { status: 429 } {
        if (!err || typeof err !== 'object') return false;
        const e = err as SupabaseQueryError;
        return e.status === 429 || e.code === '429' || (typeof e.message === 'string' && e.message.toLowerCase().includes('rate limit'));
    }

    private isServerError(err: unknown): err is SupabaseQueryError & { status: number } {
        if (!err || typeof err !== 'object') return false;
        const e = err as SupabaseQueryError;
        return e.status >= 500;
    }

    private isNetworkError(err: unknown): boolean {
        if (!err || typeof err !== 'object') return false;
        const e = err as any;
        return e.name === 'TypeError' && e.message?.includes('fetch');
    }

    private parseRateLimitInfo(err: unknown): RateLimitInfo | undefined {
        if (!err || typeof err !== 'object') return undefined;
        const e = err as SupabaseQueryError;

        const headers = e.headers || e.response?.headers || {};
        const limit = headers['x-ratelimit-limit'] ?? headers['ratelimit-limit'];
        const remaining = headers['x-ratelimit-remaining'] ?? headers['ratelimit-remaining'];
        const reset = headers['x-ratelimit-reset'] ?? headers['ratelimit-reset'];
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

    private createResponse<T>(
        data: T | null,
        error: unknown,
        status?: number | string,
        rateLimit?: RateLimitInfo
    ): DataProviderResponse<T> {
        const err = error as SupabaseQueryError | Error | null;

        return {
            success: !error,
            data,
            status: status?.toString() ?? (error ? '500' : '200'),
            message: err?.message ?? (error ? 'Error' : 'OK'),
            errors: error
                ? {
                    message: err?.message,
                    code: 'code' in (err ?? {}) ? (err as any).code : undefined,
                    details: 'details' in (err ?? {}) ? (err as any).details : undefined,
                }
                : undefined,
            originalError: error,
            rateLimit,
        };
    }

    private async handleWithRetry<T>(fn: (client: SupabaseClient) => Promise<any>): Promise<DataProviderResponse<T>> {
        return this.circuitBreaker.execute(async () => {
            let attempt = 0;
            const maxRetries = this.rateLimitConfig.maxRetries;

            while (true) {
                try {
                    const {data, error, status} = await fn(this.client);

                    if (error) {
                        if (this.isAuthError(error)) {
                            await this.resetSession();
                            return this.createResponse<T>(null, error, 401);
                        }

                        if (this.isRateLimitError(error) && attempt < maxRetries) {
                            attempt++;
                            const rateLimitInfo = this.parseRateLimitInfo(error);
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
                            console.warn(`Server error (${error.status}). Attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
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

                        const rateLimitInfo = this.parseRateLimitInfo(error);
                        return this.createResponse<T>(null, error, status, rateLimitInfo);
                    }

                    return this.createResponse<T>(data, null, status);

                } catch (error) {
                    if (this.isAuthError(error)) {
                        await this.resetSession();
                        return this.createResponse<T>(null, error, 401);
                    }

                    if (this.isRateLimitError(error) && attempt < maxRetries) {
                        attempt++;
                        const rateLimitInfo = this.parseRateLimitInfo(error);
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
                        console.warn(`Server error. Attempt ${attempt}/${maxRetries}. Retrying in ${delay}ms...`);
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

                    const rateLimitInfo = this.parseRateLimitInfo(error);
                    return this.createResponse<T>(null, error, 500, rateLimitInfo);
                }
            }
        }).catch((error) => {
            if (error instanceof CircuitOpenError) {
                const rateLimitInfo: RateLimitInfo = {
                    limit: 0,
                    remaining: 0,
                    reset: Math.floor(Date.now() / 1000) + error.retryAfter,
                    retryAfter: error.retryAfter,
                };
                return this.createResponse<T>(null, error, 503, rateLimitInfo);
            }
            throw error;
        });
    }

    async fetch<T>(resource: string, params?: any) {
        return this.handleWithRetry<T>((c) => buildQuery(c, resource, params));
    }

    async fetchOne<T>(resource: string, params?: any) {
        return this.handleWithRetry<T>((c) =>
            buildQuery(c, resource, params).limit(1).single()
        );
    }

    async fetchMany<T>(resource: string, params?: any) {
        return this.handleWithRetry<T>((c) => {
            let q = buildQuery(c, resource, params);

            if (params?.pagination) {
                const from = (params.pagination.page - 1) * params.pagination.perPage;
                const to = from + params.pagination.perPage - 1;
                q = q.range(from, to);
            }

            return q;
        });
    }

    async fetchById<T>(resource: string, id: string | number) {
        return this.handleWithRetry<T>(async (c) =>
            c.from(resource).select('*').eq('id', id).single()
        );
    }

    async insert<T, P = T>(
        resource: string,
        data: Partial<P>
    ) {
        return this.handleWithRetry<T>(async (c) => {
            const payload = (
                Array.isArray(data)
                    ? data
                    : [data]
            ) as Record<string, unknown>[];

            const q = c
                .from(resource)
                .insert(payload)
                .select();

            return Array.isArray(data)
                ? q
                : q.single();
        });
    }

    async modify<T, P = T>(
        resource: string,
        params: { id?: string | number; filter?: QueryFilter },
        data: Partial<P>
    ) {
        return this.handleWithRetry<T>(async (c) => {
            const payload = data as Record<string, unknown>;

            let q = c.from(resource).update(payload);

            if (params.id !== undefined) {
                q = q.eq('id', params.id);
            } else if (params.filter) {
                Object.entries(params.filter).forEach(([k, v]) => {
                    q = q.eq(k, v);
                });
            } else {
                throw new Error("id or filter required");
            }

            return q.select().single();
        });
    }

    async upsert<T, P = T>(
        resource: string,
        data: Partial<P>,
        uniqueFields?: [string, ...string[]]
    ) {
        return this.handleWithRetry<T>(async (c) => {
            const payload = (
                Array.isArray(data)
                    ? data
                    : [data]
            ) as Record<string, unknown>[];

            const q = c
                .from(resource)
                .upsert(payload, {
                    onConflict: uniqueFields?.join(',')
                })
                .select();

            return Array.isArray(data)
                ? q
                : q.single();
        });
    }

    async remove<T>(
        resource: string,
        params: { id?: string | number; filter?: QueryFilter }
    ) {
        return this.handleWithRetry<T>(async (c) => {
            let q = c.from(resource).delete();

            if (params.id !== undefined) {
                q = q.eq('id', params.id);
            } else if (params.filter) {
                Object.entries(params.filter).forEach(([k, v]) => {
                    q = q.eq(k, v);
                });
            } else {
                throw new Error("id or filter required");
            }

            return q.select().single();
        });
    }

    async upload<T>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, unknown>;
        storage?: StorageConfig;
    }) {
        return this.handleWithRetry<T>(async (c) => {
            const files = Array.isArray(params.file) ? params.file : [params.file];
            const results = [];

            for (const file of files) {
                if (!(file instanceof File)) continue;

                const name = `${uuidv4()}.${file.name.split('.').pop()}`;
                const path = `${resource}/${name}`;

                const {error} = await c.storage
                    .from(this.defaultStorage?.disk || 'default')
                    .upload(path, file, {upsert: true});

                if (error) throw error;

                const {data} = c.storage
                    .from(this.defaultStorage?.disk || 'default')
                    .getPublicUrl(path);

                results.push({
                    fileName: name,
                    url: data.publicUrl
                });
            }

            return {data: results, error: null, status: 200};
        });
    }

    async signIn<T extends AuthUser>(credentials: unknown) {
        const { data, error } =
            await this.client.auth.signInWithPassword(
                credentials as SignInWithPasswordCredentials
            );

        return this.createResponse<T>(
            data as unknown as T,
            error,
            error ? 401 : 200
        );
    }

    async signOut() {
        const {error} = await this.client.auth.signOut();
        await this.resetSession();

        return this.createResponse(null, error);
    }

    subscribe<T>(resource: string, cb: (data: T) => void) {
        this.subscriptions[resource] = this.client
            .channel(`public:${resource}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: resource
            }, (payload) => {
                cb(payload.new as T);
            })
            .subscribe();
    }

    unsubscribe(resource: string) {
        const sub = this.subscriptions[resource];

        if (sub) {
            this.client.removeChannel(sub);
            delete this.subscriptions[resource];
        }
    }

    async count<T = number>(resource: string, filter?: QueryFilter) {
        return this.handleWithRetry<T>(async (c) => {
            let q = c.from(resource).select('*', {count: 'exact', head: true});

            if (filter) {
                Object.entries(filter).forEach(([k, v]) => {
                    q = q.eq(k, v);
                });
            }

            return q;
        });
    }
}