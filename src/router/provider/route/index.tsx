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

    const hasAddedRoutes = useRef(false);

    const [routes, setRoutes] = useState<RouteConfig<T>[]>(() =>
        parentContext ? [] : newRoutes
    );

    const addRoutes = (routesToAdd: RouteConfig<T>[]) => {
        if (parentContext) {
            parentContext.addRoutes(routesToAdd);
        } else {
            setRoutes(prev => {
                const existingPaths = new Set(prev.map(r => r.path));
                const uniqueNewRoutes = routesToAdd.filter(
                    r => !existingPaths.has(r.path)
                );
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
            ? { routes: parentContext.routes, addRoutes }
            : { routes, addRoutes };
    }, [routes, parentContext]);

    // 🔥 CASO EMBEBIDO (microfrontend)
    if (parentContext) {
        return (
            <RouteContext.Provider value={contextValue}>
                {children}
            </RouteContext.Provider>
        );
    }

    // 🔥 CASO ROOT (standalone)
    return (
        <RouteContext.Provider value={contextValue}>
            <BrowserRouter>
                <InnerRouter />
                {children}
            </BrowserRouter>
        </RouteContext.Provider>
    );
};