import { describe, expect, test } from "bun:test";
import { pickNewerMissionSnapshot } from "../src/lib/dead-reckoning/queries";
import type { MissionSnapshot } from "../src/lib/dead-reckoning/types";

/** A minimal but fully-typed snapshot, so tests build real objects rather than casts. */
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

describe("pickNewerMissionSnapshot (U02)", () => {
  test("accepts the incoming snapshot when nothing is cached yet", () => {
    const incoming = snapshot({ revision: 1 });
    expect(pickNewerMissionSnapshot(undefined, incoming)).toBe(incoming);
  });

  test("accepts a strictly newer revision", () => {
    const current = snapshot({ revision: 3 });
    const incoming = snapshot({ revision: 4 });
    expect(pickNewerMissionSnapshot(current, incoming)).toBe(incoming);
  });

  test("never lets an older revision overwrite a newer one (out-of-order/missing SSE hint)", () => {
    const current = snapshot({ revision: 5, status: "blocked", blockedReason: "campsite closed" });
    const stale = snapshot({ revision: 2, status: "executing" });
    const result = pickNewerMissionSnapshot(current, stale);
    expect(result).toBe(current);
    expect(result.status).toBe("blocked");
    expect(result.revision).toBe(5);
  });

  test("a duplicate/equal revision does not regress — the incoming (freshly confirmed) read wins the tie", () => {
    const current = snapshot({ revision: 5, updatedAt: "2026-09-26T00:00:00.000Z" });
    const incoming = snapshot({ revision: 5, updatedAt: "2026-09-26T00:00:05.000Z" });
    expect(pickNewerMissionSnapshot(current, incoming)).toBe(incoming);
  });

  test("repeated older responses (a reconnect racing several stale polls) never regress the view", () => {
    const current = snapshot({ revision: 10 });
    let result = current;
    for (const staleRevision of [1, 9, 3, 7]) {
      result = pickNewerMissionSnapshot(result, snapshot({ revision: staleRevision }));
    }
    expect(result).toBe(current);
    expect(result.revision).toBe(10);
  });
});
