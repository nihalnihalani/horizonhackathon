// Mission actor: the single writer (serialized acked appends, control-assigned rev), the mission lifecycle owner
// (commands, dispatch claims, pause/cancel reconciliation), the event bus (SSE + AG-UI), and the supervisor that
// spawns/kills runner children with the env allowlist. Every canonical row is FIRST a typed event in the
// CanonicalEventSink, then mirrored to its legacy RawTree table (metrics: row only).
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  ACTIVE_STATUSES, AckError, F3, HOLD_LINE_PREFIX, REPO_ROOT, TRANSITIONS, assertRunId, buildRunnerEnv, canTransition, encodeSse, eventTypeForRow,
  hashPayload, isTableName, makeEvent, newRunId, parseRow,
  type Arm, type CanonicalEventSink, type CommandKind, type ConfigOf, type CrashPoint, type DeskClient, type EventType,
  type FactRow, type MissionMeta, type MissionSnapshot, type MissionStatus, type Projection, type SseEnvelope, type SseEventType, type TableName,
} from "@dr/shared";
import {
  RawTreeClient, RawTreeEventLog, RawTreeLoader, RawTreeSink, applyEvent, applyRow, emptyProjection, restoreFromEvents, totalRows,
  waitForRow, writeCheckpoint,
} from "@dr/storage";
import { HttpDeskClient } from "@dr/kernel/desk-client";
import { ApprovalError, assertApprovalCovers, decideApproval, proposeApproval, type Approval, type ApprovalBinding } from "@dr/task-kernel";
import {
  commandArgsHash, decideArmCrash, decideCancel, decideClaim, decideCommand, decidePause, decideResume, isRefusal,
  newMissionMeta, statusPath, toApiError, unresolvedClaims, type CommandInput, type Refusal,
} from "./lifecycle.ts";
import { MemoryEventLog } from "./memory-event-log.ts";

export const RUNNER_MAIN = resolve(REPO_ROOT, "packages/runner/src/main.ts");
export const SIM_CLOCK_RESUME = "2026-10-10T09:00:00-07:00 SIMULATED (+48h)";

export type MissionState = "created" | "starting" | "running" | "holding" | "killed" | "done" | "failed";
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
  meta: MissionMeta;
  updatedAt: string;
  reconciling: boolean;
  /** CONTRACTS §3: "auto" = creation authorizes fixture bookings within constraints; "per_action" = each claim needs an approval */
  review: "auto" | "per_action";
  /** by approvalId (deterministic from the binding hash); persisted as APPROVAL_REQUESTED / APPROVAL_DECIDED events */
  approvals: Map<string, Approval>;
  /** every facts row this control process wrote for the mission (bounded), for evidence lookup by id/version */
  factRows: FactRow[];
  /** F4: hash/revision of the last row-carrying event, so a Journal retry after a mirror failure reuses it */
  lastRowEvent: { hash: string; revision: number } | null;
};

export type EvidenceView = {
  evidenceId: string; missionId: string; kind: "fact" | "observation";
  provenance: { sourceUrl: string | null; taskId: string | null; retrievalMode: "live" | "direct" | null; observedAt: string; worldVersion: number | null; status: string };
  excerpt: string; truncated: boolean;
};

/** HTTP-shaped command result; duplicates return the stored one verbatim (D02). */
export type CommandResult = { http: number; body: Record<string, unknown> };

export type ActorOptions = {
  events?: CanonicalEventSink;
  /** control-side desk client for lookup-only reconciliation after a runner exits while pausing/cancelling */
  desk?: DeskClient;
  /** override the runner entrypoint (tests use a bounded booking child) */
  runnerMain?: string;
  /** bounded polling before exposing reconciliationStatus=blocked */
  reconcile?: { polls: number; intervalMs: number };
  statusUrl?: () => Promise<string> | string;
  /** write a mission_checkpoints row after each commitment outcome (default true for the RawTree log) */
  checkpoints?: boolean;
};

type Listener = (e: SseEnvelope) => void;

