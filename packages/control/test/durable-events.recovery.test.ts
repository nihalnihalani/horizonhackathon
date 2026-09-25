// Wave 2-I: the control actor on the DURABLE canonical event log (RawTreeEventLog over FakeRawTree HTTP), a real
// runner child (fixtures/booking-child.ts) and a real SIGKILL. Restore reads mission_events (+ checkpoints), not the
// legacy row tables. S10: an ambiguous canonical append that survives child death blocks restore until resolved.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { REPO_ROOT, actionKey, fromStoredEvent, type ConfigOf } from "@dr/shared";
import { FakeRawTree, RawTreeClient, RawTreeEventLog, restoreFromEvents } from "@dr/storage";
import { startDesk, type RunningDesk } from "@dr/desk";
import { f3FerryStep } from "@dr/kernel";
import { MissionActor } from "../src/actor.ts";
import { createControlHandler, type DemoOps } from "../src/server.ts";

const W = "de-world", O = "de-operator", I = "de-internal";
const CHILD = resolve(REPO_ROOT, "packages/control/test/fixtures/booking-child.ts");
let fake: FakeRawTree; let desk: RunningDesk; let cfg: ConfigOf<"control">; let client: RawTreeClient;
const servers: Server[] = [];
const actors: MissionActor[] = [];
const ops: DemoOps = { enabled: true, world: async () => ({}), reset: async () => ({}), statusUrl: async () => "http://127.0.0.1:9/status.html" };

async function control() {
  let handler: (req: IncomingMessage, res: ServerResponse) => void = (_q, s) => { s.writeHead(503).end(); };
  const server = createServer((q, s) => handler(q, s));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const events = new RawTreeEventLog(client, { visibilityDeadlineMs: 1_500, pollMs: 20 });
  const logs: string[] = [];
  const actor = new MissionActor(cfg, url, { events, runnerMain: CHILD, reconcile: { polls: 2, intervalMs: 100 } });
  actor.subscribe((e) => { if (e.type === "log") logs.push(String((e.data as { line: string }).line)); });
  handler = createControlHandler({ actor, cfg, ops });
  servers.push(server); actors.push(actor);
  return { actor, events, logs };
}

beforeAll(async () => {
  fake = await new FakeRawTree().start();
  client = new RawTreeClient({ baseUrl: fake.url, apiKey: fake.apiKey, database: "deadreckoning" });
  desk = await startDesk({ worldToken: W, operatorToken: O, port: 0, feedPort: null });
  cfg = {
    RAWTREE_API_KEY: fake.apiKey, RAWTREE_DATABASE: "deadreckoning", RAWTREE_BASE_URL: fake.url, NIMBLE_API_KEY: "x", OPENAI_API_KEY: "x",
    DR_PLANNER_MODEL: "x", DR_LIQUID_BASE_URL: "http://127.0.0.1:9/v1", DR_LIQUID_MODEL: "x", DR_PLANNER_CONTEXT_BUDGET: 6000, DR_CONTROL_PORT: 4400,
    DR_WORLD_BASE_URL: desk.url, DR_WORLD_TOKEN: W, DR_OPERATOR_TOKEN: O, DR_INTERNAL_TOKEN: I, DR_ENABLE_DEMO_CONTROLS: true,
  } as ConfigOf<"control">;
});
afterAll(async () => {
  for (const a of actors) await a.kill(true);
  for (const s of servers) { s.closeAllConnections(); await new Promise((r) => s.close(r)); }
  await desk.close(); await fake.stop();
});

let seq = 0;
const cid = (t: string) => `cmd-${t}-${(++seq).toString().padStart(4, "0")}`;
async function waitFor(pred: () => boolean, ms = 20_000, what = "condition") {
  const t0 = Date.now();
  while (!pred()) { if (Date.now() - t0 > ms) throw new Error(`timed out waiting for ${what}`); await new Promise((r) => setTimeout(r, 25)); }
}
const storedEvents = (id: string) => fake.rows("mission_events", id).map(fromStoredEvent);

