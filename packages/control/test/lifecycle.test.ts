// D01–D04 and the dispatch-claim / resume / pause / cancel rules (CONTRACTS §3, §5, §6).
// Pure reducer tests plus the real actor + HTTP handler (FakeRawTree, memory event log, no child processes).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { ConfigOf, MissionMeta } from "@dr/shared";
import { FakeRawTree } from "@dr/storage";
import { MissionActor } from "../src/actor.ts";
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
  const ops: DemoOps = { enabled: true, world: async () => ({}), reset: async () => ({}), statusUrl: async () => "http://127.0.0.1:9/status.html" };
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
