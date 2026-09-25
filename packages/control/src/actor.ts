// Mission actor: the single writer (serialized acked appends to RawTree, control-assigned rev), the event bus
// (SSE + AG-UI), and the supervisor that spawns/kills runner children with the env allowlist.
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  AckError, F3, HOLD_LINE_PREFIX, REPO_ROOT, assertRunId, buildRunnerEnv, encodeSse, isTableName, newRunId, parseRow,
  type Arm, type ConfigOf, type Projection, type SseEnvelope, type SseEventType, type TableName,
} from "@dr/shared";
import { RawTreeClient, RawTreeLoader, RawTreeSink, applyRow, emptyProjection, totalRows, waitForRow } from "@dr/storage";

export const RUNNER_MAIN = resolve(REPO_ROOT, "packages/runner/src/main.ts");
export const SIM_CLOCK_RESUME = "2026-10-10T09:00:00-07:00 SIMULATED (+48h)";

export type MissionState = "starting" | "running" | "holding" | "killed" | "done" | "failed";
export type Mission = {
  arm: Arm;
  run_id: string;
  generation: number;
  pid: number | null;
  state: MissionState;
  token: string;
  statusUrl: string;
  transcriptPath: string;
  holdLine: string | null;
  lastExit: { pid: number; code: number | null; signal: string | null } | null;
  verdict: { verdict: string; reason: string; duplicate_effects: number; stale_actions: number } | null;
  child: ChildProcess | null;
  exited: Promise<void>;
};

type Listener = (e: SseEnvelope) => void;

export class MissionActor {
  readonly client: RawTreeClient;
  private sink: RawTreeSink;
  private loader: RawTreeLoader;
  private seq = 0;
  private buffer: SseEnvelope[] = [];
  private listeners = new Set<Listener>();
  private queue: Promise<unknown> = Promise.resolve();
  private revs = new Map<string, number>();
  private tokens = new Map<string, { run_id: string; arm: Arm }>();
  readonly cache = new Map<string, Projection>();
  readonly missions: Partial<Record<Arm, Mission>> = {};

  constructor(readonly cfg: ConfigOf<"control">, readonly controlUrl: string) {
    this.client = new RawTreeClient({ baseUrl: cfg.RAWTREE_BASE_URL, apiKey: cfg.RAWTREE_API_KEY, database: cfg.RAWTREE_DATABASE });
    this.sink = new RawTreeSink(this.client);
    this.loader = new RawTreeLoader(this.client);
  }

  // ---------------------------------------------------------------- events
  publish(type: SseEventType, data: unknown, extra: Partial<SseEnvelope> = {}): SseEnvelope {
    const e: SseEnvelope = { type, seq: ++this.seq, ts: new Date().toISOString(), data, ...extra };
    this.buffer.push(e);
    if (this.buffer.length > 2000) this.buffer.shift();
    for (const l of this.listeners) { try { l(e); } catch { /* listener errors never break the actor */ } }
    return e;
  }
  log(line: string, arm?: Arm, run_id?: string) {
    console.log(`${arm ? `[${arm}] ` : ""}${line}`);
    this.publish("log", { line }, { arm, run_id });
  }
  subscribe(l: Listener): () => void { this.listeners.add(l); return () => this.listeners.delete(l); }
  recent(n = 500): SseEnvelope[] { return this.buffer.slice(-n); }
  sse(e: SseEnvelope): string { return encodeSse(e); }

  // ---------------------------------------------------------------- single writer
  authRunner(header: string | undefined): { run_id: string; arm: Arm } | null {
    const tok = (header ?? "").replace(/^Bearer\s+/i, "");
    return this.tokens.get(tok) ?? null;
  }

