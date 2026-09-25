// Recovery steps 1–4 (FINAL_PROJECT §3) on every process start, from RawTree only (no local state):
//  1. epoch row (after loading the projection so restored_rows and the epoch number are known)
//  2. projection load via ProjectionLoader (RawTree), restored-row count
//  3. reconcile every intent/unknown commitment idempotently against the desk by action_key
//  4. mark stale every volatile fact from an earlier epoch or past valid_until
import {
  F3, RESTORE_LINE_PREFIX,
  type Arm, type CommitmentRow, type DeskClient, type FactRow, type ProjectionLoader, type RowSink,
} from "@dr/shared";
import { totalRows, tsMillis } from "@dr/storage/projection";
import { Journal } from "./journal.ts";

export type ReconcileResult = {
  action_key: string;
  slot: string;
  result: "recovered" | "confirmed_from_projection" | "not_executed" | "unknown";
  receipt_id?: string;
  lookup: boolean;
};

export type RecoveryResult = {
  journal: Journal;
  epoch: number;
  restored_rows: number;
  reconciled: ReconcileResult[];
  stale: string[];
  blocked_steps: string[];
};

export type RecoveryDeps = {
  loader: ProjectionLoader;
  sink: RowSink;
  desk: DeskClient;
  run_id: string;
  arm: Arm;
  sim_clock?: string;
  log?: (line: string) => void;
  /** test hook (I2b): called after the recovered receipts row is acked, before commitments confirmed */
  afterRecoveredReceipt?: (actionKey: string) => void | Promise<void>;
  /**
   * CONTRACTS §6: while pausing/cancelling, reconciliation is lookup-only — a 404 keeps the outcome unknown (no false
   * not_executed, no resend). Defaults to true when projection.mission.status is pausing or cancelling.
   */
  lookupOnly?: boolean;
};

