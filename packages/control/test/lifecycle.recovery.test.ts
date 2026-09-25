// R06–R11 through the REAL control actor + HTTP handler with REAL runner children (fixtures/booking-child.ts),
// FakeRawTree and the real desk on loopback. Cancellation/pause races use the named crash points as barriers.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { REPO_ROOT, actionKey, canTransition, type ConfigOf, type CrashPoint, type MissionStatus } from "@dr/shared";
import { FakeRawTree } from "@dr/storage";
import { startDesk, type RunningDesk } from "@dr/desk";
import { f3FerryStep } from "@dr/kernel";
import { MissionActor } from "../src/actor.ts";
import { MemoryEventLog } from "../src/memory-event-log.ts";
import { createControlHandler, type DemoOps } from "../src/server.ts";

const W = "lc-world", O = "lc-operator", I = "lc-internal";
const CHILD = resolve(REPO_ROOT, "packages/control/test/fixtures/booking-child.ts");
let fake: FakeRawTree; let desk: RunningDesk; let cfg: ConfigOf<"control">;
const servers: Server[] = [];
const actors: MissionActor[] = [];
const ops: DemoOps = { enabled: true, world: async () => ({}), reset: async () => ({}), statusUrl: async () => "http://127.0.0.1:9/status.html" };

async function control(events = new MemoryEventLog()): Promise<{ actor: MissionActor; events: MemoryEventLog; url: string }> {
  let handler: (req: IncomingMessage, res: ServerResponse) => void = (_q, s) => { s.writeHead(503).end(); };
  const server = createServer((q, s) => handler(q, s));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const actor = new MissionActor(cfg, url, { events, runnerMain: CHILD, reconcile: { polls: 2, intervalMs: 100 } });
  handler = createControlHandler({ actor, cfg, ops });
  servers.push(server); actors.push(actor);
  return { actor, events, url };
}

beforeAll(async () => {
  fake = await new FakeRawTree().start();
  desk = await startDesk({ worldToken: W, operatorToken: O, port: 0, feedPort: null });
  cfg = {
    RAWTREE_API_KEY: fake.apiKey, RAWTREE_DATABASE: "deadreckoning", RAWTREE_BASE_URL: fake.url, NIMBLE_API_KEY: "x", OPENAI_API_KEY: "x",
    DR_PLANNER_MODEL: "x", DR_LIQUID_BASE_URL: "http://127.0.0.1:9/v1", DR_LIQUID_MODEL: "x", DR_PLANNER_CONTEXT_BUDGET: 6000, DR_CONTROL_PORT: 4400,
    DR_WORLD_BASE_URL: desk.url, DR_WORLD_TOKEN: W, DR_OPERATOR_TOKEN: O, DR_INTERNAL_TOKEN: I, DR_ENABLE_DEMO_CONTROLS: true,
  } as ConfigOf<"control">;
});
afterEach(async () => { for (const a of actors) await a.kill(true); });
afterAll(async () => {
  for (const s of servers) { s.closeAllConnections(); await new Promise((r) => s.close(r)); }
  await desk.close(); await fake.stop();
});

let seq = 0;
const cid = (tag: string) => `cmd-${tag}-${(++seq).toString().padStart(4, "0")}`;
async function waitFor(pred: () => boolean, ms = 15_000, what = "condition") {
  const t0 = Date.now();
  while (!pred()) { if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 25)); }
}
async function prepared(actor: MissionActor, point: CrashPoint | null, holdMs: number) {
  const c = await actor.createMission({ commandId: cid("create"), ownerId: "user-1", goal: "F3" });
  const id = String(c.body.missionId);
  if (point) expect((await actor.command(id, { commandId: cid("arm"), kind: "arm_crash", args: { point } })).http).toBe(202);
  process.env.DR_HOLD_MS = String(holdMs);
  const key = (() => { const f = f3FerryStep(); return actionKey(id, f.step_id, f.resource, f.date, f.party); })();
  return { id, key, m: () => actor.byId.get(id)! };
}
const resume = (actor: MissionActor, id: string, commandId = cid("resume")) => actor.command(id, { commandId, kind: "resume", expectedRevision: actor.revision(id) });
const stop = (actor: MissionActor, id: string, kind: "pause" | "cancel") => actor.command(id, { commandId: cid(kind), kind, expectedRevision: actor.revision(id) });
function assertGone(pid: number) {
  let err: NodeJS.ErrnoException | null = null;
  try { process.kill(pid, 0); } catch (e) { err = e as NodeJS.ErrnoException; }
  expect(err?.code).toBe("ESRCH");
}

