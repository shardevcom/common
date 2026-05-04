import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from "axios";
import {
    BaseDataAdapter,
    DataAdapter,
    DataAdapterConfig,
    DataProviderResponse, FileType,
    QueryFilter,
    SortCondition, StorageConfig
} from "../../../data";
import {AuthUser} from "../../../auth";

export class DataRestAdapter extends BaseDataAdapter implements DataAdapter {
    private client: AxiosInstance;

    constructor(config?: DataAdapterConfig) {
        super(config);

        const defaultConfig: AxiosRequestConfig = {
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Accept': 'application/json, text/plain, application/pdf, */*',
                'Content-Type': 'application/json;charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
            }
        };

        this.client = axios.create(defaultConfig as CreateAxiosDefaults);
        console.log("Axios baseURL:", this.client.defaults.baseURL);
        this.setupRequestInterceptors();
        this.setupResponseInterceptors();
    }

    private setupRequestInterceptors() {
        this.client.interceptors.request.use((config) => {
            const state = this.store?.getState();
            const token = state?.auth?.authUser?.access_token;
            const tokenType = state?.auth?.authUser?.token_type;
            const domToken = document.head.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
            const apiToken = document.head.querySelector('meta[name="api-token"]')?.getAttribute('content');

            if (!config.headers) {
                config.headers = new AxiosHeaders();
            }

            config.headers.set('Authorization', token ? `${tokenType ?? 'Bearer'} ${token}` : undefined);
            config.headers.set('X-CSRF-TOKEN', domToken || undefined);
            config.headers.set('X-API-TOKEN', apiToken || undefined);

            return config;
        }, (error) => Promise.reject(error));
    }

    private setupResponseInterceptors() {
        this.client.interceptors.response.use(
            (response ) => response,
            (error) => {
                if (error.response) {
                    console.error("Error en la respuesta del servidor:", error.response.data);
                    console.error("Status:", error.response.status);
                    console.error("Headers:", error.response.headers);

                    if (error.response.status === 401) {
                        console.warn("Sesion expirada o no autenticado: reiniciando autenticacion.");
                        this.store?.dispatch({ type: 'RESET_STATE' });
                    }

                    const errorResponse: DataProviderResponse<any> = {
                        success: false,
                        message: error.response.data?.message || `Request failed with status ${error.response.status}`,
                        errors: error.response.data?.errors || error.response.data || null,
                        data: null,
                        status: 'error',
                        originalError: error,
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

    async fetch<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        search?: string;
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.get<DataProviderResponse<TResponseData>>(`/${resource}`, { params });
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async upload<TResponseData>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, any>;
        storage?: StorageConfig;
    }): Promise<DataProviderResponse<TResponseData>> {
        try {
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

            const response = await this.client.post<DataProviderResponse<TResponseData>>(`/${resource}/upload`, formData, {
                headers: {
                    'Content-Type': undefined,
                }
            });
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async fetchById<TResponseData>(resource: string, id: string | number, params?: {
        fields?: string | string[];
        include?: string | string[];
    }): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.get<DataProviderResponse<TResponseData>>(`/${resource}/${id}`, { params });
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async insert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.post<DataProviderResponse<TResponseData>>(`/${resource}`, data);
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async modify<TResponseData, TParams = TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter;
    }, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        try {
            const url = params?.id ? `/${resource}/${params.id}` : `/${resource}`;
            const config: AxiosRequestConfig = params?.id ? {} : { params: { filter: params.filter } };

            const response = await this.client.patch<DataProviderResponse<TResponseData>>(url, data, config);
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async upsert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>, uniqueFields?: [string, ...string[]]): Promise<DataProviderResponse<TResponseData>> {
        try {
            const payload = {
                ...data,
                _uniqueFields: uniqueFields,
            };
            const response = await this.client.post<DataProviderResponse<TResponseData>>(`/${resource}`, payload);
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async remove<TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter;
    }): Promise<DataProviderResponse<TResponseData>> {
        try {
            const url = params?.id ? `/${resource}/${params.id}` : `/${resource}`;
            const config: AxiosRequestConfig = params?.id ? {} : { params: { filter: params.filter } };

            const response = await this.client.delete<DataProviderResponse<TResponseData>>(url, config);
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
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
        try {
            const response = await this.client.get<DataProviderResponse<TResponseData>>(`/${resource}`, { params });
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async fetchOne<TResponseData>(resource: string, params?: {
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[]
    }): Promise<DataProviderResponse<TResponseData>> {
        try {
            const queryParams = { ...params, pagination: { page: 1, perPage: 1 } };
            const response = await this.client.get<DataProviderResponse<TResponseData>>(`/${resource}`, { params: queryParams });
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async uploadFile<TResponseData>(resource: string, formData: FormData): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.post<DataProviderResponse<TResponseData>>(
                `/${resource}/import`,
                formData,
                {
                    headers: { "Content-Type": "multipart/form-data" },
                }
            );
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async downloadFile(resource: string, params?: Record<string, any>): Promise<Blob> {
        try {
            const response = await this.client.get(`/${resource}/export`, {
                params,
                responseType: "blob",
            });
            return response.data;
        } catch (error: any) {
            console.error("Error al descargar archivo:", error);
            throw error;
        }
    }

    async modifyMany<TResponseData, TParams = TResponseData>(
        resource: string,
        data: Partial<TParams>[]
    ): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.patch<DataProviderResponse<TResponseData>>(
                `/${resource}/bulk-update`,
                { items: data }
            );
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async removeMany<TResponseData>(
        resource: string,
        params: { ids: Array<string | number> }
    ): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.delete<DataProviderResponse<TResponseData>>(
                `/${resource}/bulk-delete`,
                { data: params }
            );
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async count<TResponseData = number>(resource: string, filter?: QueryFilter): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.get<DataProviderResponse<TResponseData>>(`/${resource}/count`, { params: { filter } });
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async signIn<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams, uri?: string): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.post<DataProviderResponse<TResponseData>>(uri ?? '/auth/signin', credentials);
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async signUp<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams, uri?: string): Promise<DataProviderResponse<TResponseData>> {
        try {
            const response = await this.client.post<DataProviderResponse<TResponseData>>(uri ?? '/auth/signup', credentials);
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async signOut(uri?: string): Promise<DataProviderResponse> {
        try {
            const response = await this.client.post<DataProviderResponse>(uri ?? '/auth/signout');
            this.store?.dispatch({ type: 'RESET_STATE' });
            return response.data;
        } catch (error: any) {
            this.store?.dispatch({ type: 'RESET_STATE' });
            return Promise.reject(error);
        }
    }
}
