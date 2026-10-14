import {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {
    DataAdapter,
    DataProviderResponse,
    PaginatedData,
    ProcessApiResponse,
    QueryFilter,
    SortCondition,
    RateLimitInfo,
} from "../../types";

import {useData} from "../data";

/**
 * =====================================
 * SHARED TYPES (Internal - not exported)
 * =====================================
 */

interface PaginationState {
    page: number;
    perPage: number;
    total: number;
}

interface FetchManyParams {
    page?: number;
    perPage?: number;
    filter?: QueryFilter;
    sort?: SortCondition | SortCondition[];
    search?: string;
    include?: string | string[];
}

export interface ExportParams {
    format?: "csv" | "xlsx" | "json";
    filter?: Record<string, any>;
    sort?: Record<string, "asc" | "desc">;
}

export interface ResourceServiceOptions {
    perPage?: number;
    include?: string | string[];
    sort?: SortCondition | SortCondition[];
    filter?: QueryFilter;
    autoFetch?: boolean;
}

/**
 * =====================================
 * INTERNAL BASE HOOK - Single source of truth for state & logic
 * =====================================
 */

function useResourceServiceBase<
    T extends { id?: string | number } = any,
    E = Record<string, unknown>
>(
    resource: string,
    options?: ResourceServiceOptions
) {
    const adapter: DataAdapter = useData();

    const requestIdRef = useRef(0);
    const stateRef = useRef<{
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
        isRateLimited: boolean;
        rateLimitInfo?: RateLimitInfo;
    } | null>(null);

    const [refreshKey, setRefreshKey] = useState(0);

    const [state, setState] = useState<{
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
        isRateLimited: boolean;
        rateLimitInfo?: RateLimitInfo;
    }>({
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
        isRateLimited: false,
        rateLimitInfo: undefined,
    });

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const startLoading = useCallback(
        (type: "fetch" | "save" | "delete" | "import" | "export" | "generic" = "generic") => {
            setState((prev) => ({
                ...prev,
                isLoading: true,
                isFetching: type === "fetch" ? true : prev.isFetching,
                isSaving: type === "save" ? true : prev.isSaving,
                isDeleting: type === "delete" ? true : prev.isDeleting,
                isImporting: type === "import" ? true : prev.isImporting,
                isExporting: type === "export" ? true : prev.isExporting,
                error: null,
            }));
        },
        []
    );

    const stopLoading = useCallback(
        (type?: "fetch" | "save" | "delete" | "import" | "export" | "generic") => {
            setState((prev) => {
                const next = { ...prev };

                if (!type || type === "generic") {
                    next.isLoading = false;
                    next.isFetching = false;
                    next.isSaving = false;
                    next.isDeleting = false;
                    next.isImporting = false;
                    next.isExporting = false;
                    return next;
                }

                if (type === "fetch") next.isFetching = false;
                if (type === "save") next.isSaving = false;
                if (type === "delete") next.isDeleting = false;
                if (type === "import") next.isImporting = false;
                if (type === "export") next.isExporting = false;

                next.isLoading =
                    next.isFetching ||
                    next.isSaving ||
                    next.isDeleting ||
                    next.isImporting ||
                    next.isExporting;

                return next;
            });
        },
        []
    );

    const handleError = useCallback(
        <R>(error: any, requestId?: number): DataProviderResponse<R, E> => {
            if (requestId && requestId !== requestIdRef.current) {
                return error as DataProviderResponse<R, E>;
            }

            const processed = ProcessApiResponse<R>(error) as DataProviderResponse<R, E>;

            const originalError = processed.originalError;
            const isRateLimited: boolean = !!(
                originalError &&
                typeof originalError === 'object' &&
                'status' in originalError &&
                (originalError as Record<string, unknown>).status === 429
            );

            setState((prev) => ({
                ...prev,
                isLoading: false,
                isFetching: false,
                isSaving: false,
                isDeleting: false,
                isImporting: false,
                isExporting: false,
                isRateLimited,
                rateLimitInfo: processed.rateLimit,
                error: processed.errors ?? (error as E) ?? null,
            }));

            return processed;
        },
        []
    );

    const refresh = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    const reset = useCallback(() => {
        setState((prev) => ({
            ...prev,
            items: [],
            pagination: { ...prev.pagination, page: 1, total: 0 },
            error: null,
        }));
    }, []);

    const clearRateLimit = useCallback(() => {
        setState((prev) => ({
            ...prev,
            isRateLimited: false,
            rateLimitInfo: undefined,
        }));
    }, []);

    const fetchMany = useCallback(
        async (params?: FetchManyParams): Promise<DataProviderResponse<PaginatedData<T>, E> | null> => {
            if (typeof adapter.fetchMany !== "function") {
                throw new Error("El adapter no implementa fetchMany");
            }

            const requestId = ++requestIdRef.current;
            startLoading("fetch");

            try {
                const current = stateRef.current;
                const page = params?.page ?? current?.pagination.page ?? 1;
                const perPage = params?.perPage ?? current?.pagination.perPage ?? 10;

                const response = await adapter.fetchMany<PaginatedData<T>>(resource, {
                    pagination: { page, perPage },
                    filter: params?.filter ?? current?.filter,
                    sort: params?.sort ?? current?.sort,
                    search: params?.search ?? current?.search,
                    include: params?.include ?? current?.include,
                });

                if (requestId !== requestIdRef.current) {
                    return null;
                }

                const processed: DataProviderResponse<PaginatedData<T>, E> =
                    ProcessApiResponse<PaginatedData<T>>(response) as DataProviderResponse<PaginatedData<T>, E>;

                if (processed.success && processed.data) {
                    setState((prev) => ({
                        ...prev,
                        items: processed.data?.data ?? [],
                        pagination: {
                            page: processed.data?.current_page ?? page,
                            perPage: processed.data?.per_page ?? perPage,
                            total: processed.data?.total ?? 0,
                        },
                        initialized: true,
                        lastUpdatedAt: Date.now(),
                        isLoading: false,
                        isFetching: false,
                        isRateLimited: false,
                        rateLimitInfo: processed.rateLimit,
                        error: null,
                    }));
                } else {
                    handleError(processed, requestId);
                }
                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                if (requestId === requestIdRef.current) {
                    stopLoading("fetch");
                }
            }
        },
        [adapter, resource, startLoading, handleError, stopLoading]
    );

    const execute = useCallback(
        async <
            TResult = any,
            K extends keyof DataAdapter = keyof DataAdapter
        >(
            method: K,
            ...args: Parameters<NonNullable<DataAdapter[K]>>
        ): Promise<DataProviderResponse<TResult, E>> => {
            const fn = adapter[method];

            if (typeof fn !== "function") {
                throw new Error(`El método ${String(method)} no existe`);
            }

            startLoading();

            try {
                const response = await (fn as any)(resource, ...args);
                const processed: DataProviderResponse<any, E> =
                    ProcessApiResponse<any>(response) as DataProviderResponse<any, E>;

                stopLoading("generic");

                if (processed.rateLimit) {
                    setState((prev) => ({
                        ...prev,
                        isRateLimited: false,
                        rateLimitInfo: processed.rateLimit,
                    }));
                }

                return processed;
            } catch (err) {
                return handleError(err);
            }
        },
        [adapter, resource, startLoading, stopLoading, handleError]
    );

    const add = useCallback(
        async (data: Partial<T>): Promise<DataProviderResponse<T, E>> => {
            if (typeof adapter.insert !== "function") {
                throw new Error("El adapter no implementa insert");
            }

            startLoading("save");

            try {
                const response = await adapter.insert<T>(resource, data);
                const processed: DataProviderResponse<T, E> =
                    ProcessApiResponse<T>(response) as DataProviderResponse<T, E>;

                if (processed.success && processed.data) {
                    setState((prev) => ({
                        ...prev,
                        items: [processed.data as T, ...prev.items],
                        lastUpdatedAt: Date.now(),
                    }));
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading("save");
            }
        },
        [adapter, resource, startLoading, stopLoading, handleError]
    );

    const upsert = useCallback(
        async <
            TResponseData = any,
            TParams = TResponseData
        >(
            data: Partial<TParams>[],
            uniqueFields: [string, ...string[]]
        ): Promise<DataProviderResponse<TResponseData, E>> => {
            if (typeof adapter.upsert !== "function") {
                throw new Error("El adapter no implementa upsert");
            }

            startLoading("save");

            try {
                const payload: Record<string, any> = { _uniqueFields: uniqueFields };
                data.forEach((item, index) => { payload[index] = item; });

                const response = await adapter.upsert<TResponseData, typeof payload>(resource, payload);
                const processed: DataProviderResponse<TResponseData, E> =
                    ProcessApiResponse<TResponseData>(response) as DataProviderResponse<TResponseData, E>;

                if (processed.success) {
                    await fetchMany();
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading("save");
            }
        },
        [adapter, resource, fetchMany, startLoading, stopLoading, handleError]
    );

    const update = useCallback(
        async (id: string | number, data: Partial<T>): Promise<DataProviderResponse<T, E>> => {
            if (typeof adapter.modify !== "function") {
                throw new Error("El adapter no implementa modify");
            }

            startLoading("save");

            try {
                const response = await adapter.modify<T>(resource, { id }, data);
                const processed: DataProviderResponse<T, E> =
                    ProcessApiResponse<T>(response) as DataProviderResponse<T, E>;

                if (processed.success && processed.data) {
                    setState((prev) => ({
                        ...prev,
                        items: prev.items.map((item) =>
                            String(item.id) === String(id) ? { ...item, ...(processed.data as T) } : item
                        ),
                        lastUpdatedAt: Date.now(),
                    }));
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading("save");
            }
        },
        [adapter, resource, startLoading, stopLoading, handleError]
    );

    const remove = useCallback(
        async (id: string | number): Promise<DataProviderResponse<T, E>> => {
            if (typeof adapter.remove !== "function") {
                throw new Error("El adapter no implementa remove");
            }

            startLoading("delete");

            try {
                const response = await adapter.remove(resource, { id });
                const processed: DataProviderResponse<T, E> =
                    ProcessApiResponse<T>(response) as DataProviderResponse<T, E>;

                if (processed.success) {
                    setState((prev) => ({
                        ...prev,
                        items: prev.items.filter((item) => String(item.id) !== String(id)),
                        lastUpdatedAt: Date.now(),
                    }));
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading("delete");
            }
        },
        [adapter, resource, startLoading, stopLoading, handleError]
    );

    const deleteMany = useCallback(
        async (ids: Array<string | number>): Promise<DataProviderResponse<T[], E>> => {
            if (typeof adapter.removeMany !== "function") {
                throw new Error("El adapter no implementa removeMany");
            }

            startLoading("delete");

            try {
                const response = await adapter.removeMany(resource, { ids });
                const processed: DataProviderResponse<any, E> =
                    ProcessApiResponse<any>(response) as DataProviderResponse<any, E>;

                if (processed.success) {
                    setState((prev) => ({
                        ...prev,
                        items: prev.items.filter((item) => !ids.includes(item.id as any)),
                        lastUpdatedAt: Date.now(),
                    }));
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading("delete");
            }
        },
        [adapter, resource, startLoading, stopLoading, handleError]
    );

    const updateMany = useCallback(
        async (items: Partial<T>[]): Promise<DataProviderResponse<T[], E>> => {
            if (typeof adapter.modifyMany !== "function") {
                throw new Error("El adapter no implementa modifyMany");
            }

            startLoading("save");

            try {
                const response = await adapter.modifyMany<T>(resource, items);
                const processed: DataProviderResponse<T[], E> =
                    ProcessApiResponse<T[]>(response) as DataProviderResponse<T[], E>;

                if (processed.success) {
                    await fetchMany();
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading("save");
            }
        },
        [adapter, resource, fetchMany, startLoading, stopLoading, handleError]
    );

    const importFromFile = useCallback(
        async (file: File, extra?: Record<string, any>): Promise<DataProviderResponse<T[], E>> => {
            if (typeof adapter.uploadFile !== "function") {
                throw new Error("El adapter no implementa uploadFile");
            }

            startLoading("import");

            try {
                const formData = new FormData();
                formData.append("file", file);

                if (extra) {
                    Object.entries(extra).forEach(([k, v]) => {
                        formData.append(k, v !== null && typeof v === "object" ? JSON.stringify(v) : String(v));
                    });
                }

                const response = await adapter.uploadFile<T[]>(resource, formData);
                const processed: DataProviderResponse<T[], E> =
                    ProcessApiResponse<T[]>(response) as DataProviderResponse<T[], E>;

                if (processed.success) {
                    await fetchMany();
                }

                return processed;
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading("import");
            }
        },
        [adapter, resource, fetchMany, startLoading, stopLoading, handleError]
    );

    const exportToFile = useCallback(
        async (params?: ExportParams): Promise<any> => {
            if (typeof adapter.downloadFile !== "function") {
                throw new Error("El adapter no implementa downloadFile");
            }

            startLoading("export");

            try {
                return await adapter.downloadFile(resource, params ?? {});
            } catch (err) {
                return handleError(err);
            } finally {
                stopLoading("export");
            }
        },
        [adapter, resource, startLoading, stopLoading, handleError]
    );

    const setPage = useCallback((page: number) => {
        setState((prev) => ({ ...prev, pagination: { ...prev.pagination, page } }));
    }, []);

    const setPerPage = useCallback((perPage: number) => {
        setState((prev) => ({ ...prev, pagination: { ...prev.pagination, perPage } }));
    }, []);

    const setSearch = useCallback((search: string) => {
        setState((prev) => ({ ...prev, search }));
    }, []);

    const setFilter = useCallback((filter: QueryFilter) => {
        setState((prev) => ({ ...prev, filter }));
    }, []);

    const setSort = useCallback(
        (sort: SortCondition | SortCondition[]) => {
            setState((prev) => ({ ...prev, sort }));
        },
        []
    );

    useEffect(() => {
        if (options?.autoFetch === false) return;
        fetchMany();
    }, [refreshKey, state.pagination.page, state.pagination.perPage, state.search, state.filter, state.sort, fetchMany, options?.autoFetch]);

    return {
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
        setPage,
        setPerPage,
        setSearch,
        setFilter,
        setSort,
        clearRateLimit,
    };
}

/**
 * =====================================
 * GRANULAR HOOKS - Composable, tree-shakeable
 * =====================================
 */

/**
 * Hook for list/fetch operations with pagination, filtering, sorting
 */
export function useResourceList<
    T extends { id?: string | number } = any,
    E = Record<string, unknown>
>(resource: string, options?: ResourceServiceOptions) {
    const base = useResourceServiceBase<T, E>(resource, options);

    return useMemo(() => ({
        items: base.state.items,
        pagination: base.state.pagination,
        filter: base.state.filter,
        sort: base.state.sort,
        include: base.state.include,
        search: base.state.search,
        isLoading: base.state.isLoading,
        isFetching: base.state.isFetching,
        initialized: base.state.initialized,
        lastUpdatedAt: base.state.lastUpdatedAt,
        error: base.state.error,
        fetchMany: base.fetchMany,
        setPage: base.setPage,
        setPerPage: base.setPerPage,
        setSearch: base.setSearch,
        setFilter: base.setFilter,
        setSort: base.setSort,
        refresh: base.refresh,
        reset: base.reset,
    }), [
        base.state.items,
        base.state.pagination,
        base.state.filter,
        base.state.sort,
        base.state.include,
        base.state.search,
        base.state.isLoading,
        base.state.isFetching,
        base.state.initialized,
        base.state.lastUpdatedAt,
        base.state.error,
        base.fetchMany,
        base.setPage,
        base.setPerPage,
        base.setSearch,
        base.setFilter,
        base.setSort,
        base.refresh,
        base.reset,
    ]);
}

/**
 * Hook for write operations (create, update, delete, upsert)
 */
export function useResourceMutations<
    T extends { id?: string | number } = any,
    E = Record<string, unknown>
>(resource: string) {
    const base = useResourceServiceBase<T, E>(resource, { autoFetch: false });

    return useMemo(() => ({
        add: base.add,
        update: base.update,
        remove: base.remove,
        upsert: base.upsert,
        deleteMany: base.deleteMany,
        updateMany: base.updateMany,
        isSaving: base.state.isSaving,
        isDeleting: base.state.isDeleting,
        error: base.state.error,
    }), [
        base.add,
        base.update,
        base.remove,
        base.upsert,
        base.deleteMany,
        base.updateMany,
        base.state.isSaving,
        base.state.isDeleting,
        base.state.error,
    ]);
}

/**
 * Hook for file operations (import/export)
 */
export function useResourceFiles<
    T extends { id?: string | number } = any,
    E = Record<string, unknown>
>(resource: string) {
    const base = useResourceServiceBase<T, E>(resource, { autoFetch: false });

    return useMemo(() => ({
        importFromFile: base.importFromFile,
        exportToFile: base.exportToFile,
        isImporting: base.state.isImporting,
        isExporting: base.state.isExporting,
        error: base.state.error,
    }), [
        base.importFromFile,
        base.exportToFile,
        base.state.isImporting,
        base.state.isExporting,
        base.state.error,
    ]);
}

/**
 * Hook for rate limit status
 */
export function useRateLimitStatus() {
    const base = useResourceServiceBase<{ id?: string | number }, Record<string, unknown>>('__rate_limit__', { autoFetch: false });

    return useMemo(() => ({
        isRateLimited: base.state.isRateLimited,
        rateLimitInfo: base.state.rateLimitInfo,
        clearRateLimit: base.clearRateLimit,
    }), [
        base.state.isRateLimited,
        base.state.rateLimitInfo,
        base.clearRateLimit,
    ]);
}

/**
 * Hook for generic execute (custom adapter methods)
 */
export function useResourceExecute<
    T extends { id?: string | number } = any,
    E = Record<string, unknown>
>(resource: string) {
    const base = useResourceServiceBase<T, E>(resource, { autoFetch: false });

    return useMemo(() => ({
        execute: base.execute,
        isLoading: base.state.isLoading,
        error: base.state.error,
    }), [
        base.execute,
        base.state.isLoading,
        base.state.error,
    ]);
}