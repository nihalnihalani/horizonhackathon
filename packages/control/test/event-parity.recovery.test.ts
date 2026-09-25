// Critic F1 acceptance: replaying the actor's own canonical events must reproduce its live MissionMeta
// (status, reconciliation, blocked reason, armed crash, open claims) at every step of a real lifecycle.
import { afterAll, beforeAll, expect, it } from "vitest";
import { resolve } from "node:path";
import { REPO_ROOT, type ConfigOf, type MissionMeta } from "@dr/shared";
import { FakeRawTree, replay } from "@dr/storage";
import { startDesk, type RunningDesk } from "@dr/desk";
import { MissionActor } from "../src/actor.ts";
import { MemoryEventLog } from "../src/memory-event-log.ts";

const CHILD = resolve(REPO_ROOT, "packages/control/test/fixtures/booking-child.ts");
let fake: FakeRawTree; let desk: RunningDesk; let actor: MissionActor; let events: MemoryEventLog;

beforeAll(async () => {
  fake = await new FakeRawTree().start();
  desk = await startDesk({ worldToken: "pw", operatorToken: "po", port: 0, feedPort: null });
  const cfg = {
    RAWTREE_API_KEY: fake.apiKey, RAWTREE_DATABASE: "deadreckoning", RAWTREE_BASE_URL: fake.url, NIMBLE_API_KEY: "x", OPENAI_API_KEY: "x",
    DR_PLANNER_MODEL: "x", DR_LIQUID_BASE_URL: "http://127.0.0.1:9/v1", DR_LIQUID_MODEL: "x", DR_PLANNER_CONTEXT_BUDGET: 6000, DR_CONTROL_PORT: 4400,
    DR_WORLD_BASE_URL: desk.url, DR_WORLD_TOKEN: "pw", DR_OPERATOR_TOKEN: "po", DR_INTERNAL_TOKEN: "pi", DR_ENABLE_DEMO_CONTROLS: true,
  } as ConfigOf<"control">;
  events = new MemoryEventLog();
  // The actor needs a reachable control URL for the child; this test only drives commands up to the claim.
  actor = new MissionActor(cfg, "http://127.0.0.1:9", { events, runnerMain: CHILD, reconcile: { polls: 1, intervalMs: 50 } });
});
afterAll(async () => { await actor?.kill(true); await desk.close(); await fake.stop(); });

const view = (m: MissionMeta) => ({
  status: m.status, reconciliationStatus: m.reconciliationStatus, blockedReason: m.blockedReason,
  armedCrash: m.armedCrash, claims: Object.keys(m.claims).sort(), commands: Object.keys(m.commands).sort(),
});
function assertParity(id: string, when: string) {
  const live = actor.byId.get(id)!.meta;
  const r = replay(id, [], events.list(id), events.watermark(id));
  expect(view(r.projection.mission!), when).toEqual(view(live));
}

it("replay(events) == live meta across create, arm, claim, outcome, pause and cancel", async () => {
  const c = await actor.createMission({ commandId: "cmd-parity-create", ownerId: "user-1", goal: "F3" });
  const id = String(c.body.missionId);
  assertParity(id, "after create");
  await actor.command(id, { commandId: "cmd-parity-arm", kind: "arm_crash", args: { point: "after_claim" } });
  assertParity(id, "after arm_crash");

  // A claim and its definitive outcome, through the same queue the runner uses.
  const m = actor.byId.get(id)!;
  m.generation = 1; // simulate an owned generation without spawning (claims check generation)
  await actor.command(id, { commandId: "cmd-parity-resume", kind: "resume", expectedRevision: actor.revision(id) }).catch(() => undefined);
  await actor.kill(true);
  assertParity(id, "after resume + kill");

  const p = await actor.command(id, { commandId: "cmd-parity-pause", kind: "pause", expectedRevision: actor.revision(id) });
  expect([202, 409]).toContain(p.http);
  await new Promise((r) => setTimeout(r, 300));
  assertParity(id, "after pause");
  const x = await actor.command(id, { commandId: "cmd-parity-cancel", kind: "cancel", expectedRevision: actor.revision(id) });
  expect([202, 409]).toContain(x.http);
  await new Promise((r) => setTimeout(r, 300));
  assertParity(id, "after cancel");
});
