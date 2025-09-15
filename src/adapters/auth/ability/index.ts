import {AbilityBuilder, PureAbility} from '@casl/ability';
import {AuthUser, BasePermissionAdapter} from "@/auth";


export class AuthAbilityAdapter<T extends AuthUser> extends BasePermissionAdapter<T> {

    private ability: PureAbility<[string, string]>;

    constructor(protected authUser: T, protected guard?: string) {
        super(authUser, guard);
        this.ability = this.defineAbility(authUser, guard);
    }

    private defineAbility(auth: any, guard?: string) {

        const ability = new AbilityBuilder(PureAbility<[string, string]>)

        // Helper function to define permissions
        const addPermission = (permission: any) => {
            if (!permission?.name) return;

            // Normalizar separadores
            const normalized = permission.name.trim().replace(/[.\s-]/, ':')  // Convertir ., espacio y - a :

            // Dividir en partes
            const parts = normalized.split(":").filter(Boolean);

            if (parts.length >= 2) {
                const action = parts[0];
                const subject = parts.slice(1).join(":"); // todo lo demás es el sujeto
                ability.can(action, subject);
            } else {
                // Default: si no hay separación clara, asumir "view"
                ability.can("view", normalized);
            }
        };

        // Check for roles
        if (auth?.roles) {
            const isSuperAdmin = auth.roles.some(
                (role: any) => role.name === 'Super Admin' && role.guard_name === guard
            );

            if (isSuperAdmin) {
                ability.can('manage', 'all');
            } else {
                auth.roles.forEach((role: any) => {
                    role.permissions.forEach((permission: any) => {
                        if (permission.guard_name === guard) {
                            addPermission(permission);
                        }
                    });
                });
            }
        }

        // Check for direct permissions if no roles exist
        if (auth?.permissions && auth.permissions.length > 0) {
            auth.permissions.forEach((permission: any) => {
                if (permission.guard_name === guard) {
                    addPermission(permission);
                }
            });
        }

        return ability.build();
    }

    public can(action: string, subject: any): boolean {
        return this.ability.can(action, subject);
    }

    public abilities() {
        return this.ability.rules.map(rule => ({
            action: rule.action,
            subject: rule.subject
        }));
    }

    public update(rules: any) {
        this.ability.update(rules)
    }


}