describe("R02 on durable canonical events", () => {
  it("kill after desk commit → restore from mission_events → same receipt recovered, one desk effect, checkpoint written", async () => {
    const { actor, events, logs } = await control();
    const c = await actor.createMission({ commandId: cid("create"), ownerId: "user-1", goal: "F3" });
    const id = String(c.body.missionId);
    const f = f3FerryStep();
    const key = actionKey(id, f.step_id, f.resource, f.date, f.party);
    await actor.command(id, { commandId: cid("arm"), kind: "arm_crash", args: { point: "after_desk_commit" } });
    process.env.DR_HOLD_MS = "60000";
    expect((await actor.command(id, { commandId: cid("resume"), kind: "resume", expectedRevision: actor.revision(id) })).http).toBe(202);
    const m = () => actor.byId.get(id)!;
    await waitFor(() => m().state === "holding", 20_000, "HOLD after desk commit");
    const pid1 = m().pid!;
    const [k] = await actor.kill();
    expect(k).toMatchObject({ pid: pid1, signal: "SIGKILL", alive_after: false });

    // Persistence, not a cached object: intent recorded canonically, no receipt, exactly one desk effect.
    const evs = storedEvents(id);
    expect(evs.some((e) => e.type === "INTENT_RECORDED" && (e.payload.row as { action_key: string }).action_key === key)).toBe(true);
    expect(evs.some((e) => e.type === "DISPATCH_CLAIMED")).toBe(true);
    expect(evs.some((e) => e.payload.table === "receipts")).toBe(false);
    expect(desk.store.ledger({ run_id: id }).outcomes).toHaveLength(1);
    expect(events.watermark(id)).toBe(Math.max(...evs.map((e) => e.revision)));

    process.env.DR_HOLD_MS = "1";
    expect((await actor.command(id, { commandId: cid("resume"), kind: "resume", expectedRevision: actor.revision(id) })).http).toBe(202);
    await waitFor(() => m().generation === 2 && !actor.childActive(m()), 20_000, "generation 2 exit");
    expect(m().pid).not.toBe(pid1);
    expect(logs.some((l) => /RESTORING FROM RAWTREE… \d+ events · epoch \d+ · mission_events rev \d+/.test(l))).toBe(true);

    const r = await restoreFromEvents(client, id, { watermark: events.watermark(id) });
    const receipts = Object.values(r.projection.receipts).filter((x) => x.action_key === key);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ recovered: true, receipt_id: desk.store.ledger({ run_id: id }).outcomes[0]!.receipt_id });
    expect(r.projection.commitments[key]?.status).toBe("confirmed");
    expect(desk.store.ledger({ run_id: id }).requests).toHaveLength(1);
    expect(fake.rows("mission_checkpoints", id).length).toBeGreaterThan(0);
    expect(r.checkpoint).not.toBeNull();
  });
});

describe("S10 through the actor: ambiguous canonical append survives child death", () => {
  it("unresolved pending blocks restore and new revisions; once visible it resolves exactly once", async () => {
    const { actor, events } = await control();
    const c = await actor.createMission({ commandId: cid("create"), ownerId: "user-1", goal: "F3" });
    const id = String(c.body.missionId);
    const before = events.watermark(id);
    // The next canonical append is acked ambiguously (500) but the row lands late and invisible for now.
    fake.failNext("mission_events", "http500");
    const armed = await actor.command(id, { commandId: cid("arm"), kind: "arm_crash", args: { point: "after_intent" } }).catch((e) => e);
    expect(events.pending(id)).not.toBeNull();
    expect(events.watermark(id)).toBe(before);
    // New revisions are refused while pending.
    await expect(actor.command(id, { commandId: cid("again"), kind: "arm_crash", args: { point: "after_claim" } })).rejects.toThrow();
    // Restore is blocked: the 500 stored nothing, so the first resolve retries the SAME identity and it becomes visible.
    const pendingEvent = events.pending(id)!.event;
    const res = await actor.projection(id, "resume").then(() => "restored", (e: Error) => e.message);
    const stored = storedEvents(id).filter((e) => e.eventId === pendingEvent.eventId);
    expect(stored.length).toBeGreaterThanOrEqual(1);
    expect(new Set(stored.map((e) => e.payloadHash))).toEqual(new Set([pendingEvent.payloadHash]));
    expect(res).toBe("restored");
    expect(events.pending(id)).toBeNull();
    expect(events.watermark(id)).toBe(before + 1);
    void armed;
  });
});
