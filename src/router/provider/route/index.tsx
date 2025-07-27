import React, {useState, useMemo, useContext} from "react";
import {
    BrowserRouter,
    useRoutes,
} from "react-router-dom";
import { AuthUser } from "../../../auth";
import { RouteConfig } from "../../types";
import {RouteContext} from "../../context";
import {parseRoutes} from "../../parser-routes";

interface RouterProps<T extends AuthUser = AuthUser> {
    children: React.ReactNode;
    baseRoutes?: RouteConfig<T>[]; // rutas base si las tienes
}

const InnerRouter = () => {
    const { routes } = useContext(RouteContext)!;
    return useRoutes(parseRoutes(routes));
};


export const RouterProvider = ({
                                   children,
                                   baseRoutes = [],
                               }: RouterProps) => {
    const [routes, setRoutes] = useState<RouteConfig[]>(baseRoutes);

    const addRoutes = (newRoutes: RouteConfig[]) => {
        setRoutes((prev) => {
            const existingPaths = new Set(prev.map((r) => r.path));
            const uniqueNewRoutes = newRoutes.filter((r) => !existingPaths.has(r.path));
            return [...prev, ...uniqueNewRoutes];
        });
    };

    const contextValue = useMemo(() => ({ routes, addRoutes }), [routes]);

    return (
        <RouteContext.Provider value={contextValue}>
            <BrowserRouter>
                <InnerRouter />
                {children}
            </BrowserRouter>
        </RouteContext.Provider>
    );
};
