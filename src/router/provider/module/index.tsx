import { useEffect, ReactNode, useRef } from "react";
import { useRouteContext } from "../../context";
import { RouteConfig } from "../../types";

interface ModuleRouteProviderProps {
    routes: RouteConfig[];
    children: ReactNode;
}

export const ModuleRouteProvider = ({ routes, children }: ModuleRouteProviderProps) => {
    const { addRoutes } = useRouteContext();

    const hasAddedRoutes = useRef(false);

    useEffect(() => {
        if (!hasAddedRoutes.current) {
            addRoutes(routes);
            hasAddedRoutes.current = true;
        }
    }, [addRoutes, routes]);

    return <>{children}</>;
};
