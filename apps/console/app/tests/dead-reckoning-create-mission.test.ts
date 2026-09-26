import { afterEach, beforeEach, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { createMissionMutationOptions } from "../src/lib/dead-reckoning/mutations";

let originalFetch: typeof fetch;
beforeEach(() => { originalFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = originalFetch; });

test("create returns the server mission identity for navigation and sends only the accepted fixture fields", async () => {
  const requests: { path: string; body: unknown }[] = [];
  globalThis.fetch = (async (path: string, options?: RequestInit) => {
    const body = JSON.parse(String(options?.body));
    requests.push({ path, body });
    // Mirrors the strict create API's documented fields. Arbitrary constraints caused a 400 before.
    if (Object.keys(body).some(key => !["commandId", "goal", "review"].includes(key))) {
      return Response.json({ error: "Unexpected create field" }, { status: 400 });
    }
    return Response.json({ missionId: "f3-20260926-1234", revision: 2, status: "created" }, { status: 201 });
  }) as unknown as typeof fetch;
  const mutation = createMissionMutationOptions(new QueryClient());
  const input = { commandId: "create-trip-123", goal: "F3 Angel Island accessible camping trip", review: "auto" as const };
  const created = await mutation.mutationFn!(input, {} as never);
  expect(created).toEqual({ missionId: "f3-20260926-1234", revision: 2 });
  expect(requests).toEqual([{ path: "/api/dead-reckoning/missions", body: input }]);
});

test("an accepted create without a usable identity refuses navigation and directs the user to refresh", async () => {
  globalThis.fetch = (async () => Response.json({ status: "created", revision: 2 }, { status: 201 })) as unknown as typeof fetch;
  const mutation = createMissionMutationOptions(new QueryClient());
  await expect(mutation.mutationFn!({ commandId: "create-trip-123", goal: "F3 trip" }, {} as never))
    .rejects.toThrow("Refresh the mission list before trying again");
});

test("a server refusal remains an error and does not produce a navigable mission", async () => {
  globalThis.fetch = (async () => Response.json({ error: "Another mission is active" }, { status: 409 })) as unknown as typeof fetch;
  const mutation = createMissionMutationOptions(new QueryClient());
  await expect(mutation.mutationFn!({ commandId: "create-trip-123", goal: "F3 trip" }, {} as never))
    .rejects.toThrow("Another mission is active");
});
