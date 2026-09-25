// Verifier D1 (P1) / U05 at the server level: with DR_REQUIRE_AGUI_ASSERTION=true the production control handler
// verifies forwardedProps.openbotRun through OpenBot's verify-run route (fake here) before any mission access.
import { afterAll, beforeAll, expect, it } from "vitest";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { ConfigOf } from "@dr/shared";
import { FakeRawTree } from "@dr/storage";
import { MissionActor } from "../src/actor.ts";
import { MemoryEventLog } from "../src/memory-event-log.ts";
import { createControlHandler, type DemoOps } from "../src/server.ts";

const I = "agv-internal";
let fake: FakeRawTree; let openbot: Server; let control: Server; let url = "";
const verifyCalls: Record<string, unknown>[] = [];
const listen = async (s: Server) => { await new Promise<void>((r) => s.listen(0, "127.0.0.1", r)); return `http://127.0.0.1:${(s.address() as AddressInfo).port}`; };

beforeAll(async () => {
  fake = await new FakeRawTree().start();
  openbot = createServer((req: IncomingMessage, res: ServerResponse) => {
    let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
      const body = JSON.parse(b || "{}") as { assertion?: string; runId?: string; threadId?: string };
      verifyCalls.push({ path: req.url, auth: req.headers.authorization, ...body });
      const ok = req.url === "/api/dead-reckoning/internal/verify-run" && req.headers.authorization === `Bearer ${I}` && body.assertion === "signed-good";
      res.writeHead(ok ? 200 : 401, { "content-type": "application/json" })
        .end(JSON.stringify(ok ? { actorId: "user-1", botId: "dead-reckoning", runId: body.runId, threadId: body.threadId } : { error: "assertion rejected" }));
    });
  });
  process.env.DR_OPENBOT_URL = await listen(openbot);
  process.env.DR_REQUIRE_AGUI_ASSERTION = "true";
  const cfg = {
    RAWTREE_API_KEY: fake.apiKey, RAWTREE_DATABASE: "deadreckoning", RAWTREE_BASE_URL: fake.url, NIMBLE_API_KEY: "x", OPENAI_API_KEY: "x",
    DR_PLANNER_MODEL: "x", DR_LIQUID_BASE_URL: "http://127.0.0.1:9/v1", DR_LIQUID_MODEL: "x", DR_PLANNER_CONTEXT_BUDGET: 6000, DR_CONTROL_PORT: 4400,
    DR_WORLD_BASE_URL: "http://127.0.0.1:9", DR_WORLD_TOKEN: "w", DR_OPERATOR_TOKEN: "o", DR_INTERNAL_TOKEN: I, DR_ENABLE_DEMO_CONTROLS: false,
  } as ConfigOf<"control">;
  const actor = new MissionActor(cfg, "http://127.0.0.1:9", { events: new MemoryEventLog() });
  const ops: DemoOps = { enabled: false, world: async () => ({}), reset: async () => ({}), statusUrl: async () => "http://127.0.0.1:9/status.html", ledger: async () => [] };
  const h = createControlHandler({ actor, cfg, ops });
  control = createServer((q, s) => h(q, s));
  url = await listen(control);
});
afterAll(async () => {
  delete process.env.DR_REQUIRE_AGUI_ASSERTION; delete process.env.DR_OPENBOT_URL;
  for (const s of [control, openbot]) { s.closeAllConnections(); await new Promise((r) => s.close(r)); }
  await fake.stop();
});

const run = (openbotRun: unknown, msgId: string) => fetch(`${url}/ag-ui`, {
  method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${I}` },
  body: JSON.stringify({ threadId: "t1", runId: `r-${msgId}`, messages: [{ id: msgId, role: "user", content: "status" }], tools: [], context: [], state: {}, forwardedProps: openbotRun === undefined ? {} : { openbotRun } }),
}).then(async (r) => ({ status: r.status, text: await r.text() }));

it("valid signed assertion → verified through OpenBot, mission port answers", async () => {
  const r = await run("signed-good", "m1");
  expect(r.status).toBe(200);
  expect(r.text).toContain("RUN_FINISHED");
  expect(r.text).not.toContain("RUN_ERROR");
  expect(verifyCalls.at(-1)).toMatchObject({ path: "/api/dead-reckoning/internal/verify-run", auth: `Bearer ${I}`, assertion: "signed-good", runId: "r-m1", threadId: "t1" });
});

it("forged or missing assertion → RUN_ERROR and the mission port is never called", async () => {
  for (const [a, id] of [["forged", "m2"], [undefined, "m3"]] as const) {
    const r = await run(a, id);
    expect(r.text).toContain("RUN_ERROR");
    expect(r.text).not.toContain("TEXT_MESSAGE_CONTENT");
  }
});

it("no bearer → 401 before any verification", async () => {
  const n = verifyCalls.length;
  const r = await fetch(`${url}/ag-ui`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  expect(r.status).toBe(401);
  expect(verifyCalls.length).toBe(n);
});
