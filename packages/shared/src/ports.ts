// Port interfaces — signatures FROZEN at scaffold. Implementations live in the owning package:
//   RowSink/ProjectionLoader → storage (RawTreeSink/RawTreeLoader) and runner (HttpRowSink/HttpProjectionLoader)
//   DeskClient → kernel or runner (HTTP to desk 4401) · Sensor/Curator/Planner/ContextComposer → providers
//   AgUiMissionPort → control (integration)
import type {
  Arm, CommitmentRow, ConstraintRow, ContextOpRow, EpochRow, FactRow, MetricRow, PlanStepRow, ReceiptRow, Slot,
} from "./records.ts";
import type { TableName } from "./tables.ts";
import type { TokenCount } from "./tokens.ts";

// ---------- errors (stable codes, CONTRACTS §5) ----------
export class DrError extends Error {
  constructor(public code: string, message: string, public retryable = false) { super(message); this.name = code; }
}
export class AckError extends DrError { constructor(m: string) { super("STORAGE_UNAVAILABLE", m, true); } }
export class RestoreCapacityError extends DrError { constructor(m: string) { super("RESTORE_CAPACITY", m); } }
export class SourceUnverified extends DrError { constructor(m: string) { super("SOURCE_UNVERIFIED", m, true); } }
export class ContextCapacity extends DrError { constructor(m: string) { super("CONTEXT_CAPACITY", m); } }
export class InvariantViolation extends DrError {
  constructor(public invariant: 1 | 2 | 3 | 4 | 5 | 6, m: string) { super("INVARIANT_VIOLATION", `invariant ${invariant}: ${m}`); }
}

// ---------- storage ----------
export interface RowSink {
  /** Resolves only on {"inserted":1}; throws AckError otherwise (fail closed). */
  append(table: TableName, row: Record<string, unknown>): Promise<{ inserted: 1 }>;
}

export type Projection = {
  run_id: string;
  arm: Arm | null;
  /** highest epoch seen (0 if none) */
  epoch: number;
  /** highest rev seen (0 if none); next rev = rev + 1 */
  rev: number;
  constraints: Record<string, ConstraintRow>; // by key
  facts: Record<string, FactRow>; // by key (latest row)
  commitments: Record<string, CommitmentRow>; // by action_key (latest row)
  receipts: Record<string, ReceiptRow>; // by receipt_id
  plan_steps: Record<string, PlanStepRow>; // by step_id (latest row)
  epochs: EpochRow[];
  context_ops: ContextOpRow[];
  metrics: MetricRow[];
  rows_loaded: Record<TableName, number>;
  /** Full-plan: mission lifecycle metadata derived from canonical events (absent in legacy row-only restores). */
  mission?: import("./mission.ts").MissionMeta;
};

export interface ProjectionLoader {
  load(runId: string, opts?: { asOf?: string }): Promise<Projection>;
}

/**
 * HTTP ProjectionLoader contract (runner side). Control serves:
 *   GET /internal/projection?run_id=<id>   Authorization: Bearer <DR_RUNNER_TOKEN>
 *   → 200 ProjectionResponse. Control discards its in-memory state for that run, calls
 *     RawTreeLoader.load(runId) and logs
 *     `control cache invalidated; RESTORING FROM RAWTREE… N rows · epoch E`.
 * The runner's HttpProjectionLoader returns `projection`. RAWTREE_API_KEY never enters the child.
 */
export type ProjectionResponse = { projection: Projection; rows_loaded: Record<TableName, number>; total_rows: number };

/** Runner → control: POST /internal/rows {table,row} (Bearer DR_RUNNER_TOKEN); control assigns rev, appends acked. */
export type InternalRowsRequest = { table: TableName; row: Record<string, unknown> };
export type InternalRowsResponse = { inserted: 1; rev: number };

// ---------- desk ----------
export type BookRequest = {
  action_key: string;
  run_id: string;
  arm: Arm;
  slot: Slot;
  resource: string;
  date: string;
  party: number;
  expected_world_version: number;
  args_hash: string; // desk recomputes and rejects a mismatch
};
export type DeskReceipt = {
  action_key: string;
  receipt_id: string;
  slot: Slot;
  resource: string;
  outcome: "committed" | "rejected";
  reject_reason?: "closed" | "stale_version" | "not_accessible" | "unknown_resource" | string | null;
  amount: number; // cents, derived by the desk
  service_ts: string;
  committed: boolean;
  dedupeHit?: boolean;
};
export type LookupResult = { status: "found"; receipt: DeskReceipt } | { status: "absent" } | { status: "unavailable"; reason?: string };

