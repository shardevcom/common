import {useCallback, useEffect, useMemo, useRef, useState,} from "react";

import {
    DataAdapter,
    DataProviderResponse,
    PaginatedData,
    ProcessApiResponse,
    QueryFilter,
    SortCondition,
} from "../../types";

import {useData} from "../data";

/**
 * =====================================
 * PAGINATION
 * =====================================
 */

export interface PaginationState {
    page: number;
    perPage: number;
    total: number;
}

/**
 * =====================================
 * STATE
 * =====================================
 */

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
    isImporting: boolean;
    isExporting: boolean;
    initialized: boolean;
    lastUpdatedAt?: number;
    error?: E | null;
}

/**
 * =====================================
 * FETCH PARAMS
 * =====================================
 */

interface FetchManyParams {
    page?: number;
    perPage?: number;
    filter?: QueryFilter;
    sort?: SortCondition | SortCondition[];
    search?: string;
    include?: string | string[];
}

/**
 * =====================================
 * EXPORT PARAMS
 * =====================================
 */

interface ExportParams {
    format?: "csv" | "xlsx" | "json";
    filter?: Record<string, any>;
    sort?: Record<string, "asc" | "desc">;
}

/**
 * =====================================
 * HOOK
 * =====================================
 */

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
    /**
     * =====================================
     * ADAPTER
     * =====================================
     */

    const adapter: DataAdapter = useData();

    /**
     * =====================================
     * REFS
     * =====================================
     */

    const requestIdRef = useRef(0);

    const stateRef = useRef<
        EntityServiceState<T, E>
    >(null as any);

    /**
     * =====================================
     * INTERNAL
     * =====================================
     */

    const [refreshKey, setRefreshKey] =
        useState(0);

    /**
     * =====================================
     * STATE
     * =====================================
     */

    const [state, setState] = useState<
        EntityServiceState<T, E>
    >({
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
        isImporting: false,
        isExporting: false,
        initialized: false,
        lastUpdatedAt: undefined,
        error: null,
    });

    /**
     * =====================================
     * SYNC STATE REF
     * =====================================
     */

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    /**
     * =====================================
     * START LOADING
     * =====================================
     */

    const startLoading = useCallback(
        (
            type:
                | "fetch"
                | "save"
                | "delete"
                | "import"
                | "export"
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

                isImporting:
                    type === "import"
                        ? true
                        : prev.isImporting,

                isExporting:
                    type === "export"
                        ? true
                        : prev.isExporting,

                error: null,
            }));
        },
        []
    );

    /**
     * =====================================
     * STOP LOADING
     * =====================================
     */

    const stopLoading = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isLoading: false,
            isFetching: false,
            isSaving: false,
            isDeleting: false,
            isImporting: false,
            isExporting: false,
        }));
    }, []);

    /**
     * =====================================
     * HANDLE ERROR
     * =====================================
     */

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
                isImporting: false,
                isExporting: false,
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
        setRefreshKey((prev) => prev + 1);
    }, []);

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

            const requestId =
                ++requestIdRef.current;

            startLoading("fetch");

            try {
                const current =
                    stateRef.current;

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
                 * IGNORAR RESPUESTAS VIEJAS
                 */

                if (
                    requestId !==
                    requestIdRef.current
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
                            processed.data
                                ?.data ?? [],

                        pagination: {
                            page:
                                processed
                                    .data
                                    ?.current_page ??
                                page,

                            perPage:
                                processed
                                    .data
                                    ?.per_page ??
                                perPage,

                            total:
                                processed
                                    .data
                                    ?.total ?? 0,
                        },
                        initialized: true,
                        lastUpdatedAt: Date.now(),
                        isLoading: false,
                        isFetching: false,
                        error: null,
                    }));
                } else {
                    handleError(processed);
                }

                return processed;
            } catch (err) {
                return handleError(err);
            }
        },
        [
            adapter,
            resource,
            startLoading,
            handleError,
        ]
    );

    /**
     * =====================================
     * EXECUTE
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
                        lastUpdatedAt: Date.now(),
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
     * UPSERT
     * =====================================
     */

    const upsert = useCallback(
        async <
            TResponseData = any,
            TParams = TResponseData
        >(
            data: Partial<TParams>[],
            uniqueFields: [
                string,
                ...string[]
            ]
        ) => {
            if (
                typeof adapter.upsert !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa upsert"
                );
            }

            startLoading("save");

            try {
                const payload: Record<
                    string,
                    any
                > = {
                    _uniqueFields:
                    uniqueFields,
                };

                data.forEach((item, index) => {
                    payload[index] = item;
                });

                const response =
                    await adapter.upsert<
                        TResponseData,
                        typeof payload
                    >(
                        resource,
                        payload
                    );

                const processed =
                    ProcessApiResponse<TResponseData>(
                        response
                    );

                if (processed.success) {
                    await fetchMany();
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
            fetchMany,
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
                        {id},
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
                        lastUpdatedAt: Date.now(),
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
                        {id}
                    );

                const processed =
                    ProcessApiResponse(
                        response
                    );

                if (processed.success) {
                    setState((prev) => ({
                        ...prev,
                        items:
                            prev.items.filter(
                                (item) =>
                                    String(
                                        item.id
                                    ) !==
                                    String(id)
                            ),
                        lastUpdatedAt: Date.now(),
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
     * DELETE MANY
     * =====================================
     */

    const deleteMany = useCallback(
        async (
            ids: Array<string | number>
        ) => {
            if (
                typeof adapter.removeMany !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa removeMany"
                );
            }

            startLoading("delete");

            try {
                const response =
                    await adapter.removeMany(
                        resource,
                        {ids}
                    );

                const processed =
                    ProcessApiResponse(
                        response
                    );

                if (processed.success) {
                    setState((prev) => ({
                        ...prev,
                        items:
                            prev.items.filter(
                                (item) =>
                                    !ids.includes(
                                        item.id as any
                                    )
                            ),

                        lastUpdatedAt: Date.now(),
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
     * UPDATE MANY
     * =====================================
     */

    const updateMany = useCallback(
        async (items: Partial<T>[]) => {
            if (
                typeof adapter.modifyMany !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa modifyMany"
                );
            }

            startLoading("save");

            try {
                const response =
                    await adapter.modifyMany<T>(
                        resource,
                        items
                    );

                const processed =
                    ProcessApiResponse<T[]>(
                        response
                    );

                if (processed.success) {
                    await fetchMany();
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
            fetchMany,
            startLoading,
            stopLoading,
            handleError,
        ]
    );

    /**
     * =====================================
     * IMPORT FILE
     * =====================================
     */

    const importFromFile = useCallback(
        async (
            file: File,
            extra?: Record<string, any>
        ) => {
            if (
                typeof adapter.uploadFile !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa uploadFile"
                );
            }

            startLoading("import");

            try {
                const formData =
                    new FormData();

                formData.append(
                    "file",
                    file
                );

                if (extra) {
                    Object.entries(
                        extra
                    ).forEach(([k, v]) => {
                        formData.append(
                            k,
                            String(v)
                        );
                    });
                }

                const response =
                    await adapter.uploadFile<
                        T[]
                    >(resource, formData);

                const processed =
                    ProcessApiResponse<T[]>(
                        response
                    );

                if (processed.success) {
                    await fetchMany();
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
            fetchMany,
            startLoading,
            stopLoading,
            handleError,
        ]
    );

    /**
     * =====================================
     * EXPORT FILE
     * =====================================
     */

    const exportToFile = useCallback(
        async (params?: ExportParams) => {
            if (
                typeof adapter.downloadFile !==
                "function"
            ) {
                throw new Error(
                    "El adapter no implementa downloadFile"
                );
            }

            startLoading("export");

            try {
                return await adapter.downloadFile(
                    resource,
                    params ?? {}
                );
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
            upsert,
            update,
            remove,
            deleteMany,
            updateMany,
            importFromFile,
            exportToFile,
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
            upsert,
            update,
            remove,
            deleteMany,
            updateMany,
            importFromFile,
            exportToFile,
            execute,
        ]
    );
}