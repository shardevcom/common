import React from "react";
import {AuthUser, PermissionAdapter} from "../../auth";

export interface RouteConfig<T extends AuthUser = AuthUser> {
    redirectLogic?: (adapter: PermissionAdapter<T>) => string | false;
    children?: RouteConfig<T>[]; // ✅ Children usa el mismo genérico
    path?: string;
    protected?: boolean;
    element: () => React.ReactElement;
    id?: string;
    index?: boolean;
}