// Deliberately separate, key-free rehearsal entrypoint. No dotenv, hosted chat, or provider startup.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { F3, REPO_ROOT, type ConfigOf } from "@dr/shared";
import { DeskStore, startDesk } from "@dr/desk";
import { MissionActor } from "./actor.ts";
import { LocalStore } from "./local-store.ts";
import { createControlHandler, createDemoOps } from "./server.ts";

function json(res: ServerResponse, code: number, data: unknown) {
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}

export async function startLocalDemo(options: { port?: number; directory?: string } = {}) {
  const base = resolve(REPO_ROOT, "artifacts/local-demo");
  mkdirSync(base, { recursive: true });
  const directory = options.directory ?? mkdtempSync(`${base}/session-`);
  mkdirSync(directory, { recursive: true });
  const store = new LocalStore(resolve(directory, "missions.sqlite"));
  const worldToken = randomBytes(24).toString("hex");
  const operatorToken = randomBytes(24).toString("hex");
  const desk = await startDesk({ port: 0, feedPort: 0, store: new DeskStore(resolve(directory, "desk.sqlite")), worldToken, operatorToken });
  const statusUrl = `${desk.feedUrl}/status.html`;
  let handler: (req: IncomingMessage, res: ServerResponse) => void = (_q, s) => json(s, 503, { error: "starting" });
  const server = createServer((req, res) => handler(req, res));
  try {
    await new Promise<void>((ok, fail) => { server.once("error", fail); server.listen(options.port ?? 4420, "127.0.0.1", ok); });
  } catch (error) { await desk.close(); store.close(); throw error; }
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const cfg: ConfigOf<"control"> = {
    RAWTREE_API_KEY: "", RAWTREE_DATABASE: "local-rehearsal", RAWTREE_BASE_URL: "http://127.0.0.1:9",
    NIMBLE_API_KEY: "", OPENAI_API_KEY: "", DR_PLANNER_MODEL: "local-rules", DR_LIQUID_MODEL: "local-rules",
    DR_LIQUID_BASE_URL: "http://127.0.0.1:9", DR_PLANNER_CONTEXT_BUDGET: 6000,
    DR_CONTROL_PORT: (server.address() as AddressInfo).port, DR_WORLD_BASE_URL: desk.url,
    DR_WORLD_TOKEN: worldToken, DR_OPERATOR_TOKEN: operatorToken, DR_INTERNAL_TOKEN: randomBytes(24).toString("hex"),
    DR_ENABLE_DEMO_CONTROLS: true,
  };
  const actor = new MissionActor(cfg, url, { events: store, storage: store.adapter, checkpoints: false, statusUrl: () => statusUrl, localMode: true });
  const core = createControlHandler({ actor, cfg, ops: createDemoOps(cfg, actor), narrate: false });
  let busy = false;
  async function route(req: IncomingMessage, res: ServerResponse) {
    const origin = new URL(url);
    if (req.headers.host !== origin.host || (req.headers.origin && req.headers.origin !== url)
      || (req.headers["sec-fetch-site"] && !["same-origin", "none"].includes(String(req.headers["sec-fetch-site"])))) {
      return json(res, 403, { error: "Open this rehearsal directly on its loopback URL." });
    }
    const path = new URL(req.url ?? "/", url).pathname;
    if (path.startsWith("/internal/")) return core(req, res); // generation bearer stays mandatory
    if (req.method === "GET" && path === "/health") return json(res, 200, { status: "ok", mode: "local", providerCalls: false });
    if (req.method === "GET" && (path === "/" || path === "/board")) {
      res.writeHead(200, {
        "content-type": "text/html", "cache-control": "no-store",
        "content-security-policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
      });
      return res.end(readFileSync(resolve(REPO_ROOT, "packages/control/public/local.html")));
    }
    if (req.method === "GET" && path === "/local/state") {
      const missions = actor.snapshot();
      return json(res, 200, {
        mode: "local", missions, snapshots: missions.map((m) => {
          const snapshot = actor.missionSnapshot(m.run_id)!;
          return { ...snapshot, availability: { localSqlite: snapshot.availability.rawtree, desk: snapshot.availability.desk },
            facts: snapshot.facts.map((fact) => ({ ...fact, retrievalMode: "direct" })) };
        }),
        ledger: missions.map((m) => ({ run_id: m.run_id, arm: m.arm, ...desk.store.ledger({ run_id: m.run_id, arm: m.arm }) })),
        world: desk.store.worldVersion(), resources: F3.resources.map((r) => desk.store.resource(r.id)),
        events: actor.recent(150),
      });
    }
    if (req.method === "POST" && path === "/local/action") {
      if (req.headers.origin !== url || req.headers["content-type"] !== "application/json") return json(res, 403, { error: "Same-origin JSON request required." });
      if (busy) return json(res, 409, { error: "An operation is already running. Wait for its result." });
      let raw = "";
      for await (const chunk of req) { raw += chunk; if (raw.length > 2048) return json(res, 413, { error: "Request too large" }); }
      let body: { action?: string; site?: string };
      try { body = JSON.parse(raw); } catch { return json(res, 400, { error: "Invalid JSON" }); }
      if (!body || typeof body !== "object" || !["start", "kill", "close-site", "resume"].includes(body.action ?? "")) return json(res, 400, { error: "Unknown action" });
      busy = true;
      try {
        const current = actor.missions.dr;
        if (body.action === "start") {
          if (current && !["valid", "blocked", "failed"].includes(current.meta.status)) return json(res, 409, { error: "Finish or resume this mission before starting another." });
          const blocker = actor.startBlocker(["dr"]);
          if (blocker) return json(res, 409, { error: blocker });
          desk.store.seed(); // restore fixture world, retain every prior run's booking ledger
          const started = await actor.start(["dr"], { crash: true, statusUrl });
          return json(res, 200, { started: started.map((m) => ({ run_id: m.run_id, pid: m.pid })) });
        }
        if (!current) return json(res, 409, { error: "Start a mission first." });
        if (body.action === "kill") return json(res, 200, { killed: await actor.kill(true) });
        if (body.action === "close-site") {
          if (actor.childActive(current)) return json(res, 409, { error: "Crash the worker before changing the world." });
          if (!["site-A", "site-C"].includes(body.site ?? "site-A")) return json(res, 400, { error: "Choose Site A or Site C." });
          return json(res, 200, desk.store.editWorld(body.site ?? "site-A", "closed", "Storm damage (simulated)"));
        }
        const result = await actor.command(current.run_id, { commandId: `local-resume-${randomBytes(8).toString("hex")}`, kind: "resume", expectedRevision: actor.revision(current.run_id) });
        return json(res, result.http, result.body);
      } finally { busy = false; }
    }
    return json(res, 404, { error: "Not found" });
  }
  handler = (req, res) => { void route(req, res).catch((error) => { if (!res.headersSent) json(res, 500, { error: (error as Error).message }); else res.end(); }); };
  return { url, actor, desk, store, directory, async close() {
    await actor.kill(true);
    server.closeAllConnections();
    await new Promise<void>((ok) => server.close(() => ok()));
    await desk.close(); store.close();
  } };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const demo = await startLocalDemo();
  console.log(`Local rehearsal ready: ${demo.url}\nNo API keys or hosted providers. SQLite + real worker process + simulated booking desk.\nEvidence: ${demo.directory}\nStop with Ctrl+C. Control restart starts a fresh session.`);
  let stopping = false;
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { if (!stopping) { stopping = true; void demo.close().then(() => process.exit(0)); } });
}
