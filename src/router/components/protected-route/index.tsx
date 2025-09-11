import React from "react";
import {Navigate, useLocation} from "react-router-dom";
import { PermissionAdapter, usePermissions } from "@/auth";

interface ProtectedRouteProps {
    children: React.ReactNode;
    redirectLogic?: (adapter: PermissionAdapter) => string | React.ReactNode | false;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, redirectLogic }) => {
    const permissions = usePermissions();
    const location = useLocation();

    if (redirectLogic) {
        const redirectResult = redirectLogic(permissions);

        if (redirectResult) {
            // Caso 1: Si devuelve un string -> tratamos como ruta
            if (typeof redirectResult === "string") {
                const absolutePath = redirectResult.startsWith("/")
                    ? redirectResult
                    : `/${redirectResult}`;

                return (
                    <Navigate
                        to={absolutePath}
                        state={{ from: location }}
                        replace
                    />
                );
            }

            // Caso 2: Si devuelve un componente React
            if (React.isValidElement(redirectResult)) {
                return redirectResult;
            }
        }
    }

    return <>{children}</>;
};

export default ProtectedRoute;
