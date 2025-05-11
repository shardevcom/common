import {QueryFilter, SortCondition} from "../../data";


const normalizeFilterValue = (operator: string, value: any): any => {
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

const buildIncludeTree = (includes: string[] | string): Record<string, any> => {
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

const renderIncludeTree = (tree: Record<string, any>): string => {
    return Object.entries(tree)
        .map(([key, subtree]) => {
            const nested = renderIncludeTree(subtree);
            return nested ? `${key}(${nested})` : `${key}(*)`;
        })
        .join(',');
};

// 🧠 Función recursiva para aplicar filtros incluyendo OR/AND
const applyFilters = (query: any, filters: QueryFilter): any => {
    if ('AND' in filters) {
        filters?.AND?.forEach((subfilter) => {
            query = applyFilters(query, subfilter);
        });
        return query;
    }

    if ('OR' in filters) {
        const orExpressions: string[] = [];

        filters?.OR?.forEach((subfilter) => {
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
        return query;
    }

    // Filtros normales
    for (const [field, condition] of Object.entries(filters)) {
        if (typeof condition === 'object' && 'operator' in condition && 'value' in condition) {
            const operator = condition.operator;
            const value = normalizeFilterValue(operator, condition.value);
            query = query.filter(field, operator, value);
        } else {
            query = query.eq(field, condition);
        }
    }

    return query;
};

export const buildQuery = <TData>(
    client: any,
    resource: string,
    params?: Partial<{
        sort?: SortCondition | SortCondition[];
        filter?: QueryFilter;
        fields?: string | string[];
        include?: string | string[];
    }>
) => {
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

    // Procesar ordenamiento
    if (params?.sort) {
        const sorts = Array.isArray(params.sort) ? params.sort : [params.sort];
        for (const sortItem of sorts) {
            query = query.order(sortItem.field, { ascending: sortItem.order === 'asc' });
        }
    }

    return query;
};
