// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { createSlice } from "@reduxjs/toolkit";

vi.mock("redux-persist/integration/react", () => ({
    PersistGate: ({ children }: { children: React.ReactNode }) => children,
}));

import { createApp } from "../../src";
import { RouterProvider } from "../../src";
import { RouteConfig } from "../../src";
import { useAppSelector, useStoreContext } from "../../src";

const hostSlice = createSlice({
    name: "host",
    initialState: { ready: true },
    reducers: {},
});

const moduleSlice = createSlice({
    name: "module",
    initialState: { enabled: true },
    reducers: {},
});

function ReducersProbe() {
    const { registeredReducers } = useStoreContext();

    return (
        <div data-testid="registered-reducers">
            {Object.keys(registeredReducers).sort().join(",")}
        </div>
    );
}

function ModuleStateProbe() {
    const enabled = useAppSelector((state: any) => state.module?.enabled ?? false);
    return <div data-testid="module-state">{String(enabled)}</div>;
}

beforeEach(() => {
    window.history.pushState({}, "", "/");
    window.localStorage.clear();
});

afterEach(() => {
    cleanup();
    window.localStorage.clear();
});

describe("createApp", () => {
    it("renders a standalone app route inside its own store provider", async () => {
        const routes: RouteConfig[] = [
            {
                path: "/standalone",
                element: () => (
                    <>
                        <div>Standalone route</div>
                        <ReducersProbe />
                    </>
                ),
            },
        ];

        const StandaloneShell = () => <RouterProvider routes={routes} />;

        const StandaloneApp = createApp({
            name: "standalone-app",
            app: StandaloneShell,
            appKey: "standalone-secret",
            slices: {
                host: hostSlice.reducer,
            },
        });

        window.history.pushState({}, "", "/standalone");

        render(<StandaloneApp />);

        expect(await screen.findByText("Standalone route")).toBeTruthy();
        expect(screen.getByTestId("registered-reducers").textContent).toBe("auth,host");
    });

    it("lets a nested app register reducers and routes without duplicating the rendered module route", async () => {
        const moduleRoutes: RouteConfig[] = [
            {
                path: "/module",
                element: () => (
                    <>
                        <div>Nested module route</div>
                        <ReducersProbe />
                        <ModuleStateProbe />
                    </>
                ),
            },
        ];

        const ModuleShell = () => <RouterProvider routes={moduleRoutes} />;

        const ModuleApp = createApp({
            name: "module-app",
            app: ModuleShell,
            appKey: "module-secret",
            slices: {
                module: moduleSlice.reducer,
            },
        });

        const hostRoutes: RouteConfig[] = [
            {
                path: "/",
                element: () => <div>Host route</div>,
            },
        ];

        const HostShell = () => (
            <>
                <RouterProvider routes={hostRoutes} />
                <ModuleApp />
            </>
        );

        const HostApp = createApp({
            name: "host-app",
            app: HostShell,
            appKey: "host-secret",
            slices: {
                host: hostSlice.reducer,
            },
        });

        window.history.pushState({}, "", "/module");

        render(<HostApp />);

        expect(await screen.findByText("Nested module route")).toBeTruthy();
        expect(screen.getAllByText("Nested module route")).toHaveLength(1);
        expect(screen.queryByText("Host route")).toBeNull();

        await waitFor(() => {
            expect(screen.getByTestId("registered-reducers").textContent).toBe("auth,host,module");
        });

        expect(screen.getByTestId("module-state").textContent).toBe("true");
    });
});
