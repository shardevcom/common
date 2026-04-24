import React, { useState, useMemo, useEffect, useRef, ReactNode } from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import { useSafeContext } from "@/utils";
import {
    RouteContext,
    RouteContextType,
    useRouteContext,
    parseRoutes,
    RouteConfig
} from "@/router";
import { AuthUser } from "@/auth";

interface UnifiedRouterProps<T extends AuthUser = AuthUser> {
    routes: RouteConfig<T>[];
    children?: ReactNode;
}

const InnerRouter = () => {
    const context = useRouteContext();
    return useRoutes(parseRoutes(context.routes));
};

export const RouterProvider = <T extends AuthUser>({
                                                       routes: newRoutes,
                                                       children
                                                   }: UnifiedRouterProps<T>) => {

    const parentContext = useSafeContext<RouteContextType<T> | null>(RouteContext);

    // 🔥 SI HAY CONTEXTO PADRE → REGISTRA INMEDIATAMENTE
    if (parentContext) {
        parentContext.addRoutes(newRoutes);

        return (
            <RouteContext.Provider value={parentContext}>
                {children}
            </RouteContext.Provider>
        );
    }

    // 🔥 ROOT MODE
    const [routes, setRoutes] = useState<RouteConfig<T>[]>(newRoutes);

    const addRoutes = (routesToAdd: RouteConfig<T>[]) => {
        setRoutes(prev => {
            const existingPaths = new Set(prev.map(r => r.path));
            const uniqueNewRoutes = routesToAdd.filter(
                r => !existingPaths.has(r.path)
            );
            return [...prev, ...uniqueNewRoutes];
        });
    };

    const contextValue: RouteContextType<T> = {
        routes,
        addRoutes
    };

    return (
        <RouteContext.Provider value={contextValue}>
            <BrowserRouter>
                <InnerRouter />
                {children}
            </BrowserRouter>
        </RouteContext.Provider>
    );
};