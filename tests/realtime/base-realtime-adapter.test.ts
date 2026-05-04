import { describe, expect, it, vi } from "vitest";
import { BaseRealtimeAdapter, RealtimeAdapter, RealtimeEvent, RealtimeFilter, RealtimeSubscription } from "../../src";

class TestRealtimeAdapter extends BaseRealtimeAdapter implements RealtimeAdapter {
    public connect(): void {
        this.markConnected(true);
    }

    public disconnect(): void {
        this.markConnected(false);
    }

    public unsubscribe(_channel: string): void {
        // No-op for tests.
    }

    public async subscribe<TRecord = any>(
        channel: string,
        filter: RealtimeFilter,
        callback: (event: RealtimeEvent<TRecord>) => void
    ): Promise<RealtimeSubscription> {
        const receivedAt = Date.now();
        this.markEvent(receivedAt);

        callback({
            channel,
            eventType: filter.event ?? "MESSAGE",
            eventName: filter.eventName,
            record: { ok: true } as TRecord,
            receivedAt,
        });

        return {
            unsubscribe: () => {
                this.markConnected(false);
            },
        };
    }

    public pushError(error: unknown) {
        this.markError(error);
    }

    public unauthorized() {
        this.handleUnauthorized();
    }
}

describe("realtime/BaseRealtimeAdapter", () => {
    it("tracks connection state and latest event timestamp", async () => {
        const adapter = new TestRealtimeAdapter();
        const callback = vi.fn();

        adapter.connect();
        await adapter.subscribe("demo", { eventName: ".Ping", channelType: "public" }, callback);

        const status = adapter.getStatus();
        expect(status.connected).toBe(true);
        expect(status.lastEventAt).toEqual(expect.any(Number));
        expect(status.lastError).toBeNull();
        expect(callback).toHaveBeenCalledOnce();
    });

    it("forwards errors and unauthorized callbacks", () => {
        const onError = vi.fn();
        const onUnauthorized = vi.fn();
        const adapter = new TestRealtimeAdapter({ onError, onUnauthorized });
        const error = new Error("boom");

        adapter.pushError(error);
        adapter.unauthorized();

        expect(adapter.getStatus().lastError).toBe(error);
        expect(onError).toHaveBeenCalledWith(error);
        expect(onUnauthorized).toHaveBeenCalledOnce();
    });

    it("updates the auth token through the base setter", () => {
        const adapter = new TestRealtimeAdapter({ token: "a" });

        adapter.setAuthToken("b");

        expect(adapter.getStatus().connected).toBe(false);
    });
});
