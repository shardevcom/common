import { describe, expect, it } from "vitest";
import {
    countStorageKeys,
    createMemoryStorage,
    createStoragePurger,
    listStorageKeys,
    purgeStorage,
    purgeStorageByPrefix,
    purgeStorageByPredicate,
    purgeStorageKeys,
} from "../../src/utils/storage";

describe("utils/storage", () => {
    describe("createMemoryStorage", () => {
        it("stores, reads, removes and clears values", async () => {
            const storage = createMemoryStorage();

            await storage.setItem("a", "1");
            await storage.setItem("b", "2");

            expect(await storage.getItem("a")).toBe("1");
            expect(await storage.getItem("missing")).toBeNull();

            await storage.removeItem("a");
            expect(await storage.getItem("a")).toBeNull();

            await storage.clear();
            expect(storage.length).toBe(0);
        });

        it("accepts initial entries and exposes keys in stable order", async () => {
            const storage = createMemoryStorage({ b: "2", a: "1" });

            expect(storage.length).toBe(2);
            expect(await listStorageKeys(storage)).toEqual(["a", "b"]);
        });
    });

    describe("purgeStorageKeys", () => {
        it("removes only the requested keys deterministically", async () => {
            const storage = createMemoryStorage({
                access_token: "secret",
                "persist:app": "{}",
                other: "keep",
            });

            const result = await purgeStorageKeys(storage, ["other", "access_token"]);

            expect(result.purged.sort()).toEqual(["access_token", "other"]);
            expect(await storage.getItem("access_token")).toBeNull();
            expect(await storage.getItem("other")).toBeNull();
            expect(await storage.getItem("persist:app")).toBe("{}");
        });

        it("deduplicates keys and ignores missing keys", async () => {
            const storage = createMemoryStorage({ a: "1" });

            const result = await purgeStorageKeys(storage, ["a", "a", "missing"]);

            expect(result.purged).toEqual(["a"]);
            expect(result.remaining).toBe(0);
        });
    });

    describe("purgeStorageByPrefix", () => {
        it("removes all keys sharing a prefix", async () => {
            const storage = createMemoryStorage({
                "persist:app": "1",
                "persist:module": "2",
                "adm": "3",
            });

            const result = await purgeStorageByPrefix(storage, "persist:");

            expect(result.purged.sort()).toEqual(["persist:app", "persist:module"]);
            expect(await storage.getItem("adm")).toBe("3");
            expect(await countStorageKeys(storage)).toBe(1);
        });
    });

    describe("purgeStorageByPredicate", () => {
        it("removes keys matching a predicate", async () => {
            const storage = createMemoryStorage({
                token_auth: "1",
                token_refresh: "2",
                profile: "3",
            });

            const result = await purgeStorageByPredicate(storage, (key) => key.startsWith("token_"));

            expect(result.purged.sort()).toEqual(["token_auth", "token_refresh"]);
            expect(await storage.getItem("profile")).toBe("3");
        });
    });

    describe("purgeStorage", () => {
        it("dispatches by target type", async () => {
            const storage = createMemoryStorage({
                "persist:app": "1",
                token: "2",
                other: "3",
            });

            const exact = await purgeStorage(storage, { keys: ["token"] });
            expect(exact.purged).toEqual(["token"]);

            const prefixed = await purgeStorage(storage, { prefix: "persist:" });
            expect(prefixed.purged).toEqual(["persist:app"]);

            const byPredicate = await purgeStorage(storage, { predicate: (key) => key === "other" });
            expect(byPredicate.purged).toEqual(["other"]);
        });

        it("returns an empty result when no target matches", async () => {
            const storage = createMemoryStorage({ a: "1" });
            const result = await purgeStorage(storage, { keys: [] });

            expect(result).toEqual({ purged: [], remaining: 1 });
        });
    });

    describe("createStoragePurger", () => {
        it("binds all purge helpers to a concrete storage", async () => {
            const storage = createMemoryStorage({ a: "1", "persist:app": "{}" });
            const purger = createStoragePurger(storage);

            expect((await purger.list()).sort()).toEqual(["a", "persist:app"]);

            await purger.purgeKeys(["a"]);
            expect(await storage.getItem("a")).toBeNull();

            await purger.purgeByPrefix("persist:");
            expect(await countStorageKeys(storage)).toBe(0);
        });
    });
});