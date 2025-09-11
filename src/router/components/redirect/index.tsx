import React from "react";
import { Navigate, NavigateProps, To } from "react-router-dom";
import { useRouteContext } from "@/router";

/**
 * Redirige anteponiendo automáticamente el `prefix` del RouterProvider si existe.
 * Evita duplicar el prefijo base si ya está presente en la ruta.
 */
export const Redirect = (props: NavigateProps) => {
    const { to, ...rest } = props;

    try {
        const ctx = useRouteContext();
        const prefix = ctx?.prefix ?? "";

        // Si no hay prefijo o el to ya incluye el prefijo, redirige normal
        if (!prefix || (typeof to === "string" && to.startsWith(prefix))) {
            return <Navigate to={to} {...rest} />;
        }

        if (typeof to === "string") {
            const normalizedPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
            const normalizedTo = to.startsWith("/") ? to : `/${to}`;

            // Evitar duplicar el prefijo si ya está presente
            if (normalizedTo.startsWith(normalizedPrefix)) {
                return <Navigate to={normalizedTo} {...rest} />;
            }

            const finalTo = `${normalizedPrefix}${normalizedTo}`.replace(/\/+/g, "/");
            return <Navigate to={finalTo} {...rest} />;
        }

        // Si `to` es un objeto (location object)
        if (typeof to === "object" && to !== null && to.pathname) {
            const normalizedPrefix = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;

            // Si el pathname ya incluye el prefijo, no lo dupliques
            if (to.pathname.startsWith(normalizedPrefix)) {
                return <Navigate to={to} {...rest} />;
            }

            const pathname = to.pathname || "";
            const normalizedPathname = pathname.startsWith("/") ? pathname : `/${pathname}`;
            const finalPathname = `${normalizedPrefix}${normalizedPathname}`.replace(/\/+/g, "/");

            const finalTo: To = {
                ...to,
                pathname: finalPathname
            };

            return <Navigate to={finalTo} {...rest} />;
        }

        // Para otros casos
        return <Navigate to={to} {...rest} />;
    } catch {
        // Si no hay contexto, redirige normal
        return <Navigate to={to} {...rest} />;
    }
};