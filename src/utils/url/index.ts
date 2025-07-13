export const useBaseUrl = ($url?: string): string => {
    return import.meta.env?.VITE_APP_URL || $url || 'https://localhost';
};