describe("R06: repeated Resume while the child is alive", () => {
  it("one worker generation; duplicate command returns the same result; a new resume is WORKER_ACTIVE", async () => {
    const { actor } = await control();
    const { id, m } = await prepared(actor, "after_desk_commit", 60_000);
    const rev0 = actor.revision(id);
    const first = await resume(actor, id, "cmd-r06-first");
    expect(first.http).toBe(202);
    await waitFor(() => m().state === "holding", 15_000, "HOLD");
    const pid = m().pid;
    const again = await resume(actor, id);
    expect(again.http).toBe(409);
    expect(again.body.code).toBe("WORKER_ACTIVE");
    const dup = await actor.command(id, { commandId: "cmd-r06-first", kind: "resume", expectedRevision: rev0 });
    expect(dup).toEqual(first);
    expect(m().generation).toBe(1);
    expect(m().pid).toBe(pid);
  });
});

describe("R07/R09: cancel races a dispatch claim", () => {
  it("R07 cancel-before-claim → no claim, zero POSTs at the desk", async () => {
    const { actor, events } = await control();
    const { id, m } = await prepared(actor, "after_intent", 1_500);
    await resume(actor, id);
    await waitFor(() => m().state === "holding", 15_000, "hold at after_intent");
    const c = await stop(actor, id, "cancel");
    expect(c.http).toBe(202);
    expect(c.body.status).toBe("cancelled");
    await m().exited;
    expect(m().lastExit?.code).toBe(0);
    expect(desk.store.ledger({ run_id: id }).requests).toHaveLength(0);
    expect(events.list(id).some((e) => e.type === "DISPATCH_CLAIMED")).toBe(false);
    expect(actor.byId.get(id)!.meta.status).toBe("cancelled");
  });

  it("R07/R09 claim-before-cancel → original attempt settles, late receipt recorded, new claims refused, then cancelled", async () => {
    const { actor, events } = await control();
    const { id, key, m } = await prepared(actor, "after_claim", 1_500);
    await resume(actor, id);
    await waitFor(() => m().state === "holding", 15_000, "hold at after_claim");
    expect(events.list(id).filter((e) => e.type === "DISPATCH_CLAIMED").map((e) => e.payload.actionKey)).toEqual([key]);
    const c = await stop(actor, id, "cancel");
    expect(c.body).toMatchObject({ status: "cancelling", unresolvedClaims: [key] });
    // no subsequent claim while cancelling (another slot/key from the same generation)
    const late = await actor.claimDispatch({ run_id: id, arm: "dr" }, { actionKey: "c".repeat(64), argsHash: "d".repeat(64), slot: "campsite", epoch: 1 });
    expect(late.http).toBe(409);
    expect(late.body.code).toBe("DISPATCH_REFUSED");
    await m().exited;
    const l = desk.store.ledger({ run_id: id });
    expect(l.requests).toHaveLength(1);
    expect(l.outcomes).toMatchObject([{ action_key: key, committed: true }]);
    expect(fake.rows("receipts", id)).toMatchObject([{ action_key: key, outcome: "committed" }]);
    await waitFor(() => m().meta.status === "cancelled", 5_000, "cancelled");
    expect(m().meta.reconciliationStatus).toBe("none");
    expect(events.list(id).filter((e) => e.type === "DISPATCH_CLAIMED")).toHaveLength(1);
  });
});

