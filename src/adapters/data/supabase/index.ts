import {
    createClient,
    RealtimeChannel,
    SignInWithPasswordCredentials,
    SupabaseClient
} from "@supabase/supabase-js";

import { v4 as uuidv4 } from 'uuid';
import localStorage from "redux-persist/es/storage";

import {
    BaseDataAdapter,
    DataAdapter,
    DataAdapterConfig,
    DataProviderResponse,
    FileType,
    QueryFilter,
    SortCondition,
    StorageConfig
} from "@/data";

import { AuthUser, Role } from "@/auth";
import { buildQuery } from "@/utils/filter";

export class DataSupabaseAdapter extends BaseDataAdapter implements DataAdapter {
    private client: SupabaseClient;
    private subscriptions: Record<string, RealtimeChannel> = {};

    constructor(config: DataAdapterConfig) {
        super(config);

        if (!config.baseURL) {
            throw new Error("Supabase baseURL is required");
        }

        if (!config.token) {
            throw new Error("Supabase anon key is required");
        }

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
                    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
                }
            }
        });
    }

    // =============================
    // 🛡️ Helpers
    // =============================

    private getAuthToken(): string | undefined {
        return this.store?.getState()?.auth?.authUser?.access_token;
    }

    private async resetSession() {
        this.store?.dispatch({ type: 'RESET_STATE' });
    }

    private toSupabasePayload<T>(data: unknown): T {
        return data as T;
    }

    private isAuthError(err: unknown): boolean {
        if (!err || typeof err !== 'object') return false;

        const e = err as any;

        const message = typeof e.message === 'string' ? e.message.toLowerCase() : '';

        return (
            e.status === 401 ||
            e.code === "PGRST301" ||
            message.includes('jwt expired') ||
            message.includes('invalid api key')
        );
    }

    private createResponse<T>(
        data: T | null,
        error: unknown,
        status?: number | string
    ): DataProviderResponse<T> {
        const err = error as any;

        return {
            success: !error,
            data,
            status: status?.toString() ?? (error ? '500' : '200'),
            message: err?.message ?? (error ? 'Error' : 'OK'),
            errors: error
                ? {
                    message: err?.message,
                    code: err?.code,
                    details: err?.details
                }
                : undefined,
            originalError: error
        };
    }

    private async handle<T>(fn: (client: SupabaseClient) => Promise<any>) {
        try {
            const { data, error, status } = await fn(this.client);

            if (error) {
                if (this.isAuthError(error)) {
                    await this.resetSession();
                    return this.createResponse<T>(null, error, 401);
                }

                return this.createResponse<T>(null, error, status);
            }

            return this.createResponse<T>(data, null, status);

        } catch (error) {
            if (this.isAuthError(error)) {
                await this.resetSession();
                return this.createResponse<T>(null, error, 401);
            }

            return this.createResponse<T>(null, error, 500);
        }
    }

    // =============================
    // 📊 CRUD
    // =============================

    async fetch<T>(resource: string, params?: any) {
        return this.handle<T>((c) => buildQuery(c, resource, params));
    }

    async fetchOne<T>(resource: string, params?: any) {
        return this.handle<T>((c) =>
            buildQuery(c, resource, params).limit(1).single()
        );
    }

    async fetchMany<T>(resource: string, params?: any) {
        return this.handle<T>((c) => {
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
        return this.handle<T>(async (c) =>
            c.from(resource).select('*').eq('id', id).single()
        );
    }

    async insert<T, P = T>(resource: string, data: Partial<P>) {
        return this.handle<T>(async (c) => {
            const payload = (Array.isArray(data) ? data : [data]) as P[];

            const q =  c.from(resource).insert(payload).select();

            return Array.isArray(data) ? q : q.single();
        });
    }

    async modify<T, P = T>(
        resource: string,
        params: { id?: string | number; filter?: QueryFilter },
        data: Partial<P>
    ) {
        return this.handle<T>(async (c) => {

            const payload =  this.toSupabasePayload<P[]>(
                Array.isArray(data) ? data : [data]
            );

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
        return this.handle<T>(async (c) => {
            const payload = (Array.isArray(data) ? data : [data]) as P[];

            const q = c.from(resource)
                .upsert(payload, {
                    onConflict: uniqueFields?.join(',')
                })
                .select();

            return Array.isArray(data) ? q : q.single();
        });
    }

    async remove<T>(
        resource: string,
        params: { id?: string | number; filter?: QueryFilter }
    ) {
        return this.handle<T>(async (c) => {
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

    // =============================
    // 📁 Storage
    // =============================

    async upload<T>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, unknown>;
        storage?: StorageConfig;
    }) {
        return this.handle<T>(async (c) => {
            const files = Array.isArray(params.file) ? params.file : [params.file];

            const results = [];

            for (const file of files) {
                if (!(file instanceof File)) continue;

                const name = `${uuidv4()}.${file.name.split('.').pop()}`;
                const path = `${resource}/${name}`;

                const { error } = await c.storage
                    .from(this.defaultStorage?.disk || 'default')
                    .upload(path, file, { upsert: true });

                if (error) throw error;

                const { data } = c.storage
                    .from(this.defaultStorage?.disk || 'default')
                    .getPublicUrl(path);

                results.push({
                    fileName: name,
                    url: data.publicUrl
                });
            }

            return { data: results, error: null, status: 200 };
        });
    }

    // =============================
    // 🔐 AUTH
    // =============================

    async signIn<T extends AuthUser>(credentials: unknown) {
        const { data, error } =
            await this.client.auth.signInWithPassword(
                credentials as SignInWithPasswordCredentials
            );

        return this.createResponse<T>(
            this.toSupabasePayload<T>(data),
            error,
            error ? 401 : 200
        );
    }

    async signOut() {
        const { error } = await this.client.auth.signOut();
        await this.resetSession();

        return this.createResponse(null, error);
    }

    // =============================
    // 📡 Realtime
    // =============================

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
        return this.handle<T>(async (c) => {
            let q = c.from(resource).select('*', { count: 'exact', head: true });

            if (filter) {
                Object.entries(filter).forEach(([k, v]) => {
                    q = q.eq(k, v);
                });
            }

            return q;
        });
    }
}