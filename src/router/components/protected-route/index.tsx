import React from "react";
import { useLocation } from "react-router-dom";
import {PermissionAdapter, usePermissions} from "@/auth";
import {Redirect} from "@/router";


interface ProtectedRouteProps {
    children: React.ReactNode;
    redirectLogic?: (adapter: PermissionAdapter) => string | false;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, redirectLogic }) => {
    const permissions = usePermissions();
    const location = useLocation();

    if (redirectLogic) {
        const redirectPath = redirectLogic(permissions);
        if (redirectPath) {
            // Asegurar que la ruta sea absoluta
            const absolutePath = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;

            return <Redirect
                to={absolutePath}
                state={{ from: location }}
                replace
            />
        }
    }

    return children;
};

export default ProtectedRoute;