describe("R10: claim, kill before HTTP, cancel, absent lookup (real subprocess)", () => {
  it("no recovery POST; unknown stays visibly blocked while cancelling; no false not_executed/cancelled; Resume rejected", async () => {
    const { actor } = await control();
    const { id, key, m } = await prepared(actor, "after_claim", 60_000);
    await resume(actor, id);
    await waitFor(() => m().state === "holding", 15_000, "hold at after_claim");
    const [k] = await actor.kill(true);
    expect(k!.signal).toBe("SIGKILL");
    assertGone(k!.pid!);
    const c = await stop(actor, id, "cancel");
    expect(c.body.status).toBe("cancelling");
    await waitFor(() => m().meta.reconciliationStatus === "blocked", 10_000, "reconciliation blocked");
    expect(m().meta.status).toBe("cancelling");
    expect(m().meta.blockedReason).toMatch(/outcome unknown/);
    const statuses = fake.rows("commitments", id).filter((r) => r.action_key === key).map((r) => r.status);
    expect(statuses).toEqual(["intent", "unknown"]);
    expect(desk.store.ledger({ run_id: id }).requests).toHaveLength(0);
    const r = await resume(actor, id);
    expect(r.body.code).toBe("INVALID_TRANSITION");
    expect(m().generation).toBe(1);
    const snap = actor.missionSnapshot(id)!;
    expect(snap).toMatchObject({ status: "cancelling", reconciliationStatus: "blocked", worker: { pid: null } });
  });
});

describe("R11: pause, runner exit, absent lookup, explicit Resume", () => {
  it("no retry before Resume; after restore/reconcile only the original key/args is sent once", async () => {
    const { actor } = await control();
    const { id, key, m } = await prepared(actor, "after_claim", 60_000);
    await resume(actor, id);
    await waitFor(() => m().state === "holding", 15_000, "hold at after_claim");
    await actor.kill(true);
    const p = await stop(actor, id, "pause");
    expect(p.body.status).toBe("pausing");
    await waitFor(() => m().meta.reconciliationStatus === "blocked", 10_000, "reconciliation blocked");
    await new Promise((r) => setTimeout(r, 300));
    expect(desk.store.ledger({ run_id: id }).requests).toHaveLength(0);
    expect(m().meta.status).toBe("pausing");
    // explicit Resume (admitted from pausing once the child is confirmed exited)
    process.env.DR_HOLD_MS = "1";
    const r = await resume(actor, id);
    expect(r.http).toBe(202);
    await waitFor(() => m().generation === 2 && !actor.childActive(m()), 20_000, "second generation exit");
    expect(m().lastExit?.code).toBe(0);
    const l = desk.store.ledger({ run_id: id });
    expect(l.requests).toHaveLength(1);
    expect(l.outcomes).toMatchObject([{ action_key: key, committed: true }]);
    const statuses = fake.rows("commitments", id).filter((x) => x.action_key === key).map((x) => x.status);
    expect(statuses).toEqual(["intent", "unknown", "not_executed", "intent", "confirmed"]);
  });
});

describe("R08: parent loses ownership/watermark metadata", () => {
  it("a fresh control process refuses to resume an existing mission (CONTROL_RECOVERY_REQUIRED); unknown id → 404", async () => {
    const a = await control();
    const { id, m } = await prepared(a.actor, null, 1);
    await resume(a.actor, id);
    await waitFor(() => m().generation === 1 && !a.actor.childActive(m()), 20_000, "first generation exit");
    expect(fake.rows("commitments", id).length).toBeGreaterThan(0);
    const b = await control(); // new actor, empty memory event log: no ownership metadata
    const h = { authorization: `Bearer ${I}`, "x-dr-actor-id": "user-1", "content-type": "application/json" };
    const r = await fetch(`${b.url}/missions/${id}/resume`, { method: "POST", headers: h, body: JSON.stringify({ commandId: cid("r08"), expectedRevision: 0 }) });
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ code: "CONTROL_RECOVERY_REQUIRED", missionId: id });
    const g = await fetch(`${b.url}/missions/f3-20260926-none`, { headers: h });
    expect(g.status).toBe(404);
    expect(b.actor.byId.size).toBe(0);
    expect(desk.store.ledger({ run_id: id }).requests).toHaveLength(1);
  });
});

