import React from "react";
import { Navigate, NavigateProps } from "react-router-dom";
import {useRouteContext} from "../../context";

/**
 * Redirect que antepone automáticamente el prefix del RouterProvider (si existe).
 */
export const Redirect = (props: NavigateProps) => {
    const { to, ...rest } = props;

    try {
        const ctx = useRouteContext();
        const prefix = ctx.prefix ?? "";

        // Si el destino ya es absoluto, no le agregamos prefix
        const isAbsolute = typeof to === "string" && to.startsWith("/");
        const finalTo =
            typeof to === "string" && isAbsolute
                ? `${prefix}${to}`
                : to;

        return <Navigate to={finalTo} {...rest} />;
    } catch {
        // Si no hay contexto, redirige normal
        return <Navigate to={to} {...rest} />;
    }
};
