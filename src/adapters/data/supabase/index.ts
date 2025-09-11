import {
    createClient,
    RealtimeChannel, SignInWithOAuthCredentials,
    SignInWithPasswordCredentials,
    SignUpWithPasswordCredentials,
    SupabaseClient,
    UserAttributes
} from "@supabase/supabase-js";
import {v4 as uuidv4} from 'uuid';
import localStorage from "redux-persist/es/storage";
import {
    BaseDataAdapter,
    DataAdapter,
    DataAdapterConfig,
    DataProviderResponse,
    SortCondition,
    FileType,
    StorageConfig,
    QueryFilter
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
                    ...(authToken ? {"Authorization": `Bearer ${authToken}`} : {}),
                }
            }
        });
    }

    private getAuthToken(): string | undefined {
        const state = this.store?.getState();
        return state?.auth?.authUser?.access_token;
    }

    private async resetSession() {
        console.warn("Session expired: resetting authentication.");
        await this.signOut();
    }

    private isAuthError(err: any): boolean {
        if (!err) return false;

        if (err.status === 401) return true;

        if (err.code === "PGRST301") return true;

        if (typeof err.message === 'string' && err.message.includes('JWT expired')) return true;

        return false;
    }


    private async handleRequest<TResponseData>(query: (client: SupabaseClient) => Promise<any>): Promise<DataProviderResponse<TResponseData>> {
        try {
            const result = await query(this.client);
            // Loggear el error si existe en el resultado (útil para depuración)
            if (result?.error) {
                console.error("Supabase result error:", result.error); // Mantén este log temporalmente
            }

            // *** Usa la función isAuthError aquí ***
            if (this.isAuthError(result?.error)) {
                console.warn("Auth error detected (PGRST301 or 401), resetting session.");
                await this.resetSession();
                // IMPORTANTE: Después de detectar un error de auth y resetear la sesión,
                // esta solicitud probablemente falló. Decide si quieres reintentarla
                // o simplemente retornar el error original. Generalmente, retornas el error
                // y el componente que usa el hook reaccionará al error o a la sesión nula.
                return this.createDataProviderResponse<TResponseData>(null, result.error, result.status);
            }

            return this.createDataProviderResponse<TResponseData>(result?.data, result?.error, result?.status);

        } catch (error: any) {
            // Loggear el error capturado (útil para depuración)
            console.error("Supabase caught error:", error); // Mantén este log temporalmente

            // *** Usa la función isAuthError aquí también ***
            if (this.isAuthError(error)) {
                console.warn("Auth error detected in catch, resetting session.");
                await this.resetSession();
                // Similar al caso del try, retorna el error después del reset.
                return this.createDataProviderResponse<TResponseData>(null, error, error?.status);

            }

            // Si no fue un error de auth conocido, lo manejas como un error general
            return this.createDataProviderResponse<TResponseData>(null, error, error?.status);
        }
    }

    private createDataProviderResponse<TResponseData>(
        data: TResponseData | null,
        error: any,
        status?: number | string,
        message?: string  // Added message parameter
    ): DataProviderResponse<TResponseData> {
        const success = !error;
        return {
            success,
            message: message || error?.message || (success ? 'Query executed successfully' : 'An error occurred'),
            errors: error ? [error] : null,
            data,
            status: status?.toString() || (success ? '200' : '500'),
            originalError: error,
        };
    }

    private async executeQuery<TResponseData>(queryBuilder: (client: SupabaseClient) => Promise<any>): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(queryBuilder);
    }

    async insert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        return this.executeQuery(async (client) => {
            const isArray = Array.isArray(data);
            const query = client
                .from(resource)
                .insert(isArray ? data : [data])
                .select();
            return (isArray ? query : query.single());
        });
    }

    async upsert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>, uniqueFields?: [string, ...string[]]): Promise<DataProviderResponse<TResponseData>> {
        return this.executeQuery(async (client) => {
            const isArray = Array.isArray(data);
            const query = client
                .from(resource)
                .upsert(isArray ? data : [data], {
                    onConflict: uniqueFields?.join(','),
                })
                .select();
            return (isArray ? query : query.single());
        });
    }

    private validateFileTypes(files: File[]): void {
        if (this.defaultStorage?.allowedTypes) {
            for (const file of files) {
                if (!(file instanceof File)) continue;
                const fileType = file.type;
                if (!this.defaultStorage.allowedTypes.includes(fileType)) {
                    throw new Error(`Invalid file type: ${fileType}. Allowed types: ${this.defaultStorage.allowedTypes.join(', ')}`);
                }
            }
        }
    }

    private generateFilePath(resource: string, fileName: string): string {
        let filePath = `${resource}/`;
        if (this.defaultStorage?.directory) {
            filePath += `${this.defaultStorage.directory}/`;
        }
        filePath += fileName;
        return filePath;
    }

    async upload?<TResponseData>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, any>;
        storage?: StorageConfig;
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            const files = Array.isArray(params.file) ? params.file : [params.file];

            if (!files.length) {
                throw new Error("No files found.");
            }

            if (params.storage) {
                this.defaultStorage = {...this.defaultStorage, ...params.storage};
            }

            this.validateFileTypes(files.filter(file => file instanceof File) as File[]);

            const results: { fileName: string; url: string; metadata?: Record<string, any> }[] = [];

            for (const file of files) {
                if (!(file instanceof File)) continue;

                const fileExtension = file.name.split('.').pop() || 'unknown';
                const uniqueFileName = `${uuidv4()}.${fileExtension}`;
                const filePath = this.generateFilePath(resource, uniqueFileName);

                const {error: uploadError} = await client
                    .storage
                    .from(this.defaultStorage?.disk || 'default')
                    .upload(filePath, file, {upsert: true});

                if (uploadError) {
                    return this.createDataProviderResponse(null, uploadError, 500);
                }

                const {data: publicData} = client
                    .storage
                    .from(this.defaultStorage?.disk || 'default')
                    .getPublicUrl(filePath);

                if (publicData?.publicUrl) {
                    results.push({fileName: uniqueFileName, url: publicData.publicUrl, metadata: params.metadata});
                }
            }

            return this.createDataProviderResponse(results as unknown as TResponseData, undefined, 200);
        });
    }

    async remove<TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter;
    }): Promise<DataProviderResponse<TResponseData>> {
        const {id, filter} = params;

        return this.handleRequest(async (client) => {
            let query = client.from(resource).delete();

            if (id !== undefined) {
                query = query.eq('id', id);
            } else if (filter) {
                Object.entries(filter).forEach(([field, value]) => {
                    query = query.eq(field, value);
                });
            } else {
                throw new Error("Either 'id' or 'filter' must be provided for remove operation.");
            }

            return query.select().single();
        });
    }

    async fetch<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            return buildQuery(client, resource, params);
        });
    }

    async fetchOne<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        return this.executeQuery(async (client) => {
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
        return this.executeQuery(async (client) => {
            return buildQuery(client, resource, {
                filter: {
                    'id': id
                }
            }).single();
        });
    }

    async modify<TResponseData, TParams = TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter;
    }, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        const {id, filter} = params;
        return this.handleRequest(async (client) => {
            let query = client.from(resource).update(data);

            if (id !== undefined) {
                query = query.eq('id', id);
            } else if (filter) {
                query = buildQuery(client, resource, {filter: params.filter});
            } else {
                throw new Error("Either 'id' or 'filter' must be provided for remove operation.");
            }

            return query.select().single();
        });
    }

    private async handleAuthResponse<TResponseData extends AuthUser>(data: any, error: any, successMessage: string, statusCode: string): Promise<DataProviderResponse<TResponseData>> {
        if (error) {
            return this.createDataProviderResponse<TResponseData>(null, error, statusCode, error.message || `Failed to ${successMessage.split(' ')[0].toLowerCase()}`);
        }
        let authUser = {};
        if (this.store && data?.user && data?.session) {
            const profileId = await this.fetchProfileId(data.user.id);
            if (!profileId) {
                return {
                    success: false,
                    message: 'Profile not found for user',
                    errors: [{message: 'Profile not found'}],
                    data: null,
                    status: '404',
                    originalError: undefined
                };
            }
            const roles = await this.fetchUserRolesAndPermissions(profileId);
            authUser = {
                id: data.user.id,
                name: data.user.user_metadata.fullName || data.user.email,
                email: data.user.email,
                profile_id: profileId,
                refresh_token: data.session.refresh_token,
                access_token: data.session.access_token,
                token_type: data.session.token_type,
                expires_at: data.session.expires_at + '',
                roles: roles,
                permissions: []
            };
        }
        return this.createDataProviderResponse(authUser as TResponseData, undefined, statusCode, successMessage);
    }

    private async fetchProfileId(userId: string): Promise<string | undefined> {
        const {data, error} = await this.client
            .from('user_profile_links')
            .select('profile_id')
            .eq('user_id', userId)
            .single();
        if (error) console.error("Error fetching profile ID:", error);
        return data?.profile_id;
    }

    private async fetchUserRolesAndPermissions(profileId: string): Promise<Role[]> {
        const {data: userRolesResult, error: userRolesError} = await this.client
            .from('user_roles')
            .select('role_id')
            .eq('profile_id', profileId);

        if (userRolesError) {
            console.error("Error fetching user roles:", userRolesError);
            return [];
        }

        const roleIds = userRolesResult?.map(item => item.role_id) || [];

        const {data: rawRoles, error: errorRoles} = await this.client
            .from('roles')
            .select(`
                *,
                role_permissions (
                    permissions (*)
                )
            `)
            .in('id', roleIds);

        if (errorRoles) {
            console.error("Error fetching roles:", errorRoles);
            return [];
        }

        return (rawRoles ?? []).map((role) => ({
            id: role.id,
            name: role.name,
            guard_name: role.guard_name,
            permissions: (role.role_permissions ?? []).map((rp: Role) => rp.permissions)
        }));
    }

    async signIn?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TResponseData>> {
        try {
            const {
                data,
                error
            } = await this.client.auth.signInWithPassword(credentials as SignInWithPasswordCredentials);
            return this.handleAuthResponse(data, error, 'Signed in successfully', error ? '401' : '200');
        } catch (error: any) {
            return this.createDataProviderResponse<TResponseData>(null, error, error.status);
        }
    }

    async signInWithOAuth?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TResponseData>> {
        try {
            const {
                data,
                error
            } = await this.client.auth.signInWithOAuth(credentials as SignInWithOAuthCredentials);
            return this.handleAuthResponse(data, error, 'Signed in successfully', error ? '401' : '200');
        } catch (error: any) {
            return this.createDataProviderResponse<TResponseData>(null, error, error.status);
        }
    }


    async signUp?<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams): Promise<DataProviderResponse<TResponseData>> {
        try {
            const {data, error} = await this.client.auth.signUp(credentials as SignUpWithPasswordCredentials);
            const userId = data.user?.id;
            if (!userId) {
                throw new Error('No user ID returned from signUp.');
            }
            return this.handleAuthResponse(data, error, 'Signed up successfully', error ? '400' : '201');
        } catch (error: any) {
            return this.createDataProviderResponse<TResponseData>(null, error, error.status);
        }
    }

    async signOut(): Promise<DataProviderResponse> {
        try {
            const {error} = await this.client.auth.signOut();
            if (error) {
                return this.createDataProviderResponse(null, error, '500', 'Failed to sign out');
            }
            if (this.store) {
                this.store?.dispatch({type: 'RESET_STATE'});
            }
            return this.createDataProviderResponse(null, undefined, '200', 'Signed out successfully');
        } catch (error: any) {
            return this.createDataProviderResponse(null, error, error.status, 'An error occurred during sign out');
        }
    }


    async count?<TResponseData = number>(resource: string, filter?: QueryFilter): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            let query = client.from(resource).select('*', {count: 'exact', head: true});
            if (filter) {
                Object.entries(filter).forEach(([field, value]) => {
                    query = query.eq(field, value);
                });
            }
            const {count, error} = await query;
            if (error) {
                return this.createDataProviderResponse(null, error, 500);
            }
            return this.createDataProviderResponse(count as unknown as TResponseData, undefined, 200);
        });
    }

    subscribe?<TResponseData>(resource: string, callback: (data: TResponseData) => void): void {
        const channel = this.client
            .channel(resource)
            .on<TResponseData[]>('postgres_changes', {event: '*', schema: 'public', table: resource}, (payload) => {
                callback(payload.new as TResponseData);
            })
            .subscribe();

        this.subscriptions = this.subscriptions || {};
        this.subscriptions[resource] = channel;
    }

    unsubscribe(resource: string): void {
        if (this.subscriptions && this.subscriptions[resource]) {
            this.client.removeChannel(this.subscriptions[resource]);
            delete this.subscriptions[resource];
        }
    }

    async getCurrentAuthUser<TResponseData extends AuthUser = AuthUser>(): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            const {data, error} = await client.auth.getUser();
            if (error) {
                return this.createDataProviderResponse(null, error, '500', error.message || 'Failed to get current auth user');
            }
            return this.createDataProviderResponse(data.user as unknown as TResponseData, undefined, '200', 'Current auth user retrieved successfully');
        });
    }

    async setCurrentAuthUser<TResponseData extends AuthUser = AuthUser, TParams = unknown>(data: TParams): Promise<DataProviderResponse<TResponseData>> {
        return this.handleRequest(async (client) => {
            const {data: dataUser, error} = await client.auth.updateUser(data as UserAttributes);
            if (error) {
                return this.createDataProviderResponse(null, error, '500', error.message || 'Failed to update user');
            }
            return this.createDataProviderResponse(dataUser.user as unknown as TResponseData, undefined, '200', 'User updated successfully');
        });
    }

}
