// Row schemas for every RawTree table (FINAL_PROJECT §3 columns + rev, arm).
// FROZEN at scaffold. Changes go through the integration agent.
//
// Read robustness: RawTree returns columns typed "Dynamic" and normalizes ISO timestamps to
// "YYYY-MM-DD HH:MM:SS". Numeric fields use coercion, booleans accept true/false/1/0/"true"/"false",
// arrays accept a JSON string. On WRITE always send rev/epoch/amounts as JSON numbers.
// `value` fields (constraints, facts) are JSON-encoded strings: use encodeValue/decodeValue.
import { z } from "zod";
import type { TableName } from "./tables.ts";

const int = z.coerce.number().int();
const bool = z.preprocess((v) => {
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return v;
}, z.boolean());
const strArray = z.preprocess((v) => {
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}, z.array(z.string()));
const optStr = z.string().nullish();

export const Arm = z.enum(["dr", "naive"]);
export type Arm = z.infer<typeof Arm>;
export const Slot = z.enum(["ferry", "campsite", "permit", "gear"]);
export type Slot = z.infer<typeof Slot>;

/** Every row carries these. `rev` = per-run monotonic integer assigned by the single writer (control). */
export const BaseRow = z.object({
  run_id: z.string().min(1),
  ts: z.string().min(1),
  epoch: int,
  rev: int,
  arm: Arm,
});
export type BaseRow = z.infer<typeof BaseRow>;

export const EpochRow = BaseRow.extend({
  reason: z.enum(["boot", "resume", "terminal"]),
  restored_rows: int.default(0),
  sim_clock: z.string(),
  pid: int.nullish(),
  verdict: z.enum(["VALID", "INVALID", "BLOCKED"]).nullish(),
  verdict_reason: optStr,
});

export const ConstraintRow = BaseRow.extend({
  key: z.string(), // "dates" | "party_size" | "budget_cents" | "accessible_required"
  value: z.string(), // JSON-encoded
  authority: z.literal("user").default("user"),
  private: bool.default(false),
  version: int.default(1),
});

export const FactStatus = z.enum(["active", "stale", "superseded", "conflict"]);
export const FactRow = BaseRow.extend({
  key: z.string(), // e.g. "site-A.status"
  value: z.string(), // JSON-encoded
  source_url: optStr,
  observed_at: z.string(),
  valid_until: optStr,
  volatile: bool,
  trust: z.enum(["high", "medium", "low", "extract"]).nullish(),
  status: FactStatus,
  superseded_by: optStr,
  excerpt: optStr,
  nimble_request_id: optStr, // Nimble task_id
  world_version: int.nullish(),
});

export const CommitmentStatus = z.enum([
  "intent", "confirmed", "rejected", "failed", "not_executed", "unknown", "cancelled",
]);
export const CommitmentRow = BaseRow.extend({
  action_key: z.string(),
  kind: z.enum(["book", "cancel"]),
  slot: Slot,
  resource: z.string(),
  date: z.string(),
  party: int,
  args_hash: z.string(),
  status: CommitmentStatus,
  receipt_id: optStr,
  reversible: bool.default(false),
  compensates: optStr,
  reason: optStr,
});

export const ReceiptRow = BaseRow.extend({
  action_key: z.string(),
  receipt_id: z.string(),
  slot: Slot,
  resource: z.string(),
  outcome: z.enum(["committed", "rejected"]),
  reject_reason: optStr, // "closed" | "stale_version" | ...
  service_ts: z.string(),
  amount: int, // cents
  recovered: bool.default(false),
});

export const PlanStepStatus = z.enum(["pending", "active", "done", "needs_repair", "blocked"]);
export const PlanStepRow = BaseRow.extend({
  step_id: z.string(), // "ferry" | "campsite" | "permit" | "gear"
  slot: Slot,
  resource: optStr,
  depends_on: strArray.default([]),
  commitment_key: optStr,
  status: PlanStepStatus,
  reason: optStr,
});

export const ContextOpRow = BaseRow.extend({
  step: z.string(),
  op: z.enum(["keep", "evict", "recall", "pin", "compare"]),
  key: z.string(),
  reason: z.string(),
  proposed_by: z.enum(["liquid", "rule", "validator"]),
  accepted: bool,
  decision: optStr, // curator decision for op=compare
  promoted_by: optStr, // "validator" when conflict→superseded
  curator_ms: int.nullish(),
  items_before: strArray.nullish(),
  items_after: strArray.nullish(),
});

export const MetricRow = BaseRow.extend({
  step: z.string(),
  phase: z.string(),
  context_tokens: int, // countTokens(exact Responses input incl. instructions + schema)
  planner_tokens_in: int.default(0), // provider-reported usage
  curator_ms: int.default(0),
  nimble_ms: int.default(0),
  duplicate_effects: int.default(0),
  stale_actions: int.default(0),
});

export type EpochRow = z.infer<typeof EpochRow>;
export type ConstraintRow = z.infer<typeof ConstraintRow>;
export type FactRow = z.infer<typeof FactRow>;
export type CommitmentRow = z.infer<typeof CommitmentRow>;
export type ReceiptRow = z.infer<typeof ReceiptRow>;
export type PlanStepRow = z.infer<typeof PlanStepRow>;
export type ContextOpRow = z.infer<typeof ContextOpRow>;
export type MetricRow = z.infer<typeof MetricRow>;

export const ROW_SCHEMAS = {
  epochs: EpochRow,
  constraints: ConstraintRow,
  facts: FactRow,
  commitments: CommitmentRow,
  receipts: ReceiptRow,
  plan_steps: PlanStepRow,
  context_ops: ContextOpRow,
  metrics: MetricRow,
} as const satisfies Record<TableName, z.ZodTypeAny>;

export type RowOf<T extends TableName> = z.infer<(typeof ROW_SCHEMAS)[T]>;
/** A row before the single writer assigns rev (runner → control /internal/rows). */
export type DraftRow<T extends TableName> = Omit<RowOf<T>, "rev"> & { rev?: number };

export function parseRow<T extends TableName>(table: T, raw: unknown): RowOf<T> {
  return ROW_SCHEMAS[table].parse(raw) as RowOf<T>;
}

export const encodeValue = (v: unknown): string => JSON.stringify(v);
export function decodeValue<T = unknown>(s: string): T {
  return JSON.parse(s) as T;
}
export const nowIso = (): string => new Date().toISOString();
