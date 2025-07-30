import { useEffect, useRef, ReactNode } from "react";
import { useRouteContext } from "../../context";
import { RouteConfig } from "../../types";

interface ModuleRouteProviderProps {
    routes: RouteConfig[];
    children?: ReactNode; // <- opcional
}

export const ModuleRouteProvider = ({ routes, children }: ModuleRouteProviderProps) => {
    const { addRoutes } = useRouteContext();
    const hasAddedRoutes = useRef(false);

    useEffect(() => {
        if (!hasAddedRoutes.current && routes.length > 0) {
            addRoutes(routes);
            hasAddedRoutes.current = true;
        }
    }, [addRoutes, routes]);

    // Si hay children, los retorna; si no, null.
    return children ?? null;
};
