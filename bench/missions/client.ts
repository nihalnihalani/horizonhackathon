// Thin REST client for the mission batch harness (dr-bench). Self-contained (does not import scripts/lib.ts,
// which is owned by the demo/console track) but follows the same pattern as scripts/e2e.ts and
// scripts/demo-f3.ts: operator-token bearer calls against control (127.0.0.1:DR_CONTROL_PORT) and desk
// (DR_WORLD_BASE_URL). Never logs tokens; only ids/statuses/timings.
import { assertRunId, loadConfig, type CrashPoint } from "@dr/shared";
import { rawTreeFromEnv } from "@dr/storage";

export const cfg = loadConfig("control");
export const CTL = `http://127.0.0.1:${cfg.DR_CONTROL_PORT}`;
export const DESK = cfg.DR_WORLD_BASE_URL.replace(/\/$/, "");
const OP = { authorization: `Bearer ${cfg.DR_OPERATOR_TOKEN}`, "content-type": "application/json" };

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
export const hhmmss = (): string => new Date().toLocaleTimeString("en-US", { hour12: false });
export const say = (s: string): void => console.log(`${hhmmss()} ${s}`);

async function callCtl(method: string, path: string, body?: unknown): Promise<{ status: number; body: Record<string, any> }> {
  const r = await fetch(`${CTL}${path}`, { method, headers: OP, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Record<string, any> };
}

export async function health(): Promise<{ desk: boolean; control: boolean }> {
  const [d, c] = await Promise.all([
    fetch(`${DESK}/health`).then((r) => r.ok).catch(() => false),
    fetch(`${CTL}/health`).then((r) => r.ok).catch(() => false),
  ]);
  return { desk: d, control: c };
}

let seq = 0;
export function commandId(tag: string): string {
  seq += 1;
  return `bench-${tag}-${Date.now().toString(36)}-${seq}`;
}

export async function createMission(opts: { arm: "dr" | "naive"; goal: string; statusUrl?: string; batchId?: string }): Promise<{ missionId: string; status: number; body: Record<string, any> }> {
  const r = await callCtl("POST", "/missions", { commandId: commandId("create"), goal: opts.goal, arm: opts.arm, statusUrl: opts.statusUrl, batchId: opts.batchId });
  if (r.status !== 201) throw new Error(`POST /missions → ${r.status} ${JSON.stringify(r.body)}`);
  return { missionId: String(r.body.missionId), status: r.status, body: r.body };
}

export async function armCrash(missionId: string, point: CrashPoint, expectedRevision?: number): Promise<{ status: number; body: Record<string, any> }> {
  return callCtl("POST", `/demo/${missionId}/arm-crash`, { commandId: commandId("arm"), point, expectedRevision });
}

export async function resumeMission(missionId: string, expectedRevision: number): Promise<{ status: number; body: Record<string, any> }> {
  return callCtl("POST", `/missions/${missionId}/resume`, { commandId: commandId("resume"), expectedRevision });
}

export async function snap(missionId: string): Promise<Record<string, any>> {
  const r = await callCtl("GET", `/missions/${missionId}`);
  if (r.status !== 200) throw new Error(`GET /missions/${missionId} → ${r.status} ${JSON.stringify(r.body)}`);
  return r.body;
}

export async function until(missionId: string, pred: (s: Record<string, any>) => boolean, ms: number, what: string): Promise<Record<string, any>> {
  const end = Date.now() + ms;
  for (;;) {
    const s = await snap(missionId);
    if (pred(s)) return s;
    if (Date.now() > end) throw new Error(`timeout waiting for ${what} on ${missionId} (status=${s.status}, worker=${JSON.stringify(s.worker)})`);
    await sleep(750);
  }
}

export async function demoKill(): Promise<{ killed: { pid: number; signal: string; alive_after: boolean; run_id?: string; arm?: string }[] }> {
  const r = await callCtl("POST", "/demo/kill", {});
  return r.body as any;
}

export async function demoWorld(site: "A" | "B" | "C", status: "open" | "closed", notice?: string): Promise<{ world_version?: number }> {
  const r = await callCtl("POST", "/demo/world", { site: `site-${site}`, status, notice });
  return r.body as any;
}

export async function demoReset(): Promise<void> {
  await callCtl("POST", "/demo/reset", {});
}

export type LedgerOutcome = { action_key: string; receipt_id: string; slot: string; resource: string; outcome: string; reject_reason: string | null; amount: number; committed: boolean; cancelled: boolean; run_id: string; arm: string };
export type LedgerResponse = { world_version: number; outcomes: LedgerOutcome[]; requests: unknown[]; committed_by_slot: Record<string, number> };

export async function ledger(runId: string, arm: string): Promise<LedgerResponse> {
  const r = await fetch(`${DESK}/admin/ledger?run_id=${encodeURIComponent(assertRunId(runId))}&arm=${encodeURIComponent(arm)}`, { headers: OP });
  if (!r.ok) throw new Error(`GET ${DESK}/admin/ledger → HTTP ${r.status}`);
  return (await r.json()) as LedgerResponse;
}

export type MetricRow = { step: string; phase: string; context_tokens: number; planner_tokens_in: number; curator_ms: number; nimble_ms: number; rev: number };

/** Per-step planner input tokens for one run, straight from RawTree (S07-safe bounded query). */
export async function metricsForRun(runId: string): Promise<MetricRow[]> {
  const { client } = rawTreeFromEnv();
  const id = assertRunId(runId);
  const rows = await client.query(`SELECT step, phase, context_tokens, planner_tokens_in, curator_ms, nimble_ms, rev FROM metrics WHERE run_id = '${id}' ORDER BY toInt64(rev) LIMIT 5000`);
  return rows as unknown as MetricRow[];
}

export type FactProvenanceRow = { key: string; nimble_request_id: string | null; world_version: number | null; status: string; observed_at: string };

/** Which facts were observed via Nimble vs the direct fallback (the runner labels direct fallback ids "direct-…"). */
export async function factProvenanceForRun(runId: string): Promise<FactProvenanceRow[]> {
  const { client } = rawTreeFromEnv();
  const id = assertRunId(runId);
  const rows = await client.query(`SELECT key, nimble_request_id, world_version, status, observed_at FROM facts WHERE run_id = '${id}' ORDER BY toInt64(rev) LIMIT 5000`);
  return rows as unknown as FactProvenanceRow[];
}
