import React from 'react';
import {
    BrowserRouter,
    useRoutes,
} from 'react-router-dom';
import {parseRoutes} from "../parser-routes";
import {AuthUser} from "../../auth";
import {RouteConfig} from "../types";


interface RouterProps<T extends AuthUser = AuthUser> {
    routes: RouteConfig<T>[];
}

const InnerRouterProvider: React.FC<RouterProps> = ({routes}) => {
    return useRoutes(parseRoutes(routes));
};

export const RouterProvider: React.FC<RouterProps> = ({routes}) => {
    return (
        <BrowserRouter>
            <InnerRouterProvider routes={routes} />
        </BrowserRouter>
    );
};

