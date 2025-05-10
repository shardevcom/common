import {AbilityBuilder, PureAbility} from '@casl/ability';
import {AuthUser, BasePermissionAdapter} from "../../../auth";


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
            const [action, subject] = permission.name.split('-');
            if (action && subject) {
                ability.can(action, subject);
            } else {
                ability.can('view', permission.name); // Default to 'view' if no action and subject
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

    public update(rules: any) {
        this.ability.update(rules)
    }


}
