// D01–D04 and the dispatch-claim / resume / pause / cancel rules (CONTRACTS §3, §5, §6).
// Pure reducer tests plus the real actor + HTTP handler (FakeRawTree, memory event log, no child processes).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { ConfigOf, MissionMeta } from "@dr/shared";
import { FakeRawTree } from "@dr/storage";
import { MissionActor, MissionStopped, RowIdentityMismatch } from "../src/actor.ts";
import { replay } from "@dr/storage";
import type { MissionEvent } from "@dr/shared";
import { commandArgsHash, decideCancel, decideClaim, decideCommand, decidePause, decideResume, newMissionMeta, statusPath } from "../src/lifecycle.ts";
import { MemoryEventLog } from "../src/memory-event-log.ts";
import { createControlHandler, type DemoOps } from "../src/server.ts";
import { TRANSITIONS } from "@dr/shared";

const K1 = "a".repeat(64), K2 = "b".repeat(64), H1 = "1".repeat(64), H2 = "2".repeat(64);
const meta = (over: Partial<MissionMeta> = {}): MissionMeta => ({ ...newMissionMeta({ missionId: "m1", ownerId: "u1", batchId: "b", goal: "g" }), ...over });
const claim = (actionKey: string, slot: string) => ({ dispatchId: `d-${actionKey.slice(0, 4)}`, actionKey, argsHash: H1, epoch: 1, revision: 3, slot });

