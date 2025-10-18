import { useCallback, useEffect, useState } from "react";
import {
    DataAdapter,
    DataProviderResponse,
    PaginatedData, ProcessApiResponse,
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

export function useEntityService<
    T extends { id?: string | number } = any,
    E = Record<string, unknown>
>(
    resource: string,
    options?: {
        perPage?: number;
        include?: string | string[];
        sort?: SortCondition | SortCondition[];
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
        filter: {},
        sort: options?.sort,
        include: options?.include,
        search: "",
        isLoading: false,
        error: null,
    });

    /** Ejecutar cualquier método del adapter */
    const execute = useCallback(
        async <K extends keyof DataAdapter>(
            method: K,
            ...args: Parameters<NonNullable<DataAdapter[K]>>
        ): Promise<DataProviderResponse<any> & { errors?: E }> => {
            const fn = adapter[method];
            if (typeof fn !== "function") {
                throw new Error(`El método ${String(method)} no está disponible en el adapter`);
            }

            setState((prev) => ({ ...prev, isLoading: true, error: null }));

            try {
                const response = await (fn as any)(resource, ...args);
                const processed = ProcessApiResponse<any>(response) as DataProviderResponse<any> & { errors?: E };

                setState((prev) => ({
                    ...prev,
                    isLoading: false,
                    error: processed.success ? null : processed.errors,
                }));

                return processed;
            } catch (error) {
                const processed = ProcessApiResponse(error) as DataProviderResponse<any> & { errors?: E };
                setState((prev) => ({ ...prev, isLoading: false, error: processed.errors }));
                return processed;
            }
        },
        [adapter, resource]
    );

    /** Fetch paginado */
    const fetchMany = useCallback(
        async (params?: {
            page?: number;
            perPage?: number;
            filter?: QueryFilter;
            sort?: SortCondition | SortCondition[];
            search?: string;
            include?: string | string[];
        }) => {
            if (typeof adapter.fetchMany !== "function") {
                throw new Error("El adapter no implementa fetchMany");
            }

            setState((prev) => ({ ...prev, isLoading: true }));

            const page = params?.page ?? state.pagination.page;
            const perPage = params?.perPage ?? state.pagination.perPage;

            const response = await adapter.fetchMany<PaginatedData<T>>(resource, {
                pagination: { page, perPage },
                filter: params?.filter ?? state.filter,
                sort: params?.sort ?? state.sort,
                search: params?.search ?? state.search,
                include: params?.include ?? state.include,
            });

            const processed = ProcessApiResponse<PaginatedData<T>>(response) as DataProviderResponse<PaginatedData<T>> & { errors?: E };
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

    /** Crear registro */
    const add = useCallback(
        async (data: Partial<T>) => {
            if (typeof adapter.insert !== "function")
                throw new Error("El adapter no implementa insert");

            const response = await adapter.insert<T>(resource, data);
            const processed = ProcessApiResponse<T>(response) as DataProviderResponse<T> & { errors?: E };

            if (processed.success && processed.data) {
                setState((prev) => ({
                    ...prev,
                    items: [processed.data as T, ...prev.items],
                    error: null,
                }));
            } else {
                setState((prev) => ({ ...prev, error: processed.errors ?? null }));
            }

            return processed;
        },
        [adapter, resource]
    );

    /** Actualizar registro */
    const update = useCallback(
        async (id: string | number, data: Partial<T>) => {
            if (typeof adapter.modify !== "function")
                throw new Error("El adapter no implementa modify");

            const response = await adapter.modify<T>(resource, { id }, data);
            const processed = ProcessApiResponse<T>(response) as DataProviderResponse<T> & { errors?: E };

            if (processed.success && processed.data) {
                setState((prev) => ({
                    ...prev,
                    items: prev.items.map((i) =>
                        String(i.id) === String(id)
                            ? { ...i, ...(processed.data as T) }
                            : i
                    ),
                    error: null,
                }));
            } else {
                setState((prev) => ({ ...prev, error: processed.errors ?? null }));
            }

            return processed;
        },
        [adapter, resource]
    );

    /** Eliminar registro */
    const remove = useCallback(
        async (id: string | number) => {
            if (typeof adapter.remove !== "function")
                throw new Error("El adapter no implementa remove");

            const response = await adapter.remove<T>(resource, { id });
            const processed = ProcessApiResponse(response) as DataProviderResponse<T> & { errors?: E };

            if (processed.success) {
                setState((prev) => ({
                    ...prev,
                    items: prev.items.filter((i) => String(i.id) !== String(id)),
                    error: null,
                }));
            } else {
                setState((prev) => ({ ...prev, error: processed.errors ?? null }));
            }

            return processed;
        },
        [adapter, resource]
    );

    /** Cambiar página */
    const setPage = useCallback(
        (page: number) =>
            setState((prev) => ({
                ...prev,
                pagination: { ...prev.pagination, page },
            })),
        []
    );

    /** Cambiar perPage */
    const setPerPage = useCallback(
        (perPage: number) =>
            setState((prev) => ({
                ...prev,
                pagination: { ...prev.pagination, perPage },
            })),
        []
    );

    /** Buscar / filtrar / ordenar / incluir relaciones */
    const setSearch = (search: string) =>
        setState((prev) => ({ ...prev, search }));
    const setFilter = (filter: QueryFilter) =>
        setState((prev) => ({ ...prev, filter }));
    const setSort = (sort: SortCondition | SortCondition[]) =>
        setState((prev) => ({ ...prev, sort }));
    const setInclude = (include: string | string[]) =>
        setState((prev) => ({ ...prev, include }));

    /** Auto-fetch inicial */
    useEffect(() => {
        if (options?.autoFetch !== false) fetchMany();
    }, [state.pagination.page, state.search, state.filter, state.sort]);

    return {
        ...state,
        fetchMany,
        add,
        update,
        remove,
        setPage,
        setPerPage,
        setSearch,
        setFilter,
        setSort,
        setInclude,
        execute
    };
}