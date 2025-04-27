import React from "react";
import {RouteObject} from "react-router-dom";
import ProtectedRoute from "../components/protected-route";
import Unauthorized from "../components/unauthorized";
import {RouteConfig} from "../types";


export const parseRoutes = (routes: RouteConfig[]): RouteObject[] => {
    const protectedRoutes = routes.map(({path, element, redirectLogic, children, id, index}) => {


        if (index) {
            return {
                index: true,
                id,
                element: <ProtectedRoute redirectLogic={redirectLogic}>{element()}</ProtectedRoute>,
            } satisfies RouteObject;
        }

        return {
            path,
            id,
            element: <ProtectedRoute redirectLogic={redirectLogic}>{element()}</ProtectedRoute>,
            children: children ? parseRoutes(children) : undefined,
        } satisfies RouteObject;
    });

    const hasUnauthorizedRoute = routes.some((route) => (route.path === "/unauthorized" || route.id === "/unauthorized"));

    if (!hasUnauthorizedRoute) {
        protectedRoutes.push({
            id: "unauthorized",
            path: "/unauthorized",
            element: <Unauthorized/>,
            children: undefined
        } satisfies RouteObject);
    }

    return protectedRoutes;
};