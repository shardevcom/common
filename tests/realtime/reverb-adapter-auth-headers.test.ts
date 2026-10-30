import { describe, expect, it, vi } from "vitest";

const echoOptions: Record<string, any>[] = [];

vi.mock("laravel-echo", () => ({
    default: class {
        connector = undefined;
        constructor(options: Record<string, any>) {
            echoOptions.push(options);
        }
        connect() {}
    },
}));

import { RealtimeReverbAdapter } from "../../src/adapters/realtime/reverb";

describe("RealtimeReverbAdapter auth headers", () => {
    it("no fija Content-Type: pusher-js envía el cuerpo form-urlencoded y XHR concatenaría ambos valores", () => {
        echoOptions.length = 0;

        new RealtimeReverbAdapter({
            baseURL: "http://localhost",
            token: "abc",
            options: { key: "key", wsHost: "localhost" },
        });

        const headers = echoOptions.at(-1)?.auth?.headers ?? {};
        const names = Object.keys(headers).map((h) => h.toLowerCase());

        expect(names).not.toContain("content-type");
        expect(headers.Accept).toBe("application/json");
        expect(headers.Authorization).toBe("Bearer abc");
    });

    it("respeta las cabeceras extra configuradas", () => {
        echoOptions.length = 0;

        new RealtimeReverbAdapter({
            baseURL: "http://localhost",
            options: { key: "key", wsHost: "localhost", auth: { headers: { "X-Custom": "1" } } },
        });

        const headers = echoOptions.at(-1)?.auth?.headers ?? {};
        expect(headers["X-Custom"]).toBe("1");
        expect(headers.Authorization).toBeUndefined();
    });
});
