// S11: an evidence/mirror write is interrupted, and yet:
//   (a) a published canonical reference (the row carried inside the accepted event) still resolves via
//       restoreFromEvents even when its legacy mirror write failed;
//   (b) a failed CANONICAL append never reaches the mirror write at all, so it leaves no orphaned/unreferenced
//       legacy row (CONTRACTS §4: "a failed canonical append may leave an unreferenced evidence row, which is
//       safe" -- this implementation is stricter still: the mirror is only attempted after the canonical append
//       already succeeded, so a canonical failure leaves nothing in the legacy table at all);
//   (c) a legacy mirror (row table) write failure for an already-accepted event -- including CONTEXT_EDIT_DECIDED
//       -- does not lose that event: replay from mission_events still contains it, and an identical retry (the
//       runner's Journal resends the same row) reuses the accepted event rather than duplicating it, then finishes
//       the mirror write once.
// Real MissionActor + RawTreeEventLog over FakeRawTree, no child (see pending-append.test.ts for the same setup).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
const contextOp = (id: string, key: string, ts: string) => ({
  run_id: id, arm: "dr", ts, epoch: 1, rev: 0, step: "curate", op: "evict", key, reason: "stale evidence superseded", proposed_by: "rule", accepted: true,
});

function actorFor() {
  const events = new RawTreeEventLog(client, { visibilityDeadlineMs: 1000, pollMs: 50 });
  const actor = new MissionActor(cfg, "http://127.0.0.1:9", { events, checkpoints: false, pendingResolveMs: 1500 });
  return { events, actor };
}

describe("S11: evidence/mirror write interruption", () => {
  it("(a)+(c) a facts mirror failure does not lose the accepted event; replay still contains it; retry reuses it once", async () => {
    const { events, actor } = actorFor();
    const id = String((await actor.createMission({ commandId: "cmd-s11a", ownerId: "u", goal: "g" })).body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    const before = events.watermark(id);

    fake.failNext("facts", "http500"); // the legacy MIRROR write fails; mission_events is unaffected
    const row = fact(id, "site-S11.status", "2026-09-26T03:00:00.000Z");
    await expect(actor.appendRow(who, "facts", row)).rejects.toThrow();

    // (a): the canonical event is durable even though the mirror never got the row
    expect(events.watermark(id)).toBe(before + 1);
    expect(fake.rows("facts", id).some((r) => r.key === "site-S11.status")).toBe(false);
    const restored = await restoreFromEvents(client, id, { watermark: events.watermark(id) });
    expect(restored.projection.facts["site-S11.status"]?.status).toBe("active");

    // (c): an identical retry reuses the already-accepted event (no new revision) and finally lands the mirror row once
    const r2 = await actor.appendRow(who, "facts", row);
    expect(r2.inserted).toBe(1);
    expect(events.watermark(id)).toBe(before + 1);
    expect(fake.rows("facts", id).filter((r) => r.key === "site-S11.status")).toHaveLength(1);
  });

  it("(a)+(c) same guarantee for an accepted CONTEXT_EDIT_DECIDED whose context_ops mirror write fails", async () => {
    const { events, actor } = actorFor();
    const id = String((await actor.createMission({ commandId: "cmd-s11ctx", ownerId: "u", goal: "g" })).body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    const before = events.watermark(id);

    fake.failNext("context_ops", "http500");
    const row = contextOp(id, "site-A.status", "2026-09-26T03:00:01.000Z");
    await expect(actor.appendRow(who, "context_ops", row)).rejects.toThrow();

    // (a): the accepted CONTEXT_EDIT_DECIDED event is durable despite the mirror failure
    expect(events.watermark(id)).toBe(before + 1);
    expect(fake.rows("context_ops", id)).toHaveLength(0);
    const restored = await restoreFromEvents(client, id, { watermark: events.watermark(id) });
    expect(restored.projection.context_ops.some((o) => o.key === "site-A.status" && o.op === "evict" && o.accepted)).toBe(true);

    // (c): identical retry reuses the event, does not duplicate it, and the mirror lands once
    const r2 = await actor.appendRow(who, "context_ops", row);
    expect(r2.inserted).toBe(1);
    expect(events.watermark(id)).toBe(before + 1);
    expect(fake.rows("context_ops", id)).toHaveLength(1);
  });

  it("(b) a failed CANONICAL append never reaches the mirror write: no orphaned legacy row", async () => {
    const { events, actor } = actorFor();
    const id = String((await actor.createMission({ commandId: "cmd-s11b", ownerId: "u", goal: "g" })).body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    const before = events.watermark(id);

    fake.failNext("mission_events", "http500"); // the CANONICAL insert itself fails
    const row = fact(id, "site-S11b.status", "2026-09-26T03:00:02.000Z");
    await expect(actor.appendRow(who, "facts", row)).rejects.toThrow();

    // no new canonical revision, and — because the mirror write is only attempted after a successful canonical
    // append — the legacy table was never touched either: no orphaned/unreferenced mirror row
    expect(events.watermark(id)).toBe(before);
    expect(fake.rows("facts", id).some((r) => r.key === "site-S11b.status")).toBe(false);
    expect(events.pending(id)).not.toBeNull(); // mission suspended until the pending append resolves

    // once storage recovers, the retried row lands cleanly as revision+1 with its mirror
    const r2 = await actor.appendRow(who, "facts", row);
    expect(r2.inserted).toBe(1);
    expect(events.watermark(id)).toBe(before + 1);
    expect(fake.rows("facts", id).filter((r) => r.key === "site-S11b.status")).toHaveLength(1);
  });
});