/** Every status event in the log is an allowed hop (finer status never skips the transition table). */
function assertStatusChain(events: MemoryEventLog, id: string) {
  const hops = events.list(id).filter((e) => typeof e.payload.to === "string" && e.payload.from !== e.payload.to)
    .map((e) => [e.payload.from, e.payload.to] as [MissionStatus, MissionStatus]);
  for (const [from, to] of hops) expect(canTransition(from, to, { childExited: to === "queued" }), `${from} → ${to}`).toBe(true);
  return hops.map(([, to]) => to);
}

describe("finer status + per-action review (U04, U06) through HTTP", () => {
  it("claim refused WAITING_APPROVAL until an accepted approval binds exactly this commitment; then exactly one effect", async () => {
    const { actor, events, url } = await control();
    const c = await actor.createMission({ commandId: cid("create"), ownerId: "user-1", goal: "F3", review: "per_action" });
    const id = String(c.body.missionId);
    const m = () => actor.byId.get(id)!;
    const f = f3FerryStep();
    const key = actionKey(id, f.step_id, f.resource, f.date, f.party);
    const h = (actorId = "user-1") => ({ authorization: `Bearer ${I}`, "x-dr-actor-id": actorId, "content-type": "application/json" });
    const post = async (path: string, body: unknown, actorId?: string) => {
      const r = await fetch(`${url}${path}`, { method: "POST", headers: h(actorId), body: JSON.stringify(body) });
      return { status: r.status, body: (await r.json()) as Record<string, unknown> };
    };
    process.env.DR_HOLD_MS = "1";
    await resume(actor, id);
    await waitFor(() => m().generation === 1 && !actor.childActive(m()), 20_000, "generation 1 exit");
    expect(m().meta.status).toBe("waiting_approval");
    expect(desk.store.ledger({ run_id: id }).requests).toHaveLength(0);
    const list = await (await fetch(`${url}/missions/${id}/approvals`, { headers: h() })).json() as { approvals: { approvalId: string; bindingHash: string; actionKey: string; status: string; planRevision: number }[] };
    expect(list.approvals).toHaveLength(1);
    const ap = list.approvals[0]!;
    expect(ap).toMatchObject({ actionKey: key, status: "awaiting_review", planRevision: 0 });
    const path = `/missions/${id}/approvals/${ap.approvalId}`;
    // U04: stale/replayed card → no action
    expect((await post(path, { commandId: cid("ap"), decision: "accept", displayedBindingHash: "0".repeat(64), expectedPlanRevision: 0 })).body.code).toBe("APPROVAL_CHANGED");
    expect((await post(path, { commandId: cid("ap"), decision: "accept", displayedBindingHash: ap.bindingHash, expectedPlanRevision: 1 })).body.code).toBe("REVISION_CONFLICT");
    expect((await post(path, { commandId: cid("ap"), decision: "accept", displayedBindingHash: ap.bindingHash, expectedPlanRevision: 0 }, "user-2")).status).toBe(403);
    expect(events.list(id).filter((e) => e.type === "APPROVAL_DECIDED")).toHaveLength(0);
    const acceptId = cid("ap");
    const ok = await post(path, { commandId: acceptId, decision: "accept", displayedBindingHash: ap.bindingHash, expectedPlanRevision: 0 });
    expect(ok).toMatchObject({ status: 200, body: { status: "accepted", approvalId: ap.approvalId } });
    expect(await post(path, { commandId: acceptId, decision: "accept", displayedBindingHash: ap.bindingHash, expectedPlanRevision: 0 })).toEqual(ok);
    expect((await post(path, { commandId: cid("ap"), decision: "reject", displayedBindingHash: ap.bindingHash, expectedPlanRevision: 0 })).body.code).toBe("APPROVAL_CHANGED");
    // U06: the accepted approval does not cover another action key/slot with otherwise identical args
    const intent = events.list(id).find((e) => e.type === "INTENT_RECORDED")!.payload.row as Record<string, unknown>;
    const otherKey = "e".repeat(64);
    await actor.appendRow({ run_id: id, arm: "dr" }, "commitments", { ...intent, action_key: otherKey, slot: "permit", resource: "permit", rev: 0 });
    const replay = await actor.claimDispatch({ run_id: id, arm: "dr" }, { actionKey: otherKey, argsHash: String(intent.args_hash), slot: "permit", epoch: 1 });
    expect(replay.http).toBe(409);
    expect(replay.body.code).toBe("WAITING_APPROVAL");
    expect(replay.body.approvalId).not.toBe(ap.approvalId);
    expect(events.list(id).some((e) => e.type === "DISPATCH_CLAIMED")).toBe(false);
    // explicit Resume: restore/reconcile, same key/args, now covered → one effect
    await resume(actor, id);
    await waitFor(() => m().generation === 2 && !actor.childActive(m()), 20_000, "generation 2 exit");
    const l = desk.store.ledger({ run_id: id });
    expect(l.requests).toHaveLength(1);
    expect(l.outcomes).toMatchObject([{ action_key: key, committed: true }]);
    const chain = assertStatusChain(events, id);
    expect(chain).toContain("waiting_approval");
    expect(chain).toContain("executing");
  });

  it("claim-driven executing status walks the table (restoring → … → executing), never skipping", async () => {
    const { actor, events } = await control();
    const { id, m } = await prepared(actor, null, 1);
    await resume(actor, id);
    await waitFor(() => m().generation === 1 && !actor.childActive(m()), 20_000, "exit");
    expect(assertStatusChain(events, id)).toEqual(["queued", "restoring", "reconciling", "revalidating", "planning", "executing"]);
    const snap = actor.missionSnapshot(id)!;
    expect(snap.status).toBe("executing");
    await actor.probeDesk();
    expect(actor.missionSnapshot(id)!.availability.desk).toBe("ok");
  });
});

