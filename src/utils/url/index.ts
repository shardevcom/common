export const useBaseUrl = () => {
    const url = import.meta.env.VITE_APP_URL;

    if (!url) {
        throw new Error("VITE_APP_URL is not defined in environment variables.");
    }

    return url;
};