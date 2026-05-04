import { describe, expect, it } from "vitest";
import { createSlice } from "@reduxjs/toolkit";
import { createEncryptor } from "../../src/store/factory/encryptor";
import {AuthState, createStoreFactory, StateFromReducersMapObject} from "../../src";
import {PersistState} from "redux-persist/es/types";

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
});
