// RawTree table names (tables already exist in database `deadreckoning`, sorting key "run_id, ts").
// FROZEN at scaffold. Changes go through the integration agent.
export const TABLES = [
  "epochs",
  "constraints",
  "facts",
  "commitments",
  "receipts",
  "plan_steps",
  "context_ops",
  "metrics",
] as const;
export type TableName = (typeof TABLES)[number];

export function isTableName(x: string): x is TableName {
  return (TABLES as readonly string[]).includes(x);
}

/**
 * Projection key per table: the in-code projection takes the last row (by rev, ts) per key.
 * `null` = append-only log (every row kept, ordered by rev, ts).
 * Receipts are keyed by receipt_id (duplicate_effects = distinct confirmed receipt_ids per slot).
 */
export const PROJECTION_KEY: Record<TableName, string | null> = {
  epochs: "epoch",
  constraints: "key",
  facts: "key",
  commitments: "action_key",
  receipts: "receipt_id",
  plan_steps: "step_id",
  context_ops: null,
  metrics: null,
};

/** Restore reads at most this many rows per table; hitting it fails with RESTORE_CAPACITY. */
export const RESTORE_ROW_LIMIT = 5000;
