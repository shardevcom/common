import {useContext, useMemo} from "react";

import {AuthUser, Permission, PermissionAdapter, Role, AuthContext} from "@/auth";
import {AuthAbilityAdapter} from "@/adapters";
import {useAppSelector} from "@/store";

export const createMockPermissionAdapter = (): PermissionAdapter<AuthUser> => {
    let user: AuthUser = {};
    return {
        can: (_action: string, _subject: any) => false,
        update: (_roles: Role[], _permissions: Permission[]) => {},
        getUser: () => user,
        setUser: (authUser: AuthUser) => { user = authUser; },
    };
};

export const usePermissions = <T extends AuthUser = AuthUser>(): PermissionAdapter<T> => {
    const context = useContext(AuthContext);

    if (!context) {
        return createMockPermissionAdapter() as PermissionAdapter<T>;
    }

    // Forzamos el tipo aquí, ya que sabemos que el contexto es seguro.
    return context as PermissionAdapter<T>;
};


export const useAuthAbilityAdapter = <T extends AuthUser = AuthUser>(
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








