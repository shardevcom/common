import { AbilityBuilder, PureAbility } from '@casl/ability';
import { AuthUser, BasePermissionAdapter } from "@/auth";

export class AuthAbilityAdapter<T extends AuthUser> extends BasePermissionAdapter<T> {
    private ability: PureAbility<[string, string]>;

    // 1. Acciones por defecto (Estáticas)
    public static defaultActions = ['view', 'create', 'update', 'remove', 'manage', 'delete', 'edit'];

    constructor(
        protected authUser: T,
        protected guard?: string,
        protected availableActions?: string[]
    ) {
        super(authUser, guard, availableActions);
        this.ability = this.defineAbility(authUser, guard);
    }

    private defineAbility(auth: any, guard?: string) {
        const { can, build } = new AbilityBuilder(PureAbility<[string, string]>);

        // Combinar las acciones por defecto con las extras pasadas al constructor
        // También podemos intentar extraer acciones dinámicas del objeto auth si existieran
        const knownActions = [
            ...AuthAbilityAdapter.defaultActions,
            ...(this?.availableActions || []), // Acciones adicionales pasadas al constructor
            ...(auth?.availableActions || []) // Opcional: acciones que vengan del backend
        ];

        const addPermission = (permission: any) => {
            if (!permission?.name) return;

            const rawName = permission.name.trim();
            const match = rawName.match(/^([^:.\s-]+)[:.\s-](.+)$/);

            if (match) {
                const firstPart = match[1].toLowerCase();
                const secondPart = match[2];

                if (knownActions.includes(firstPart)) {
                    can(firstPart, secondPart);
                } else {
                    can("view", rawName);
                }
            } else {
                can("view", rawName);
            }
        };

        // --- Lógica de Roles y Super Admin ---
        if (auth?.roles) {
            const isSuperAdmin = auth.roles.some(
                (role: any) => (role.name === 'Super Admin' || role.name === 'admin') && role.guard_name === guard
            );

            if (isSuperAdmin) {
                can('manage', 'all');
            } else {
                auth.roles.forEach((role: any) => {
                    role.permissions?.forEach((permission: any) => {
                        if (permission.guard_name === guard) {
                            addPermission(permission);
                        }
                    });
                });
            }
        }

        // --- Permisos Directos ---
        if (auth?.permissions?.length > 0) {
            auth.permissions.forEach((permission: any) => {
                if (permission.guard_name === guard) {
                    addPermission(permission);
                }
            });
        }

        return build();
    }

    public can(action: string, subject: any): boolean {
        return this.ability.can(action, subject);
    }

    public update(rules: any) {
        this.ability.update(rules);
    }
}