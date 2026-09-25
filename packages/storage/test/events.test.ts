import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CheckpointConflictError, EventConflictError, PendingAppendError, RestoreGapError,
  canonicalJson, makeEvent, sha256Hex, toStoredEvent, type MissionEvent,
} from "@dr/shared";
import {
  FakeRawTree, RawTreeClient, RawTreeEventLog, applyEvent, emptyProjection, replay, restoreFromEvents,
  writeCheckpoint, loadCheckpoints,
} from "../src/index.ts";

let fake: FakeRawTree;
let client: RawTreeClient;
beforeEach(async () => {
  fake = await new FakeRawTree().start();
  client = new RawTreeClient({ baseUrl: fake.url, apiKey: fake.apiKey, database: "deadreckoning", timeoutMs: 300 });
});
afterEach(async () => { await fake.stop(); });

const rowEvent = (missionId: string, revision: number, table: string, row: Record<string, unknown>): MissionEvent =>
  makeEvent({ missionId, batchId: "batch", arm: "dr", revision, epoch: 1, type: "CONSTRAINT_SET", payload: { table, row } });

const missionCreated = (missionId: string, revision = 1): MissionEvent =>
  makeEvent({ missionId, batchId: "batch", arm: "dr", revision, epoch: 1, type: "MISSION_CREATED", payload: { ownerId: "u1", batchId: "batch", goal: "trip" } });

const statusChanged = (missionId: string, revision: number, status: string): MissionEvent =>
  makeEvent({ missionId, batchId: "batch", arm: "dr", revision, epoch: 1, type: "MISSION_STATUS_CHANGED", payload: { status } });

