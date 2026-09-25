// Control service (127.0.0.1:DR_CONTROL_PORT): mission actor + supervisor, runner-facing internal routes,
// SSE feed, operator demo controls, and the AG-UI endpoint OpenBot calls.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Narrator, scorecard, type LedgerOutcome } from "./narrator.ts";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, type Arm } from "@dr/shared";
import { createAgUiHandler } from "./ag-ui/handler";
import { requireBearer } from "./ag-ui/auth";
import { MissionActor } from "./actor.ts";
import { collectResults, createMissionPort, statusMarkdown } from "./mission-port.ts";

const cfg = loadConfig("control");
const HOST = "127.0.0.1";
const PORT = Number(cfg.DR_CONTROL_PORT);
const actor = new MissionActor(cfg, `http://${HOST}:${PORT}`);
const BOARD = resolve(dirname(fileURLToPath(import.meta.url)), "../public/board.html");
// Narrated story lines for the board: the same wording the chat uses, published live as SSE "story" events.
const storyNarrator = new Narrator();
actor.subscribe((e) => {
  if (e.type === "story") return;
  const text = storyNarrator.line(e);
  if (text) actor.publish("story", { text }, { arm: e.arm, run_id: e.run_id });
});

export type DemoOps = {
  enabled: boolean;
  world(b: { site: string; status: string; notice?: string }): Promise<{ world_version?: number }>;
  reset(): Promise<unknown>;
  statusUrl(): Promise<string>;
  /** The desk's own ledger for one run (authoritative count of effects). Null if the desk is unreachable. */
  ledger(run_id: string, arm: string): Promise<LedgerOutcome[] | null>;
};

