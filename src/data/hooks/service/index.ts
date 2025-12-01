import { useCallback, useEffect, useState } from "react";
import {
    DataAdapter,
    DataProviderResponse,
    PaginatedData,
    ProcessApiResponse,
    QueryFilter,
    SortCondition,
} from "@/data";
import { useData } from "@/data/hooks";

export interface PaginationState {
    page: number;
    perPage: number;
    total: number;
}

export interface EntityServiceState<T, E = Record<string, unknown>> {
    items: T[];
    pagination: PaginationState;
    filter?: QueryFilter;
    sort?: SortCondition | SortCondition[];
    include?: string | string[];
    search?: string;
    isLoading: boolean;
    error?: E | null;
}

export function useResourceService<
    T extends { id?: string | number } = any,
    E = Record<string, unknown>
>(
    resource: string,
    options?: {
        perPage?: number;
        include?: string | string[];
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        autoFetch?: boolean;
    }
) {
    const adapter: DataAdapter = useData();

    const [state, setState] = useState<EntityServiceState<T, E>>({
        items: [],
        pagination: {
            page: 1,
            perPage: options?.perPage ?? 10,
            total: 0,
        },
        filter: options?.filter ?? {},
        sort: options?.sort,
        include: options?.include,
        search: "",
        isLoading: false,
        error: null,
    });

    /** Utilidad interna para manejar errores y estados */
    const handleResponse = useCallback(
        <R>(response: any): DataProviderResponse<R> & { errors?: E } => {
            const processed = ProcessApiResponse<R>(response) as DataProviderResponse<R> & { errors?: E };
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: processed.success ? null : processed.errors ?? null,
            }));
            return processed;
        },
        []
    );

    /** Ejecutar método genérico */
    const execute = useCallback(
        async <K extends keyof DataAdapter>(
            method: K,
            ...args: Parameters<NonNullable<DataAdapter[K]>>
        ): Promise<DataProviderResponse<any> & { errors?: E }> => {
            const fn = adapter[method];
            if (typeof fn !== "function") {
                throw new Error(`El método ${String(method)} no está disponible en el adapter`);
            }
            setState((prev) => ({ ...prev, isLoading: true }));
            try {
                const response = await (fn as any)(resource, ...args);
                return handleResponse<any>(response);
            } catch (err) {
                return handleResponse<any>(err);
            }
        },
        [adapter, resource, handleResponse]
    );

    /** 🔄 Obtener muchos registros (paginado) */
    const fetchMany = useCallback(
        async (params?: {
            page?: number;
            perPage?: number;
            filter?: QueryFilter;
            sort?: SortCondition | SortCondition[];
            search?: string;
            include?: string | string[];
        }) => {
            if (typeof adapter.fetchMany !== "function")
                throw new Error("El adapter no implementa fetchMany");

            setState((p) => ({ ...p, isLoading: true }));

            const page = params?.page ?? state.pagination.page;
            const perPage = params?.perPage ?? state.pagination.perPage;

            const response = await adapter.fetchMany<PaginatedData<T>>(resource, {
                pagination: { page, perPage },
                filter: params?.filter ?? state.filter,
                sort: params?.sort ?? state.sort,
                search: params?.search ?? state.search,
                include: params?.include ?? state.include,
            });

            const processed = ProcessApiResponse<PaginatedData<T>>(response) as DataProviderResponse<
                PaginatedData<T>
            > & { errors?: E };

            if (processed.success && processed.data) {
                setState((prev) => ({
                    ...prev,
                    items: processed?.data?.data ?? [],
                    pagination: {
                        page: processed?.data?.current_page ?? page,
                        perPage: processed?.data?.per_page ?? perPage,
                        total: processed?.data?.total ?? 0,
                    },
                    isLoading: false,
                    error: null,
                }));
            } else {
                setState((prev) => ({ ...prev, isLoading: false, error: processed.errors ?? null }));
            }

            return processed;
        },
        [adapter, resource, state]
    );

    /** ➕ Crear registro */
    const add = useCallback(
        async (data: Partial<T>) => {
            if (typeof adapter.insert !== "function")
                throw new Error("El adapter no implementa insert");

            const response = await adapter.insert<T>(resource, data);
            const processed = handleResponse<T>(response);
            if (processed.success && processed.data) {
                setState((prev) => ({
                    ...prev,
                    items: [processed.data as T, ...prev.items],
                }));
            }
            return processed;
        },
        [adapter, resource, handleResponse]
    );

    /** ✏️ Actualizar registro */
    const update = useCallback(
        async (id: string | number, data: Partial<T>) => {
            if (typeof adapter.modify !== "function")
                throw new Error("El adapter no implementa modify");

            const response = await adapter.modify<T>(resource, { id }, data);
            const processed = handleResponse<T>(response);

            if (processed.success && processed.data) {
                setState((prev) => ({
                    ...prev,
                    items: prev.items.map((i) =>
                        String(i.id) === String(id) ? { ...i, ...(processed.data as T) } : i
                    ),
                }));
            }
            return processed;
        },
        [adapter, resource, handleResponse]
    );

    /** 🗑️ Eliminar registro */
    const remove = useCallback(
        async (id: string | number) => {
            if (typeof adapter.remove !== "function")
                throw new Error("El adapter no implementa remove");

            const response = await adapter.remove<T>(resource, { id });
            const processed = handleResponse<T>(response);

            if (processed.success) {
                setState((prev) => ({
                    ...prev,
                    items: prev.items.filter((i) => String(i.id) !== String(id)),
                }));
            }
            return processed;
        },
        [adapter, resource, handleResponse]
    );

    /** 📤 Importar desde archivo */
    const importFromFile = useCallback(
        async (file: File, extra?: Record<string, any>) => {
            if (typeof adapter.uploadFile !== "function")
                throw new Error("El adapter no implementa uploadFile");

            setState((s) => ({ ...s, isLoading: true }));

            const formData = new FormData();
            formData.append("file", file);
            if (extra)
                Object.entries(extra).forEach(([k, v]) =>
                    formData.append(k, String(v))
                );

            try {
                const response = await adapter.uploadFile<T[]>(resource, formData);
                const processed = handleResponse<T[]>(response);

                if (processed.success) {
                    await fetchMany(); // Refrescar listado tras importación
                }

                return processed;
            } catch (err) {
                return handleResponse<any>(err);
            }
        },
        [adapter, resource, fetchMany, handleResponse]
    );

    /** 📥 Exportar datos */
    const exportToFile = useCallback(
        async (params?: {
            format?: "csv" | "xlsx" | "json";
            filter?: Record<string, any>;
            sort?: Record<string, "asc" | "desc">;
        }) => {
            if (typeof adapter.downloadFile !== "function")
                throw new Error("El adapter no implementa downloadFile");

            setState((s) => ({ ...s, isLoading: true }));

            try {
                const blob = await adapter.downloadFile(resource, params ?? {});
                setState((s) => ({ ...s, isLoading: false }));
                return blob;
            } catch (err) {
                return handleResponse<any>(err);
            }
        },
        [adapter, resource, handleResponse]
    );

    /** 🗑️ Eliminar múltiples */
    const deleteMany = useCallback(
        async (ids: Array<string | number>) => {
            if (typeof adapter.removeMany !== "function")
                throw new Error("El adapter no implementa removeMany");

            setState((s) => ({ ...s, isLoading: true }));

            try {
                const response = await adapter.removeMany(resource, { ids });
                const processed = handleResponse<any>(response);

                if (processed.success) {
                    setState((prev) => ({
                        ...prev,
                        items: prev.items.filter((i) => !ids.includes(i.id as any)),
                    }));
                }
                return processed;
            } catch (err) {
                return handleResponse<any>(err);
            }
        },
        [adapter, resource, handleResponse]
    );

    /** ✏️ Actualizar múltiples */
    const updateMany = useCallback(
        async (items: Partial<T>[]) => {
            if (typeof adapter.modifyMany !== "function")
                throw new Error("El adapter no implementa modifyMany");

            setState((s) => ({ ...s, isLoading: true }));

            try {
                const response = await adapter.modifyMany<T>(resource, items);
                const processed = handleResponse<T[]>(response);

                if (processed.success) {
                    await fetchMany(); // Refrescar listado tras actualización masiva
                }

                return processed;
            } catch (err) {
                return handleResponse<any>(err);
            }
        },
        [adapter, resource, fetchMany, handleResponse]
    );

    /** --- Helpers de estado --- */
    const setPage = (page: number) =>
        setState((prev) => ({
            ...prev,
            pagination: { ...prev.pagination, page },
        }));
    const setPerPage = (perPage: number) =>
        setState((prev) => ({
            ...prev,
            pagination: { ...prev.pagination, perPage },
        }));
    const setSearch = (search: string) => setState((p) => ({ ...p, search }));
    const setFilter = (filter: QueryFilter) => setState((p) => ({ ...p, filter }));
    const setSort = (sort: SortCondition | SortCondition[]) => setState((p) => ({ ...p, sort }));

    /** Auto-fetch inicial */
    useEffect(() => {
        if (options?.autoFetch !== false) fetchMany();
    }, [state.pagination.page, state.pagination.perPage, state.search, state.filter, state.sort]);

    return {
        ...state,
        fetchMany,
        add,
        update,
        remove,
        importFromFile,
        exportToFile,
        deleteMany,
        updateMany,
        setPage,
        setPerPage,
        setSearch,
        setFilter,
        setSort,
        execute,
    };
}