import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import { missionKeys, missionQueryOptions } from "../src/lib/dead-reckoning/queries";
import type { MissionSnapshot } from "../src/lib/dead-reckoning/types";

/**
 * Exercises `missionQueryOptions`'s wired `queryFn` end to end — real `fetch` mocked at the HTTP
 * boundary, real `QueryClient` cache — rather than only the extracted pure function, so a future
 * change that forgets to call `pickNewerMissionSnapshot` inside the `queryFn` itself would still
 * fail here even if the pure function's own tests kept passing.
 */
function snapshot(overrides: Partial<MissionSnapshot> = {}): MissionSnapshot {
  return {
    missionId: "m1",
    revision: 1,
    updatedAt: "2026-09-26T00:00:00.000Z",
    status: "executing",
    reconciliationStatus: "none",
    blockedReason: null,
    arm: "dr",
    epoch: 1,
    worker: { pid: 1234, state: "running", generation: 1, lastExit: null },
    availability: { rawtree: "ok", desk: "ok" },
    constraints: [],
    plan: [],
    commitments: [],
    receipts: [],
    facts: [],
    context: { items: [], tokens: null, lastOps: [] },
    verdict: null,
    ...overrides,
  };
}

let originalFetch: typeof fetch;
let nextResponse: MissionSnapshot;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => Response.json(nextResponse)) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("missionQueryOptions queryFn (U02, wired)", () => {
  test("a fresh fetch after a reload (empty cache) shows the current canonical snapshot, not a stale success message (U01)", async () => {
    const queryClient = new QueryClient();
    nextResponse = snapshot({ revision: 9, status: "blocked", blockedReason: "campsite closed at v2" });
    const result = await missionQueryOptions("m1", queryClient).queryFn?.({
      queryKey: missionKeys.detail("m1"),
      meta: undefined,
      client: queryClient,
      signal: new AbortController().signal,
    } as never);
    expect(result).toEqual(nextResponse);
  });

  test("a stale response after a newer one is already cached does not regress the mission (U02)", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(missionKeys.detail("m1"), snapshot({ revision: 5, status: "blocked" }));
    nextResponse = snapshot({ revision: 2, status: "executing" }); // an out-of-order/racing response
    const result = await missionQueryOptions("m1", queryClient).queryFn?.({
      queryKey: missionKeys.detail("m1"),
      meta: undefined,
      client: queryClient,
      signal: new AbortController().signal,
    } as never);
    expect(result).toEqual(snapshot({ revision: 5, status: "blocked" }));
  });

  test("a genuinely newer response replaces the cached one", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(missionKeys.detail("m1"), snapshot({ revision: 5 }));
    nextResponse = snapshot({ revision: 6, status: "valid" });
    const result = await missionQueryOptions("m1", queryClient).queryFn?.({
      queryKey: missionKeys.detail("m1"),
      meta: undefined,
      client: queryClient,
      signal: new AbortController().signal,
    } as never);
    expect(result).toEqual(nextResponse);
  });
});
