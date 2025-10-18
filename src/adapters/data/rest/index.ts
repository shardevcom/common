import axios, { AxiosHeaders, AxiosInstance, AxiosRequestConfig, CreateAxiosDefaults } from "axios";
import {
    BaseDataAdapter,
    DataAdapter,
    DataAdapterConfig,
    DataProviderResponse, FileType,
    QueryFilter,
    SortCondition, StorageConfig
} from "@/data";
import {AuthUser} from "@/auth";


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
                // Manejo básico de errores HTTP
                if (error.response) {
                    // La solicitud fue hecha y el servidor respondió con un código de estado
                    // que cae fuera del rango de 2xx
                    console.error("Error en la respuesta del servidor:", error.response.data);
                    console.error("Status:", error.response.status);
                    console.error("Headers:", error.response.headers);

                    if (error.response.status === 401) {
                        console.warn("Sesión expirada o no autenticado: reiniciando autenticación.");
                        // Disparar una acción Redux para manejar el estado de autenticación global
                        // Asegúrate de que 'RESET_STATE' sea una acción válida en tu store
                        this.store?.dispatch({ type: 'RESET_STATE' });// Considera una acción más específica
                    }

                    // Devolver una estructura DataProviderResponse para uniformidad
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
                    console.error("No se recibió respuesta del servidor:", error.request);
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
                    // Algo sucedió al configurar la solicitud que provocó un Error
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
            // Axios serializa automáticamente el objeto params en query string
            const response = await this.client.get<DataProviderResponse<TResponseData>>(`/${resource}`, { params });
            return response.data;
        } catch (error: any) {
            // El interceptor de respuesta ya maneja la transformación del error a DataProviderResponse
            return Promise.reject(error);
        }
    }

    async upload<TResponseData>(resource: string, params: {
        file: FileType;
        metadata?: Record<string, any>;
        storage?: StorageConfig; // Podría usarse para influir en el endpoint o cabeceras
    }): Promise<DataProviderResponse<TResponseData>> {
        try {
            const formData = new FormData();

            // Manejar diferentes tipos de FileType (File, Blob, Buffer, Array)
            if (Array.isArray(params.file)) {
                params.file.forEach((f, index) => {
                    formData.append(`files[${index}]`, f as Blob); // FormData trabaja bien con Blob y File
                });
            } else {
                formData.append('file', params.file as Blob); // FormData trabaja bien con Blob y File
            }


            // Añadir metadatos si existen. Podrían ser serializados a JSON si son complejos.
            if (params.metadata) {
                // Opción 1: Añadir metadatos como un campo JSON serializado
                formData.append('metadata', JSON.stringify(params.metadata));
                // Opción 2: Añadir cada propiedad de metadatos como un campo separado
                // Object.keys(params.metadata).forEach(key => {
                //     formData.append(key, params.metadata[key]);
                // });
            }

            // Axios establecerá automáticamente el Content-Type correcto (multipart/form-data)
            const response = await this.client.post<DataProviderResponse<TResponseData>>(`/${resource}/upload`, formData, {
                headers: {
                    'Content-Type': undefined,
                }
            }); // Endpoint común para subidas
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
        filter?: QueryFilter; // El filtro para modificar podría ser complejo de pasar vía REST
    }, data: Partial<TParams>): Promise<DataProviderResponse<TResponseData>> {
        try {
            // Si se proporciona un ID, usamos ese endpoint. Si no, intentamos usar el filtro (menos común en REST estándar para PATCH/PUT múltiples)
            // Nota: Modificar por filtro sin ID puede no ser soportado por todas las APIs REST estándar.
            const url = params?.id ? `/${resource}/${params.id}` : `/${resource}`;
            // Si usas filtro sin ID, es probable que el backend espere el filtro en query params
            const config: AxiosRequestConfig = params?.id ? {} : { params: { filter: params.filter } }; // Esto puede requerir serialización custom de QueryFilter

            // Usamos PATCH para modificaciones parciales, PUT para reemplazo completo. PATCH es más común para 'modify'.
            const response = await this.client.patch<DataProviderResponse<TResponseData>>(url, data, config);
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async upsert<TResponseData, TParams = TResponseData>(resource: string, data: Partial<TParams>, uniqueFields?: [string, ...string[]]): Promise<DataProviderResponse<TResponseData>> {
        try {
            // La lógica de upsert (insertar o actualizar) generalmente reside en el backend.
            // Podemos usar un endpoint específico o enviar información adicional (como uniqueFields)
            // en una petición POST o PUT al endpoint de recurso.
            // Una convención posible es un POST a /resource/upsert o un PUT a /resource con data y uniqueFields.
            // Optaremos por un POST al endpoint base, enviando uniqueFields en el cuerpo (si el backend lo espera así).
            const payload = {
                ...data,
                _uniqueFields: uniqueFields, // Usar un prefijo o campo específico para uniqueFields
            };
            const response = await this.client.post<DataProviderResponse<TResponseData>>(`/${resource}`, payload); // O quizás `/${resource}/upsert`
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async remove<TResponseData>(resource: string, params: {
        id?: string | number;
        filter?: QueryFilter; // Eliminar por filtro sin ID es menos común en REST estándar
    }): Promise<DataProviderResponse<TResponseData>> {
        try {
            // Si se proporciona un ID, usamos ese endpoint DELETE.
            // Si no, intentamos usar el filtro (menos común para DELETE de múltiples recursos).
            const url = params?.id ? `/${resource}/${params.id}` : `/${resource}`;
            // Si usas filtro sin ID, es probable que el backend espere el filtro en query params para DELETE
            const config: AxiosRequestConfig = params?.id ? {} : { params: { filter: params.filter } }; // Serialización custom de QueryFilter puede ser necesaria

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
            // Axios serializa automáticamente el objeto params en query string
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
            // Podemos añadir un parámetro de límite para indicarle al backend que solo queremos uno.
            const queryParams = { ...params, pagination: { page: 1, perPage: 1 } }; // Añadir paginación para obtener solo 1

            const response = await this.client.get<DataProviderResponse<TResponseData>>(`/${resource}`, { params: queryParams });

            // Opcionalmente, puedes verificar si se recibió un solo elemento si la API devuelve un array
            // if (Array.isArray(response.data.data)) {
            //    response.data.data = response.data.data[0] || null;
            // }

            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    /**
     * 📤 Subir un archivo para importación masiva
     */
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
                responseType: "blob", // Para manejar binarios correctamente
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
                { data: params } // DELETE no suele aceptar body, pero axios sí lo permite
            );
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async count<TResponseData = number>(resource: string, filter?: QueryFilter): Promise<DataProviderResponse<TResponseData>> {
        try {
            // Un endpoint común para contar recursos es /resource/count o usar un parámetro especial como _count=true
            const response = await this.client.get<DataProviderResponse<TResponseData>>(`/${resource}/count`, { params: { filter } }); // Pasar el filtro como query param
            // Asumiendo que la respuesta directa es el número o está en response.data.data
            // Si la respuesta es solo el número, necesitarías mapearla a la estructura DataProviderResponse
            // if (typeof response.data === 'number') {
            //     return { success: true, message: 'Count successful', errors: null, data: response.data as any, status: 'success' };
            // }

            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }


    async signIn<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams, uri?: string): Promise<DataProviderResponse<TResponseData>> {
        try {
            // Asumiendo un endpoint POST para iniciar sesión
            const response = await this.client.post<DataProviderResponse<TResponseData>>(uri ?? '/auth/signin', credentials);
            // Si la respuesta contiene el usuario y el token, puedes opcionalmente guardarlos en el store aquí
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async signUp<TResponseData extends AuthUser = AuthUser, TParams = unknown>(credentials: TParams, uri?: string): Promise<DataProviderResponse<TResponseData>> {
        try {
            // Asumiendo un endpoint POST para registrarse
            const response = await this.client.post<DataProviderResponse<TResponseData>>(uri ?? '/auth/signup', credentials);
            // Si la respuesta contiene el usuario y el token, puedes opcionalmente guardarlos en el store aquí
            return response.data;
        } catch (error: any) {
            return Promise.reject(error);
        }
    }

    async signOut(uri?: string): Promise<DataProviderResponse> {
        try {
            // Asumiendo un endpoint POST o GET para cerrar sesión. POST es común para invalidar el token en el backend.
            const response = await this.client.post<DataProviderResponse>(uri ?? '/auth/signout'); // O `/auth/logout`
            // Disparar una acción Redux para limpiar el estado de autenticación en el store
            this.store?.dispatch({ type: 'RESET_STATE' });// Asegúrate de que esta acción exista
            return response.data;
        } catch (error: any) {
            // debemos intentar limpiar el estado local.
            this.store?.dispatch({ type: 'RESET_STATE' });
            return Promise.reject(error);
        }
    }

}