describe("F2: kill after_intent → operator world edit while stopped → Resume", () => {
  it("retry with changed preconditions is not resent: step blocked precondition_changed, mission BLOCKED, 0 desk requests, exit 0", async () => {
    const { actor, events } = await control();
    const { id, key, m } = await prepared(actor, "after_intent", 60_000);
    await resume(actor, id);
    await waitFor(() => m().state === "holding", 15_000, "hold at after_intent");
    const [k] = await actor.kill(true);
    expect(k!.signal).toBe("SIGKILL");
    const wv = desk.store.editWorld("site-A", "closed", "closure while stopped").world_version;
    try {
      expect(wv).toBeGreaterThan(1);
      expect((await resume(actor, id)).http).toBe(202);
      await waitFor(() => m().generation === 2 && !actor.childActive(m()), 20_000, "generation 2 exit");
      expect(m().lastExit?.code).toBe(0);
      await waitFor(() => m().meta.status === "blocked", 5_000, "blocked");
      expect(m().meta.blockedReason).toMatch(/precondition_changed/);
      expect(desk.store.ledger({ run_id: id }).requests).toHaveLength(0);
      const statuses = fake.rows("commitments", id).filter((r) => r.action_key === key).map((r) => r.status);
      expect(statuses).toEqual(["intent", "not_executed"]);
      expect(fake.rows("plan_steps", id).at(-1)).toMatchObject({ step_id: "ferry", status: "blocked" });
      assertStatusChain(events, id);
    } finally {
      desk.store.editWorld("site-A", "open", "");
    }
  });
});
