import React, { createContext, useContext } from "react";
import { RouteConfig } from "../types";
import { AuthUser } from "../../auth";

export interface RouteContextType<T extends AuthUser = AuthUser> {
    routes: RouteConfig<T>[];
    addRoutes: (newRoutes: RouteConfig<T>[]) => void;
    prefix?: string;
}

export const RouteContext = createContext<RouteContextType<any> | null>(null);

export const useRouteContext = () => {
    const ctx = useContext(RouteContext);
    if (!ctx) throw new Error("useRouteContext debe usarse dentro de RouterProvider");
    return ctx;
};
