export interface PermissionAdapter {
    can(action: string, subject: any): boolean;

    update(currentAuthUser: any, guardName: string): void;
}


export abstract class BasePermissionAdapter implements PermissionAdapter {
    constructor(protected authUser: any, protected guard?: string) {}
    abstract can(action: string, subject: any): boolean;
    abstract update(authUser: any, guardName: string): void;
}