  /** Serialized, acked append. Control assigns rev (authoritative). */
  appendRow(who: { run_id: string; arm: Arm }, table: string, row: Record<string, unknown>): Promise<{ inserted: 1; rev: number }> {
    const run = this.queue.then(async () => {
      if (!isTableName(table)) throw new AckError(`unknown table ${table}`);
      if (row.run_id !== who.run_id || row.arm !== who.arm) throw new AckError("row run_id/arm does not match the runner token");
      const rev = Math.max(this.revs.get(who.run_id) ?? 0, Number(row.rev ?? 0) - 1) + 1;
      const parsed = parseRow(table as TableName, { ...row, rev });
      await this.sink.append(table as TableName, parsed as Record<string, unknown>);
      this.revs.set(who.run_id, rev);
      const p = this.cache.get(who.run_id) ?? emptyProjection(who.run_id);
      applyRow(p, table as TableName, parsed);
      this.cache.set(who.run_id, p);
      this.publish(table === "metrics" ? "metric" : "row", parsed, { table: table as TableName, run_id: who.run_id, arm: who.arm });
      return { inserted: 1 as const, rev };
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async projection(runId: string, purpose: string): Promise<{ projection: Projection; rows_loaded: Projection["rows_loaded"]; total_rows: number }> {
    assertRunId(runId);
    const arm = this.armOf(runId);
    this.cache.delete(runId);
    const p = await this.loader.load(runId);
    const n = totalRows(p);
    this.cache.set(runId, p);
    this.revs.set(runId, Math.max(this.revs.get(runId) ?? 0, p.rev));
    if (purpose === "verdict") this.log(`verdict check: re-read ${n} rows of ${runId} from RawTree`, arm, runId);
    else this.log(`control cache invalidated; RESTORING FROM RAWTREE… ${n} rows · epoch ${p.epoch + 1}`, arm, runId);
    return { projection: p, rows_loaded: p.rows_loaded, total_rows: n };
  }

  async intentVisible(runId: string, actionKey: string): Promise<number> {
    const r = await waitForRow(this.client, "commitments", runId, (row) => row.action_key === actionKey && row.status === "intent", { deadlineMs: 10_000, intervalMs: 200 });
    return r.visible_ms;
  }

  private armOf(runId: string): Arm | undefined {
    for (const m of Object.values(this.missions)) if (m?.run_id === runId) return m.arm;
    return undefined;
  }

  // ---------------------------------------------------------------- supervisor
  /** Error message if any arm still has a live child (start would throw), else null. */
  startBlocker(arms: Arm[]): string | null {
    for (const arm of arms) {
      const prev = this.missions[arm];
      if (prev?.child && prev.state !== "killed" && prev.state !== "done" && prev.state !== "failed") return `${arm} mission ${prev.run_id} still has a live child pid ${prev.pid}`;
    }
    return null;
  }

  start(arms: Arm[], opts: { crash: boolean; statusUrl: string }): Mission[] {
    const out: Mission[] = [];
    const blocker = this.startBlocker(arms);
    if (blocker) throw new Error(blocker);
    for (const arm of arms) {
      const run_id = newRunId();
      mkdirSync(resolve(REPO_ROOT, "artifacts/naive"), { recursive: true });
      const m: Mission = {
        arm, run_id, generation: 0, pid: null, state: "starting", token: "", statusUrl: opts.statusUrl,
        transcriptPath: resolve(REPO_ROOT, `artifacts/naive/${run_id}.json`), holdLine: null, lastExit: null, verdict: null, child: null, exited: Promise.resolve(),
      };
      this.missions[arm] = m;
      this.spawn(m, { crash: opts.crash, simClock: F3.sim_clock });
      out.push(m);
    }
    return out;
  }

  resume(opts: { simClock?: string } = {}): Mission[] {
    const out: Mission[] = [];
    for (const m of Object.values(this.missions)) {
      if (!m || m.verdict || (m.child && m.pid && m.state !== "killed" && m.state !== "failed")) continue;
      this.spawn(m, { crash: false, simClock: opts.simClock ?? SIM_CLOCK_RESUME });
      out.push(m);
    }
    return out;
  }

  private spawn(m: Mission, o: { crash: boolean; simClock: string }) {
    m.generation += 1;
    if (m.token) this.tokens.delete(m.token);
    m.token = randomBytes(24).toString("hex");
    this.tokens.set(m.token, { run_id: m.run_id, arm: m.arm });
    const env = buildRunnerEnv(this.cfg, {
      DR_RUN_ID: m.run_id, DR_EPOCH: m.generation, DR_ARM: m.arm, DR_CRASH_AFTER: o.crash ? "after_desk_commit" : "",
      DR_CONTROL_URL: this.controlUrl, DR_RUNNER_TOKEN: m.token,
    });
    const args = ["--import", "tsx", RUNNER_MAIN, `--status-url=${m.statusUrl}`, `--sim-clock=${o.simClock}`];
    if (m.arm === "naive") args.push("--resume=transcript", `--transcript=${m.transcriptPath}`);
    const child = spawn(process.execPath, args, { cwd: REPO_ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    m.child = child;
    m.pid = child.pid ?? null;
    m.state = "running";
    m.holdLine = null;
    this.publish("worker", { state: "spawned", pid: m.pid, epoch: m.generation, arm: m.arm, env_keys: Object.keys(env).sort() }, { run_id: m.run_id, arm: m.arm });
    this.log(`supervisor: spawned runner pid=${m.pid} generation ${m.generation}${o.crash ? " (crash armed: after_desk_commit)" : ""} · child env keys: ${Object.keys(env).sort().join(",")}`, m.arm, m.run_id);
    createInterface({ input: child.stdout! }).on("line", (line) => this.onChildLine(m, line));
    createInterface({ input: child.stderr! }).on("line", (line) => this.log(`stderr: ${line}`, m.arm, m.run_id));
    m.exited = new Promise((res) => {
      child.on("exit", (code, signal) => {
        m.lastExit = { pid: m.pid ?? -1, code, signal };
        m.state = signal === "SIGKILL" ? "killed" : code === 0 ? "done" : "failed";
        m.child = null;
        this.publish("worker", { state: "exited", pid: m.pid, epoch: m.generation, code, signal }, { run_id: m.run_id, arm: m.arm });
        this.log(`supervisor: runner pid=${m.pid} exited code=${code} signal=${signal}`, m.arm, m.run_id);
        res();
      });
    });
  }

  private onChildLine(m: Mission, line: string) {
    if (line.startsWith("@@DR ")) {
      try {
        const ev = JSON.parse(line.slice(5)) as { kind: string } & Record<string, unknown>;
        if (ev.kind === "verdict") m.verdict = { verdict: String(ev.verdict), reason: String(ev.reason), duplicate_effects: Number(ev.duplicate_effects), stale_actions: Number(ev.stale_actions) };
        this.publish("worker", { ...ev, pid: m.pid, epoch: m.generation }, { run_id: m.run_id, arm: m.arm });
      } catch { this.log(line, m.arm, m.run_id); }
      return;
    }
    if (line.startsWith(HOLD_LINE_PREFIX)) {
      m.state = "holding";
      m.holdLine = line;
      this.publish("worker", { state: "holding", pid: m.pid, epoch: m.generation, line }, { run_id: m.run_id, arm: m.arm });
    }
    this.log(line, m.arm, m.run_id);
  }

  /** SIGKILL every held child (or every live child with all=true). Returns pid + observed signal. */
  async kill(all = false): Promise<{ arm: Arm; run_id: string; pid: number | null; signal: string | null; alive_after: boolean }[]> {
    const targets = Object.values(this.missions).filter((m): m is Mission => !!m && !!m.child && (all || m.state === "holding"));
    const out = [];
    for (const m of targets) {
      const pid = m.pid;
      this.log(`demo: kill -9 ${pid}`, m.arm, m.run_id);
      m.child!.kill("SIGKILL");
      await m.exited;
      let alive = false;
      try { if (pid) { process.kill(pid, 0); alive = true; } } catch { alive = false; }
      out.push({ arm: m.arm, run_id: m.run_id, pid, signal: m.lastExit?.signal ?? null, alive_after: alive });
    }
    return out;
  }

  snapshot() {
    return Object.values(this.missions).filter(Boolean).map((m) => ({
      arm: m!.arm, run_id: m!.run_id, generation: m!.generation, pid: m!.pid, state: m!.state, hold_line: m!.holdLine,
      last_exit: m!.lastExit, verdict: m!.verdict, status_url: m!.statusUrl,
    }));
  }

  shutdown() { for (const m of Object.values(this.missions)) m?.child?.kill("SIGTERM"); }
}
