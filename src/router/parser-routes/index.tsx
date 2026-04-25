import React from "react";
import { RouteObject } from "react-router-dom";
import ProtectedRoute from "../components/protected-route";
import { RouteConfig } from "../types";

export const parseRoutes = (routes: RouteConfig[]): RouteObject[] => {
    return routes.map(({ path, element, redirectLogic, children, id, index }) => {

        const wrappedElement = redirectLogic
            ? (
                <ProtectedRoute redirectLogic={redirectLogic}>
                    {element()}
                </ProtectedRoute>
            )
            : element();

        if (index) {
            return {
                index: true,
                id,
                element: wrappedElement,
            };
        }

        return {
            path: path === '/' ? '' : path, // 🔥 NO manipular
            id,
            element: wrappedElement,
            children: children ? parseRoutes(children) : undefined,
        };
    });
};