export async function recover(d: RecoveryDeps): Promise<RecoveryResult> {
  const log = d.log ?? ((l: string) => console.log(l));
  const simClock = d.sim_clock ?? F3.sim_clock;

  // Step 2 (needed first to number the epoch): full projection from RawTree.
  const projection = await d.loader.load(d.run_id);
  const restored = totalRows(projection);
  const epoch = projection.epoch + 1;
  log(`${RESTORE_LINE_PREFIX}… ${restored} rows · epoch ${epoch}`);
  const journal = new Journal(d.sink, { run_id: d.run_id, arm: d.arm, epoch }, projection);
  const ms = projection.mission?.status;
  const lookupOnly = d.lookupOnly ?? (ms === "pausing" || ms === "cancelling");

  // Step 1: epoch row.
  await journal.append("epochs", {
    reason: projection.epoch === 0 ? "boot" : "resume", restored_rows: restored, sim_clock: simClock, pid: process.pid, verdict: null, verdict_reason: null,
  });

  // Step 3: reconcile.
  const reconciled: ReconcileResult[] = [];
  const blocked: string[] = [];
  const pending = Object.values(journal.state.commitments).filter((c) => c.status === "intent" || c.status === "unknown");
  for (const c of pending) {
    const inProjection = Object.values(journal.state.receipts).find((r) => r.action_key === c.action_key);
    if (inProjection) {
      // I2b: receipt already recorded (killed before the confirmed row) → no lookup, write only the commitment.
      await writeCommitment(journal, c, inProjection.outcome === "committed" ? "confirmed" : "rejected", inProjection.receipt_id, "reconciled from recorded receipt");
      await writeStep(journal, c, inProjection.outcome === "committed" ? "done" : "needs_repair", inProjection.outcome === "committed" ? `receipt ${inProjection.receipt_id} reconciled from recorded receipt` : `rejected: ${inProjection.reject_reason ?? "?"}`);
      reconciled.push({ action_key: c.action_key, slot: c.slot, result: "confirmed_from_projection", receipt_id: inProjection.receipt_id, lookup: false });
      continue;
    }
    const r = await d.desk.lookup(c.action_key);
    if (r.status === "found") {
      const rc = r.receipt;
      await journal.append("receipts", {
        action_key: c.action_key, receipt_id: rc.receipt_id, slot: rc.slot, resource: rc.resource, outcome: rc.outcome,
        reject_reason: rc.reject_reason ?? null, service_ts: rc.service_ts, amount: rc.amount, recovered: true,
      });
      await d.afterRecoveredReceipt?.(c.action_key);
      await writeCommitment(journal, c, rc.committed ? "confirmed" : "rejected", rc.receipt_id, "RECOVERED FROM DESK");
      await writeStep(journal, c, rc.committed ? "done" : "needs_repair", rc.committed ? `receipt ${rc.receipt_id} RECOVERED FROM DESK` : `rejected: ${rc.reject_reason}`);
      log(`reconcile ${c.slot} ${c.action_key.slice(0, 12)}… → ${rc.outcome} receipt ${rc.receipt_id} RECOVERED FROM DESK`);
      reconciled.push({ action_key: c.action_key, slot: c.slot, result: "recovered", receipt_id: rc.receipt_id, lookup: true });
    } else if (r.status === "absent" && lookupOnly) {
      await writeCommitment(journal, c, "unknown", null, "desk lookup 404 while pausing/cancelling; lookup-only, never resent");
      const step = await writeStep(journal, c, "blocked", "reconcile_lookup_only_absent");
      blocked.push(step);
      log(`reconcile ${c.slot} ${c.action_key.slice(0, 12)}… → absent (lookup-only); outcome stays unknown, step ${step} blocked`);
      reconciled.push({ action_key: c.action_key, slot: c.slot, result: "unknown", lookup: true });
    } else if (r.status === "absent") {
      await writeCommitment(journal, c, "not_executed", null, "desk lookup 404 (authoritative absence); retry with same key");
      // an earlier lookup-only pass may have blocked the step; explicit Resume reopens it for the original key only
      const open = Object.values(journal.state.plan_steps).find((s) => s.commitment_key === c.action_key);
      if (open?.status === "blocked") await writeStep(journal, c, "needs_repair", "not executed; retry original key/args after explicit Resume");
      log(`reconcile ${c.slot} ${c.action_key.slice(0, 12)}… → not_executed`);
      reconciled.push({ action_key: c.action_key, slot: c.slot, result: "not_executed", lookup: true });
    } else {
      await writeCommitment(journal, c, "unknown", null, `desk lookup unavailable (${r.reason ?? "?"}); never inferred as failure`);
      const step = await writeStep(journal, c, "blocked", "reconcile_unavailable");
      blocked.push(step);
      log(`reconcile ${c.slot} ${c.action_key.slice(0, 12)}… → unknown; step ${step} blocked`);
      reconciled.push({ action_key: c.action_key, slot: c.slot, result: "unknown", lookup: true });
    }
  }

  // Step 3b: a kill between the confirmed commitment row and the plan_steps=done row leaves the step open with a
  // success receipt; re-running it would trip invariant 2. Close any such step from the recorded commitment.
  for (const c of Object.values(journal.state.commitments)) {
    if (c.kind !== "book" || c.status !== "confirmed") continue;
    // Only the step still 'active' on exactly this key; a needs_repair step (commitment_key reset) is left to repair.
    const s = Object.values(journal.state.plan_steps).find((x) => x.commitment_key === c.action_key);
    if (!s || s.status !== "active") continue;
    await writeStep(journal, c, "done", `confirmed commitment ${c.receipt_id ?? c.action_key.slice(0, 12)}; step closed on restore`);
    log(`reconcile ${c.slot} step closed on restore (commitment already confirmed)`);
  }

  // Step 4: mark stale.
  const stale: string[] = [];
  const now = tsMillis(simClock.replace(/\s+SIMULATED$/, ""));
  for (const f of Object.values(journal.state.facts)) {
    if (!f.volatile || f.status !== "active") continue;
    const expired = !!f.valid_until && tsMillis(f.valid_until) > 0 && tsMillis(f.valid_until) < now;
    if (f.epoch < epoch || expired) {
      await markStale(journal, f, expired ? "valid_until passed" : `observed in epoch ${f.epoch} < ${epoch}`);
      stale.push(f.key);
    }
  }
  if (stale.length) log(`marked stale: ${stale.join(", ")}`);
  return { journal, epoch, restored_rows: restored, reconciled, stale, blocked_steps: blocked };
}

async function writeCommitment(j: Journal, c: CommitmentRow, status: CommitmentRow["status"], receipt_id: string | null, reason: string) {
  await j.append("commitments", {
    action_key: c.action_key, kind: c.kind, slot: c.slot, resource: c.resource, date: c.date, party: c.party, args_hash: c.args_hash,
    status, receipt_id, reversible: c.reversible, compensates: c.compensates ?? null, reason,
  });
}

async function writeStep(j: Journal, c: CommitmentRow, status: "done" | "blocked" | "needs_repair", reason: string): Promise<string> {
  const existing = Object.values(j.state.plan_steps).find((s) => s.commitment_key === c.action_key)
    ?? Object.values(j.state.plan_steps).find((s) => s.slot === c.slot);
  const step_id = existing?.step_id ?? c.slot;
  await j.append("plan_steps", {
    step_id, slot: c.slot, resource: c.resource, depends_on: existing?.depends_on ?? [], commitment_key: c.action_key, status, reason,
  });
  return step_id;
}

async function markStale(j: Journal, f: FactRow, reason: string) {
  await j.append("facts", {
    key: f.key, value: f.value, source_url: f.source_url ?? null, observed_at: f.observed_at, valid_until: f.valid_until ?? null,
    volatile: f.volatile, trust: f.trust ?? null, status: "stale", superseded_by: null, excerpt: reason, nimble_request_id: f.nimble_request_id ?? null,
    world_version: f.world_version ?? null,
  });
}
