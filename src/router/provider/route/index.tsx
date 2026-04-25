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
    const hasRegistered = useRef(false);

    // Si somos un hijo, registramos las rutas en el contexto del padre
    useEffect(() => {
        if (parentContext && !hasRegistered.current) {
            parentContext.addRoutes(newRoutes);
            hasRegistered.current = true;
        }
    }, [parentContext, newRoutes]);

    // SI HAY PADRE: Solo actuamos como pasarela de contexto
    if (parentContext) {
        return (
            <RouteContext.Provider value={parentContext}>
                {children}
                {/* IMPORTANTE: No renderizamos <InnerRouter /> aquí
                   porque el router ya está corriendo en el root.
                */}
            </RouteContext.Provider>
        );
    }

    // MODO ROOT: Solo la aplicación principal entra aquí
    const [routes, setRoutes] = useState<RouteConfig<T>[]>(newRoutes);

    const addRoutes = (routesToAdd: RouteConfig<T>[]) => {
        setRoutes(prev => {
            const existingPaths = new Set(prev.map(r => r.path));
            const uniqueNewRoutes = routesToAdd.filter(r => !existingPaths.has(r.path));
            return [...prev, ...uniqueNewRoutes];
        });
    };

    const contextValue = { routes, addRoutes };

    return (
        <RouteContext.Provider value={contextValue}>
            <BrowserRouter>
                <InnerRouter />
                {children}
            </BrowserRouter>
        </RouteContext.Provider>
    );
};