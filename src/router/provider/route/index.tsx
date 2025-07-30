import React, {useState, useMemo, useContext} from "react";
import {
    BrowserRouter,
    useRoutes,
} from "react-router-dom";
import {AuthUser} from "../../../auth";
import {RouteConfig} from "../../types";
import {RouteContext} from "../../context";
import {parseRoutes} from "../../parser-routes";

interface RouterProps<T extends AuthUser = AuthUser> {
    children?: React.ReactNode;
    baseRoutes?: RouteConfig<T>[]; // rutas base si las tienes
    prefix?: string;
}

function applyPrefixToRoutes<T extends AuthUser>(
    routes: RouteConfig<T>[],
    prefix?: string
): RouteConfig<T>[] {
    if (!prefix) return routes;

    return routes.map((route) => {
        const prefixedPath = `${prefix}/${route.path}`.replace(/\/+/g, "/");

        return {
            ...route,
            path: prefixedPath,
            children: route.children ? applyPrefixToRoutes(route.children, prefix) : undefined,
        };
    });
}

const InnerRouter = () => {
    const {routes} = useContext(RouteContext)!;
    return useRoutes(parseRoutes(routes));
};


export const RouterProvider = ({
                                   children,
                                   baseRoutes = [],
                                   prefix
                               }: RouterProps) => {
    const [routes, setRoutes] = useState<RouteConfig[]>(() =>
        applyPrefixToRoutes(baseRoutes, prefix)
    );

    const addRoutes = (newRoutes: RouteConfig[]) => {
        const prefixedRoutes = applyPrefixToRoutes(newRoutes, prefix);
        setRoutes((prev) => {
            const existingPaths = new Set(prev.map((r) => r.path));
            const uniqueNewRoutes = prefixedRoutes.filter((r) => !existingPaths.has(r.path));
            return [...prev, ...uniqueNewRoutes];
        });
    };

    const contextValue = useMemo(() => ({routes, addRoutes}), [routes]);

    return (
        <RouteContext.Provider value={contextValue}>
            <BrowserRouter>
                <InnerRouter/>
                {children}
            </BrowserRouter>
        </RouteContext.Provider>
    );
};