async function deskAdmin(path: string, body: unknown) {
  const r = await fetch(`${cfg.DR_WORLD_BASE_URL.replace(/\/$/, "")}${path}`, {
    method: "POST", headers: { authorization: `Bearer ${cfg.DR_OPERATOR_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`desk ${path} HTTP ${r.status}`);
  return j as { world_version?: number };
}

/** Status page URL the runners observe: explicit env, else the local ngrok tunnel (Nimble needs a public URL), else loopback (direct fallback). */
async function resolveStatusUrl(): Promise<string> {
  if (process.env.DR_STATUS_URL) return process.env.DR_STATUS_URL;
  try {
    const r = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: AbortSignal.timeout(1500) });
    const j = (await r.json()) as { tunnels?: { public_url: string; config?: { addr?: string } }[] };
    const t = j.tunnels?.find((x) => x.public_url.startsWith("https://") && /4402/.test(x.config?.addr ?? ""));
    if (t) return `${t.public_url}/status.html`;
  } catch { /* no tunnel */ }
  return "http://127.0.0.1:4402/status.html";
}

const ops: DemoOps = {
  enabled: cfg.DR_ENABLE_DEMO_CONTROLS,
  world: async (b) => {
    const r = await deskAdmin("/admin/world", b);
    actor.log(`operator: world edit ${b.site} → ${b.status}${b.notice ? ` (${b.notice})` : ""} · world v${r.world_version ?? "?"}`);
    return r;
  },
  reset: async () => { const r = await deskAdmin("/admin/reset", {}); actor.log("operator: desk world reset to v1"); return r; },
  statusUrl: resolveStatusUrl,
  ledger: async (run_id, arm) => {
    try {
      const u = `${cfg.DR_WORLD_BASE_URL.replace(/\/$/, "")}/admin/ledger?run_id=${encodeURIComponent(run_id)}&arm=${encodeURIComponent(arm)}`;
      const r = await fetch(u, { headers: { authorization: `Bearer ${cfg.DR_OPERATOR_TOKEN}` }, signal: AbortSignal.timeout(5000) });
      if (!r.ok) return null;
      return ((await r.json()) as { outcomes?: LedgerOutcome[] }).outcomes ?? [];
    } catch { return null; }
  },
};
// OpenBot authenticates with the shared DR_INTERNAL_TOKEN (apps/console/.env → agents.yaml auth.bearer).
const agUi = requireBearer(cfg.DR_INTERNAL_TOKEN, createAgUiHandler(createMissionPort(actor, ops)), (req) =>
  console.warn(`ag-ui: 401 ${req.method} from ${req.socket.remoteAddress} (${req.headers.authorization ? "bad" : "no"} bearer, ua=${req.headers["user-agent"] ?? "-"})`));

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > 2_000_000) throw new Error("body too large"); chunks.push(c as Buffer); }
  const s = Buffer.concat(chunks).toString("utf8");
  return s ? (JSON.parse(s) as Record<string, unknown>) : {};
}
const bearer = (req: IncomingMessage) => (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");

async function route(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? "/", `http://${HOST}`);
  const p = url.pathname;
  const m = req.method ?? "GET";

  if (m === "GET" && p === "/health") return json(res, 200, { status: "ok", mode: "control", missions: actor.snapshot().length });
  if (p === "/ag-ui") return agUi(req, res);

  // ---- runner-facing (per-generation DR_RUNNER_TOKEN)
  if (p.startsWith("/internal/")) {
    const who = actor.authRunner(req.headers.authorization);
    if (!who) return json(res, 401, { error: "runner token required" });
    if (m === "POST" && p === "/internal/rows") {
      const b = await body(req);
      try { return json(res, 200, await actor.appendRow(who, String(b.table), b.row as Record<string, unknown>)); } catch (e) {
        actor.log(`single writer: append REFUSED (${(e as Error).message})`, who.arm, who.run_id);
        return json(res, 503, { error: (e as Error).message });
      }
    }
    if (m === "GET" && p === "/internal/projection") {
      const runId = url.searchParams.get("run_id") ?? "";
      if (runId !== who.run_id) return json(res, 403, { error: "run_id mismatch" });
      try { return json(res, 200, await actor.projection(runId, url.searchParams.get("purpose") ?? "restore")); } catch (e) { return json(res, 503, { error: (e as Error).message }); }
    }
    if (m === "GET" && p === "/internal/visible") {
      const runId = url.searchParams.get("run_id") ?? "";
      if (runId !== who.run_id) return json(res, 403, { error: "run_id mismatch" });
      try { return json(res, 200, { visible_ms: await actor.intentVisible(runId, url.searchParams.get("action_key") ?? "") }); } catch (e) { return json(res, 503, { error: (e as Error).message }); }
    }
    return json(res, 404, { error: "not found" });
  }

  // ---- read-only views
  if (m === "GET" && p === "/missions") return json(res, 200, { missions: actor.snapshot() });
  if (m === "GET" && p === "/scorecard") { const results = await collectResults(actor, ops); return json(res, 200, { results, markdown: scorecard(results) }); }
  if (m === "GET" && p === "/status.md") { res.writeHead(200, { "content-type": "text/markdown" }); return res.end(statusMarkdown(actor)); }
  if (m === "GET" && p === "/board") {
    if (!existsSync(BOARD)) return json(res, 404, { error: "board.html not present" });
    res.writeHead(200, { "content-type": "text/html" });
    return res.end(readFileSync(BOARD));
  }
  if (m === "GET" && p === "/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(actor.sse({ type: "snapshot", seq: 0, ts: new Date().toISOString(), data: { missions: actor.snapshot() } }));
    for (const e of actor.recent()) res.write(actor.sse(e));
    const off = actor.subscribe((e) => res.write(actor.sse(e)));
    const ka = setInterval(() => res.write(": keepalive\n\n"), 15_000);
    req.on("close", () => { off(); clearInterval(ka); });
    return;
  }

  // ---- operator demo controls
  if (p.startsWith("/demo/")) {
    if (!ops.enabled) return json(res, 403, { error: "demo controls disabled" });
    if (bearer(req) !== cfg.DR_OPERATOR_TOKEN) return json(res, 401, { error: "operator token required" });
    const b = m === "POST" ? await body(req) : {};
    if (p === "/demo/start") {
      const a = String(b.arm ?? "both");
      const arms: Arm[] = a === "both" ? ["dr", "naive"] : [a as Arm];
      const statusUrl = typeof b.status_url === "string" ? b.status_url : await resolveStatusUrl();
      try {
        const blocker = actor.startBlocker(arms);
        if (blocker) throw new Error(blocker);
        if (b.reset !== false) await ops.reset();
        const ms = actor.start(arms, { crash: b.crash !== false, statusUrl });
        return json(res, 200, { started: ms.map((x) => ({ arm: x.arm, run_id: x.run_id, pid: x.pid })), status_url: statusUrl });
      } catch (e) { return json(res, 409, { error: (e as Error).message }); }
    }
    if (p === "/demo/kill") return json(res, 200, { killed: await actor.kill(b.all === true) });
    if (p === "/demo/resume") {
      const ms = actor.resume({ simClock: typeof b.sim_clock === "string" ? b.sim_clock : undefined });
      return json(res, 200, { resumed: ms.map((x) => ({ arm: x.arm, run_id: x.run_id, pid: x.pid, generation: x.generation })) });
    }
    if (p === "/demo/world") return json(res, 200, await ops.world({ site: String(b.site ?? "site-A"), status: String(b.status ?? "closed"), notice: typeof b.notice === "string" ? b.notice : undefined }));
    if (p === "/demo/reset") return json(res, 200, await ops.reset());
    return json(res, 404, { error: "not found" });
  }
  return json(res, 404, { error: "not found" });
}

const server = createServer((req, res) => {
  route(req, res).catch((err) => {
    if (!res.headersSent) json(res, 500, { error: String((err as Error)?.message ?? err) });
    else res.end();
  });
});
server.listen(PORT, HOST, () => console.log(`DR control listening on http://${HOST}:${PORT} (health, ag-ui, events, missions, internal/*, demo/*)`));
for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { actor.shutdown(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1000).unref(); });
