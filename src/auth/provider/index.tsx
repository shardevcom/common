import React, { ReactNode} from "react";
import {PermissionAdapter} from "../types";
import {AuthContext} from "../context";


interface AuthProviderProps {
    adapter: PermissionAdapter;
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({adapter,children, }) => {
    return (
        <AuthContext.Provider value={adapter}>
            {children}
        </AuthContext.Provider>
    );
};
