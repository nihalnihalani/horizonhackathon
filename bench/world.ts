// Shared canonical ledger for the M1 trace (VALIDATION_AND_DEMO.md §6b.1: "share the same typed effect
// ledger, constraints, validators, receipt lookup"). Both arms read the SAME Projection snapshot per
// round; only their context/retention policy differs. This mirrors packages/providers/test/helpers.ts's
// f3Projection but advances across the 12 M1 rounds (ferry confirms at round 3, site-A closes at round 7,
// the campsite step repairs to site-C at round 9).
import { createHash } from "node:crypto";
import { F3, encodeValue, type CommitmentRow, type ConstraintRow, type FactRow, type PlanStepRow, type Projection, type ReceiptRow } from "@dr/shared";

export const RUN_ID = "m1-bench-run";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

const FERRY_KEY = sha256Hex("m1-ferry-tiburon-1009");

const base = (rev: number, epoch = 1) => ({ run_id: RUN_ID, ts: `2026-10-08T09:00:${String(rev).padStart(2, "0")}Z`, epoch, rev, arm: "dr" as const });

function fact(key: string, value: unknown, observed_at: string, over: Partial<FactRow> = {}): FactRow {
  return {
    ...base(10), key, value: encodeValue(value), source_url: "https://sim.dead-reckoning.test/status.html", observed_at, valid_until: null,
    volatile: key.endsWith(".status"), trust: "extract", status: "active", superseded_by: null, excerpt: null, nimble_request_id: "task-m1", world_version: 1, ...over,
  };
}

/** Canonical Projection snapshot after round `round` has been applied (rounds are 1-indexed, inclusive). */
export function worldAtRound(round: number): Projection {
  const constraints: Record<string, ConstraintRow> = {};
  F3.constraints.forEach((c, i) => { constraints[c.key] = { ...base(i + 1), key: c.key, value: encodeValue(c.value), authority: "user", private: false, version: 1 }; });

  const ferryConfirmed = round >= 3;
  const commitments: Record<string, CommitmentRow> = {
    [FERRY_KEY]: {
      ...base(6), action_key: FERRY_KEY, kind: "book", slot: "ferry", resource: "ferry-tiburon-1009", date: "2026-10-09", party: 2,
      args_hash: "h", status: ferryConfirmed ? "confirmed" : "intent", receipt_id: ferryConfirmed ? "rcpt-ferry-1" : null, reversible: false, compensates: null, reason: null,
    },
  };
  const receipts: Record<string, ReceiptRow> = {};
  if (ferryConfirmed) {
    receipts["rcpt-ferry-1"] = {
      ...base(7, 2), action_key: FERRY_KEY, receipt_id: "rcpt-ferry-1", slot: "ferry", resource: "ferry-tiburon-1009",
      outcome: "committed", reject_reason: null, service_ts: "2026-10-08T09:10:00Z", amount: 12000, recovered: false,
    };
  }

  const closed = round >= 7;
  const facts: Record<string, FactRow> = {
    "site-A.status": closed
      ? fact("site-A.status", "closed", round >= 8 ? "2026-10-08T14:05:00Z" : "2026-10-08T14:00:00Z", { status: "active", world_version: 2, excerpt: "Storm damage to access path" })
      : fact("site-A.status", "open", "2026-10-08T09:00:00Z"),
    "site-A.accessible": fact("site-A.accessible", true, "2026-10-08T09:00:00Z"),
  };

  let campsiteStatus: PlanStepRow["status"];
  let campsiteResource: string | null = "site-A";
  let campsiteReason: string | null = null;
  if (round < 4) { campsiteStatus = "pending"; }
  else if (round < 7) { campsiteStatus = "active"; }
  else if (round < 9) { campsiteStatus = "needs_repair"; campsiteReason = "site-A closed (storm damage); revalidating dependent evidence before repair"; }
  else if (round < 12) { campsiteStatus = "active"; campsiteResource = "site-C"; campsiteReason = "repaired: site-A closed, site-B rejected (not accessible), site-C selected (accessible, open, within budget)"; }
  else { campsiteStatus = "done"; campsiteResource = "site-C"; campsiteReason = "repaired: site-A closed, site-B rejected (not accessible), site-C selected (accessible, open, within budget)"; }

  const plan_steps: Record<string, PlanStepRow> = {};
  F3.plan.forEach((s, i) => {
    let status: PlanStepRow["status"] = "pending";
    let resource: string | null = s.resource;
    let reason: string | null = null;
    if (s.step_id === "ferry") { status = ferryConfirmed ? "done" : "active"; }
    else if (s.step_id === "campsite") { status = campsiteStatus; resource = campsiteResource; reason = campsiteReason; }
    else if (s.step_id === "permit") { status = round >= 12 ? "active" : "pending"; }
    plan_steps[s.step_id] = { ...base(20 + i), step_id: s.step_id, slot: s.slot, resource, depends_on: s.depends_on, commitment_key: s.step_id === "ferry" ? FERRY_KEY : null, status, reason };
  });

  return {
    run_id: RUN_ID, arm: "dr", epoch: 1, rev: 30 + round, constraints, facts, commitments, receipts, plan_steps,
    epochs: [], context_ops: [], metrics: [],
    rows_loaded: { epochs: 0, constraints: 4, facts: 2, commitments: 1, receipts: ferryConfirmed ? 1 : 0, plan_steps: 4, context_ops: 0, metrics: 0 },
  };
}

export { FERRY_KEY };
