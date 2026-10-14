import { QueryFilter, SortCondition } from "../../data";

export const normalizeFilterValue = (operator: string, value: any): any => {
    switch (operator) {
        case 'in':
            if (Array.isArray(value)) {
                return `(${value.join(',')})`;
            }
            if (typeof value === 'string' && !value.startsWith('(')) {
                return `(${value})`;
            }
            return value;
        case 'like':
        case 'ilike':
            if (typeof value === 'string' && !value.includes('*')) {
                return `*${value}*`;
            }
            return value;
        case 'is':
        case 'eq':
        case 'neq':
        case 'gt':
        case 'gte':
        case 'lt':
        case 'lte':
            return value;
        default:
            return value;
    }
};

export const buildIncludeTree = (includes: string[] | string): Record<string, any> => {
    const tree: Record<string, any> = {};

    (Array.isArray(includes) ? includes : [includes]).forEach((path) => {
        const parts = path.split('.');
        let current = tree;
        for (const part of parts) {
            if (!current[part]) current[part] = {};
            current = current[part];
        }
    });

    return tree;
};

export const renderIncludeTree = (tree: Record<string, any>): string => {
    return Object.entries(tree)
        .map(([key, subtree]) => {
            const nested = renderIncludeTree(subtree);
            return nested ? `${key}(${nested})` : `${key}(*)`;
        })
        .join(',');
};

// Type for Supabase query builder (duck-typed for compatibility)
export interface SupabaseQueryBuilder {
    select(columns?: string, options?: { count?: 'exact' | 'planned' | 'estimated'; head?: boolean }): SupabaseQueryBuilder;
    filter(column: string, operator: string, value: any): SupabaseQueryBuilder;
    eq(column: string, value: any): SupabaseQueryBuilder;
    or(expression: string, options?: { foreignTable?: string }): SupabaseQueryBuilder;
    range(from: number, to: number): SupabaseQueryBuilder;
    order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): SupabaseQueryBuilder;
    limit(count: number): SupabaseQueryBuilder;
    single(): Promise<any>;
    then<TResult1 = any, TResult2 = never>(
        onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
        onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null): Promise<any>;
    finally(onfinally?: (() => void) | null): Promise<any>;
    readonly [Symbol.toStringTag]: string;
}

// Type for Supabase client (duck-typed)
export interface SupabaseClientLike {
    from(table: string): SupabaseQueryBuilder;
}

// 🧠 Función recursiva para aplicar filtros incluyendo OR/AND
export const applyFilters = (query: SupabaseQueryBuilder, filters: QueryFilter): SupabaseQueryBuilder => {
    const { AND, OR, ...directFilters } = filters;

    if (AND) {
        AND.forEach((subfilter) => {
            query = applyFilters(query, subfilter);
        });
    }

    for (const [field, condition] of Object.entries(directFilters)) {
        if (typeof condition === 'object' && 'operator' in condition && 'value' in condition) {
            const operator = condition.operator;
            const value = normalizeFilterValue(operator, condition.value);
            query = query.filter(field, operator, value);
        } else {
            query = query.eq(field, condition);
        }
    }

    if (OR) {
        const orExpressions: string[] = [];

        OR.forEach((subfilter) => {
            if (typeof subfilter !== 'object') return;

            for (const [field, condition] of Object.entries(subfilter)) {
                if (typeof condition === 'object' && 'operator' in condition && 'value' in condition) {
                    const operator = condition.operator;
                    const value = normalizeFilterValue(operator, condition.value);
                    orExpressions.push(`${field}.${operator}.${value}`);
                } else {
                    orExpressions.push(`${field}.eq.${condition}`);
                }
            }
        });

        query = query.or(orExpressions.join(','));
    }

    return query;
};

export interface BuildQueryParams {
    sort?: SortCondition | SortCondition[];
    filter?: QueryFilter;
    fields?: string | string[];
    include?: string | string[];
    pagination?: { page: number; perPage: number };
}

/**
 * Builds a Supabase query with type-safe parameters.
 * The client parameter is typed as `any` for compatibility with Supabase's complex types,
 * but the params and return value are fully typed.
 */
export const buildQuery = (
    client: any,
    resource: string,
    params?: BuildQueryParams
): SupabaseQueryBuilder => {
    let query = client.from(resource);

    // Procesar fields
    let selectedFields = '*';
    if (params?.fields) {
        selectedFields = Array.isArray(params.fields)
            ? params.fields.join(',')
            : params.fields;
    }

    // Procesar include
    if (params?.include) {
        const includeTree = buildIncludeTree(params.include);
        const includes = renderIncludeTree(includeTree);
        query = query.select(`${selectedFields},${includes}`, { count: 'exact' });
    } else {
        query = query.select(selectedFields, { count: 'exact' });
    }

    // Procesar filtros
    if (params?.filter) {
        query = applyFilters(query, params.filter);
    }

    // Procesar paginación
    if (params?.pagination) {
        const from = (params.pagination.page - 1) * params.pagination.perPage;
        const to = from + params.pagination.perPage - 1;
        query = query.range(from, to);
    }

    // Procesar ordenamiento
    if (params?.sort) {
        const sorts = Array.isArray(params.sort) ? params.sort : [params.sort];
        for (const sortItem of sorts) {
            query = query.order(sortItem.field, { ascending: sortItem.order === 'asc' });
        }
    }

    return query;
};