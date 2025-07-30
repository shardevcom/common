import React from "react";
import { Navigate, NavigateProps } from "react-router-dom";
import { useRouteContext } from "../../context";

/**
 * Redirige anteponiendo automáticamente el `prefix` del RouterProvider si existe.
 */
export const Redirect = (props: NavigateProps) => {
    const { to, ...rest } = props;

    try {
        const ctx = useRouteContext();
        const prefix = ctx?.prefix ?? "";

        if (typeof to === "string") {
            const normalizedPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
            const normalizedTo = to.startsWith("/") ? to : `/${to}`;
            const finalTo = `${normalizedPrefix}${normalizedTo}`.replace(/\/+/g, "/");

            return <Navigate to={finalTo} {...rest} />;
        }

        // Si `to` no es un string (por ejemplo una función o location object)
        return <Navigate to={to} {...rest} />;
    } catch {
        // Si no hay contexto, redirige normal
        return <Navigate to={to} {...rest} />;
    }
};
