// Control service (127.0.0.1:DR_CONTROL_PORT): mission actor + supervisor, mission lifecycle REST (CONTRACTS §5),
// runner-facing internal routes, SSE feed, operator demo controls, and the AG-UI endpoint OpenBot calls.
// createControlHandler() is importable by tests; the listener only starts when this file is the entrypoint.
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { CrashPoint, Slot, loadConfig, type ApiError, type Arm, type ConfigOf } from "@dr/shared";
import { createAgUiHandler } from "./ag-ui/handler";
import { RawTreeClient, RawTreeEventLog } from "@dr/storage";
import { MissionActor, type CommandResult } from "./actor.ts";
import { createMissionPort, statusMarkdown } from "./mission-port.ts";

const HOST = "127.0.0.1";
const BOARD = resolve(dirname(fileURLToPath(import.meta.url)), "../public/board.html");

export type DemoOps = {
  enabled: boolean;
  world(b: { site: string; status: string; notice?: string }): Promise<{ world_version?: number }>;
  reset(): Promise<unknown>;
  statusUrl(): Promise<string>;
};

/** Status page URL the runners observe: explicit env, else the local ngrok tunnel (Nimble needs a public URL), else loopback (direct fallback). */
export async function resolveStatusUrl(): Promise<string> {
  if (process.env.DR_STATUS_URL) return process.env.DR_STATUS_URL;
  try {
    const r = await fetch("http://127.0.0.1:4040/api/tunnels", { signal: AbortSignal.timeout(1500) });
    const j = (await r.json()) as { tunnels?: { public_url: string; config?: { addr?: string } }[] };
    const t = j.tunnels?.find((x) => x.public_url.startsWith("https://") && /4402/.test(x.config?.addr ?? ""));
    if (t) return `${t.public_url}/status.html`;
  } catch { /* no tunnel */ }
  return "http://127.0.0.1:4402/status.html";
}