describe("lifecycle reducer", () => {
  it("D02/D03: same commandId + args is a duplicate; different args conflict", () => {
    const cmd = { commandId: "cmd-000001", kind: "pause" as const, missionId: "m1", expectedRevision: 4, args: {} };
    const h = commandArgsHash(cmd);
    const m = meta({ commands: { "cmd-000001": { commandId: "cmd-000001", kind: "pause", argsHash: h, result: { http: 202 }, revision: 5 } } });
    expect(decideCommand(m, cmd, h, 9)).toEqual({ kind: "duplicate", result: { http: 202 } });
    const other = { ...cmd, expectedRevision: 5 };
    const d = decideCommand(m, other, commandArgsHash(other), 9);
    expect(d.kind).toBe("conflict");
    expect(d.kind === "conflict" && d.refusal.code).toBe("COMMAND_CONFLICT");
  });

  it("D04: stale expectedRevision → REVISION_CONFLICT", () => {
    const cmd = { commandId: "cmd-000002", kind: "cancel" as const, missionId: "m1", expectedRevision: 3, args: {} };
    const d = decideCommand(meta({ status: "executing" }), cmd, commandArgsHash(cmd), 4);
    expect(d.kind === "conflict" && d.refusal).toMatchObject({ code: "REVISION_CONFLICT", status: 409 });
    expect(decideCommand(meta(), { ...cmd, expectedRevision: 4 }, "x", 4)).toEqual({ kind: "accept" });
  });

  it("resume rules: active child, cancelling/cancelled/valid/failed rejected; created/paused/pausing/blocked/exited accepted", () => {
    expect(decideResume(meta({ status: "paused" }), true)).toMatchObject({ code: "WORKER_ACTIVE" });
    for (const s of ["cancelling", "cancelled", "valid", "failed"] as const) expect(decideResume(meta({ status: s }), false)).toMatchObject({ code: "INVALID_TRANSITION" });
    for (const s of ["created", "paused", "pausing", "blocked", "restoring", "executing"] as const) expect(decideResume(meta({ status: s }), false)).toEqual({ next: "queued" });
  });

  it("pause/cancel wait (pausing/cancelling) while a claim is unresolved; complete otherwise", () => {
    const withClaim = meta({ status: "executing", claims: { [K1]: claim(K1, "ferry") } });
    expect(decidePause(withClaim)).toEqual({ next: ["pausing"] });
    expect(decideCancel(withClaim)).toEqual({ next: ["cancelling"] });
    expect(decidePause(meta({ status: "executing" }))).toEqual({ next: ["pausing", "paused"] });
    expect(decideCancel(meta({ status: "executing" }))).toEqual({ next: ["cancelling", "cancelled"] });
    expect(decideCancel(meta({ status: "created" }))).toEqual({ next: ["cancelling", "cancelled"] });
    expect(decidePause(meta({ status: "cancelling" }))).toMatchObject({ code: "INVALID_TRANSITION" });
    expect(decideCancel(meta({ status: "valid" }))).toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("claims: refused while pausing/paused/cancelling/cancelled/terminal, for a stale generation, or a busy slot (invariant 13)", () => {
    const req = { actionKey: K1, argsHash: H1, slot: "ferry", epoch: 2, generation: 2, currentGeneration: 2 };
    for (const s of ["pausing", "paused", "cancelling", "cancelled", "valid", "failed", "blocked", "created"] as const) {
      const d = decideClaim(meta({ status: s }), req, 7);
      expect(d.kind === "refuse" && d.refusal.code).toBe("DISPATCH_REFUSED");
    }
    const stale = decideClaim(meta({ status: "executing" }), { ...req, generation: 1 }, 7);
    expect(stale.kind === "refuse" && stale.refusal.code).toBe("STALE_GENERATION");
    const busy = decideClaim(meta({ status: "executing", claims: { [K2]: claim(K2, "ferry") } }), req, 7);
    expect(busy.kind === "refuse" && busy.refusal.code).toBe("SLOT_BUSY");
    const confirmed = decideClaim(meta({ status: "executing" }), { ...req, commitments: { [K2]: { action_key: K2, slot: "ferry", status: "confirmed", kind: "book" } } }, 7);
    expect(confirmed.kind === "refuse" && confirmed.refusal.code).toBe("SLOT_BUSY");
    const conflict = decideClaim(meta({ status: "executing", claims: { [K1]: claim(K1, "ferry") } }), { ...req, argsHash: H2 }, 7);
    expect(conflict.kind === "refuse" && conflict.refusal.code).toBe("ARGS_CONFLICT");
    const again = decideClaim(meta({ status: "executing", claims: { [K1]: claim(K1, "ferry") } }), req, 7);
    expect(again.kind).toBe("existing");
    const g = decideClaim(meta({ status: "restoring" }), req, 7);
    expect(g.kind === "grant" && g.claim).toMatchObject({ actionKey: K1, argsHash: H1, epoch: 2, revision: 7, slot: "ferry" });
    // deterministic dispatch id for the same business action/epoch
    const g2 = decideClaim(meta({ status: "restoring" }), req, 8);
    expect(g2.kind === "grant" && g2.claim.dispatchId).toBe(g.kind === "grant" && g.claim.dispatchId);
  });

  it("statusPath walks the frozen transition table", () => {
    expect(statusPath("restoring", "valid", TRANSITIONS)).toEqual(["reconciling", "revalidating", "planning", "valid"]);
    expect(statusPath("restoring", "blocked", TRANSITIONS)).toEqual(["blocked"]);
    expect(statusPath("cancelled", "valid", TRANSITIONS)).toBeNull();
  });
});

// ---------------------------------------------------------------- actor + HTTP (no child)
const I = "internal-token-test", O = "operator-token-test";
let fake: FakeRawTree; let actor: MissionActor; let events: MemoryEventLog; let server: Server; let base = "";
beforeAll(async () => {
  fake = await new FakeRawTree().start();
  const cfg = {
    RAWTREE_API_KEY: fake.apiKey, RAWTREE_DATABASE: "deadreckoning", RAWTREE_BASE_URL: fake.url, NIMBLE_API_KEY: "x", OPENAI_API_KEY: "x",
    DR_PLANNER_MODEL: "x", DR_LIQUID_BASE_URL: "http://127.0.0.1:9/v1", DR_LIQUID_MODEL: "x", DR_PLANNER_CONTEXT_BUDGET: 6000, DR_CONTROL_PORT: 4400,
    DR_WORLD_BASE_URL: "http://127.0.0.1:9", DR_WORLD_TOKEN: "w", DR_OPERATOR_TOKEN: O, DR_INTERNAL_TOKEN: I, DR_ENABLE_DEMO_CONTROLS: true,
  } as ConfigOf<"control">;
  events = new MemoryEventLog();
  actor = new MissionActor(cfg, "http://127.0.0.1:9", { events });
  const ops: DemoOps = { enabled: true, world: async () => ({}), reset: async () => ({}), statusUrl: async () => "http://127.0.0.1:9/status.html", ledger: async () => [] };
  server = createServer(createControlHandler({ actor, cfg, ops }));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { actor.shutdown(); server.closeAllConnections(); await new Promise((r) => server.close(r)); await fake.stop(); });

const call = async (method: string, path: string, body?: unknown, h: Record<string, string> = { authorization: `Bearer ${I}`, "x-dr-actor-id": "user-1" }) => {
  const r = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json", ...h }, body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body) });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
};

describe("mission REST (actor, memory event log)", () => {
  it("D01: malformed command / unknown kind / bad JSON → 400, no event", async () => {
    expect((await call("POST", "/missions", "{not json")).status).toBe(400);
    expect((await call("POST", "/missions", { commandId: "x" })).body.code).toBe("INVALID_REQUEST");
    expect((await call("POST", "/missions", { commandId: "cmd-d01-aaaa", goal: "g", ownerId: "evil" })).status).toBe(400); // unknown field
    expect(actor.byId.size).toBe(0);
    const c = await call("POST", "/missions", { commandId: "cmd-d01-bbbb", goal: "g" });
    const id = String(c.body.missionId);
    const w = events.watermark(id);
    expect((await call("POST", `/missions/${id}/pause`, { commandId: "cmd-d01-cccc" })).status).toBe(400); // missing expectedRevision
    expect((await call("POST", `/demo/${id}/arm-crash`, { commandId: "cmd-d01-dddd", point: "whenever" }, { authorization: `Bearer ${O}` })).status).toBe(400);
    expect(events.watermark(id)).toBe(w);
  });

  it("auth: no/foreign token 401; internal token without actor 401; wrong owner 403", async () => {
    expect((await call("POST", "/missions", { commandId: "cmd-auth-0001", goal: "g" }, {})).status).toBe(401);
    expect((await call("POST", "/missions", { commandId: "cmd-auth-0001", goal: "g" }, { authorization: `Bearer ${I}` })).status).toBe(401);
    const c = await call("POST", "/missions", { commandId: "cmd-auth-0002", goal: "g" });
    const id = String(c.body.missionId);
    expect((await call("GET", `/missions/${id}`, undefined, { authorization: `Bearer ${I}`, "x-dr-actor-id": "user-2" })).status).toBe(403);
    expect((await call("GET", `/missions/${id}`, undefined, { authorization: `Bearer ${O}` })).status).toBe(200);
  });

  it("create is 201 `created` with no child; D02 duplicate create returns the same mission; D03 conflicting reuse 409", async () => {
    const a = await call("POST", "/missions", { commandId: "cmd-create-01", goal: "Angel Island" });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({ status: "created" });
    const b = await call("POST", "/missions", { commandId: "cmd-create-01", goal: "Angel Island" });
    expect(b).toEqual(a);
    const c = await call("POST", "/missions", { commandId: "cmd-create-01", goal: "Somewhere else" });
    expect(c.status).toBe(409);
    expect(c.body.code).toBe("COMMAND_CONFLICT");
    const snap = await call("GET", `/missions/${a.body.missionId}`);
    expect(snap.body).toMatchObject({ status: "created", reconciliationStatus: "none", worker: { pid: null, generation: 0 } });
    expect(snap.body.revision).toBe(events.watermark(String(a.body.missionId)));
  });

  it("D02/D03/D04 on an existing mission: duplicate pause is idempotent, same id new args 409, stale revision 409", async () => {
    const c = await call("POST", "/missions", { commandId: "cmd-d04-0001", goal: "g" });
    const id = String(c.body.missionId);
    const rev = events.watermark(id);
    // two cancels at the same expected revision: one accepted, the stale one rejected
    const first = await call("POST", `/missions/${id}/cancel`, { commandId: "cmd-d04-0002", expectedRevision: rev });
    expect(first.status).toBe(202);
    expect(first.body.status).toBe("cancelled");
    const w = events.watermark(id);
    const stale = await call("POST", `/missions/${id}/cancel`, { commandId: "cmd-d04-0003", expectedRevision: rev });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ code: "REVISION_CONFLICT", currentRevision: w, missionId: id });
    const dup = await call("POST", `/missions/${id}/cancel`, { commandId: "cmd-d04-0002", expectedRevision: rev });
    expect(dup).toEqual(first);
    const reuse = await call("POST", `/missions/${id}/pause`, { commandId: "cmd-d04-0002", expectedRevision: w });
    expect(reuse.body.code).toBe("COMMAND_CONFLICT");
    expect(events.watermark(id)).toBe(w); // no extra transition from the duplicate/conflict/stale commands
    const resume = await call("POST", `/missions/${id}/resume`, { commandId: "cmd-d04-0004", expectedRevision: w });
    expect(resume.body.code).toBe("INVALID_TRANSITION"); // cancelled mission cannot be resumed
    expect(actor.byId.get(id)!.generation).toBe(0);
  });

  it("arm-crash requires the operator token and records the point; unknown mission 404", async () => {
    const c = await call("POST", "/missions", { commandId: "cmd-arm-0001", goal: "g" });
    const id = String(c.body.missionId);
    expect((await call("POST", `/demo/${id}/arm-crash`, { commandId: "cmd-arm-0002", point: "after_claim" })).status).toBe(401);
    const r = await call("POST", `/demo/${id}/arm-crash`, { commandId: "cmd-arm-0003", point: "after_claim" }, { authorization: `Bearer ${O}` });
    expect(r.status).toBe(202);
    expect(actor.byId.get(id)!.meta.armedCrash).toBe("after_claim");
    expect((await call("GET", "/missions/f3-20260926-zzzz")).status).toBe(404);
    expect(events.list(id).map((e) => e.type)).toEqual(["MISSION_CREATED", "COMMAND_ACCEPTED", "COMMAND_ACCEPTED"]);
  });

  it("dispatch-claim requires a runner token", async () => {
    expect((await call("POST", "/internal/dispatch-claim", { actionKey: K1, argsHash: H1, slot: "ferry", epoch: 1 })).status).toBe(401);
  });
});

describe("evidence, per-mission SSE hints, desk availability", () => {
  const factRow = (id: string, over: Record<string, unknown>) => ({
    run_id: id, arm: "dr", ts: new Date().toISOString(), epoch: 1, rev: 0, key: "site-A.status", value: JSON.stringify("open"),
    source_url: "https://feed.example/status.html", observed_at: "2026-10-08T09:00:00Z", volatile: true, status: "active",
    nimble_request_id: "task-111", world_version: 1, ...over,
  });

  it("GET /missions/:id/evidence/:id returns bounded excerpt + provenance for fact:<key>@<version> and obs:<task_id>; no URL fetch", async () => {
    const c = await call("POST", "/missions", { commandId: "cmd-evid-0001", goal: "g" });
    const id = String(c.body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    await actor.appendRow(who, "facts", factRow(id, {}));
    await actor.appendRow(who, "facts", factRow(id, { key: "site-C.status" }));
    await actor.appendRow(who, "facts", factRow(id, { status: "superseded", excerpt: "superseded by \"closed\" (task task-222)" }));
    await actor.appendRow(who, "facts", factRow(id, { value: JSON.stringify("closed"), nimble_request_id: "direct-333", world_version: 2, observed_at: "2026-10-10T09:00:00Z" }));
    const f = await call("GET", `/missions/${id}/evidence/${encodeURIComponent("fact:site-A.status@v1")}`);
    expect(f.status).toBe(200);
    expect(f.body).toMatchObject({ kind: "fact", provenance: { taskId: "task-111", retrievalMode: "live", worldVersion: 1, status: "superseded", sourceUrl: "https://feed.example/status.html" } });
    expect(String(f.body.excerpt)).toMatch(/site-A.status = "open" · superseded by/);
    const f2 = await call("GET", `/missions/${id}/evidence/${encodeURIComponent("fact:site-A.status@2")}`);
    expect(f2.body).toMatchObject({ provenance: { retrievalMode: "direct", worldVersion: 2, status: "active" } });
    const o = await call("GET", `/missions/${id}/evidence/${encodeURIComponent("obs:task-111")}?maxChars=20`);
    expect(o.body).toMatchObject({ kind: "observation", truncated: true, provenance: { taskId: "task-111" } });
    expect(String(o.body.excerpt)).toHaveLength(20);
    expect((await call("GET", `/missions/${id}/evidence/${encodeURIComponent("https://evil.example/")}`)).status).toBe(404);
    expect((await call("GET", `/missions/${id}/evidence/${encodeURIComponent("fact:site-A.status@v9")}`)).status).toBe(404);
    expect((await call("GET", `/missions/${id}/evidence/x`, undefined, { authorization: `Bearer ${I}`, "x-dr-actor-id": "user-2" })).status).toBe(403);
  });

  it("GET /missions/:id/events streams revision hints for that mission only", async () => {
    const a = String((await call("POST", "/missions", { commandId: "cmd-sse-0001", goal: "g" })).body.missionId);
    const b = String((await call("POST", "/missions", { commandId: "cmd-sse-0002", goal: "g" })).body.missionId);
    const ac = new AbortController();
    const r = await fetch(`${base}/missions/${a}/events`, { headers: { authorization: `Bearer ${I}`, "x-dr-actor-id": "user-1" }, signal: ac.signal });
    expect(r.headers.get("content-type")).toMatch(/text\/event-stream/);
    const reader = r.body!.getReader();
    let text = "";
    const readUntil = async (re: RegExp) => { while (!re.test(text)) { const { value } = await reader.read(); text += new TextDecoder().decode(value); } };
    await readUntil(/"type":"snapshot"/);
    await actor.command(b, { commandId: "cmd-sse-0003", kind: "arm_crash", args: { point: "after_claim" } }); // other mission: no hint
    await actor.command(a, { commandId: "cmd-sse-0004", kind: "arm_crash", args: { point: "after_claim" } });
    await readUntil(/"type":"COMMAND_ACCEPTED"/);
    ac.abort();
    const hints = text.split("\n\n").filter((x) => x.startsWith("id: ")).map((x) => JSON.parse(x.split("data: ")[1]!));
    expect(hints.every((h) => h.missionId === a)).toBe(true);
    expect(hints.at(-1)).toMatchObject({ revision: events.watermark(a), type: "COMMAND_ACCEPTED" });
  });

  it("snapshot availability.desk comes from a short desk probe (unreachable desk → unavailable)", async () => {
    const id = String((await call("POST", "/missions", { commandId: "cmd-desk-0001", goal: "g" })).body.missionId);
    const s = await call("GET", `/missions/${id}`);
    expect(s.body.availability).toMatchObject({ desk: "unavailable" });
  });
});

describe("critic fixes F3, F4, F6a, F8 (actor + HTTP, no child)", () => {
  const base = (id: string) => ({ run_id: id, arm: "dr", ts: "2026-09-26T01:02:03.000Z", epoch: 1, rev: 0 });
  const terminal = (id: string) => ({ ...base(id), reason: "terminal", restored_rows: 0, sim_clock: "x", pid: 1, verdict: "VALID", verdict_reason: "all steps done" });
  const intent = (id: string) => ({ ...base(id), action_key: "f".repeat(64), kind: "book", slot: "ferry", resource: "ferry-tiburon-1009", date: "2026-10-09", party: 2, args_hash: "a".repeat(64), status: "intent", receipt_id: null, reversible: false, compensates: null, reason: "step ferry" });

  it("F3: after cancel, runner intent and terminal verdict rows are refused (MISSION_STOPPED); no MISSION_VALIDATED; replay says cancelled", async () => {
    const id = String((await call("POST", "/missions", { commandId: "cmd-f3-000001", goal: "g" })).body.missionId);
    const c = await call("POST", `/missions/${id}/cancel`, { commandId: "cmd-f3-000002", expectedRevision: events.watermark(id) });
    expect(c.body.status).toBe("cancelled");
    const who = { run_id: id, arm: "dr" as const };
    await expect(actor.appendRow(who, "epochs", terminal(id))).rejects.toBeInstanceOf(MissionStopped);
    await expect(actor.appendRow(who, "commitments", intent(id))).rejects.toBeInstanceOf(MissionStopped);
    expect(events.list(id).some((e) => e.type === "MISSION_VALIDATED" || e.type === "INTENT_RECORDED")).toBe(false);
    expect(replay(id, [], events.list(id), events.watermark(id)).projection.mission?.status).toBe("cancelled");
  });

  it("F3: a runner terminal epochs row is a report event (never MISSION_VALIDATED); status only via setStatus", async () => {
    const id = String((await call("POST", "/missions", { commandId: "cmd-f3-000003", goal: "g" })).body.missionId);
    await actor.appendRow({ run_id: id, arm: "dr" }, "epochs", terminal(id));
    const last = events.list(id).at(-1)!;
    expect(last.type).toBe("MISSION_STATUS_CHANGED");
    const r = replay(id, [], events.list(id), events.watermark(id));
    expect(r.projection.mission?.status).toBe("created");
    expect(r.projection.epochs).toMatchObject([{ reason: "terminal", verdict: "VALID" }]);
  });

  it("F4: Journal retry of the identical row after a mirror failure reuses the acked event revision", async () => {
    const id = String((await call("POST", "/missions", { commandId: "cmd-f4-000001", goal: "g" })).body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    fake.failNext("commitments", "http500");
    await expect(actor.appendRow(who, "commitments", intent(id))).rejects.toThrow();
    const w = events.watermark(id);
    expect(events.list(id).filter((e) => e.type === "INTENT_RECORDED")).toHaveLength(1);
    await actor.appendRow(who, "commitments", intent(id));
    expect(events.watermark(id)).toBe(w);
    expect(events.list(id).filter((e) => e.type === "INTENT_RECORDED")).toHaveLength(1);
    expect(fake.rows("commitments", id)).toHaveLength(1);
  });

  it("F6a: a create retried after a partial append failure finishes the same mission (no second mission)", async () => {
    class FlakyLog extends MemoryEventLog {
      n = 0; failAt = 0;
      override async append(e: MissionEvent) { if (++this.n === this.failAt) throw new Error("injected append failure"); return super.append(e); }
    }
    for (const failAt of [1, 2]) {
      const log = new FlakyLog();
      log.failAt = failAt;
      const a2 = new MissionActor(actor.cfg, "http://127.0.0.1:9", { events: log });
      await expect(a2.createMission({ commandId: `cmd-f6a-${failAt}0000`, ownerId: "u", goal: "g" })).rejects.toThrow();
      const r = await a2.createMission({ commandId: `cmd-f6a-${failAt}0000`, ownerId: "u", goal: "g" });
      expect(r.http).toBe(201);
      expect(a2.byId.size).toBe(1);
      const id = String(r.body.missionId);
      expect([...a2.byId.keys()]).toEqual([id]);
      expect(log.list(id).map((e) => e.type)).toEqual(["MISSION_CREATED", "COMMAND_ACCEPTED"]);
      expect(await a2.createMission({ commandId: `cmd-f6a-${failAt}0000`, ownerId: "u", goal: "g" })).toEqual(r);
    }
  });

  it("F8: GET /missions needs a caller and is owner-filtered; actor id `operator` rejected; row identity mismatch is 403-class", async () => {
    const mine = String((await call("POST", "/missions", { commandId: "cmd-f8-000001", goal: "g" }, { authorization: `Bearer ${I}`, "x-dr-actor-id": "user-f8" })).body.missionId);
    expect((await call("GET", "/missions", undefined, {})).status).toBe(401);
    const list = await call("GET", "/missions", undefined, { authorization: `Bearer ${I}`, "x-dr-actor-id": "user-f8" });
    expect((list.body.missions as { run_id: string }[]).map((x) => x.run_id)).toEqual([mine]);
    expect((await call("GET", "/missions", undefined, { authorization: `Bearer ${I}`, "x-dr-actor-id": "operator" })).status).toBe(401);
    expect((await call("GET", "/missions", undefined, { authorization: `Bearer ${I}x` })).status).toBe(401);
    await expect(actor.appendRow({ run_id: mine, arm: "dr" }, "commitments", { ...intent("f3-20260926-othr") })).rejects.toBeInstanceOf(RowIdentityMismatch);
  });
});

describe("planRevision (invariant 17 binding) + /events operator auth", () => {
  const b = (id: string, ts: string) => ({ run_id: id, arm: "dr", ts, epoch: 1, rev: 0 });
  const stepRow = (id: string, ts: string, over: Record<string, unknown>) => ({ ...b(id, ts), step_id: "campsite", slot: "campsite", resource: "site-A", depends_on: ["site-A.status"], commitment_key: null, status: "pending", reason: "initial plan", ...over });
  const factRow = (id: string, ts: string, key: string, status: string) => ({ ...b(id, ts), key, value: JSON.stringify("open"), source_url: null, observed_at: ts, volatile: true, status, nimble_request_id: "t-1", world_version: 1 });
  const metric = (id: string, ts: string) => ({ ...b(id, ts), step: "campsite", phase: "planner", context_tokens: 10, planner_tokens_in: 10, curator_ms: 0, nimble_ms: 0, duplicate_effects: 0, stale_actions: 0 });

  it("bumps on repair / depended fact replaced / resource change; not on metrics, initial rows or unrelated facts; replay reproduces it", async () => {
    const id = String((await call("POST", "/missions", { commandId: "cmd-plan-0001", goal: "g" })).body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    const pr = () => actor.byId.get(id)!.meta.planRevision;
    await actor.appendRow(who, "plan_steps", stepRow(id, "2026-09-26T03:00:00.000Z", {}));
    await actor.appendRow(who, "facts", factRow(id, "2026-09-26T03:00:01.000Z", "site-A.status", "active"));
    await actor.appendRow(who, "metrics", metric(id, "2026-09-26T03:00:02.000Z"));
    await actor.appendRow(who, "facts", factRow(id, "2026-09-26T03:00:03.000Z", "site-B.status", "superseded")); // no step depends on it
    expect(pr()).toBe(0);
    await actor.appendRow(who, "facts", factRow(id, "2026-09-26T03:00:04.000Z", "site-A.status", "superseded"));
    expect(pr()).toBe(1);
    await actor.appendRow(who, "plan_steps", stepRow(id, "2026-09-26T03:00:05.000Z", { status: "needs_repair", reason: "depends on superseded site-A.status" }));
    expect(pr()).toBe(2);
    await actor.appendRow(who, "metrics", metric(id, "2026-09-26T03:00:06.000Z"));
    await actor.appendRow(who, "plan_steps", stepRow(id, "2026-09-26T03:00:07.000Z", { status: "needs_repair", reason: "still" })); // already needs_repair
    expect(pr()).toBe(2);
    await actor.appendRow(who, "plan_steps", stepRow(id, "2026-09-26T03:00:08.000Z", { resource: "site-C", status: "active" }));
    expect(pr()).toBe(3);
    expect(replay(id, [], events.list(id), events.watermark(id)).projection.mission?.planRevision).toBe(3);
  });

  it("U04: an approval proposed at planRevision N is refused (REVISION_CONFLICT) after a repair bumps it to N+1", async () => {
    const id = String((await call("POST", "/missions", { commandId: "cmd-plan-0002", goal: "g", review: "per_action" })).body.missionId);
    const who = { run_id: id, arm: "dr" as const };
    const ts = "2026-09-26T04:00:00.000Z";
    const key = "9".repeat(64), args = "8".repeat(64);
    await actor.appendRow(who, "plan_steps", stepRow(id, ts, { step_id: "ferry", slot: "ferry", resource: "ferry-tiburon-1009", depends_on: [] }));
    await actor.appendRow(who, "commitments", { ...b(id, "2026-09-26T04:00:01.000Z"), action_key: key, kind: "book", slot: "ferry", resource: "ferry-tiburon-1009", date: "2026-10-09", party: 2, args_hash: args, status: "intent", receipt_id: null, reversible: false, compensates: null, reason: "step ferry" });
    const refused = await actor.claimDispatch(who, { actionKey: key, argsHash: args, slot: "ferry", epoch: 0 });
    expect(refused.body.code).toBe("WAITING_APPROVAL");
    const list = await call("GET", `/missions/${id}/approvals`);
    const ap = (list.body.approvals as { approvalId: string; bindingHash: string; planRevision: number }[])[0]!;
    expect(ap.planRevision).toBe(0);
    await actor.appendRow(who, "plan_steps", stepRow(id, "2026-09-26T04:00:02.000Z", { step_id: "ferry", slot: "ferry", resource: "ferry-tiburon-1009", depends_on: [], status: "needs_repair" }));
    expect((await call("GET", `/missions/${id}/approvals`)).body.planRevision).toBe(1);
    for (const expectedPlanRevision of [0, 1]) {
      const d = await call("POST", `/missions/${id}/approvals/${ap.approvalId}`, { commandId: `cmd-plan-ap-${expectedPlanRevision}`, decision: "accept", displayedBindingHash: ap.bindingHash, expectedPlanRevision });
      expect(d.status).toBe(409);
      expect(d.body.code).toBe("REVISION_CONFLICT");
    }
    expect(events.list(id).some((e) => e.type === "APPROVAL_DECIDED")).toBe(false);
  });

  it("GET /events and /scorecard need the operator: 401 without; 200 with the header or the dr_op session cookie", async () => {
    expect((await fetch(`${base}/events`)).status).toBe(401);
    expect((await fetch(`${base}/scorecard`)).status).toBe(401);
    expect((await fetch(`${base}/events`, { headers: { authorization: `Bearer ${I}`, "x-dr-actor-id": "user-1" } })).status).toBe(401);
    const open = async (h: Record<string, string>) => {
      const ac = new AbortController();
      const r = await fetch(`${base}/events`, { headers: h, signal: ac.signal });
      ac.abort();
      return r.status;
    };
    expect(await open({ authorization: `Bearer ${O}` })).toBe(200);
    expect((await fetch(`${base}/demo/session`, { method: "POST" })).status).toBe(401);
    const s = await fetch(`${base}/demo/session`, { method: "POST", headers: { authorization: `Bearer ${O}` } });
    expect(s.status).toBe(204);
    const cookie = s.headers.get("set-cookie")!;
    expect(cookie).toMatch(/^dr_op=[a-f0-9]{48}; HttpOnly; SameSite=Strict; Path=\//);
    expect(cookie).not.toContain(O);
    expect(await open({ cookie: cookie.split(";")[0]! })).toBe(200);
    expect(await open({ cookie: `dr_op=${"0".repeat(48)}` })).toBe(401);
    expect((await fetch(`${base}/board`)).status).not.toBe(401); // the board page itself stays open (no data)
  });
});

describe("concurrent legacy starts (chat retry / double click)", () => {
  it("only one of two concurrent reserveStart calls wins; the other is refused until release", () => {
    const a = actor.reserveStart(["dr", "naive"]);
    const b = actor.reserveStart(["dr", "naive"]);
    expect("release" in a).toBe(true);
    expect(b).toEqual({ blocker: "a start is already in progress" });
    if ("release" in a) a.release();
    const c = actor.reserveStart(["dr"]);
    expect("release" in c).toBe(true);
    if ("release" in c) c.release();
  });
});
