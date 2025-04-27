import {useContext} from "react";

import {PermissionAdapter} from "../types";
import {AuthContext} from "../context";

export const usePermissions = (): PermissionAdapter => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("usePermissions must be used within a PermissionsProvider");
    }
    return context;
};








