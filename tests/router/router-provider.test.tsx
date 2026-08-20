// @vitest-environment jsdom

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";

vi.mock("redux-persist/integration/react", () => ({
    PersistGate: ({ children }: { children: React.ReactNode }) => children,
}));

import { createApp } from "../../src";
import { RouterProvider } from "../../src";
import { RouteConfig } from "../../src";

beforeEach(() => {
    window.history.pushState({}, "", "/");
    window.localStorage.clear();
});

afterEach(() => {
    cleanup();
    window.localStorage.clear();
});

function makeModuleApp(moduleRoutes: RouteConfig[]) {
    const ModuleShell = () => <RouterProvider routes={moduleRoutes} />;
    return createApp({
        name: "module-app",
        app: ModuleShell,
        appKey: "module-secret",
        slices: {},
    });
}

describe("RouterProvider nesting", () => {
    it("does not duplicate a module route when the module is a CHILD of the root router", async () => {
        let elementCalls = 0;
        const moduleRoutes: RouteConfig[] = [
            {
                path: "/module",
                element: () => {
                    elementCalls += 1;
                    return (
                        <div data-testid="module-page-child">
                            <p>Nested module route (child)</p>
                        </div>
                    );
                },
            },
        ];

        const ModuleApp = makeModuleApp(moduleRoutes);

        const hostRoutes: RouteConfig[] = [
            {
                path: "/",
                element: () => <div data-testid="host-page">Host route</div>,
            },
        ];

        const HostShell = () => (
            <RouterProvider routes={hostRoutes}>
                <ModuleApp />
            </RouterProvider>
        );

        const HostApp = createApp({
            name: "host-app",
            app: HostShell,
            appKey: "host-secret",
            slices: {},
        });

        window.history.pushState({}, "", "/module");

        render(<HostApp />);

        await waitFor(() => {
            expect(screen.getByTestId("module-page-child")).toBeTruthy();
        });

        expect(screen.getAllByTestId("module-page-child")).toHaveLength(1);
        expect(elementCalls).toBe(1);
        expect(screen.queryByTestId("host-page")).toBeNull();
    });

    it("does not duplicate a module route when the module is rendered as a sibling of the root router", async () => {
        const moduleRoutes: RouteConfig[] = [
            {
                path: "/module",
                element: () => (
                    <div data-testid="module-page-sibling">
                        <p>Nested module route (sibling)</p>
                    </div>
                ),
            },
        ];

        const ModuleApp = makeModuleApp(moduleRoutes);

        const hostRoutes: RouteConfig[] = [
            {
                path: "/",
                element: () => <div data-testid="host-page">Host route</div>,
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
            slices: {},
        });

        window.history.pushState({}, "", "/module");

        render(<HostApp />);

        await waitFor(() => {
            expect(screen.getByTestId("module-page-sibling")).toBeTruthy();
        });

        expect(screen.getAllByTestId("module-page-sibling")).toHaveLength(1);
        expect(screen.queryByTestId("host-page")).toBeNull();
    });
});