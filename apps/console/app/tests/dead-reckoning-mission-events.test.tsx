import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { missionKeys } from "@/lib/dead-reckoning/queries";
import { useMissionEvents } from "@/lib/dead-reckoning/use-mission-events";

/**
 * `useMissionEvents` (U02): every SSE message, and every reconnect, only ever calls
 * `invalidateQueries` — it never reads the event payload or writes it into the cache — so an
 * out-of-order or missing hint can only ever trigger a refetch, never itself become the displayed
 * state. The refetch's own result is protected separately by `pickNewerMissionSnapshot`
 * (see dead-reckoning-mission-query.test.ts), which is what actually stops a regression; this test
 * covers the other half of U02's claim: that the hint path never bypasses that guard by writing
 * data directly.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly url: string;
  closed = false;
  private readonly listeners: Record<string, (() => void)[]> = {};
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, cb: () => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(cb);
  }
  close() {
    this.closed = true;
  }
  emit(type: string) {
    for (const cb of this.listeners[type] ?? []) cb();
  }
}

let originalEventSource: unknown;

beforeAll(() => {
  GlobalRegistrator.register();
  originalEventSource = (globalThis as { EventSource?: unknown }).EventSource;
  (globalThis as { EventSource?: unknown }).EventSource = FakeEventSource as unknown;
});
afterEach(() => {
  cleanup();
  FakeEventSource.instances = [];
});
afterAll(() => {
  (globalThis as { EventSource?: unknown }).EventSource = originalEventSource;
  GlobalRegistrator.unregister();
});

function wrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("useMissionEvents", () => {
  test("an SSE message only invalidates this mission's own query — never writes cache data directly", () => {
    const queryClient = new QueryClient();
    const invalidate = spyOn(queryClient, "invalidateQueries");
    renderHook(() => useMissionEvents("m1"), { wrapper: wrapper(queryClient) });

    expect(FakeEventSource.instances).toHaveLength(1);
    FakeEventSource.instances[0]?.emit("message");

    expect(invalidate).toHaveBeenCalledWith({ queryKey: missionKeys.detail("m1") });
    // The defining guarantee: the hint alone never becomes state. Only a real GET (guarded by
    // pickNewerMissionSnapshot) can ever populate this key.
    expect(queryClient.getQueryData(missionKeys.detail("m1"))).toBeUndefined();
  });

  test("an out-of-order or missing hint still only ever nudges — repeated/garbled messages stay a no-op besides invalidation", () => {
    const queryClient = new QueryClient();
    const invalidate = spyOn(queryClient, "invalidateQueries");
    renderHook(() => useMissionEvents("m1"), { wrapper: wrapper(queryClient) });

    const source = FakeEventSource.instances[0];
    source?.emit("message");
    source?.emit("message");
    source?.emit("error"); // a dropped connection: still no direct cache write

    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryData(missionKeys.detail("m1"))).toBeUndefined();
  });

  test("a reconnect (remount, e.g. after the connection dropped) opens a fresh EventSource and still only nudges", () => {
    const queryClient = new QueryClient();
    const invalidate = spyOn(queryClient, "invalidateQueries");
    const view = renderHook(({ missionId }) => useMissionEvents(missionId), {
      wrapper: wrapper(queryClient),
      initialProps: { missionId: "m1" },
    });
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]?.closed).toBe(false);

    view.unmount();
    expect(FakeEventSource.instances[0]?.closed).toBe(true);

    renderHook(() => useMissionEvents("m1"), { wrapper: wrapper(queryClient) });
    expect(FakeEventSource.instances).toHaveLength(2);
    FakeEventSource.instances[1]?.emit("message");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: missionKeys.detail("m1") });
  });

  test("does not throw when EventSource is unavailable (degrades to polling alone)", () => {
    const queryClient = new QueryClient();
    const previous = (globalThis as { EventSource?: unknown }).EventSource;
    (globalThis as { EventSource?: unknown }).EventSource = undefined;
    expect(() =>
      renderHook(() => useMissionEvents("m1"), { wrapper: wrapper(queryClient) }),
    ).not.toThrow();
    (globalThis as { EventSource?: unknown }).EventSource = previous;
  });
});