export interface DeskClient {
  book(req: BookRequest): Promise<DeskReceipt>;
  /** GET /actions/:key → 200 found / 404 absent / 503|timeout unavailable */
  lookup(actionKey: string): Promise<LookupResult>;
  /** current world version (from /status.html or /admin/world) — used by nimble version assert */
  worldVersion?(): Promise<number>;
}

// ---------- providers ----------
export type Observation = {
  url: string;
  fields: Record<string, string>; // the fourteen parsed status-page fields
  task_id: string;
  status: string;
  status_code: number;
  fetched_at: string; // ISO; becomes facts.observed_at
  retrieval_mode: "live" | "cache" | "direct";
  raw_hash: string;
  nimble_ms: number;
};
export type DomainHealth = { host: string; status: string; raw: unknown };

export interface Sensor {
  health(host: string): Promise<DomainHealth>;
  extractStatusPage(url: string, opts?: { expectedWorldVersion?: number }): Promise<Observation>;
}

export type CuratorDecision = "superseded" | "unchanged" | "conflict";
export type CompareResult = {
  decision: CuratorDecision;
  new_value: unknown;
  reason: string;
  curator_ms: number;
  raw: unknown;
  accepted: boolean;
  promoted_by?: "validator";
  reject_reason?: string;
};
export type ContextOpsProposal = { evict: string[]; keep: string[]; reason: string; proposed_by: "liquid" | "rule" };

export interface Curator {
  /** old = current fact row; obs = parsed fields for the same key (never raw markdown) */
  compareFact(old: FactRow, obs: { key: string; value: unknown; observed_at: string; task_id?: string }): Promise<CompareResult>;
  proposeContextOps(rendered: RenderedContext): Promise<ContextOpsProposal>;
}

export type PlannerAction = "book" | "cancel" | "keep" | "block";
export type PlannerDecision = {
  action: PlannerAction;
  resource?: string;
  action_key?: string;
  reason: string;
  /** countTokens(exact Responses `input` incl. instructions + schema) — the metrics.context_tokens value */
  context_tokens: TokenCount;
  /** provider-reported usage.input_tokens */
  planner_tokens_in: number;
};
export type Candidate = { resource: string; slot: Slot; price_cents: number; accessible: boolean; status: "open" | "closed" };

export interface Planner {
  /** Throws ContextCapacity if input > DR_PLANNER_CONTEXT_BUDGET. Called once per step, both arms, both epochs. */
  decide(rendered: RenderedContext, step: string, candidates: Candidate[]): Promise<PlannerDecision>;
}

export type ContextItem = { id: string; class: "constraint" | "commitment" | "receipt" | "fact" | "plan" | "transcript"; pinned: boolean; text: string };
export type RenderedContext = { text: string; tokens: TokenCount; items: ContextItem[] };

export type ComposerState = { projection: Projection; step: string; evicted?: string[] };

export interface ContextComposer {
  /** Re-rendered from state, never appended. Constraints + unresolved commitments always pinned. */
  render(state: ComposerState): RenderedContext;
  /** Validates (no constraints.*, no intent/unknown commitments) and returns the next render + ops. */
  applyContextOps(state: ComposerState, proposal: ContextOpsProposal): { rendered: RenderedContext; accepted: string[]; rejected: { id: string; reason: string }[] };
}

// ---------- control / AG-UI ----------
export interface AgUiMissionPort {
  /** Verbs: start | status | resume | kill (message may name a run_id). Yields markdown/text chunks. */
  handle(text: string, threadId: string, ctx?: { actorId: string }): AsyncIterable<string>;
}

// ---------- kernel ----------
export type HoldOptions = { holdAfterCommit: boolean; holdMs?: number /* default 120_000 */ };
/** Log line the R02 harness and /demo/kill watch for. */
export const HOLD_LINE_PREFIX = "HOLDING AFTER DESK COMMIT";
export const RESTORE_LINE_PREFIX = "RESTORING FROM RAWTREE";
