import React from "react";

export interface Role {
    id: string
    name: string
    guard_name: string
    permissions: Permission[]
}

export interface Permission {
    id: string
    name: string
    guard_name: string
    roles: Role[]
}

export interface AuthUser {
    id?: string | null | undefined
    name?: string
    roles?: Role[]
    permissions?: Permission[]
    refresh_token?: string
    access_token?: string
    token_type?: string
    expires_at?: string
}

export interface PermissionAdapter <T extends AuthUser = AuthUser>{
    can(action: string, subject: any): boolean;
    update(roles: Role[], permissions: Permission[]): void;
    getUser(): T;
    setUser(authUser: T): void;
}


export abstract class BasePermissionAdapter<T extends AuthUser> implements PermissionAdapter {
    constructor(protected authUser: T, protected guard?: string) {
        this.authUser = authUser;
        this.guard = guard;
    }
    abstract can(action: string, subject: any): boolean;
    abstract update(roles: Role[], permissions: Permission[]): void;
    getUser(): T {
        return this.authUser;
    }

    setUser(authUser: T): void {
        this.authUser = authUser
    }
}


