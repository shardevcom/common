import React, { ReactNode} from "react";
import {PermissionAdapter} from "@/auth";
import {AuthContext} from "@/auth";


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
