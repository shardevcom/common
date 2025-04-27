export interface DataAdapter {
    query<TData, TParams>(query: string, variables?: TParams): Promise<TData>;
    mutate<TData, TParams>(mutation: string, variables?: TParams): Promise<TData | null | undefined>;
    delete<TData>(url: string, variables?: any): Promise<TData | null | undefined>;
    put<TData, TParams>(url: string, variables?: TParams): Promise<TData | null | undefined>;
}
