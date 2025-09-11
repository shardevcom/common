import React from "react";
import {Navigate, useLocation} from "react-router-dom";
import { PermissionAdapter, usePermissions } from "@/auth";

interface ProtectedRouteProps {
    children: React.ReactNode;
    redirectLogic?: (adapter: PermissionAdapter) => string | false;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, redirectLogic }) => {
    const permissions = usePermissions();
    const location = useLocation();

    if (redirectLogic) {
        const redirectResult = redirectLogic(permissions);
        if (redirectResult) {
                return (
                    <Navigate
                        to={redirectResult}
                        state={{ from: location }}
                        replace
                    />
                );
        }
    }

    return <>{children}</>;
};

export default ProtectedRoute;
