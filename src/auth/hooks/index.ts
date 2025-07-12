import {useContext, useMemo} from "react";

import {AuthUser, PermissionAdapter} from "../types";
import {AuthContext} from "../context";
import {AuthAbilityAdapter} from "../../adapters";
import {useAppSelector} from "../../store";

export const usePermissions = <T extends AuthUser = AuthUser>(): PermissionAdapter<T> => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error("usePermissions must be used within a PermissionsProvider");
    }

    // Forzamos el tipo aquí, ya que sabemos que el contexto es seguro.
    return context as PermissionAdapter<T>;
};
export const useAuthAdapter = <T extends AuthUser = AuthUser>(
    guard: string = 'api'
): AuthAbilityAdapter<T> | null => {
    const authUser = useAppSelector((state) => state.auth.authUser);

    return useMemo(() => {
        if (!authUser) {
            console.warn('AuthAdapter: authUser is null or undefined.');
            return null;
        }

        return new AuthAbilityAdapter<T>(authUser as T, guard);
    }, [authUser, guard]);
};








