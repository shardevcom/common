export const useBaseUrl = ($url: string) => {
    return import.meta.env?.VITE_APP_URL || $url;
};