/** F3: the mission stopped (cancel/pause/terminal); the runner must not start new intents or claim a verdict. */
export class MissionStopped extends Error { code = "MISSION_STOPPED"; }
/** F8: a runner token presented a row for another run/arm. */
export class RowIdentityMismatch extends Error { code = "FORBIDDEN"; }
const STOPPED: readonly MissionStatus[] = ["cancelling", "cancelled", "paused", "valid", "failed"];
const RESOLVED = new Set(["confirmed", "rejected", "not_executed"]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const STATUS_EVENT: Partial<Record<MissionStatus, EventType>> = {
  paused: "MISSION_PAUSED", cancelled: "MISSION_CANCELLED", blocked: "MISSION_BLOCKED", valid: "MISSION_VALIDATED",
};

export class MissionActor {
  readonly client: RawTreeClient;
  readonly events: CanonicalEventSink;
  private sink: RawTreeSink;
  private loader: RawTreeLoader;
  private desk: DeskClient | null;
  private seq = 0;
  private buffer: SseEnvelope[] = [];
  private listeners = new Set<Listener>();
  private queue: Promise<unknown> = Promise.resolve();
  private revs = new Map<string, number>();
  private tokens = new Map<string, { run_id: string; arm: Arm }>();
  private createCommands = new Map<string, { argsHash: string; missionId: string; created: boolean; result: CommandResult | null }>();
  private rawtreeOk = true;
  private deskProbe: { ok: boolean; at: number } = { ok: true, at: 0 };
  readonly cache = new Map<string, Projection>();
  /** Event-derived projection per mission (applyEvent over every acked event); source of checkpoints. */
  private canon = new Map<string, Projection>();
  readonly missions: Partial<Record<Arm, Mission>> = {};
  readonly byId = new Map<string, Mission>();

  constructor(readonly cfg: ConfigOf<"control">, readonly controlUrl: string, readonly opts: ActorOptions = {}) {
    this.client = new RawTreeClient({ baseUrl: cfg.RAWTREE_BASE_URL, apiKey: cfg.RAWTREE_API_KEY, database: cfg.RAWTREE_DATABASE });
    this.sink = new RawTreeSink(this.client);
    this.loader = new RawTreeLoader(this.client);
    this.events = opts.events ?? new MemoryEventLog();
    this.desk = opts.desk ?? null;
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

  /** One global serialized queue: user commands, claims and child row writes are ordered against each other. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  revision(missionId: string): number { return this.events.watermark(missionId); }

  private async appendEvent(m: Mission, type: EventType, payload: Record<string, unknown>, commandId?: string): Promise<number> {
    const ev = makeEvent({
      missionId: m.run_id, batchId: m.meta.batchId, arm: m.arm, revision: this.events.watermark(m.run_id) + 1,
      commandId: commandId ?? null, epoch: m.generation, type, payload,
    });
    try {
      const r = await this.events.append(ev);
      this.rawtreeOk = true;
      await this.afterEvent(m, ev);
      m.updatedAt = ev.writtenAt;
      this.publish("worker", { kind: "event", type, revision: r.revision }, { run_id: m.run_id, arm: m.arm });
      return r.revision;
    } catch (e) {
      this.rawtreeOk = false;
      throw e instanceof AckError ? e : new AckError(`event append failed: ${(e as Error).message}`);
    }
  }

  /** Keep the event-derived projection current; checkpoint after each commitment outcome (CONTRACTS §4 step 5). */
  private async afterEvent(m: Mission, ev: ReturnType<typeof makeEvent>): Promise<void> {
    const p = this.canon.get(m.run_id) ?? emptyProjection(m.run_id);
    try { applyEvent(p, ev); } catch (e) { this.log(`event reducer: ${(e as Error).message}`, m.arm, m.run_id); return; }
    this.canon.set(m.run_id, p);
    const payload = ev.payload as { table?: string; row?: { status?: string } };
    const outcome = ev.type === "OUTCOME_RECORDED" && payload.table === "commitments" && payload.row?.status !== "intent";
    if (!outcome || !(this.opts.checkpoints ?? this.events instanceof RawTreeEventLog)) return;
    try {
      await writeCheckpoint(this.client, m.run_id, ev.revision, structuredClone(p), ev);
      this.log(`checkpoint ${m.run_id}@${ev.revision} written`, m.arm, m.run_id);
    } catch (e) {
      // A missing checkpoint only lengthens replay; restore falls back to an earlier one or full event replay.
      this.log(`checkpoint ${m.run_id}@${ev.revision} not written (${(e as Error).message}); restore will replay events`, m.arm, m.run_id);
    }
  }

  private async setStatus(m: Mission, to: MissionStatus, reason: string | null, o: { childExited?: boolean; commandId?: string } = {}): Promise<void> {
    const from = m.meta.status;
    if (from === to) return;
    if (!canTransition(from, to, { childExited: o.childExited })) throw new Error(`INVALID_TRANSITION ${from} → ${to}`);
    // `status`/`blockedReason` are the fields the storage reducer (applyEvent) restores from
    await this.appendEvent(m, STATUS_EVENT[to] ?? "MISSION_STATUS_CHANGED", { from, to, status: to, reason, ...(to === "blocked" ? { blockedReason: reason } : {}) }, o.commandId);
    m.meta.status = to;
    if (to === "blocked") m.meta.blockedReason = reason;
    else if (to === "queued") m.meta.blockedReason = null;
    this.log(`mission ${m.run_id}: ${from} → ${to}${reason ? ` (${reason})` : ""}`, m.arm, m.run_id);
  }

  /** Runner-driven jumps (e.g. restoring → valid) walk the transition table rather than skipping it. */
  private async moveTo(m: Mission, to: MissionStatus, reason: string | null): Promise<void> {
    const path = statusPath(m.meta.status, to, TRANSITIONS);
    if (!path) { this.log(`mission ${m.run_id}: no transition path ${m.meta.status} → ${to}; status kept`, m.arm, m.run_id); return; }
    for (const s of path) await this.setStatus(m, s, s === to ? reason : null);
  }

  private async setReconciliation(m: Mission, status: MissionMeta["reconciliationStatus"], reason: string | null): Promise<void> {
    if (m.meta.reconciliationStatus === status) return;
    const clear = status === "none" && m.meta.status !== "blocked"; // F5: a resolved reconciliation block leaves no stale reason
    await this.appendEvent(m, "MISSION_STATUS_CHANGED", { from: m.meta.status, to: m.meta.status, reconciliationStatus: status, reason, ...(clear ? { blockedReason: null } : {}) });
    m.meta.reconciliationStatus = status;
    if (status === "blocked") m.meta.blockedReason = reason;
    if (clear) m.meta.blockedReason = null;
    this.log(`mission ${m.run_id}: reconciliation ${status}${reason ? ` (${reason})` : ""}`, m.arm, m.run_id);
  }

  /** F8: control-side lookups are namespaced to the mission's run/arm (no cross-run receipt). */
  private deskFor(m: Mission): DeskClient {
    return this.desk ?? new HttpDeskClient({ baseUrl: this.cfg.DR_WORLD_BASE_URL, token: this.cfg.DR_WORLD_TOKEN, ns: { run_id: m.run_id, arm: m.arm } });
  }

  // ---------------------------------------------------------------- single writer
  authRunner(header: string | undefined): { run_id: string; arm: Arm } | null {
    const tok = (header ?? "").replace(/^Bearer\s+/i, "");
    return this.tokens.get(tok) ?? null;
  }

  /** Serialized, acked append. Control assigns rev (authoritative). */
  appendRow(who: { run_id: string; arm: Arm }, table: string, row: Record<string, unknown>): Promise<{ inserted: 1; rev: number }> {
    return this.enqueue(() => this.appendRowNow(who, table, row));
  }

  private async appendRowNow(who: { run_id: string; arm: Arm }, table: string, row: Record<string, unknown>): Promise<{ inserted: 1; rev: number }> {
    if (!isTableName(table)) throw new AckError(`unknown table ${table}`);
    if (row.run_id !== who.run_id || row.arm !== who.arm) throw new RowIdentityMismatch("row run_id/arm does not match the runner token");
    const rev = Math.max(this.revs.get(who.run_id) ?? 0, Number(row.rev ?? 0) - 1) + 1;
    const parsed = parseRow(table as TableName, { ...row, rev }) as Record<string, unknown>;
    const m = this.byId.get(who.run_id);
    const terminalEpoch = table === "epochs" && parsed.reason === "terminal";
    if (m && STOPPED.includes(m.meta.status) && ((table === "commitments" && parsed.status === "intent") || terminalEpoch)) {
      throw new MissionStopped(`mission is ${m.meta.status}; ${terminalEpoch ? "no runner verdict" : "no new intent"} accepted`);
    }
    let type = eventTypeForRow(table as TableName, parsed);
    // F3: mission status (valid/blocked) changes only through setStatus; a runner's terminal epoch row is a report
    if (terminalEpoch && type) type = "MISSION_STATUS_CHANGED";
    if (m && type) {
      const payload = { table, row: parsed };
      const hash = hashPayload(payload);
      // F4: the Journal retries the identical row (same ts/rev) after a mirror failure: reuse the acked event
      if (m.lastRowEvent?.hash === hash && m.lastRowEvent.revision === this.events.watermark(m.run_id)) {
        this.log(`single writer: identical row retry reuses event rev ${m.lastRowEvent.revision}; retrying mirror only`, m.arm, m.run_id);
      } else {
        const revision = await this.appendEvent(m, type, payload);
        m.lastRowEvent = { hash, revision };
      }
    }
    try {
      await this.sink.append(table as TableName, parsed);
      this.rawtreeOk = true;
    } catch (e) { this.rawtreeOk = false; throw e; }
    this.revs.set(who.run_id, rev);
    const p = this.cache.get(who.run_id) ?? emptyProjection(who.run_id);
    applyRow(p, table as TableName, parsed as never);
    this.cache.set(who.run_id, p);
    this.publish(table === "metrics" ? "metric" : "row", parsed, { table: table as TableName, run_id: who.run_id, arm: who.arm });
    if (m && table === "facts") { m.factRows.push(parsed as unknown as FactRow); if (m.factRows.length > 500) m.factRows.shift(); }
    if (m && table === "commitments") await this.onCommitment(m, parsed);
    return { inserted: 1 as const, rev };
  }

  /** A definitive outcome resolves the claim; pause/cancel complete once no claim is unresolved. */
  private async onCommitment(m: Mission, row: Record<string, unknown>): Promise<void> {
    const key = String(row.action_key);
    if (!m.meta.claims[key] || !RESOLVED.has(String(row.status))) return;
    delete m.meta.claims[key];
    this.log(`claim for ${key.slice(0, 12)}… resolved (${row.status})`, m.arm, m.run_id);
    await this.finishStopIfResolved(m);
  }

  private async finishStopIfResolved(m: Mission): Promise<void> {
    if (unresolvedClaims(m.meta).length) return;
    if (m.meta.reconciliationStatus !== "none") await this.setReconciliation(m, "none", null);
    if (m.meta.status === "pausing") await this.setStatus(m, "paused", "every claimed action resolved");
    else if (m.meta.status === "cancelling") await this.setStatus(m, "cancelled", "every claimed action resolved");
  }

  async projection(runId: string, purpose: string): Promise<{ projection: Projection; rows_loaded: Projection["rows_loaded"]; total_rows: number }> {
    assertRunId(runId);
    const arm = this.armOf(runId);
    this.cache.delete(runId);
    const m = this.byId.get(runId);
    // S10: a parent-retained ambiguous append is resolved by its original id/hash before anything is restored.
    const pend = await this.events.resolvePending(runId);
    if (pend === "blocked") throw new AckError(`pending canonical append for ${runId} is unresolved; restore and new revisions blocked`);
    const rows = await this.loader.load(runId);
    let p = rows;
    let source = "legacy row tables";
    const watermark = this.events.watermark(runId);
    if (this.events instanceof RawTreeEventLog && watermark > 0) {
      // Canonical restore: latest valid checkpoint ≤ watermark + contiguous ordered events. Gaps/conflicts throw (block).
      const r = await restoreFromEvents(this.client, runId, { watermark });
      p = r.projection;
      p.metrics = rows.metrics; // metrics are non-canonical measurements, read from their table
      p.rows_loaded = rows.rows_loaded;
      source = `mission_events rev ${r.revision}${r.checkpoint ? ` from checkpoint @${r.checkpoint.revision}` : ""} + ${r.eventsReplayed} events`;
      const drift = (["commitments", "receipts", "plan_steps", "facts"] as const).filter((t) => Object.keys(p[t]).length !== Object.keys(rows[t]).length);
      if (drift.length) this.log(`restore: row mirror differs from canonical events for ${drift.join(",")} (events win)`, m?.arm, runId);
    }
    const n = source.startsWith("mission_events") ? this.events.watermark(runId) : totalRows(p);
    if (m) p.mission = structuredClone(m.meta);
    this.cache.set(runId, p);
    this.revs.set(runId, Math.max(this.revs.get(runId) ?? 0, p.rev));
    if (purpose === "verdict") this.log(`verdict check: re-read ${n} rows of ${runId} from RawTree`, arm, runId);
    else this.log(`control cache invalidated; RESTORING FROM RAWTREE… ${n} ${source.startsWith("mission_events") ? "events" : "rows"} · epoch ${p.epoch + 1} · ${source}`, arm, runId);
    return { projection: p, rows_loaded: p.rows_loaded, total_rows: n };
  }

  async intentVisible(runId: string, actionKey: string): Promise<number> {
    const r = await waitForRow(this.client, "commitments", runId, (row) => row.action_key === actionKey && row.status === "intent", { deadlineMs: 10_000, intervalMs: 200 });
    return r.visible_ms;
  }

  private armOf(runId: string): Arm | undefined { return this.byId.get(runId)?.arm; }

  /** R08: can a durable record for an id this process does not own exist? Unavailable storage counts as "maybe". */
  async mayHaveDurableRecord(missionId: string): Promise<boolean> {
    try { assertRunId(missionId); } catch { return false; }
    try { return totalRows(await this.loader.load(missionId)) > 0; } catch { return true; }
  }

  // ---------------------------------------------------------------- lifecycle commands
  childActive(m: Mission): boolean {
    return !!m.child && m.state !== "killed" && m.state !== "done" && m.state !== "failed";
  }

  private newMission(o: { arm: Arm; ownerId: string; goal: string; statusUrl: string; batchId?: string; run_id?: string }): Mission {
    const run_id = o.run_id ?? newRunId();
    mkdirSync(resolve(REPO_ROOT, "artifacts/naive"), { recursive: true });
    const m: Mission = {
      arm: o.arm, run_id, generation: 0, pid: null, state: "created", token: "", statusUrl: o.statusUrl,
      transcriptPath: resolve(REPO_ROOT, `artifacts/naive/${run_id}.json`), holdLine: null, lastExit: null, verdict: null, child: null,
      exited: Promise.resolve(), meta: newMissionMeta({ missionId: run_id, ownerId: o.ownerId, batchId: o.batchId ?? run_id, goal: o.goal }),
      updatedAt: new Date().toISOString(), reconciling: false, review: "auto", approvals: new Map(), factRows: [], lastRowEvent: null,
    };
    this.byId.set(run_id, m);
    this.missions[o.arm] = m;
    return m;
  }

  private async recordCommand(m: Mission, cmd: CommandInput, hash: string, body: Record<string, unknown>, http: number): Promise<CommandResult> {
    const revision = this.events.watermark(m.run_id) + 1;
    const result: CommandResult = { http, body: { ...body, missionId: m.run_id, revision } };
    await this.appendEvent(m, "COMMAND_ACCEPTED", { commandId: cmd.commandId, kind: cmd.kind, argsHash: hash, result }, cmd.commandId);
    m.meta.commands[cmd.commandId] = { commandId: cmd.commandId, kind: cmd.kind, argsHash: hash, result, revision };
    return result;
  }

  private refuse(r: Refusal, m?: Mission): CommandResult {
    return { http: r.status, body: toApiError(r, m ? { missionId: m.run_id, currentRevision: this.revision(m.run_id) } : {}) as unknown as Record<string, unknown> };
  }

  /** POST /missions: `created`, no child, no effect (arm a crash before the first Resume). */
  createMission(o: { commandId: string; ownerId: string; goal: string; arm?: Arm; statusUrl?: string; batchId?: string; review?: "auto" | "per_action"; args?: Record<string, unknown> }): Promise<CommandResult> {
    return this.enqueue(async () => {
      const review = o.review ?? "auto";
      const cmd: CommandInput = { commandId: o.commandId, kind: "create", args: { goal: o.goal, arm: o.arm ?? "dr", owner: o.ownerId, batchId: o.batchId ?? null, review, ...(o.args ?? {}) } };
      const hash = commandArgsHash(cmd);
      let entry = this.createCommands.get(o.commandId);
      if (entry && entry.argsHash !== hash) return this.refuse({ code: "COMMAND_CONFLICT", status: 409, message: `commandId ${o.commandId} was already used with different arguments` });
      if (entry?.result) return entry.result;
      // F6a: the command is registered before the first append, so a retry after a partial failure finishes the SAME
      // mission (missing MISSION_CREATED / COMMAND_ACCEPTED) instead of creating a second one.
      let m = entry ? this.byId.get(entry.missionId)! : undefined;
      if (!m) {
        const statusUrl = o.statusUrl ?? String(await (this.opts.statusUrl?.() ?? "http://127.0.0.1:4402/status.html"));
        m = this.newMission({ arm: o.arm ?? "dr", ownerId: o.ownerId, goal: o.goal, statusUrl, batchId: o.batchId });
        m.review = review;
        entry = { argsHash: hash, missionId: m.run_id, created: false, result: null };
        this.createCommands.set(o.commandId, entry);
      }
      if (!entry!.created) {
        await this.appendEvent(m, "MISSION_CREATED", { missionId: m.run_id, ownerId: o.ownerId, goal: o.goal, batchId: m.meta.batchId, arm: m.arm, review }, o.commandId);
        entry!.created = true;
      }
      const result = await this.recordCommand(m, cmd, hash, { status: "created", review }, 201);
      entry!.result = result;
      return result;
    });
  }

  /** resume | pause | cancel | arm_crash on an owned mission (ownership is checked by the caller: server.ts). */
  command(missionId: string, c: { commandId: string; kind: Exclude<CommandKind, "create" | "approve">; expectedRevision?: number; args?: Record<string, unknown> }): Promise<CommandResult> {
    return this.enqueue(async () => {
      const m = this.byId.get(missionId);
      if (!m) return this.refuse({ code: "NOT_FOUND", status: 404, message: "unknown mission" });
      const cmd: CommandInput = { commandId: c.commandId, kind: c.kind, missionId, expectedRevision: c.expectedRevision, args: c.args ?? {} };
      const hash = commandArgsHash(cmd);
      const d = decideCommand(m.meta, cmd, hash, this.revision(missionId));
      if (d.kind === "duplicate") return d.result as CommandResult;
      // F5: the lookup-only poller owns the claimed outcome until it settles; never race it with a new generation
      // (checked before the revision check: the poller itself advances the revision)
      if (c.kind === "resume" && m.reconciling) return this.refuse({ code: "RECONCILING", status: 409, message: "lookup-only reconciliation in progress; retry Resume once it settles", retryable: true }, m);
      if (d.kind !== "accept") return this.refuse(d.refusal, m);
      if (c.kind === "resume") {
        const r = decideResume(m.meta, this.childActive(m));
        if (isRefusal(r)) return this.refuse(r, m);
        await this.setStatus(m, "queued", "explicit resume", { childExited: !this.childActive(m), commandId: c.commandId });
        const res = await this.recordCommand(m, cmd, hash, { status: "queued", generation: m.generation + 1 }, 202);
        await this.spawnGeneration(m, { simClock: typeof c.args?.simClock === "string" ? c.args.simClock : m.generation === 0 ? F3.sim_clock : SIM_CLOCK_RESUME });
        return res;
      }
      if (c.kind === "pause" || c.kind === "cancel") {
        const r = c.kind === "pause" ? decidePause(m.meta) : decideCancel(m.meta);
        if (isRefusal(r)) return this.refuse(r, m);
        for (const s of r.next) await this.setStatus(m, s, s === "pausing" || s === "cancelling" ? `${c.kind} requested` : "no unresolved dispatch claim", { commandId: c.commandId });
        const res = await this.recordCommand(m, cmd, hash, { status: m.meta.status, unresolvedClaims: unresolvedClaims(m.meta).map((x) => x.actionKey) }, 202);
        // a claimed action whose runner already exited is reconciled lookup-only now
        if (unresolvedClaims(m.meta).length && !this.childActive(m)) void this.reconcileStopped(m);
        return res;
      }
      if (c.kind === "arm_crash") {
        const r = decideArmCrash(m.meta, c.args?.point as CrashPoint, this.childActive(m));
        if (isRefusal(r)) return this.refuse(r, m);
        m.meta.armedCrash = r.point;
        return this.recordCommand(m, cmd, hash, { armedCrash: r.point }, 202);
      }
      return this.refuse({ code: "INVALID_TRANSITION", status: 409, message: `unsupported command ${c.kind}` }, m);
    });
  }

  /** POST /internal/dispatch-claim: serialized with pause/cancel in the same queue. */
  claimDispatch(who: { run_id: string; arm: Arm }, req: { actionKey: string; argsHash: string; slot: string; epoch: number }): Promise<CommandResult> {
    return this.enqueue(async () => {
      const m = this.byId.get(who.run_id);
      if (!m) return this.refuse({ code: "NOT_FOUND", status: 404, message: "unknown mission" });
      if (m.review === "per_action" && !m.meta.claims[req.actionKey]) {
        const gate = await this.reviewGate(m, req);
        if (gate) return gate;
      }
      const d = decideClaim(m.meta, {
        ...req, generation: req.epoch, currentGeneration: m.generation, commitments: this.cache.get(m.run_id)?.commitments,
      }, this.revision(m.run_id) + 1);
      if (d.kind === "refuse") {
        this.log(`dispatch claim REFUSED ${req.actionKey.slice(0, 12)}… (${d.refusal.code}): ${d.refusal.message}`, m.arm, m.run_id);
        return this.refuse(d.refusal, m);
      }
      if (d.kind === "grant") {
        await this.appendEvent(m, "DISPATCH_CLAIMED", { ...d.claim });
        m.meta.claims[req.actionKey] = d.claim;
        this.log(`dispatch claim GRANTED ${d.claim.dispatchId} for ${req.actionKey.slice(0, 12)}… slot ${req.slot}${m.arm === "naive" ? " (naive arm: attempt-derived key)" : ""}`, m.arm, m.run_id);
        await this.advanceNow(m, "executing");
      }
      return { http: 200, body: { granted: true, dispatchId: d.claim.dispatchId } };
    });
  }

  // ---------------------------------------------------------------- per-action review (U04/U06, invariant 17)
  private bindingFor(m: Mission, req: { actionKey: string; argsHash: string; slot: string }): ApprovalBinding | null {
    const c = this.cache.get(m.run_id)?.commitments[req.actionKey];
    if (!c || c.args_hash !== req.argsHash) return null;
    return {
      missionId: m.run_id, ownerId: m.meta.ownerId, planRevision: m.meta.planRevision, actionKey: req.actionKey, slot: req.slot,
      operation: c.kind, resourceId: c.resource, argsHash: req.argsHash,
    };
  }

  /** In the queue: refuse the claim until an accepted, unexpired approval binds exactly this commitment. */
  private async reviewGate(m: Mission, req: { actionKey: string; argsHash: string; slot: string }): Promise<CommandResult | null> {
    const b = this.bindingFor(m, req);
    if (!b) return this.refuse({ code: "INTENT_MISSING", status: 409, message: "no recorded intent with these arguments; nothing to review" }, m);
    const now = Date.now();
    const proposal = proposeApproval(b, { now, display: `${b.operation} ${b.resourceId} for slot ${b.slot} (plan rev ${b.planRevision})` });
    const existing = m.approvals.get(proposal.approvalId);
    if (existing?.status === "accepted") {
      try {
        assertApprovalCovers(existing, b, now);
        if (m.meta.status === "waiting_approval") await this.setStatus(m, "executing", `approval ${existing.approvalId} accepted`);
        return null;
      } catch (e) {
        return this.refuse({ code: (e as ApprovalError).code ?? "APPROVAL_CHANGED", status: 409, message: (e as Error).message }, m);
      }
    }
    if (existing?.status === "rejected") return this.refuse({ code: "APPROVAL_REJECTED", status: 409, message: `approval ${existing.approvalId} was rejected` }, m);
    let a = existing;
    if (!a || (a.status === "awaiting_review" && Date.parse(a.expiresAt) <= now) || a.status === "expired") {
      a = proposal;
      m.approvals.set(a.approvalId, a);
      await this.appendEvent(m, "APPROVAL_REQUESTED", { approval: a });
      this.log(`approval requested ${a.approvalId}: ${a.display}`, m.arm, m.run_id);
    }
    await this.advanceNow(m, "waiting_approval");
    return { http: 409, body: { ...toApiError({ code: "WAITING_APPROVAL", status: 409, message: `waiting for approval ${a.approvalId}` }, { missionId: m.run_id, currentRevision: this.revision(m.run_id) }), approvalId: a.approvalId } };
  }

  listApprovals(missionId: string): Approval[] { return [...(this.byId.get(missionId)?.approvals.values() ?? [])]; }

  /** POST /missions/:id/approvals/:approvalId. Deduplicated by commandId like every mutation. */
  decideApproval(missionId: string, approvalId: string, actorId: string, d: { commandId: string; decision: "accept" | "reject"; displayedBindingHash: string; expectedPlanRevision: number }): Promise<CommandResult> {
    return this.enqueue(async () => {
      const m = this.byId.get(missionId);
      if (!m) return this.refuse({ code: "NOT_FOUND", status: 404, message: "unknown mission" });
      const cmd: CommandInput = { commandId: d.commandId, kind: "approve", missionId, args: { approvalId, actorId, decision: d.decision, displayedBindingHash: d.displayedBindingHash, expectedPlanRevision: d.expectedPlanRevision } };
      const hash = commandArgsHash(cmd);
      const dc = decideCommand(m.meta, cmd, hash, this.revision(missionId));
      if (dc.kind === "duplicate") return dc.result as CommandResult;
      if (dc.kind !== "accept") return this.refuse(dc.refusal, m);
      const a = m.approvals.get(approvalId);
      if (!a) return this.refuse({ code: "NOT_FOUND", status: 404, message: `unknown approval ${approvalId}` }, m);
      let next: Approval;
      try {
        next = decideApproval(a, { actorId, displayedBindingHash: d.displayedBindingHash, expectedPlanRevision: d.expectedPlanRevision, currentPlanRevision: m.meta.planRevision, decision: d.decision, commandId: d.commandId, now: Date.now() });
      } catch (e) {
        const code = (e as ApprovalError).code ?? "APPROVAL_CHANGED";
        if (code === "APPROVAL_EXPIRED" && a.status === "awaiting_review") {
          m.approvals.set(approvalId, { ...a, status: "expired" });
          await this.appendEvent(m, "APPROVAL_DECIDED", { approvalId, status: "expired", commandId: d.commandId });
        }
        return this.refuse({ code, status: code === "APPROVAL_FORBIDDEN" ? 403 : 409, message: (e as Error).message }, m);
      }
      m.approvals.set(approvalId, next);
      await this.appendEvent(m, "APPROVAL_DECIDED", { approvalId, status: next.status, decidedBy: actorId, bindingHash: next.bindingHash, commandId: d.commandId }, d.commandId);
      this.log(`approval ${approvalId} ${next.status} by ${actorId}`, m.arm, m.run_id);
      return this.recordCommand(m, cmd, hash, { approvalId, status: next.status }, 200);
    });
  }

  // ---------------------------------------------------------------- finer status (from runner progress, via TRANSITIONS)
  private async advanceNow(m: Mission, to: MissionStatus): Promise<void> {
    if (!ACTIVE_STATUSES.includes(m.meta.status) || m.meta.status === to) return;
    if (!statusPath(m.meta.status, to, TRANSITIONS)) return;
    await this.moveTo(m, to, null);
  }
  private advance(m: Mission, to: MissionStatus): void {
    void this.enqueue(() => this.advanceNow(m, to)).catch((e) => this.log(`status ${to}: ${(e as Error).message}`, m.arm, m.run_id));
  }

  // ---------------------------------------------------------------- evidence (bounded, provenance only; no URL fetch)
  evidence(missionId: string, evidenceId: string, maxChars = 1000): EvidenceView | null {
    const m = this.byId.get(missionId);
    if (!m) return null;
    const cap = Math.max(1, Math.min(2000, maxChars));
    const fact = evidenceId.match(/^fact:([A-Za-z0-9._-]{1,64})@v?(\d{1,9})$/);
    const obs = evidenceId.match(/^obs:([A-Za-z0-9._:-]{1,128})$/);
    const mode = (t: string | null | undefined) => (t ? (t.startsWith("direct-") ? "direct" as const : "live" as const) : null);
    const cut = (t: string) => ({ excerpt: t.length > cap ? t.slice(0, cap) : t, truncated: t.length > cap });
    if (fact) {
      const [, key, v] = fact;
      const rows = m.factRows.filter((f) => f.key === key && (f.world_version ?? 0) === Number(v));
      const f = rows.find((x) => x.status === "active") ?? rows.at(-1);
      if (!f) return null;
      return {
        evidenceId, missionId, kind: "fact",
        provenance: { sourceUrl: f.source_url ?? null, taskId: f.nimble_request_id ?? null, retrievalMode: mode(f.nimble_request_id), observedAt: f.observed_at, worldVersion: f.world_version ?? null, status: rows.at(-1)!.status },
        ...cut(`${key} = ${f.value}${rows.at(-1)!.excerpt ? ` · ${rows.at(-1)!.excerpt}` : ""}`),
      };
    }
    if (obs) {
      const rows = m.factRows.filter((f) => f.nimble_request_id === obs[1]);
      if (!rows.length) return null;
      const latest = new Map(rows.map((r) => [r.key, r]));
      const f = rows[0]!;
      return {
        evidenceId, missionId, kind: "observation",
        provenance: { sourceUrl: f.source_url ?? null, taskId: obs[1]!, retrievalMode: mode(obs[1]), observedAt: f.observed_at, worldVersion: f.world_version ?? null, status: "recorded" },
        ...cut([...latest.values()].map((r) => `${r.key} = ${r.value}`).join("\n")),
      };
    }
    return null;
  }

  /** Cheap desk liveness probe for the snapshot (short timeout, cached 2 s). */
  async probeDesk(): Promise<boolean> {
    if (Date.now() - this.deskProbe.at < 2000) return this.deskProbe.ok;
    let ok = false;
    try { ok = (await fetch(`${this.cfg.DR_WORLD_BASE_URL.replace(/\/$/, "")}/health`, { signal: AbortSignal.timeout(800) })).ok; } catch { ok = false; }
    this.deskProbe = { ok, at: Date.now() };
    return ok;
  }

  /**
   * CONTRACTS §6 lookup-only reconciliation after the runner exited while pausing/cancelling: record a found outcome;
   * 404/unavailable keeps the outcome unknown and, after bounded polling, exposes reconciliationStatus=blocked.
   * Never resends, never writes not_executed, never finishes cancel with an unresolved claim.
   */
  private async reconcileStopped(m: Mission): Promise<void> {
    if (m.reconciling) return;
    m.reconciling = true;
    const { polls, intervalMs } = this.opts.reconcile ?? { polls: 3, intervalMs: 1000 };
    try {
      await this.enqueue(() => this.setReconciliation(m, "polling", null));
      for (let i = 0; i < polls && unresolvedClaims(m.meta).length; i++) {
        for (const claim of unresolvedClaims(m.meta)) {
          const r = await this.deskFor(m).lookup(claim.actionKey);
          this.log(`reconcile (lookup-only) ${claim.actionKey.slice(0, 12)}… → ${r.status}`, m.arm, m.run_id);
          if (r.status !== "found") continue;
          await this.enqueue(async () => {
            const c = this.cache.get(m.run_id)?.commitments[claim.actionKey];
            if (!c || !m.meta.claims[claim.actionKey]) return;
            const who = { run_id: m.run_id, arm: m.arm };
            const base = { run_id: m.run_id, arm: m.arm, ts: new Date().toISOString(), epoch: Math.max(1, this.cache.get(m.run_id)?.epoch ?? 1), rev: 0 };
            const rc = r.receipt;
            await this.appendRowNow(who, "receipts", { ...base, action_key: rc.action_key, receipt_id: rc.receipt_id, slot: rc.slot, resource: rc.resource, outcome: rc.outcome, reject_reason: rc.reject_reason ?? null, service_ts: rc.service_ts, amount: rc.amount, recovered: true });
            await this.appendRowNow(who, "commitments", { ...base, action_key: c.action_key, kind: c.kind, slot: c.slot, resource: c.resource, date: c.date, party: c.party, args_hash: c.args_hash, status: rc.committed ? "confirmed" : "rejected", receipt_id: rc.receipt_id, reversible: c.reversible, compensates: c.compensates ?? null, reason: "RECOVERED FROM DESK (lookup-only while stopping)" });
          });
        }
        if (unresolvedClaims(m.meta).length && i < polls - 1) await sleep(intervalMs);
      }
      await this.enqueue(async () => {
        const left = unresolvedClaims(m.meta);
        if (!left.length) return this.finishStopIfResolved(m);
        const who = { run_id: m.run_id, arm: m.arm };
        for (const claim of left) {
          const c = this.cache.get(m.run_id)?.commitments[claim.actionKey];
          if (c && c.status !== "unknown") {
            await this.appendRowNow(who, "commitments", { run_id: m.run_id, arm: m.arm, ts: new Date().toISOString(), epoch: Math.max(1, this.cache.get(m.run_id)?.epoch ?? 1), rev: 0, action_key: c.action_key, kind: c.kind, slot: c.slot, resource: c.resource, date: c.date, party: c.party, args_hash: c.args_hash, status: "unknown", receipt_id: null, reversible: c.reversible, compensates: c.compensates ?? null, reason: "claimed; runner exited; desk lookup absent/unavailable while stopping — never resent" });
          }
        }
        await this.setReconciliation(m, "blocked", `outcome unknown for claimed ${left.map((x) => x.actionKey.slice(0, 12)).join(", ")}; lookup absent/unavailable`);
      });
    } catch (e) {
      this.log(`reconcile (lookup-only) failed: ${(e as Error).message}`, m.arm, m.run_id);
    } finally { m.reconciling = false; }
  }

  private async onExit(m: Mission): Promise<void> {
    await this.enqueue(async () => {
      if (m.verdict && m.meta.status !== "pausing" && m.meta.status !== "cancelling" && m.meta.status !== "paused") {
        if (m.verdict.verdict === "VALID") await this.moveTo(m, "valid", m.verdict.reason);
        else await this.moveTo(m, "blocked", `${m.verdict.verdict}: ${m.verdict.reason}`);
      }
    }).catch((e) => this.log(`exit bookkeeping failed: ${(e as Error).message}`, m.arm, m.run_id));
    if ((m.meta.status === "pausing" || m.meta.status === "cancelling") && unresolvedClaims(m.meta).length) await this.reconcileStopped(m);
  }

  // ---------------------------------------------------------------- supervisor
  /** Error message if any arm still has a live child (start would throw), else null. */
  startBlocker(arms: Arm[]): string | null {
    for (const arm of arms) {
      const prev = this.missions[arm];
      if (prev && this.childActive(prev)) return `${arm} mission ${prev.run_id} still has a live child pid ${prev.pid}`;
    }
    return null;
  }

  /** Legacy demo start: create + (arm after_desk_commit) + resume per arm, through the same lifecycle. */
  async start(arms: Arm[], opts: { crash: boolean; statusUrl: string }): Promise<Mission[]> {
    const blocker = this.startBlocker(arms);
    if (blocker) throw new Error(blocker);
    const out: Mission[] = [];
    for (const arm of arms) {
      const tag = randomBytes(6).toString("hex");
      const created = await this.createMission({ commandId: `demo-create-${tag}`, ownerId: "operator", goal: "F3 Angel Island trip", arm, statusUrl: opts.statusUrl });
      const id = String(created.body.missionId);
      if (opts.crash) await this.command(id, { commandId: `demo-arm-${tag}`, kind: "arm_crash", args: { point: "after_desk_commit" } });
      const r = await this.command(id, { commandId: `demo-resume-${tag}`, kind: "resume" });
      if (r.http !== 202) throw new Error(String(r.body.message ?? "resume refused"));
      out.push(this.byId.get(id)!);
    }
    return out;
  }

  /** Legacy demo resume: every exited, verdict-less mission (lifecycle refusals are skipped, not forced). */
  async resume(opts: { simClock?: string } = {}): Promise<Mission[]> {
    const out: Mission[] = [];
    for (const m of Object.values(this.missions)) {
      if (!m || m.verdict || this.childActive(m)) continue;
      const r = await this.command(m.run_id, { commandId: `demo-resume-${randomBytes(6).toString("hex")}`, kind: "resume", args: { simClock: opts.simClock ?? SIM_CLOCK_RESUME } });
      if (r.http === 202) out.push(m);
    }
    return out;
  }

  private async spawnGeneration(m: Mission, o: { simClock: string }) {
    const crash = m.meta.armedCrash;
    m.meta.armedCrash = null; // fires for exactly one generation
    m.generation += 1;
    if (m.token) this.tokens.delete(m.token);
    m.token = randomBytes(24).toString("hex");
    this.tokens.set(m.token, { run_id: m.run_id, arm: m.arm });
    const env = buildRunnerEnv(this.cfg, {
      DR_RUN_ID: m.run_id, DR_EPOCH: m.generation, DR_ARM: m.arm === "naive" ? "naive" : "dr", DR_CRASH_AFTER: crash ?? "",
      DR_CONTROL_URL: this.controlUrl, DR_RUNNER_TOKEN: m.token,
    });
    const args = ["--import", "tsx", this.opts.runnerMain ?? RUNNER_MAIN, `--status-url=${m.statusUrl}`, `--sim-clock=${o.simClock}`];
    if (m.arm === "naive") args.push("--resume=transcript", `--transcript=${m.transcriptPath}`);
    const child = spawn(process.execPath, args, { cwd: REPO_ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    m.child = child;
    m.pid = child.pid ?? null;
    m.state = "running";
    m.holdLine = null;
    m.verdict = null;
    createInterface({ input: child.stdout! }).on("line", (line) => this.onChildLine(m, line));
    createInterface({ input: child.stderr! }).on("line", (line) => this.log(`stderr: ${line}`, m.arm, m.run_id));
    m.exited = new Promise((res) => {
      // F6b: exit can fire before stdout is drained; the verdict line must be parsed before exit bookkeeping
      const drained = Promise.all([once(child.stdout!, "close"), once(child.stderr!, "close")]).catch(() => undefined);
      child.on("exit", (code, signal) => {
        m.lastExit = { pid: m.pid ?? -1, code, signal };
        m.state = signal === "SIGKILL" ? "killed" : code === 0 ? "done" : "failed";
        m.child = null;
        void drained.then(() => {
          this.publish("worker", { state: "exited", pid: m.pid, epoch: m.generation, code, signal }, { run_id: m.run_id, arm: m.arm });
          this.log(`supervisor: runner pid=${m.pid} exited code=${code} signal=${signal}`, m.arm, m.run_id);
          res();
          void this.onExit(m);
        });
      });
    });
    this.publish("worker", { state: "spawned", pid: m.pid, epoch: m.generation, arm: m.arm, env_keys: Object.keys(env).sort() }, { run_id: m.run_id, arm: m.arm });
    this.log(`supervisor: spawned runner pid=${m.pid} generation ${m.generation}${crash ? ` (crash armed: ${crash})` : ""} · child env keys: ${Object.keys(env).sort().join(",")}`, m.arm, m.run_id);
    await this.setStatus(m, "restoring", `runner generation ${m.generation} pid ${m.pid}`);
  }

  private onChildLine(m: Mission, line: string) {
    if (line.startsWith("@@DR ")) {
      try {
        const ev = JSON.parse(line.slice(5)) as { kind: string } & Record<string, unknown>;
        if (ev.kind === "recovered") this.advance(m, "revalidating");
        else if (ev.kind === "planner") this.advance(m, "planning");
        else if (ev.kind === "context_ops") this.advance(m, "curating");
        if (ev.kind === "verdict") m.verdict = { verdict: String(ev.verdict), reason: String(ev.reason), duplicate_effects: Number(ev.duplicate_effects), stale_actions: Number(ev.stale_actions) };
        this.publish("worker", { ...ev, pid: m.pid, epoch: m.generation }, { run_id: m.run_id, arm: m.arm });
      } catch { this.log(line, m.arm, m.run_id); }
      return;
    }
    if (line.startsWith(HOLD_LINE_PREFIX) || line.startsWith("HOLDING AT ")) {
      m.state = "holding";
      m.holdLine = line;
      this.publish("worker", { state: "holding", pid: m.pid, epoch: m.generation, line }, { run_id: m.run_id, arm: m.arm });
    }
    this.log(line, m.arm, m.run_id);
  }

  /** SIGKILL every held child (or every live child with all=true). Returns pid + observed signal. */
  async kill(all = false): Promise<{ arm: Arm; run_id: string; pid: number | null; signal: string | null; alive_after: boolean }[]> {
    // Capture this generation's handles before any await. A second worker may finish
    // naturally while the first exits; never dereference its now-cleared m.child.
    const targets = [...this.byId.values()]
      .filter((m) => !!m.child && (all || m.state === "holding"))
      .map((m) => ({ arm: m.arm, run_id: m.run_id, pid: m.pid, child: m.child!, exited: m.exited }));
    for (const t of targets) {
      this.log(`demo: kill -9 ${t.pid}`, t.arm, t.run_id);
      t.child.kill("SIGKILL");
    }
    return Promise.all(targets.map(async (t) => {
      await t.exited;
      let alive = false;
      try { if (t.pid) { process.kill(t.pid, 0); alive = true; } } catch { alive = false; }
      return { arm: t.arm, run_id: t.run_id, pid: t.pid, signal: t.child.signalCode, alive_after: alive };
    }));
  }

  snapshot() {
    return Object.values(this.missions).filter(Boolean).map((m) => ({
      arm: m!.arm, run_id: m!.run_id, generation: m!.generation, pid: m!.pid, state: m!.state, hold_line: m!.holdLine,
      last_exit: m!.lastExit, verdict: m!.verdict, status_url: m!.statusUrl, status: m!.meta.status,
    }));
  }

  /** GET /missions/:id (MissionSnapshot). Projection values come from the acked cache the single writer maintains. */
  missionSnapshot(missionId: string): MissionSnapshot | null {
    const m = this.byId.get(missionId);
    if (!m) return null;
    const p = this.cache.get(missionId) ?? emptyProjection(missionId);
    const lastOps = p.context_ops.slice(-5).map((o) => ({ op: o.op, key: o.key, accepted: !!o.accepted, proposedBy: o.proposed_by, reason: o.reason }));
    return {
      missionId, revision: this.revision(missionId), updatedAt: m.updatedAt, status: m.meta.status,
      reconciliationStatus: m.meta.reconciliationStatus, blockedReason: m.meta.blockedReason, arm: m.arm, epoch: m.generation,
      worker: { pid: this.childActive(m) ? m.pid : null, state: m.state, generation: m.generation, lastExit: m.lastExit },
      availability: { rawtree: this.rawtreeOk ? "ok" : "unavailable", desk: this.deskProbe.ok ? "ok" : "unavailable", ...(this.rawtreeOk ? {} : { lastKnown: true }) },
      constraints: Object.values(p.constraints).map((c) => ({ key: c.key, value: c.value })),
      plan: Object.values(p.plan_steps).map((s) => ({ stepId: s.step_id, slot: s.slot, resource: s.resource ?? null, status: s.status, reason: s.reason ?? null })),
      commitments: Object.values(p.commitments).map((c) => ({ actionKey: c.action_key, slot: c.slot, resource: c.resource, status: c.status, receiptId: c.receipt_id ?? null })),
      receipts: Object.values(p.receipts).map((r) => ({ receiptId: r.receipt_id, actionKey: r.action_key, slot: r.slot, resource: r.resource, outcome: r.outcome, amountCents: r.amount, recovered: !!r.recovered })),
      facts: Object.values(p.facts).map((f) => ({ key: f.key, value: f.value, status: f.status, observedAt: f.observed_at, taskId: f.nimble_request_id ?? null, retrievalMode: f.nimble_request_id ? (String(f.nimble_request_id).startsWith("direct-") ? "direct" : "live") : null })),
      context: { items: [], tokens: p.metrics.filter((x) => x.phase === "planner").at(-1)?.context_tokens ?? null, lastOps },
      verdict: m.verdict ? { verdict: m.verdict.verdict, reason: m.verdict.reason } : null,
    };
  }

  shutdown() { for (const m of this.byId.values()) m.child?.kill("SIGTERM"); }
}
