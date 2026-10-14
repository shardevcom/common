import {Middleware} from '@reduxjs/toolkit';
import {StorageBackend} from '../../utils/storage';
import {authSlice} from '../slices/auth.slice';

export const RESET_STATE_TYPE = 'RESET_STATE';

/**
 * Middleware que refleja el `access_token` autenticado en un storage externo
 * bajo una clave configurable por la app.
 *
 * Normas que cumple:
 * - No asume nombres de claves (la clave se declara en `config.authStorageKey`).
 * - Usa el storage inyectable (`config.storage`), no `localStorage` global.
 * - No ejecuta efectos dentro de reducers: todo vive en el middleware.
 * - Al hacer logout/initAuth/reset elimina la clave (purga dirigida).
 */
export const createAuthStorageMiddleware = (
    storage: StorageBackend,
    authStorageKey?: string,
): Middleware | undefined => {
    if (!authStorageKey) return undefined;

    const apply = (fn: () => void | Promise<void>): void => {
        try {
            const result = fn();
            if (result instanceof Promise) {
                result.catch((error) => {
                    // Log estructurado en lugar de tragar silenciosamente
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('[AuthStorageMiddleware] Storage operation failed:', {
                        error: errorMessage,
                        timestamp: new Date().toISOString(),
                        action: 'storage',
                    });
                    // Opcional: emitir evento para monitoring externo
                    if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('auth:storage:error', {
                            detail: { error: errorMessage, timestamp: Date.now() }
                        }));
                    }
                });
            }
        } catch (error) {
            // Log estructurado en lugar de tragar silenciosamente
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[AuthStorageMiddleware] Storage operation failed:', {
                error: errorMessage,
                timestamp: new Date().toISOString(),
                action: 'storage',
            });
            // Opcional: emitir evento para monitoring externo
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('auth:storage:error', {
                    detail: { error: errorMessage, timestamp: Date.now() }
                }));
            }
        }
    };

    return (storeApi) => (next) => (action: any) => {
        const result = next(action);

        const {type} = action ?? {};

        if (type === authSlice.actions.setAuth.type) {
            const authUser = (storeApi.getState() as any)?.auth?.authUser;
            const token = authUser?.access_token;

            if (token) {
                apply(() => storage.setItem(authStorageKey, token));
            } else {
                apply(() => storage.removeItem(authStorageKey));
            }
        }

        if (
            type === authSlice.actions.initAuth.type ||
            type === authSlice.actions.logout.type ||
            type === RESET_STATE_TYPE
        ) {
            apply(() => storage.removeItem(authStorageKey));
        }

        return result;
    };
};