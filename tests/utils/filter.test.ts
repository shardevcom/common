import { describe, expect, it, vi } from "vitest";
import {
    applyFilters,
    buildIncludeTree,
    buildQuery,
    normalizeFilterValue,
    renderIncludeTree,
} from "../../src/utils/filter";

class QueryMock {
    public selectCalls: Array<{ fields: string; options?: Record<string, unknown> }> = [];
    public filterCalls: Array<{ field: string; operator: string; value: unknown }> = [];
    public eqCalls: Array<{ field: string; value: unknown }> = [];
    public orCalls: string[] = [];
    public orderCalls: Array<{ field: string; ascending: boolean }> = [];

    select(fields: string, options?: Record<string, unknown>) {
        this.selectCalls.push({ fields, options });
        return this;
    }

    filter(field: string, operator: string, value: unknown) {
        this.filterCalls.push({ field, operator, value });
        return this;
    }

    eq(field: string, value: unknown) {
        this.eqCalls.push({ field, value });
        return this;
    }

    or(expression: string) {
        this.orCalls.push(expression);
        return this;
    }

    order(field: string, { ascending }: { ascending: boolean }) {
        this.orderCalls.push({ field, ascending });
        return this;
    }
}

describe("utils/filter", () => {
    it("normalizes operators that need special formatting", () => {
        expect(normalizeFilterValue("in", ["a", "b"])).toBe("(a,b)");
        expect(normalizeFilterValue("in", "a,b")).toBe("(a,b)");
        expect(normalizeFilterValue("like", "john")).toBe("*john*");
        expect(normalizeFilterValue("ilike", "*john*")).toBe("*john*");
        expect(normalizeFilterValue("eq", 10)).toBe(10);
    });

    it("builds and renders nested include trees", () => {
        const tree = buildIncludeTree(["profile", "roles.permissions", "roles.company"]);

        expect(tree).toEqual({
            profile: {},
            roles: {
                permissions: {},
                company: {},
            },
        });

        expect(renderIncludeTree(tree)).toBe("profile(*),roles(permissions(*),company(*))");
    });

    it("applies OR and regular filters to a query-like object", () => {
        const query = new QueryMock();

        applyFilters(query, {
            status: "active",
            total: { operator: "gte", value: 10 },
            OR: [
                { name: { operator: "ilike", value: "john" } },
                { email: "john@example.com" },
            ],
        });

        expect(query.eqCalls).toContainEqual({ field: "status", value: "active" });
        expect(query.filterCalls).toContainEqual({ field: "total", operator: "gte", value: 10 });
        expect(query.orCalls).toEqual(["name.ilike.*john*,email.eq.john@example.com"]);
    });

    it("applies AND groups without dropping direct filters", () => {
        const query = new QueryMock();

        applyFilters(query, {
            status: "active",
            AND: [
                { role: "admin" },
                { score: { operator: "gte", value: 80 } },
            ],
        });

        expect(query.eqCalls).toEqual(
            expect.arrayContaining([
                { field: "status", value: "active" },
                { field: "role", value: "admin" },
            ]),
        );
        expect(query.filterCalls).toContainEqual({ field: "score", operator: "gte", value: 80 });
    });

    it("builds a query with fields, includes, filters and sorting", () => {
        const query = new QueryMock();
        const client = {
            from: vi.fn(() => query),
        };

        const result = buildQuery(client, "users", {
            fields: ["id", "name"],
            include: ["profile", "roles.permissions"],
            filter: { status: "active" },
            sort: [
                { field: "name", order: "asc" },
                { field: "created_at", order: "desc" },
            ],
        });

        expect(result).toBe(query);
        expect(client.from).toHaveBeenCalledWith("users");
        expect(query.selectCalls).toEqual([
            {
                fields: "id,name,profile(*),roles(permissions(*))",
                options: { count: "exact" },
            },
        ]);
        expect(query.eqCalls).toContainEqual({ field: "status", value: "active" });
        expect(query.orderCalls).toEqual([
            { field: "name", ascending: true },
            { field: "created_at", ascending: false },
        ]);
    });
});
