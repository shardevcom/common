import { describe, expect, it } from "vitest";
import { createSlice } from "@reduxjs/toolkit";
import { createEncryptor } from "../../src/store/factory/encryptor";
import {AuthState, createStoreFactory, initAuth, logout, setAuth, StateFromReducersMapObject} from "../../src";
import {PersistState} from "redux-persist/es/types";
import {createMemoryStorage, countStorageKeys, createPersistKey} from "../../src";

describe("store/createEncryptor", () => {
    it("encrypts and decrypts persisted state consistently", () => {
        const encryptor = createEncryptor("secret");
        const inbound = { name: "Shardev", enabled: true };

        const encrypted = encryptor.in(inbound, "test", {} as never);
        const decrypted = encryptor.out(encrypted, "test", {} as never);

        expect(typeof encrypted).toBe("string");
        expect(decrypted).toEqual(inbound);
    });
});

describe("store/createStoreFactory", () => {
    it("creates a store with default auth and custom slices", () => {
        const counterSlice = createSlice({
            name: "counter",
            initialState: { value: 0 },
            reducers: {
                increment: (state) => {
                    state.value += 1;
                },
            },
        });

        const instance = createStoreFactory({
            keyName: "test-store",
            secretKey: "test-secret",
            slices: {
                counter: counterSlice.reducer,
            },
        });

        instance.store.dispatch(counterSlice.actions.increment());

        const state = instance.store.getState() as {
            auth: AuthState;
            counter: { value: number };
        } & {
            _persist: PersistState;
        };

        expect(state.auth).toBeDefined();
        expect(state.counter.value).toBe(1);
        expect(instance.registeredReducers).toHaveProperty("auth");
        expect(instance.registeredReducers).toHaveProperty("counter");
    });

    it("supports dynamically adding reducers and resetting state", () => {
        const alphaSlice = createSlice({
            name: "alpha",
            initialState: { count: 1 },
            reducers: {
                bump: (state) => {
                    state.count += 1;
                },
            },
        });

        const betaSlice = createSlice({
            name: "beta",
            initialState: { ready: false },
            reducers: {
                enable: (state) => {
                    state.ready = true;
                },
            },
        });

        const instance = createStoreFactory({
            keyName: "dynamic-store",
            secretKey: "dynamic-secret",
            slices: {
                alpha: alphaSlice.reducer,
            },
        });

        instance.addReducers({
            beta: betaSlice.reducer,
        });

        instance.store.dispatch(alphaSlice.actions.bump());
        instance.store.dispatch(betaSlice.actions.enable());

        let state = instance.store.getState() as {
            auth: AuthState;
            alpha: { count: number };
            beta: { ready: boolean };
        } & {
            _persist: PersistState;
        };

        expect(state.auth).toBeDefined();
        expect(state.alpha.count).toBe(2);
        expect(state.beta.ready).toBe(true);

        instance.store.dispatch({ type: "RESET_STATE" });

        state = instance.store.getState() as {
            auth: AuthState;
            alpha: { count: number };
            beta: { ready: boolean };
        } & {
            _persist: PersistState;
        };

        expect(state.auth).toBeDefined();
        expect(state.alpha.count).toBe(1);
        expect(state.beta.ready).toBe(false);
    });

    it("purges only the app's own persist key and declared purgeKeys", async () => {
        const storage = createMemoryStorage({
            [createPersistKey("purge-store")]: "encrypted-state",
            "access_token": "secret",
            "other-app": "keep",
        });

        const instance = createStoreFactory({
            keyName: "purge-store",
            secretKey: "purge-secret",
            storage,
            purgeKeys: ["access_token"],
        });

        const result = await instance.purge();

        expect(result.purged.sort()).toEqual(["access_token", "persist:purge-store"]);
        expect(await storage.getItem("persist:purge-store")).toBeNull();
        expect(await storage.getItem("access_token")).toBeNull();
        expect(await storage.getItem("other-app")).toBe("keep");
    });

    it("purge supports a custom target without dropping own keys", async () => {
        const storage = createMemoryStorage({
            [createPersistKey("purge-store")]: "encrypted-state",
            "session:id": "abc",
        });

        const instance = createStoreFactory({
            keyName: "purge-store",
            secretKey: "purge-secret",
            storage,
        });

        const result = await instance.purge({ prefix: "session:" });

        expect(result.purged.sort()).toEqual(["persist:purge-store", "session:id"]);
        expect(await countStorageKeys(storage)).toBe(0);
    });

    it("resets auth via initAuth and logout without touching storage", () => {
        const instance = createStoreFactory({
            keyName: "auth-store",
            secretKey: "auth-secret",
        });

        instance.store.dispatch(setAuth({ id: "1", access_token: "token" }));

        let state = instance.store.getState() as { auth: AuthState } & { _persist: PersistState };
        expect(state.auth.authUser.access_token).toBe("token");

        instance.store.dispatch(logout());

        state = instance.store.getState() as { auth: AuthState } & { _persist: PersistState };
        expect(state.auth.authUser.access_token).toBe("");

        instance.store.dispatch(setAuth({ id: "2", access_token: "token-2" }));
        instance.store.dispatch(initAuth());

        state = instance.store.getState() as { auth: AuthState } & { _persist: PersistState };
        expect(state.auth.authUser.access_token).toBe("");
        expect(state.auth.authUser.id).toBe("");
    });

    it("auth storage middleware mirrors access_token and purges it on logout/initAuth", async () => {
        const storage = createMemoryStorage();

        const instance = createStoreFactory({
            keyName: "auth-mirror",
            secretKey: "auth-mirror-secret",
            storage,
            authStorageKey: "access_token",
        });

        instance.store.dispatch(setAuth({ id: "1", access_token: "abc" }));
        expect(await storage.getItem("access_token")).toBe("abc");

        instance.store.dispatch(logout());
        expect(await storage.getItem("access_token")).toBeNull();

        instance.store.dispatch(setAuth({ id: "2", access_token: "xyz" }));
        expect(await storage.getItem("access_token")).toBe("xyz");

        instance.store.dispatch(initAuth());
        expect(await storage.getItem("access_token")).toBeNull();
    });

    it("auth storage middleware does nothing when authStorageKey is not declared", async () => {
        const storage = createMemoryStorage();

        const instance = createStoreFactory({
            keyName: "auth-no-mirror",
            secretKey: "auth-no-mirror-secret",
            storage,
        });

        instance.store.dispatch(setAuth({ id: "1", access_token: "abc" }));
        expect(await countStorageKeys(storage)).toBe(0);
    });
});
