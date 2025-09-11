import React, { useState, useMemo, useEffect, useRef, ReactNode } from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { useSafeContext } from "@/utils";
import { RouteContext, RouteContextType, useRouteContext, parseRoutes, RouteConfig} from "@/router";
import { AuthUser } from "@/auth";

interface UnifiedRouterProps<T extends AuthUser = AuthUser> {
    routes: RouteConfig<T>[];
    children?: ReactNode;
    prefix?: string;
}

function applyPrefixToRoutes<T extends AuthUser = AuthUser>(
    routes: RouteConfig<T>[],
    prefix?: string
): RouteConfig<T>[] {
    if (!prefix) return routes;
    return routes.map(route => ({
        ...route,
        path: `${prefix}/${route.path}`.replace(/\/+/g, '/'),
        children: route.children
    }));
}

const InnerRouter = () => {
    const context = useRouteContext();
    return useRoutes(parseRoutes(context.routes));
};

export const RouterProvider = <T extends AuthUser>({
                                                              routes: newRoutes,
                                                              children,
                                                              prefix
                                                          }: UnifiedRouterProps<T>) => {
    // Hook siempre se llama
    const parentContext = useSafeContext<RouteContextType<T> | null>(RouteContext);

    const hasAddedRoutes = useRef(false);

    const [routes, setRoutes] = useState<RouteConfig<T>[]>(() =>
        parentContext
            ? [] // si hay contexto padre, no necesitamos rutas locales
            : applyPrefixToRoutes(newRoutes, prefix)
    );

    const addRoutes = (routesToAdd: RouteConfig<T>[]) => {
        const prefixedRoutes = applyPrefixToRoutes(routesToAdd, prefix);
        if (parentContext) {
            parentContext.addRoutes(prefixedRoutes);
        } else {
            setRoutes(prev => {
                const existingPaths = new Set(prev.map(r => r.path));
                const uniqueNewRoutes = prefixedRoutes.filter(r => !existingPaths.has(r.path));
                return [...prev, ...uniqueNewRoutes];
            });
        }
    };

    useEffect(() => {
        if (!hasAddedRoutes.current && newRoutes.length > 0) {
            addRoutes(newRoutes);
            hasAddedRoutes.current = true;
        }
    }, [newRoutes]);

    const contextValue: RouteContextType<T> = useMemo(() => {
        return parentContext
            ? { routes: parentContext.routes, addRoutes, prefix }
            : { routes, addRoutes, prefix };
    }, [routes, parentContext, prefix]);

    // Si hay un contexto padre, solo renderizamos los children
    if (parentContext) {
        return <>{children}</>;
    }

    // Si no hay contexto padre, creamos el RouterProvider completo
    return (
        <RouteContext.Provider value={contextValue}>
            <BrowserRouter>
                <InnerRouter />
                {children}
            </BrowserRouter>
        </RouteContext.Provider>
    );
};
