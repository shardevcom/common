import { describe, expect, it } from "vitest";
import { AuthUser, BasePermissionAdapter, Permission, Role } from "../../src";

class TestPermissionAdapter extends BasePermissionAdapter<AuthUser> {
    constructor(
        authUser: AuthUser,
        guard?: string,
        private readonly allowed = new Set<string>(),
    ) {
        super(authUser, guard);
    }

    can(action: string, subject: any): boolean {
        return this.allowed.has(`${action}:${String(subject)}`);
    }

    update(_roles: Role[], _permissions: Permission[]): void {
        // No-op for tests.
    }
}

describe("auth/BasePermissionAdapter", () => {
    it("supports canAny and canAll based on can()", () => {
        const adapter = new TestPermissionAdapter(
            { id: "1", access_token: "token" },
            "web",
            new Set(["view:users", "edit:users"]),
        );

        expect(adapter.canAny(["delete", "view"], "users")).toBe(true);
        expect(adapter.canAny(["delete", "create"], "users")).toBe(false);
        expect(adapter.canAll(["view", "edit"], "users")).toBe(true);
        expect(adapter.canAll(["view", "delete"], "users")).toBe(false);
    });

    it("tracks and returns the current user", () => {
        const adapter = new TestPermissionAdapter({});
        const user: AuthUser = { id: "10", access_token: "abc", name: "Elber" };

        adapter.setUser(user);

        expect(adapter.getUser()).toEqual(user);
    });

    it("checks authentication state with optional guards", () => {
        const user: AuthUser = { id: "1", access_token: "token" };

        expect(new TestPermissionAdapter(user, "web").isAuthenticated()).toBe(true);
        expect(new TestPermissionAdapter(user, "web").isAuthenticated("web")).toBe(true);
        expect(new TestPermissionAdapter(user, "web").isAuthenticated("api")).toBe(false);
        expect(new TestPermissionAdapter({}, "web").isAuthenticated()).toBe(false);
    });
});