export function createDemoOps(cfg: ConfigOf<"control">, actor: MissionActor): DemoOps {
  async function deskAdmin(path: string, body: unknown) {
    const r = await fetch(`${cfg.DR_WORLD_BASE_URL.replace(/\/$/, "")}${path}`, {
      method: "POST", headers: { authorization: `Bearer ${cfg.DR_OPERATOR_TOKEN}`, "content-type": "application/json" }, body: JSON.stringify(body ?? {}),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`desk ${path} HTTP ${r.status}`);
    return j as { world_version?: number };
  }
  return {
    enabled: cfg.DR_ENABLE_DEMO_CONTROLS,
    world: async (b) => {
      const r = await deskAdmin("/admin/world", b);
      actor.log(`operator: world edit ${b.site} → ${b.status}${b.notice ? ` (${b.notice})` : ""} · world v${r.world_version ?? "?"}`);
      return r;
    },
    reset: async () => { const r = await deskAdmin("/admin/reset", {}); actor.log("operator: desk world reset to v1"); return r; },
    statusUrl: resolveStatusUrl,
  };
}

// ---------------------------------------------------------------- request schemas (CONTRACTS §5)
const CommandId = z.string().min(6).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const CreateBody = z.object({
  commandId: CommandId,
  goal: z.string().min(1).max(500).default("F3 Angel Island trip"),
  arm: z.enum(["dr", "naive"]).default("dr"),
  batchId: z.string().regex(/^[A-Za-z0-9._-]{1,64}$/).optional(),
  statusUrl: z.string().url().optional(),
  review: z.enum(["auto", "per_action"]).optional(),
}).strict();
const ApprovalBody = z.object({
  commandId: CommandId, decision: z.enum(["accept", "reject"]), displayedBindingHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedPlanRevision: z.number().int().nonnegative(),
}).strict();
const MutationBody = z.object({ commandId: CommandId, expectedRevision: z.number().int().nonnegative() }).strict();
const ArmCrashBody = z.object({ commandId: CommandId, point: CrashPoint, expectedRevision: z.number().int().nonnegative().optional() }).strict();
const ClaimBody = z.object({
  actionKey: z.string().regex(/^[a-f0-9]{64}$/), argsHash: z.string().regex(/^[a-f0-9]{64}$/), slot: Slot, epoch: z.number().int().min(1),
}).strict();

class BadRequest extends Error {}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}
const apiError = (res: ServerResponse, status: number, e: ApiError) => json(res, status, e);
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let n = 0;
  for await (const c of req) { n += (c as Buffer).length; if (n > 2_000_000) throw new BadRequest("body too large"); chunks.push(c as Buffer); }
  const s = Buffer.concat(chunks).toString("utf8");
  if (!s) return {};
  try { return JSON.parse(s) as Record<string, unknown>; } catch { throw new BadRequest("malformed JSON body"); }
}
function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, b: unknown): T {
  const r = schema.safeParse(b);
  if (!r.success) throw new BadRequest(`invalid request: ${r.error.issues.map((i) => `${i.path.join(".") || "body"} ${i.message}`).join("; ")}`);
  return r.data;
}
const bearer = (req: IncomingMessage) => (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
const send = (res: ServerResponse, r: CommandResult) => json(res, r.http, r.body);

export type ControlDeps = { actor: MissionActor; cfg: ConfigOf<"control">; ops: DemoOps };

export function createControlHandler({ actor, cfg, ops }: ControlDeps) {
  const agUi = createAgUiHandler(createMissionPort(actor, ops));

  /**
   * Mission REST caller: OpenBot (internal token + trusted x-dr-actor-id) or the local operator (admin).
   * Operator-as-admin is accepted for the single-user MVP only (lead disposition, wave 2); approvals still require the owner.
   */
  function caller(req: IncomingMessage): { ownerId: string; admin: boolean } | null {
    const tok = bearer(req);
    if (tok && tok === cfg.DR_INTERNAL_TOKEN) {
      const id = req.headers["x-dr-actor-id"];
      return typeof id === "string" && /^[A-Za-z0-9._:@-]{1,128}$/.test(id) ? { ownerId: id, admin: false } : null;
    }
    if (tok && tok === cfg.DR_OPERATOR_TOKEN) return { ownerId: "operator", admin: true };
    return null;
  }

  /** R08: an id this process does not own may still have durable records → refuse takeover instead of 404. */
  async function unknownMission(res: ServerResponse, id: string) {
    if (await actor.mayHaveDurableRecord(id)) {
      return apiError(res, 409, { code: "CONTROL_RECOVERY_REQUIRED", message: "this control process has no ownership/watermark metadata for the mission; automatic takeover is not supported", retryable: false, missionId: id });
    }
    return apiError(res, 404, { code: "NOT_FOUND", message: "unknown mission", retryable: false, missionId: id });
  }

  async function route(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url ?? "/", `http://${HOST}`);
    const p = url.pathname;
    const m = req.method ?? "GET";

    if (m === "GET" && p === "/health") return json(res, 200, { status: "ok", mode: "control", missions: actor.snapshot().length });
    if (p === "/ag-ui") return agUi(req, res);

    // ---- runner-facing (per-generation DR_RUNNER_TOKEN)
    if (p.startsWith("/internal/")) {
      const who = actor.authRunner(req.headers.authorization);
      if (!who) return json(res, 401, { error: "runner token required", code: "UNAUTHORIZED" });
      if (m === "POST" && p === "/internal/rows") {
        const b = await body(req);
        try { return json(res, 200, await actor.appendRow(who, String(b.table), b.row as Record<string, unknown>)); } catch (e) {
          actor.log(`single writer: append REFUSED (${(e as Error).message})`, who.arm, who.run_id);
          return json(res, 503, { error: (e as Error).message, code: "STORAGE_UNAVAILABLE" });
        }
      }
      if (m === "POST" && p === "/internal/dispatch-claim") {
        const b = parse(ClaimBody, await body(req));
        try { return send(res, await actor.claimDispatch(who, b)); } catch (e) {
          return apiError(res, 503, { code: "STORAGE_UNAVAILABLE", message: `claim not durable: ${(e as Error).message}`, retryable: true, missionId: who.run_id });
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

    // ---- mission lifecycle REST (CONTRACTS §5)
    if (m === "POST" && p === "/missions") {
      const who = caller(req);
      if (!who) return apiError(res, 401, { code: "UNAUTHORIZED", message: "internal token with x-dr-actor-id, or operator token, required", retryable: false });
      const b = parse(CreateBody, await body(req));
      try {
        return send(res, await actor.createMission({ commandId: b.commandId, ownerId: who.ownerId, goal: b.goal, arm: b.arm as Arm, batchId: b.batchId, statusUrl: b.statusUrl, review: b.review }));
      } catch (e) { return apiError(res, 503, { code: "STORAGE_UNAVAILABLE", message: (e as Error).message, retryable: true }); }
    }
    const sub = p.match(/^\/missions\/([A-Za-z0-9._-]{1,64})\/(approvals|evidence|events)(?:\/([^/]{1,200}))?$/);
    if (sub) {
      const [, id, kind, rawArg] = sub as unknown as [string, string, "approvals" | "evidence" | "events", string | undefined];
      let arg: string | undefined;
      try { arg = rawArg === undefined ? undefined : decodeURIComponent(rawArg); } catch { throw new BadRequest("malformed path"); }
      const who = caller(req);
      if (!who) return apiError(res, 401, { code: "UNAUTHORIZED", message: "internal token with x-dr-actor-id, or operator token, required", retryable: false, missionId: id });
      const mission = actor.byId.get(id);
      if (!mission) return unknownMission(res, id);
      if (!who.admin && mission.meta.ownerId !== who.ownerId) return apiError(res, 403, { code: "FORBIDDEN", message: "mission is owned by another actor", retryable: false, missionId: id });
      if (kind === "approvals" && m === "GET" && !arg) return json(res, 200, { missionId: id, planRevision: mission.meta.planRevision, approvals: actor.listApprovals(id) });
      if (kind === "approvals" && m === "POST" && arg) {
        const b = parse(ApprovalBody, await body(req));
        return send(res, await actor.decideApproval(id, arg, who.ownerId, b));
      }
      if (kind === "evidence" && m === "GET" && arg) {
        const max = Number(url.searchParams.get("maxChars") ?? 1000);
        if (!Number.isInteger(max) || max < 1) throw new BadRequest("maxChars must be a positive integer");
        const ev = actor.evidence(id, arg, max);
        if (!ev) return apiError(res, 404, { code: "NOT_FOUND", message: `unknown evidence ${arg}`, retryable: false, missionId: id });
        return json(res, 200, ev);
      }
      if (kind === "events" && m === "GET" && !arg) {
        // Revision hints for this mission only; clients refetch the snapshot (the hint carries no state).
        res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        const hint = (revision: number, type: string) => res.write(`id: ${revision}\ndata: ${JSON.stringify({ missionId: id, revision, type })}\n\n`);
        hint(actor.revision(id), "snapshot");
        const off = actor.subscribe((e) => {
          const d = e.data as { kind?: string; type?: string; revision?: number };
          if (e.run_id === id && d?.kind === "event" && typeof d.revision === "number") hint(d.revision, String(d.type));
        });
        const ka = setInterval(() => res.write(": keepalive\n\n"), 15_000);
        req.on("close", () => { off(); clearInterval(ka); });
        return;
      }
      return json(res, 405, { error: "method not allowed" });
    }
    const mm = p.match(/^\/missions\/([A-Za-z0-9._-]{1,64})(?:\/(resume|pause|cancel))?$/);
    if (mm) {
      const [, id, verb] = mm as unknown as [string, string, "resume" | "pause" | "cancel" | undefined];
      const who = caller(req);
      if (!who) return apiError(res, 401, { code: "UNAUTHORIZED", message: "internal token with x-dr-actor-id, or operator token, required", retryable: false, missionId: id });
      const mission = actor.byId.get(id);
      if (!mission) return unknownMission(res, id);
      if (!who.admin && mission.meta.ownerId !== who.ownerId) return apiError(res, 403, { code: "FORBIDDEN", message: "mission is owned by another actor", retryable: false, missionId: id });
      if (!verb && m === "GET") { await actor.probeDesk(); return json(res, 200, actor.missionSnapshot(id)); }
      if (verb && m === "POST") {
        const b = parse(MutationBody, await body(req));
        try { return send(res, await actor.command(id, { commandId: b.commandId, kind: verb, expectedRevision: b.expectedRevision })); } catch (e) {
          return apiError(res, 503, { code: "STORAGE_UNAVAILABLE", message: (e as Error).message, retryable: true, missionId: id });
        }
      }
      return json(res, 405, { error: "method not allowed" });
    }

    // ---- read-only views
    if (m === "GET" && p === "/missions") return json(res, 200, { missions: actor.snapshot() });
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
      if (!ops.enabled) return json(res, 403, { error: "demo controls disabled", code: "FORBIDDEN" });
      if (bearer(req) !== cfg.DR_OPERATOR_TOKEN) return json(res, 401, { error: "operator token required", code: "UNAUTHORIZED" });
      const arm = p.match(/^\/demo\/([A-Za-z0-9._-]{1,64})\/arm-crash$/);
      if (arm && m === "POST") {
        const id = arm[1]!;
        const b = parse(ArmCrashBody, await body(req));
        if (!actor.byId.has(id)) return unknownMission(res, id);
        return send(res, await actor.command(id, { commandId: b.commandId, kind: "arm_crash", expectedRevision: b.expectedRevision, args: { point: b.point } }));
      }
      const b = m === "POST" ? await body(req) : {};
      if (p === "/demo/start") {
        const a = String(b.arm ?? "both");
        const arms: Arm[] = a === "both" ? ["dr", "naive"] : [a as Arm];
        const statusUrl = typeof b.status_url === "string" ? b.status_url : await resolveStatusUrl();
        try {
          const blocker = actor.startBlocker(arms);
          if (blocker) throw new Error(blocker);
          if (b.reset !== false) await ops.reset();
          const ms = await actor.start(arms, { crash: b.crash !== false, statusUrl });
          return json(res, 200, { started: ms.map((x) => ({ arm: x.arm, run_id: x.run_id, pid: x.pid })), status_url: statusUrl });
        } catch (e) { return json(res, 409, { error: (e as Error).message }); }
      }
      if (p === "/demo/kill") return json(res, 200, { killed: await actor.kill(b.all === true) });
      if (p === "/demo/resume") {
        const ms = await actor.resume({ simClock: typeof b.sim_clock === "string" ? b.sim_clock : undefined });
        return json(res, 200, { resumed: ms.map((x) => ({ arm: x.arm, run_id: x.run_id, pid: x.pid, generation: x.generation })) });
      }
      if (p === "/demo/world") return json(res, 200, await ops.world({ site: String(b.site ?? "site-A"), status: String(b.status ?? "closed"), notice: typeof b.notice === "string" ? b.notice : undefined }));
      if (p === "/demo/reset") return json(res, 200, await ops.reset());
      return json(res, 404, { error: "not found" });
    }
    return json(res, 404, { error: "not found" });
  }

  return (req: IncomingMessage, res: ServerResponse) => {
    route(req, res).catch((err) => {
      if (res.headersSent) return void res.end();
      if (err instanceof BadRequest) return apiError(res, 400, { code: "INVALID_REQUEST", message: err.message, retryable: false });
      json(res, 500, { error: String((err as Error)?.message ?? err) });
    });
  };
}

function main() {
  const cfg = loadConfig("control");
  const PORT = Number(cfg.DR_CONTROL_PORT);
  // Durable canonical events (CONTRACTS §4). DR_EVENT_LOG=memory keeps the non-durable in-memory log for offline dev.
  const client = new RawTreeClient({ baseUrl: cfg.RAWTREE_BASE_URL, apiKey: cfg.RAWTREE_API_KEY, database: cfg.RAWTREE_DATABASE });
  const events = process.env.DR_EVENT_LOG === "memory" ? undefined : new RawTreeEventLog(client, { visibilityDeadlineMs: 10_000, pollMs: 200 });
  console.log(`DR control canonical event log: ${events ? "RawTree mission_events (durable)" : "in-memory (DR_EVENT_LOG=memory, NOT durable)"}`);
  const actor = new MissionActor(cfg, `http://${HOST}:${PORT}`, { statusUrl: resolveStatusUrl, events });
  const ops = createDemoOps(cfg, actor);
  const server = createServer(createControlHandler({ actor, cfg, ops }));
  server.listen(PORT, HOST, () => console.log(`DR control listening on http://${HOST}:${PORT} (health, ag-ui, events, missions, internal/*, demo/*)`));
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { actor.shutdown(); server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 1000).unref(); });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
