// Live-demo blocker: an ambiguous mission_events insert (timeout / 500 / bad ack) leaves a parent-retained pending
// append. The actor must resolve it by original id/hash before the next revision, and the runner's identical row
// retry must reuse that event (never a duplicate). Real actor + RawTreeEventLog over FakeRawTree, no child.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AckMode } from "@dr/storage";
import type { ConfigOf } from "@dr/shared";
import { FakeRawTree, RawTreeClient, RawTreeEventLog, restoreFromEvents } from "@dr/storage";
import { MissionActor } from "../src/actor.ts";

let fake: FakeRawTree; let client: RawTreeClient; let cfg: ConfigOf<"control">;
beforeAll(async () => {
  fake = await new FakeRawTree().start();
  client = new RawTreeClient({ baseUrl: fake.url, apiKey: fake.apiKey, database: "deadreckoning", timeoutMs: 300 });
  cfg = {
    RAWTREE_API_KEY: fake.apiKey, RAWTREE_DATABASE: "deadreckoning", RAWTREE_BASE_URL: fake.url, NIMBLE_API_KEY: "x", OPENAI_API_KEY: "x",
    DR_PLANNER_MODEL: "x", DR_LIQUID_BASE_URL: "http://127.0.0.1:9/v1", DR_LIQUID_MODEL: "x", DR_PLANNER_CONTEXT_BUDGET: 6000, DR_CONTROL_PORT: 4400,
    DR_WORLD_BASE_URL: "http://127.0.0.1:9", DR_WORLD_TOKEN: "w", DR_OPERATOR_TOKEN: "o", DR_INTERNAL_TOKEN: "i", DR_ENABLE_DEMO_CONTROLS: true,
  } as ConfigOf<"control">;
});
afterAll(async () => { await fake.stop(); });

const fact = (id: string, key: string, ts: string) => ({
  run_id: id, arm: "dr", ts, epoch: 1, rev: 0, key, value: JSON.stringify("open"), source_url: null, observed_at: ts, volatile: true,
  status: "active", nimble_request_id: "task-1", world_version: 1,
});

describe("pending mission_events append is resolved, never wedges the mission", () => {
  it.each<[AckMode, string]>([
    ["http500", "insert failed; resolve re-sends the identical event"],
    ["hang", "insert timed out; resolve re-sends the identical event"],
    ["wrong-count", "insert landed with an ambiguous ack; resolve finds it by id/hash"],
  ])("%s: %s → mission continues, exactly one event for that payload", async (mode) => {
    const events = new RawTreeEventLog(client, { visibilityDeadlineMs: 1000, pollMs: 50 });
    const actor = new MissionActor(cfg, "http://127.0.0.1:9", { events, checkpoints: false, pendingResolveMs: 1500 });
    const id = String((await actor.createMission({ commandId: `cmd-pend-${mode}`, ownerId: "u", goal: "g" })).body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    await actor.appendRow(who, "facts", fact(id, "site-A.status", "2026-09-26T01:00:00.000Z"));
    const before = events.watermark(id);

    fake.failNext("mission_events", mode);
    const row = fact(id, "site-B.status", "2026-09-26T01:00:01.000Z");
    await expect(actor.appendRow(who, "facts", row)).rejects.toThrow(); // runner sees 503
    expect(events.pending(id)).not.toBeNull();

    // the runner's Journal retries the identical row: resolved pending event is reused, the mirror is written once
    const r = await actor.appendRow(who, "facts", row);
    expect(r.inserted).toBe(1);
    expect(events.pending(id)).toBeNull();
    expect(events.watermark(id)).toBe(before + 1);
    // and the mission keeps going
    await actor.appendRow(who, "facts", fact(id, "site-C.status", "2026-09-26T01:00:02.000Z"));
    expect(events.watermark(id)).toBe(before + 2);

    const stored = fake.rows("mission_events", id);
    const ids = new Set(stored.map((x) => x.event_id));
    const forRow = stored.filter((x) => String(x.payload).includes("site-B.status"));
    expect(new Set(forRow.map((x) => x.event_id)).size).toBe(1); // one logical event (identical copies dedupe on replay)
    expect(fake.rows("facts", id).filter((x) => x.key === "site-B.status")).toHaveLength(1);
    const restored = await restoreFromEvents(client, id, { watermark: events.watermark(id) });
    expect(restored.revision).toBe(events.watermark(id));
    expect(Object.keys(restored.projection.facts).sort()).toEqual(["site-A.status", "site-B.status", "site-C.status"]);
    expect(ids.size).toBe(events.watermark(id));
  });

  it("an append that stays unresolved suspends the mission (AckError), with no new revision assigned", async () => {
    const events = new RawTreeEventLog(client, { visibilityDeadlineMs: 300, pollMs: 50 });
    const actor = new MissionActor(cfg, "http://127.0.0.1:9", { events, checkpoints: false, pendingResolveMs: 600 });
    const id = String((await actor.createMission({ commandId: "cmd-pend-stuck", ownerId: "u", goal: "g" })).body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    const w = events.watermark(id);
    fake.ackMode = "hang"; // every insert (including resolve's re-send) times out
    try {
      await expect(actor.appendRow(who, "facts", fact(id, "site-A.status", "2026-09-26T02:00:00.000Z"))).rejects.toThrow();
      await expect(actor.appendRow(who, "facts", fact(id, "site-A.status", "2026-09-26T02:00:00.000Z"))).rejects.toThrow(/unresolved/);
      expect(events.watermark(id)).toBe(w);
    } finally { fake.ackMode = "ok"; }
    // once storage recovers, the same retry resolves and continues
    await actor.appendRow(who, "facts", fact(id, "site-A.status", "2026-09-26T02:00:00.000Z"));
    expect(events.watermark(id)).toBe(w + 1);
  });
});