describe("event-log S01-S10", () => {
  it("S01: identical duplicated event applies once during restore", async () => {
    const run = "ev-s01a-000001";
    const log = new RawTreeEventLog(client);
    const e1 = missionCreated(run, 1);
    await log.append(e1);
    // seed a byte-identical duplicate row directly (simulating a physical dup from a resolved ambiguous ack)
    fake.seed("mission_events", [toStoredEvent(e1)]);
    const r = await restoreFromEvents(client, run, { watermark: 1 });
    expect(r.eventsReplayed).toBe(1);
    expect(r.projection.mission?.ownerId).toBe("u1");
  });

  it("S02: same event id with different hash blocks restore", async () => {
    const run = "ev-s02a-000001";
    const e1 = missionCreated(run, 1);
    const conflicting = { ...toStoredEvent(e1) };
    conflicting.payload_hash = "f".repeat(64);
    conflicting.payload = JSON.stringify({ ownerId: "attacker" });
    fake.seed("mission_events", [toStoredEvent(e1), conflicting]);
    await expect(restoreFromEvents(client, run, { watermark: 1 })).rejects.toBeInstanceOf(EventConflictError);
  });

  it("S03: revision order determines state, not timestamp", () => {
    const run = "ev-s03a-000001";
    const e1 = missionCreated(run, 1);
    const e2 = statusChanged(run, 2, "queued");
    // e3 has an earlier revision-consistent slot but a much LATER wall-clock timestamp than e2 (clock skew)
    const e3 = makeEvent({ missionId: run, batchId: "batch", arm: "dr", revision: 3, epoch: 1, type: "MISSION_STATUS_CHANGED", payload: { status: "planning" } });
    // events array deliberately out of order — restore must still follow revision order, never timestamp
    const r = replay(run, [], [e3, e1, e2], 3);
    expect(r.projection.mission?.status).toBe("planning");
    expect(r.revision).toBe(3);
  });

  it("S04: missing revision (gap) is detected, no partial green snapshot", () => {
    const run = "ev-s04a-000001";
    const e1 = missionCreated(run, 1);
    const e3 = statusChanged(run, 3, "planning");
    expect(() => replay(run, [], [e1, e3], 3)).toThrow(RestoreGapError);
  });

  it("S05: ambiguous ack keeps pending, no new revision until resolved by original id", async () => {
    const run = "ev-s05a-000001";
    const log = new RawTreeEventLog(client, { visibilityDeadlineMs: 300, pollMs: 20 });
    const e1 = missionCreated(run, 1);
    fake.failNext("mission_events", "wrong-count"); // persists the row but acks {inserted:0}
    await expect(log.append(e1)).rejects.toBeInstanceOf(PendingAppendError);
    expect(log.pending(run)?.event.eventId).toBe(e1.eventId);
    expect(log.watermark(run)).toBe(0);
    // further appends are refused while pending is unresolved
    const e2 = statusChanged(run, 2, "queued");
    await expect(log.append(e2)).rejects.toBeInstanceOf(PendingAppendError);
    // the row actually exists (wrong-count still persisted it) — resolve by original id
    expect(await log.resolvePending(run)).toBe("resolved");
    expect(log.watermark(run)).toBe(1);
    expect(log.pending(run)).toBeNull();
  });

  it("S06: acknowledged row not yet visible -> bounded polling, PendingAppendError at deadline", async () => {
    const run = "ev-s06a-000001";
    fake.visibilityDelayMs = 5000; // far beyond the deadline below
    const log = new RawTreeEventLog(client, { visibilityDeadlineMs: 150, pollMs: 20 });
    const e1 = missionCreated(run, 1);
    await expect(log.append(e1)).rejects.toBeInstanceOf(PendingAppendError);
    expect(log.isSuspended(run)).toBe(true);
    expect(log.watermark(run)).toBe(0);
  });

  it("S07: restore paginates across more events than one page", async () => {
    const run = "ev-s07a-000001";
    const events: MissionEvent[] = [missionCreated(run, 1)];
    for (let rev = 2; rev <= 12; rev++) events.push(statusChanged(run, rev, "queued"));
    fake.seed("mission_events", events.map(toStoredEvent));
    const r = await restoreFromEvents(client, run, { watermark: 12, pageSize: 3 });
    expect(r.eventsReplayed).toBe(12);
    expect(r.pages).toBeGreaterThanOrEqual(4);
    expect(r.revision).toBe(12);
  });

  it("S08: duplicate checkpoint dedupes; conflicting content at one revision blocks", () => {
    const run = "ev-s08a-000001";
    const e1 = missionCreated(run, 1);
    const p1 = replay(run, [], [e1], 1).projection;
    const hash1 = sha256Hex(canonicalJson(p1));
    const cpA = { id: "cp-a", missionId: run, revision: 1, schemaVersion: 1, projection: p1, contentHash: hash1, lastEventId: e1.eventId, lastEventHash: e1.payloadHash, ts: "t" };
    const cpADup = { ...cpA };
    // identical retries dedupe fine
    expect(() => replay(run, [cpA, cpADup], [e1], 1)).not.toThrow();
    const differentProjection = { ...p1, epoch: 999 };
    const cpConflict = { ...cpA, projection: differentProjection, contentHash: sha256Hex(canonicalJson(differentProjection)) };
    expect(() => replay(run, [cpA, cpConflict], [e1], 1)).toThrow(CheckpointConflictError);
  });

  it("S09: checkpoint above watermark ignored; wrong boundary event falls back to full replay", () => {
    const run = "ev-s09a-000001";
    const e1 = missionCreated(run, 1);
    const e2 = statusChanged(run, 2, "queued");
    const p1 = replay(run, [], [e1], 1).projection;
    const hash1 = sha256Hex(canonicalJson(p1));
    // checkpoint at revision 2 (above watermark 1) must be ignored entirely
    const cpAbove = { id: "cp-2", missionId: run, revision: 2, schemaVersion: 1, projection: p1, contentHash: hash1, lastEventId: e2.eventId, lastEventHash: e2.payloadHash, ts: "t" };
    const r1 = replay(run, [cpAbove], [e1, e2], 1);
    expect(r1.checkpoint).toBeNull();
    expect(r1.revision).toBe(1);
    // checkpoint at revision 1 whose content hash is valid but boundary event id/hash is wrong: fall back to full replay
    const cpWrongBoundary = { id: "cp-1-wrong", missionId: run, revision: 1, schemaVersion: 1, projection: p1, contentHash: hash1, lastEventId: "ev-not-real", lastEventHash: "0".repeat(64), ts: "t" };
    const r2 = replay(run, [cpWrongBoundary], [e1, e2], 2);
    expect(r2.checkpoint).toBeNull();
    expect(r2.eventsReplayed).toBe(2);
    expect(r2.revision).toBe(2);
  });

  it("S10 (library level): pending survives forget(); delayed visibility resolves exactly once; unresolved stays blocked", async () => {
    const run = "ev-s10a-000001";
    const log = new RawTreeEventLog(client, { visibilityDeadlineMs: 100, pollMs: 20 });
    const e1 = missionCreated(run, 1);
    fake.visibilityDelayMs = 250; // becomes visible shortly AFTER our append's deadline
    await expect(log.append(e1)).rejects.toBeInstanceOf(PendingAppendError);
    log.forget(run); // simulate a projection-cache clear
    expect(log.pending(run)?.event.eventId).toBe(e1.eventId); // pending survives forget
    expect(log.hasOwnership(run)).toBe(true); // ownership still established via pending
    // not yet visible (delay hasn't elapsed) — stays blocked
    expect(await log.resolvePending(run)).toBe("blocked");
    await new Promise((r) => setTimeout(r, 300));
    // now visible — resolves exactly once
    expect(await log.resolvePending(run)).toBe("resolved");
    expect(log.watermark(run)).toBe(1);
    expect(log.pending(run)).toBeNull();
    expect(await log.resolvePending(run)).toBe("none"); // idempotent: nothing left pending
  });
});

describe("checkpoint write/load", () => {
  it("writes and loads a checkpoint that round-trips through restore", async () => {
    const run = "ev-cpwl-000001";
    const log = new RawTreeEventLog(client);
    const e1 = missionCreated(run, 1);
    await log.append(e1);
    const p1 = applyEvent(emptyProjection(run), e1);
    const cp = await writeCheckpoint(client, run, 1, p1, e1);
    const loaded = await loadCheckpoints(client, run, 1);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]!.contentHash).toBe(cp.contentHash);
    const r = await restoreFromEvents(client, run, { watermark: 1 });
    expect(r.checkpoint?.id).toBe(cp.id);
    expect(r.eventsReplayed).toBe(0); // nothing to replay past the checkpoint boundary
    expect(r.projection.mission?.goal).toBe("trip");
  });
});

describe("row-carrying events", () => {
  it("applies constraint rows via the same reducer used live", () => {
    const run = "ev-rows-000001";
    const constraintRow = { run_id: run, ts: "2026-09-26T00:00:00.000Z", epoch: 1, rev: 1, arm: "dr", key: "budget_cents", value: "35000", authority: "user", private: false, version: 1 };
    const e = rowEvent(run, 1, "constraints", constraintRow);
    const p = applyEvent(emptyProjection(run), e);
    expect(p.constraints.budget_cents?.value).toBe("35000");
  });
});
