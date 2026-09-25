// Shared helpers for the operator-side demo scripts (they run on the operator's machine with the root .env;
// they never print secrets — only ids, statuses, timings).
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { REPO_ROOT, assertRunId, loadConfig } from "@dr/shared";

export const cfg = loadConfig("control");
export const CTL = `http://127.0.0.1:${cfg.DR_CONTROL_PORT}`;
export const DESK = cfg.DR_WORLD_BASE_URL.replace(/\/$/, "");
const OP = { authorization: `Bearer ${cfg.DR_OPERATOR_TOKEN}`, "content-type": "application/json" };
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const hhmmss = () => new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "America/Los_Angeles" });
export const say = (s: string) => console.log(`${hhmmss()} ${s}`);

export async function post<T = any>(url: string, body: unknown = {}): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: OP, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`POST ${url.replace(/^https?:\/\/[^/]+/, "")} → HTTP ${r.status} ${JSON.stringify(j)}`);
  return j as T;
}
export async function get<T = any>(url: string): Promise<T> {
  const r = await fetch(url, { headers: OP });
  if (!r.ok) throw new Error(`GET ${url.replace(/^https?:\/\/[^/]+/, "")} → HTTP ${r.status}`);
  return (await r.json()) as T;
}
export type MissionSnap = { arm: "dr" | "naive"; run_id: string; generation: number; pid: number | null; state: string; hold_line: string | null; last_exit: any; verdict: any; status_url: string };
export const missions = async () => (await get<{ missions: MissionSnap[] }>(`${CTL}/missions`)).missions;
export async function waitMissions(pred: (m: MissionSnap[]) => boolean, timeoutMs: number): Promise<MissionSnap[]> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const m = await missions();
    if (pred(m)) return m;
    if (Date.now() > end) throw new Error(`timeout waiting for missions: ${JSON.stringify(m.map((x) => [x.arm, x.state]))}`);
    await sleep(1000);
  }
}
export type LedgerOutcome = { action_key: string; receipt_id: string; slot: string; resource: string; outcome: string; reject_reason: string | null; committed: boolean };
export const ledger = async (run_id: string, arm: string) =>
  (await get<{ outcomes: LedgerOutcome[]; requests: unknown[] }>(`${DESK}/admin/ledger?run_id=${assertRunId(run_id)}&arm=${arm}`));

const LAST = resolve(REPO_ROOT, "artifacts/last-demo.json");
export function saveLast(x: Record<string, string>) { mkdirSync(resolve(REPO_ROOT, "artifacts"), { recursive: true }); writeFileSync(LAST, JSON.stringify({ ...x, at: new Date().toISOString() }, null, 2)); }
export function loadLast(): Record<string, string> { return existsSync(LAST) ? JSON.parse(readFileSync(LAST, "utf8")) : {}; }

/** Build closing-numbers SQL from the template; run ids are validated (no bind params in RawTree SQL). */
export function closingSql(dr: string, naive: string): string[] {
  const t = readFileSync(resolve(REPO_ROOT, "scripts/closing-numbers.sql"), "utf8");
  const filled = t.replaceAll("{{DR_RUN}}", assertRunId(dr)).replaceAll("{{NAIVE_RUN}}", assertRunId(naive));
  return filled.split(/;\s*\n/).map((s) => s.replace(/--.*$/gm, "").trim()).filter(Boolean);
}
