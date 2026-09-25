import { afterAll, beforeAll, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { FakeRawTree } from "@dr/storage";
import { type ConfigOf } from "@dr/shared";
import { MissionActor } from "../src/actor.ts";
import { MemoryEventLog } from "../src/memory-event-log.ts";
let fake: FakeRawTree;
let actor: MissionActor;
beforeAll(async () => {
  fake = await new FakeRawTree().start();
  const cfg = {
    RAWTREE_API_KEY: fake.apiKey, RAWTREE_DATABASE: "deadreckoning", RAWTREE_BASE_URL: fake.url,
    NIMBLE_API_KEY: "fake", OPENAI_API_KEY: "fake", DR_PLANNER_MODEL: "fake",
    DR_LIQUID_BASE_URL: "http://127.0.0.1:9/v1", DR_LIQUID_MODEL: "fake", DR_PLANNER_CONTEXT_BUDGET: 6000,
    DR_CONTROL_PORT: 4400, DR_WORLD_BASE_URL: "http://127.0.0.1:9", DR_WORLD_TOKEN: "fake",
    DR_OPERATOR_TOKEN: "fake", DR_INTERNAL_TOKEN: "fake", DR_ENABLE_DEMO_CONTROLS: true,
  } as ConfigOf<"control">;
  actor = new MissionActor(cfg, "http://127.0.0.1:9", { events: new MemoryEventLog(), runnerMain: fileURLToPath(new URL("./fixtures/free-worker.ts", import.meta.url)) });
});
afterAll(async () => { actor?.shutdown(); await fake?.stop(); });

it("kills running workers without a HOLD, tolerates double click, and resumes new generations", async () => {
  await actor.start(["dr", "naive"], { crash: false, statusUrl: "http://127.0.0.1:9/status" });
  await expect.poll(() => actor.recent().filter((e) => e.type === "log" && (e.data as { line?: string }).line === "working").map((e) => e.arm).filter((v, i, a) => a.indexOf(v) === i).length).toBe(2);
  expect(actor.snapshot().map((m) => m.state)).toEqual(["running", "running"]);
  expect(await actor.kill()).toEqual([]); // controlled mode does not touch freely running workers
  const [first, duplicate] = await Promise.all([actor.kill(true), actor.kill(true)]);
  for (const results of [first, duplicate]) {
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r).toMatchObject({ signal: "SIGKILL", alive_after: false });
      expect(() => process.kill(r.pid!, 0)).toThrow();
    }
  }
  expect(await actor.kill(true)).toEqual([]);
  await actor.resume();
  expect(actor.snapshot().map((m) => m.generation)).toEqual([2, 2]);
  expect(actor.snapshot().map((m) => m.state)).toEqual(["running", "running"]);
  expect((await actor.kill(true)).map((r) => r.signal)).toEqual(["SIGKILL", "SIGKILL"]);
});

it("captures all child handles before waiting, even when a later worker exits during that wait", async () => {
  await actor.start(["dr", "naive"], { crash: false, statusUrl: "http://127.0.0.1:9/finish" });
  const first = actor.missions.dr!;
  const second = actor.missions.naive!;
  // Delay first-target completion until the other child exits. Sequential kill/await
  // used to dereference second.child after its exit listener had cleared the handle.
  first.exited = Promise.all([first.exited, second.exited]).then(() => {});
  const results = await actor.kill(true);
  expect(results).toHaveLength(2);
  expect(results.every((r) => !r.alive_after)).toBe(true);
});
