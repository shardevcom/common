import React from "react";
import {RouteObject} from "react-router-dom";
import ProtectedRoute from "../components/protected-route";
import {RouteConfig} from "../types";

export const parseRoutes = (routes: RouteConfig[]): RouteObject[] => {
    return routes.map(({path, element, redirectLogic, children, id, index}) => {
        if (index) {
            return {
                index: true,
                id,
                element: <ProtectedRoute redirectLogic={redirectLogic}>{element()}</ProtectedRoute>,
            } satisfies RouteObject;
        }

        return {
            path: path?.startsWith('/') ? path.slice(1) : path,
            id,
            element: <ProtectedRoute redirectLogic={redirectLogic}>{element()}</ProtectedRoute>,
            children: children ? parseRoutes(children) : undefined,
        } satisfies RouteObject;
    });
};