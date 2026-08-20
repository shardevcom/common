/**
 * Interfaz mínima de almacenamiento.
 * Compatible con la Web Storage API (localStorage/sessionStorage), que es
 * sincrona, y con storages basados en promesas (como los de redux-persist).
 */
export interface StorageBackend {
    getItem(key: string): string | null | Promise<string | null>;
    setItem(key: string, value: string): void | Promise<void>;
    removeItem(key: string): void | Promise<void>;
    key?(index: number): string | null | Promise<string | null>;
    readonly length?: number;
    clear?(): void | Promise<void>;
}

/** Objetivo de una purga: lista exacta, prefijo o predicado. */
export interface PurgeTarget {
    keys?: readonly string[];
    prefix?: string;
    predicate?: (key: string) => boolean;
}

/** Resultado de una purga. */
export interface PurgeResult {
    /** Claves que fueron eliminadas, ordenadas de forma determinística. */
    purged: string[];
    /** Cantidad de claves restantes en el storage tras la purga. */
    remaining: number;
}

const resolve = async <T>(value: T | Promise<T>): Promise<T> => value;

/**
 * Cuenta las claves actuales de un storage.
 * Usa `length` cuando está disponible; si no, enumera con `key()`.
 */
export async function countStorageKeys(storage: StorageBackend): Promise<number> {
    if (typeof storage.length === 'number') {
        return storage.length;
    }
    if (typeof storage.key !== 'function') {
        return 0;
    }
    let count = 0;
    while ((await resolve(storage.key(count))) !== null) {
        count++;
    }
    return count;
}

/**
 * Enumera las claves actuales de un storage.
 * Solo funciona si el backend expone `key`/`length` (Web Storage API).
 */
export async function listStorageKeys(storage: StorageBackend): Promise<string[]> {
    if (typeof storage.key !== 'function' || typeof storage.length !== 'number') {
        return [];
    }
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
        const key = await resolve(storage.key(i));
        if (key !== null) {
            keys.push(key);
        }
    }
    return keys.sort();
}

/**
 * Elimina un conjunto de claves exactas de forma determinística.
 * Ordena las claves antes de borrarlas y retorna las que realmente se eliminaron.
 */
export async function purgeStorageKeys(storage: StorageBackend, keys: readonly string[]): Promise<PurgeResult> {
    const unique = Array.from(new Set(keys));
    unique.sort();

    const purged: string[] = [];
    for (const key of unique) {
        if ((await resolve(storage.getItem(key))) !== null) {
            await storage.removeItem(key);
            purged.push(key);
        }
    }

    return { purged, remaining: await countStorageKeys(storage) };
}

/** Elimina todas las claves que comiencen con un prefijo dado. */
export async function purgeStorageByPrefix(storage: StorageBackend, prefix: string): Promise<PurgeResult> {
    const matching = (await listStorageKeys(storage)).filter((key) => key.startsWith(prefix));
    return purgeStorageKeys(storage, matching);
}

/** Elimina todas las claves que cumplan un predicado. */
export async function purgeStorageByPredicate(
    storage: StorageBackend,
    predicate: (key: string) => boolean
): Promise<PurgeResult> {
    const matching = (await listStorageKeys(storage)).filter(predicate);
    return purgeStorageKeys(storage, matching);
}

/**
 * Purga dirigida según el objetivo indicado.
 * Es la forma recomendada para cumplimiento de estándares de seguridad
 * tipo CASA: cada app declara qué claves limpiar y se eliminan SOLO esas.
 */
export async function purgeStorage(storage: StorageBackend, target: PurgeTarget): Promise<PurgeResult> {
    if (target.keys && target.keys.length > 0) {
        return purgeStorageKeys(storage, target.keys);
    }
    if (target.prefix !== undefined) {
        return purgeStorageByPrefix(storage, target.prefix);
    }
    if (target.predicate) {
        return purgeStorageByPredicate(storage, target.predicate);
    }
    return { purged: [], remaining: await countStorageKeys(storage) };
}

/** Crea un purger atado a un storage concreto. */
export function createStoragePurger(storage: StorageBackend) {
    return {
        purge: (target: PurgeTarget) => purgeStorage(storage, target),
        purgeKeys: (keys: readonly string[]) => purgeStorageKeys(storage, keys),
        purgeByPrefix: (prefix: string) => purgeStorageByPrefix(storage, prefix),
        purgeByPredicate: (predicate: (key: string) => boolean) =>
            purgeStorageByPredicate(storage, predicate),
        list: () => listStorageKeys(storage),
        clear: () => storage.clear?.(),
    };
}

/**
 * Crea un backend de storage en memoria, útil para pruebas y SSR.
 * Sus métodos retornan promesas, por lo que también es compatible con
 * storages async como los de redux-persist.
 */
export function createMemoryStorage(initial?: Record<string, string>): StorageBackend {
    const data = new Map(Object.entries(initial ?? {}));

    return {
        getItem: (key) => Promise.resolve(data.get(key) ?? null),
        setItem: (key, value) => Promise.resolve(void data.set(key, value)),
        removeItem: (key) => Promise.resolve(void data.delete(key)),
        key: (index) => Promise.resolve(Array.from(data.keys())[index] ?? null),
        get length() {
            return data.size;
        },
        clear: () => Promise.resolve(data.clear()),
    };
}