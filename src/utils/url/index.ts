export const useBaseUrl = ($url?: string): string => {
    return getEnv('VITE_APP_URL', $url ?? 'https://localhost');
};

/**
 * Obtiene variables de entorno desde import.meta.env o process.env
 * @param key Nombre de la variable (ej: "VITE_APP_KEY")
 * @param fallback Valor por defecto si no se encuentra
 */
export const getEnv = (key: string, fallback?: string): string => {
    // Primero intentar con import.meta.env (Vite)
    if (typeof import.meta !== "undefined" && import.meta.env && key in import.meta.env) {
        return import.meta.env[key] ?? fallback ?? "";
    }

    // Luego intentar con process.env (Node.js)
    if (typeof process !== "undefined" && process.env && key in process.env) {
        return process.env[key] ?? fallback ?? "";
    }

    // Si no existe, retornar el fallback
    return fallback ?? "";
}
