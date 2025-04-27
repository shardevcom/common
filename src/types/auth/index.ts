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
