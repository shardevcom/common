import { useContext } from "react";
import React from "react";

/**
 * useSafeContext
 * Intenta obtener un contexto de React. Si no existe, retorna `false`.
 * @param context - El contexto de React a consumir
 * @returns El valor del context o `false` si no existe
 */
export function useSafeContext<T>(context: React.Context<T | null>): T | false {
    const value = useContext(context);
    if (value === null || value === undefined) {
        return false;
    }
    return value;
}
