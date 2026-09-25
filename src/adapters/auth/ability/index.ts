import { AbilityBuilder, PureAbility } from '@casl/ability';
import { AuthUser, BasePermissionAdapter } from "../../../auth";

export class AuthAbilityAdapter<T extends AuthUser> extends BasePermissionAdapter<T> {
    private ability: PureAbility<[string, string]>;

    public static defaultActions = ['view', 'create', 'update', 'remove', 'manage', 'delete', 'edit', 'import', 'export'];

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

        const knownActions = [
            ...AuthAbilityAdapter.defaultActions,
            ...(this?.availableActions || []),
            ...(auth?.availableActions || [])
        ];

        const addPermission = (permission: any) => {
            if (!permission?.name) return;

            // Filtrar por guard si está definido
            if (guard && permission.guard_name && permission.guard_name !== guard) {
                return;
            }

            const rawName = permission.name.trim();

            // 🚀 Regla especial: Si el permiso es 'manage' o 'manage:all', se concede acceso total
            if (rawName === 'manage' || rawName === 'manage:all' || rawName === '*:*') {
                can('manage', 'all');
                return;
            }

            const match = rawName.match(/^([^:.\s-]+)[:.\s-](.+)$/);

            if (match) {
                const firstPart = match[1].toLowerCase();
                const secondPart = match[2];

                if (firstPart === 'manage') {
                    // Soporta permisos como 'manage:users' -> concede 'manage' sobre el recurso 'users'
                    can('manage', secondPart);
                } else if (knownActions.includes(firstPart)) {
                    can(firstPart, secondPart);
                } else {
                    can("view", rawName);
                }
            } else {
                can("view", rawName);
            }
        };

        // 1. Extraer y aplanar todos los permisos (provenientes de roles o permisos directos del usuario)
        const allPermissions: any[] = [];

        if (Array.isArray(auth?.roles)) {
            auth.roles.forEach((role: any) => {
                if (Array.isArray(role?.permissions)) {
                    allPermissions.push(...role.permissions);
                }
            });
        }

        if (Array.isArray(auth?.permissions)) {
            allPermissions.push(...auth.permissions);
        }

        // 2. Evaluar cada permiso de forma agnóstica a los roles
        allPermissions.forEach((permission) => {
            addPermission(permission);
        });

        return build();
    }

    public can(action: string, subject: any): boolean {
        return this.ability.can(action, subject);
    }

    public update(rules: any) {
        this.ability.update(rules);
    }
}