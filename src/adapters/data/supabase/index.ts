import {createClient, RealtimeChannel, SignInWithPasswordCredentials, SupabaseClient} from "@supabase/supabase-js";
import {v4 as uuidv4} from 'uuid';
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
import {AuthUser, Role} from "@/auth";
import {buildQuery} from "@/utils/filter";

export class DataSupabaseAdapter extends BaseDataAdapter implements DataAdapter {
    private client: SupabaseClient;
    private subscriptions: Record<string, RealtimeChannel> = {};

    constructor(config: DataAdapterConfig) {
        super(config);
        if (!config.baseURL) {
            throw new Error("Supabase baseURL (URL del proyecto) is required");
        }
        if (!config.token) {
            throw new Error("Supabase token (anon key) is required");
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
                    ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
                }
            }
        });
    }

    // =============================
    // 🛡️ Manejo de Errores y Auth
    // =============================

    private getAuthToken(): string | undefined {
        const state = this.store?.getState();
        return state?.auth?.authUser?.access_token;
    }

    private async resetSession() {
        console.warn("Session expired: resetting authentication state.");
        if (this.store) {
            this.store.dispatch({ type: 'RESET_STATE' });
        }
    }

    private isAuthError(err: any): boolean {
        if (!err) return false;
        const status = err.status || err.statusCode;
        const code = err.code;
        const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';

        return (
            status === 401 ||
            code === "PGRST301" ||
            message.includes('jwt expired') ||
            message.includes('invalid api key')
        );
    }

    /**
     * Corregido para cumplir con: Record<string, unknown> | undefined
     */
    private createDataProviderResponse<TResponseData>(
        data: TResponseData | null,
        error: any,
        status?: number | string,
        message?: string
    ): DataProviderResponse<TResponseData> {
        const success = !error;

        // Transformamos el error en un objeto plano (Record) y usamos undefined si no hay error
        const errorObject = error ? {
            message: error.message || 'An error occurred',
            code: error.code || 'UNKNOWN_ERROR',
            details: error.details || null,
            hint: error.hint || null
        } as Record<string, unknown> : undefined;

        return {
            success,
            message: message || error?.message || (success ? 'Query executed successfully' : 'An error occurred'),
            errors: errorObject, // ✅ Corregido: ya no es Array ni null
            data,
            status: status?.toString() || (success ? '200' : '500'),
            originalError: error,
        };
    }

    private async handleRequest<TResponseData>(
        query: (client: SupabaseClient) => Promise<any>
    ): Promise<DataProviderResponse<TResponseData>> {
        try {
            const result = await query(this.client);
            const { data, error, status } = result;

            if (error) {
                if (this.isAuthError(error)) {
                    await this.resetSession();
                    return this.createDataProviderResponse<TResponseData>(null, error, 401, "Session expired");
                }
                return this.createDataProviderResponse<TResponseData>(null, error, status || 400);
            }

            return this.createDataProviderResponse<TResponseData>(data, null, status || 200);

        } catch (error: any) {
            console.error("Supabase Adapter Exception:", error);

            if (this.isAuthError(error)) {
                await this.resetSession();
                return this.createDataProviderResponse<TResponseData>(null, error, 401);
            }

            return this.createDataProviderResponse<TResponseData>(null, error, error?.status || 500);
        }
    }

    // =============================
    // 📊 Operaciones de Datos
    // =============================

    async fetch<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => buildQuery(client, resource, params));
    }

    async fetchOne<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            return buildQuery<TResponseData>(client, resource, params).limit(1).single();
        });
    }

    async fetchMany<TResponseData>(resource: string, params?: {
        pagination?: { page: number; perPage: number };
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            let query = buildQuery(client, resource, params);
            if (params?.pagination) {
                const from = (params.pagination.page - 1) * params.pagination.perPage;
                const to = from + params.pagination.perPage - 1;
                query = query.range(from, to);
            }
            return query;
        });
    }

    async fetchById<TResponseData>(resource: string, id: string | number): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            return client.from(resource).select('*').eq('id', id).single();
        });
    }

    async insert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            const isArray = Array.isArray(data);
            const query = client.from(resource).insert(isArray ? data : [data]).select();
            return (isArray ? query : query.single());
        });
    }

    async modify<TResponseData, TParams = TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter;
    }, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        const { id, filter } = params;
        return this.handleRequest(async (client) => {
            let query = client.from(resource).update(data);
            if (id !== undefined) {
                query = query.eq('id', id);
            } else if (filter) {
                Object.entries(filter).forEach(([field, value]) => { query = query.eq(field, value); });
            } else {
                throw new Error("Either 'id' or 'filter' must be provided for modify operation.");
            }
            return query.select().single();
        });
    }

    async upsert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>, uniqueFields?: [string, ...string[]]): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            const isArray = Array.isArray(data);
            const query = client.from(resource).upsert(isArray ? data : [data], {
                onConflict: uniqueFields?.join(','),
            }).select();
            return (isArray ? query : query.single());
        });
    }

    async remove<TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter;
    }): Promise<DataProviderResponse<TResponseData>> {
        const { id, filter } = params;
        return this.handleRequest(async (client) => {
            let query = client.from(resource).delete();
            if (id !== undefined) {
                query = query.eq('id', id);
            } else if (filter) {
                Object.entries(filter).forEach(([field, value]) => { query = query.eq(field, value); });
            } else {
                throw new Error("Either 'id' or 'filter' must be provided for remove operation.");
            }
            return query.select().single();
        });
    }

    // =============================
    // 📁 Storage
    // =============================

    async upload<TResponseData>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, any>;
        storage?: StorageConfig;
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            const files = Array.isArray(params.file) ? params.file : [params.file];
            if (!files.length) throw new Error("No files found.");

            if (params.storage) this.defaultStorage = { ...this.defaultStorage, ...params.storage };
            this.validateFileTypes(files.filter(file => file instanceof File) as File[]);

            const results = [];
            for (const file of files) {
                if (!(file instanceof File)) continue;
                const uniqueFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
                const filePath = `${resource}/${this.defaultStorage?.directory ? this.defaultStorage.directory + '/' : ''}${uniqueFileName}`;

                const { error: uploadError } = await client.storage
                    .from(this.defaultStorage?.disk || 'default')
                    .upload(filePath, file, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: publicData } = client.storage
                    .from(this.defaultStorage?.disk || 'default')
                    .getPublicUrl(filePath);

                results.push({ fileName: uniqueFileName, url: publicData.publicUrl, metadata: params.metadata });
            }
            // Retorno manual exitoso
            return { data: results as unknown as TResponseData, error: null, status: 200 };
        });
    }

    private validateFileTypes(files: File[]): void {
        const allowed = this.defaultStorage?.allowedTypes;
        if (allowed) {
            files.forEach(file => {
                if (!allowed.includes(file.type)) throw new Error(`Invalid file type: ${file.type}`);
            });
        }
    }

    // =============================
    // 🔑 Autenticación (Auth)
    // =============================

    async signIn<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TResponseData>> {
        const { data, error } = await this.client.auth.signInWithPassword(credentials as SignInWithPasswordCredentials);
        return this.handleAuthResponse(data, error, 'Signed in successfully', error ? '401' : '200');
    }

    async signOut(): Promise<DataProviderResponse> {
        const { error } = await this.client.auth.signOut();
        await this.resetSession();
        return this.createDataProviderResponse(null, error, error ? '500' : '200', 'Signed out successfully');
    }

    private async handleAuthResponse<TResponseData extends AuthUser>(
        data: any,
        error: any,
        successMessage: string,
        statusCode: string
    ): Promise<DataProviderResponse<TResponseData>> {
        if (error) return this.createDataProviderResponse<TResponseData>(null, error, statusCode);

        if (this.store && data?.user && data?.session) {
            const profileId = await this.fetchProfileId(data.user.id);
            if (!profileId) return this.createDataProviderResponse<TResponseData>(null, { message: 'Profile not found' }, 404);
            const roles = await this.fetchUserRolesAndPermissions(profileId);
            const auth = {
                id: data.user.id,
                name: data.user.user_metadata.fullName || data.user.email,
                email: data.user.email,
                profile_id: profileId,
                refresh_token: data.session.refresh_token,
                access_token: data.session.access_token,
                token_type: data.session.token_type,
                expires_at: data.session.expires_at?.toString(),
                roles: roles,
                permissions: []
            };
            return this.createDataProviderResponse<TResponseData>(auth as unknown as TResponseData, null, statusCode, successMessage);
        }
        return this.createDataProviderResponse<TResponseData>(null, { message: 'Invalid session data' }, 500);
    }

    private async fetchProfileId(userId: string): Promise<string | undefined> {
        const { data } = await this.client.from('user_profile_links').select('profile_id').eq('user_id', userId).single();
        return data?.profile_id;
    }

    private async fetchUserRolesAndPermissions(profileId: string): Promise<Role[]> {
        const { data: userRoles } = await this.client.from('user_roles').select('role_id').eq('profile_id', profileId);
        if (!userRoles?.length) return [];

        const { data: rawRoles } = await this.client.from('roles')
            .select('*, role_permissions(permissions(*))')
            .in('id', userRoles.map(r => r.role_id));

        return (rawRoles ?? []).map(role => ({
            id: role.id,
            name: role.name,
            guard_name: role.guard_name,
            permissions: (role.role_permissions ?? []).map((rp: any) => rp.permissions)
        }));
    }

    // =============================
    // 📡 Realtime & Otros
    // =============================

    subscribe<TResponseData>(resource: string, callback: (data: TResponseData) => void): void {
        this.subscriptions[resource] = this.client
            .channel(`public:${resource}`)
            .on('postgres_changes', {event: '*', schema: 'public', table: resource}, (payload) => {
                callback(payload.new as TResponseData);
            })
            .subscribe();
    }

    unsubscribe(resource: string): void {
        if (this.subscriptions[resource]) {
            this.client.removeChannel(this.subscriptions[resource]);
            delete this.subscriptions[resource];
        }
    }

    async count<TResponseData = number>(resource: string, filter?: QueryFilter): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            let query = client.from(resource).select('*', { count: 'exact', head: true });
            if (filter) Object.entries(filter).forEach(([f, v]) => { query = query.eq(f, v); });
            return query;
        });
    }
}