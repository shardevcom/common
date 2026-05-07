import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    DataAdapter,
    DataProviderResponse,
    PaginatedData,
    ProcessApiResponse,
    QueryFilter,
    SortCondition,
} from "../../types";

import { useData } from "../data";

export interface PaginationState {
    page: number;
    perPage: number;
    total: number;
}

export interface EntityServiceState<
    T,
    E = Record<string, unknown>
> {
    items: T[];
    pagination: PaginationState;
    filter?: QueryFilter;
    sort?: SortCondition | SortCondition[];
    include?: string | string[];
    search?: string;
    isLoading: boolean;
    isFetching: boolean;
    isSaving: boolean;
    isDeleting: boolean;
    initialized: boolean;
    lastUpdatedAt?: number;
    error?: E | null;
}

interface FetchManyParams {
    page?: number;
    perPage?: number;
    filter?: QueryFilter;
    sort?: SortCondition | SortCondition[];
    search?: string;
    include?: string | string[];
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
    const requestIdRef = useRef(0);
    const [refreshKey, setRefreshKey] = useState(0);
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
        isFetching: false,
        isSaving: false,
        isDeleting: false,
        initialized: false,
        lastUpdatedAt: undefined,
        error: null,
    });

    /**
     * =====================================
     * STATE REF
     * =====================================
     */

    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    /**
     * =====================================
     * HELPERS
     * =====================================
     */

    const startLoading = useCallback(
        (
            type:
                | "fetch"
                | "save"
                | "delete"
                | "generic" = "generic"
        ) => {
            setState((prev) => ({
                ...prev,

                isLoading: true,

                isFetching:
                    type === "fetch"
                        ? true
                        : prev.isFetching,

                isSaving:
                    type === "save"
                        ? true
                        : prev.isSaving,

                isDeleting:
                    type === "delete"
                        ? true
                        : prev.isDeleting,

                error: null,
            }));
        },
        []
    );

    const stopLoading = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isLoading: false,
            isFetching: false,
            isSaving: false,
            isDeleting: false,
        }));
    }, []);

    const handleError = useCallback(
        (error: any) => {
            const processed =
                ProcessApiResponse<any>(
                    error
                ) as DataProviderResponse<any> & {
                    errors?: E;
                };

            setState((prev) => ({
                ...prev,
                isLoading: false,
                isFetching: false,
                isSaving: false,
                isDeleting: false,
                error:
                    processed.errors ??
                    (error as E) ??
                    null,
            }));

            return processed;
        },
        []
    );

    /**
     * =====================================
     * REFRESH
     * =====================================
     */

    const refresh = useCallback(() => {
        setRefreshKey((p) => p + 1);
    }, []);

    /**
     * =====================================
     * FETCH MANY
     * =====================================
     */

    const fetchMany = useCallback(
        async (params?: FetchManyParams) => {
            if (
                typeof adapter.fetchMany !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa fetchMany"
                );
            }

            const requestId = ++requestIdRef.current;

            startLoading("fetch");

            try {
                const current = stateRef.current;

                const page =
                    params?.page ??
                    current.pagination.page;

                const perPage =
                    params?.perPage ??
                    current.pagination.perPage;

                const response =
                    await adapter.fetchMany<
                        PaginatedData<T>
                    >(resource, {
                        pagination: {
                            page,
                            perPage,
                        },

                        filter:
                            params?.filter ??
                            current.filter,

                        sort:
                            params?.sort ??
                            current.sort,

                        search:
                            params?.search ??
                            current.search,

                        include:
                            params?.include ??
                            current.include,
                    });

                /**
                 * Ignorar respuestas viejas
                 */

                if (
                    requestId !== requestIdRef.current
                ) {
                    return null;
                }

                const processed =
                    ProcessApiResponse<
                        PaginatedData<T>
                    >(
                        response
                    ) as DataProviderResponse<
                        PaginatedData<T>
                    > & {
                        errors?: E;
                    };

                if (
                    processed.success &&
                    processed.data
                ) {
                    setState((prev) => ({
                        ...prev,

                        items:
                            processed.data?.data ??
                            [],

                        pagination: {
                            page:
                                processed.data
                                    ?.current_page ??
                                page,

                            perPage:
                                processed.data
                                    ?.per_page ??
                                perPage,

                            total:
                                processed.data
                                    ?.total ?? 0,
                        },
                        initialized: true,
                        isLoading: false,
                        isFetching: false,
                        error: null,
                        lastUpdatedAt:
                            Date.now(),
                    }));
                } else {
                    handleError(processed);
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading();
            }
        },
        [
            adapter,
            resource,
            startLoading,
            stopLoading,
            handleError,
        ]
    );

    /**
     * =====================================
     * GENERIC EXECUTOR
     * =====================================
     */

    const execute = useCallback(
        async <K extends keyof DataAdapter>(
            method: K,
            ...args: Parameters<
                NonNullable<DataAdapter[K]>
            >
        ) => {
            const fn = adapter[method];

            if (typeof fn !== "function") {
                throw new Error(
                    `El método ${String(
                        method
                    )} no existe`
                );
            }

            startLoading();

            try {
                const response = await (
                    fn as any
                )(resource, ...args);

                const processed =
                    ProcessApiResponse<any>(
                        response
                    );

                stopLoading();

                return processed;
            } catch (err) {
                return handleError(err);
            }
        },
        [
            adapter,
            resource,
            startLoading,
            stopLoading,
            handleError,
        ]
    );

    /**
     * =====================================
     * ADD
     * =====================================
     */

    const add = useCallback(
        async (data: Partial<T>) => {
            if (
                typeof adapter.insert !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa insert"
                );
            }

            startLoading("save");

            try {
                const response =
                    await adapter.insert<T>(
                        resource,
                        data
                    );

                const processed =
                    ProcessApiResponse<T>(
                        response
                    );

                if (
                    processed.success &&
                    processed.data
                ) {
                    setState((prev) => ({
                        ...prev,

                        items: [
                            processed.data as T,
                            ...prev.items,
                        ],
                    }));
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading();
            }
        },
        [
            adapter,
            resource,
            startLoading,
            stopLoading,
            handleError,
        ]
    );

    /**
     * =====================================
     * UPDATE
     * =====================================
     */

    const update = useCallback(
        async (
            id: string | number,
            data: Partial<T>
        ) => {
            if (
                typeof adapter.modify !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa modify"
                );
            }

            startLoading("save");

            try {
                const response =
                    await adapter.modify<T>(
                        resource,
                        { id },
                        data
                    );

                const processed =
                    ProcessApiResponse<T>(
                        response
                    );

                if (
                    processed.success &&
                    processed.data
                ) {
                    setState((prev) => ({
                        ...prev,
                        items: prev.items.map(
                            (item) =>
                                String(item.id) ===
                                String(id)
                                    ? {
                                        ...item,
                                        ...(processed.data as T),
                                    }
                                    : item
                        ),
                    }));
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading();
            }
        },
        [
            adapter,
            resource,
            startLoading,
            stopLoading,
            handleError,
        ]
    );

    /**
     * =====================================
     * REMOVE
     * =====================================
     */

    const remove = useCallback(
        async (id: string | number) => {
            if (
                typeof adapter.remove !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa remove"
                );
            }

            startLoading("delete");

            try {
                const response =
                    await adapter.remove(
                        resource,
                        { id }
                    );

                const processed =
                    ProcessApiResponse(
                        response
                    );

                if (processed.success) {
                    setState((prev) => ({
                        ...prev,

                        items: prev.items.filter(
                            (item) =>
                                String(item.id) !==
                                String(id)
                        ),
                    }));
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading();
            }
        },
        [
            adapter,
            resource,
            startLoading,
            stopLoading,
            handleError,
        ]
    );

    /**
     * =====================================
     * HELPERS
     * =====================================
     */

    const setPage = useCallback(
        (page: number) => {
            setState((prev) => ({
                ...prev,

                pagination: {
                    ...prev.pagination,
                    page,
                },
            }));
        },
        []
    );

    const setPerPage = useCallback(
        (perPage: number) => {
            setState((prev) => ({
                ...prev,

                pagination: {
                    ...prev.pagination,
                    perPage,
                },
            }));
        },
        []
    );

    const setSearch = useCallback(
        (search: string) => {
            setState((prev) => ({
                ...prev,
                search,
            }));
        },
        []
    );

    const setFilter = useCallback(
        (filter: QueryFilter) => {
            setState((prev) => ({
                ...prev,
                filter,
            }));
        },
        []
    );

    const setSort = useCallback(
        (
            sort:
                | SortCondition
                | SortCondition[]
        ) => {
            setState((prev) => ({
                ...prev,
                sort,
            }));
        },
        []
    );

    /**
     * =====================================
     * RESET
     * =====================================
     */

    const reset = useCallback(() => {
        setState((prev) => ({
            ...prev,

            items: [],

            pagination: {
                ...prev.pagination,
                page: 1,
                total: 0,
            },

            error: null,
        }));
    }, []);

    /**
     * =====================================
     * AUTO FETCH
     * =====================================
     */

    useEffect(() => {
        if (options?.autoFetch === false)
            return;

        fetchMany();
    }, [
        refreshKey,
        state.pagination.page,
        state.pagination.perPage,
        state.search,
        state.filter,
        state.sort,
    ]);

    /**
     * =====================================
     * RETURN
     * =====================================
     */

    return useMemo(
        () => ({
            ...state,
            refresh,
            reset,
            fetchMany,
            add,
            update,
            remove,
            execute,
            setPage,
            setPerPage,
            setSearch,
            setFilter,
            setSort,
        }),
        [
            state,
            refresh,
            reset,
            fetchMany,
            add,
            update,
            remove,
            execute,
        ]
    );
}