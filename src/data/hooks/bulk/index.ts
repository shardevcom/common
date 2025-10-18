import {useCallback, useState} from "react";
import {
    DataAdapter,
    DataProviderResponse,
    ProcessApiResponse,
} from "@/data";
import {useData} from "@/data/hooks";

export interface EntityBulkState<E = Record<string, unknown>> {
    isLoading: boolean;
    error?: E | null;
}

/**
 * Hook especializado para operaciones masivas:
 * importación, exportación, actualización y eliminación en lote.
 */
export function useEntityBulkService<
    T extends { id?: string | number } = any,
    E = Record<string, unknown>
>(resource: string) {
    const adapter: DataAdapter = useData();

    const [state, setState] = useState<EntityBulkState<E>>({
        isLoading: false,
        error: null,
    });

    const importFromFile = useCallback(
        async (file: File, extra?: Record<string, any>) => {
            if (typeof adapter.uploadFile !== "function") {
                throw new Error("El adapter no implementa uploadFile");
            }

            setState((s) => ({...s, isLoading: true, error: null}));

            const formData = new FormData();
            formData.append("file", file);
            if (extra) {
                Object.entries(extra).forEach(([key, value]) =>
                    formData.append(key, String(value))
                );
            }

            try {
                const response = await adapter.uploadFile<T[]>(resource, formData);
                const processed = ProcessApiResponse<T[]>(response) as DataProviderResponse<T[]> & { errors?: E };

                setState({isLoading: false, error: processed.errors ?? null});
                return processed;
            } catch (error) {
                const processed = ProcessApiResponse(error) as DataProviderResponse<any> & { errors?: E };
                setState({isLoading: false, error: processed.errors});
                return processed;
            }
        },
        [adapter, resource]
    );

    /** 📥 Exportar datos */
    const exportToFile = useCallback(
        async (params?: {
            format?: "csv" | "xlsx" | "json";
            filter?: Record<string, any>;
            sort?: Record<string, "asc" | "desc">;
        }) => {
            if (typeof adapter.downloadFile !== "function") {
                throw new Error("El adapter no implementa downloadFile");
            }

            setState((s) => ({...s, isLoading: true, error: null}));

            try {
                const blob = await adapter.downloadFile(resource, params ?? {});
                setState((s) => ({...s, isLoading: false}));
                return blob;
            } catch (error) {
                const processed = ProcessApiResponse(error) as DataProviderResponse<any> & { errors?: E };
                setState({isLoading: false, error: processed.errors});
                throw processed;
            }
        },
        [adapter, resource]
    );

    /** 🗑️ Eliminar múltiples registros */
    const deleteMany = useCallback(
        async (ids: Array<string | number>) => {
            if (typeof adapter.removeMany !== "function") {
                throw new Error("El adapter no implementa removeMany");
            }

            setState((s) => ({...s, isLoading: true}));

            try {
                const response = await adapter.removeMany(resource, {ids});
                const processed = ProcessApiResponse(response) as DataProviderResponse<any> & { errors?: E };

                setState({isLoading: false, error: processed.errors ?? null});
                return processed;
            } catch (error) {
                const processed = ProcessApiResponse(error) as DataProviderResponse<any> & { errors?: E };
                setState({isLoading: false, error: processed.errors});
                return processed;
            }
        },
        [adapter, resource]
    );

    /** ✏️ Actualizar múltiples registros */
    const updateMany = useCallback(
        async (items: Partial<T>[]) => {
            if (typeof adapter.modifyMany !== "function") {
                throw new Error("El adapter no implementa modifyMany");
            }

            setState((s) => ({...s, isLoading: true}));

            try {
                const response = await adapter.modifyMany<T>(resource, items);
                const processed = ProcessApiResponse<T[]>(response) as DataProviderResponse<T[]> & { errors?: E };

                setState({isLoading: false, error: processed.errors ?? null});
                return processed;
            } catch (error) {
                const processed = ProcessApiResponse(error) as DataProviderResponse<any> & { errors?: E };
                setState({isLoading: false, error: processed.errors});
                return processed;
            }
        },
        [adapter, resource]
    );

    return {
        ...state,
        importFromFile,
        exportToFile,
        deleteMany,
        updateMany,
    };
}