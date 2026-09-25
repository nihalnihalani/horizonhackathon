// Write-ahead booking protocol (invariants 1, 2, 4 enforced in code; thrown as InvariantViolation).
//   intent row acked → desk /book → [optional HOLD crash window] → receipts row acked → commitments confirmed acked.
import {
  F3, HOLD_LINE_PREFIX, InvariantViolation, actionKey as stableActionKey,
  type CommitmentRow, type DeskClient, type DeskReceipt, type HoldOptions, type Slot,
} from "@dr/shared";
import { bookArgsHash } from "@dr/desk/args";
import type { Journal } from "./journal.ts";

export type BookingStep = {
  step_id: string;
  slot: Slot;
  resource: string;
  date: string;
  party: number;
  expected_world_version: number;
};

export type ProtocolDeps = {
  journal: Journal;
  desk: DeskClient;
  log?: (line: string) => void;
  /** naive arm only: supply an attempt-derived key and its own (local) commitment view */
  keyOverride?: string;
  commitmentsView?: Record<string, CommitmentRow>;
  /** Invariant 1 (AGENTS.md): confirm the acked intent is query-visible before the desk call; throws AckError on deadline. */
  awaitIntentVisible?: (runId: string, actionKey: string) => Promise<void>;
};

export type BookingOutcome = { action_key: string; receipt: DeskReceipt; commitment_status: "confirmed" | "rejected" };

const ACTIVE = new Set(["intent", "confirmed", "unknown"]);

/** Invariants 2 and 4, checked against the acked state before any row is written. */
export function assertMayBook(commitments: Record<string, CommitmentRow>, receipts: Record<string, { action_key: string; outcome: string }>, key: string, slot: Slot): void {
  const hasSuccessReceipt = Object.values(receipts).some((r) => r.action_key === key && r.outcome === "committed");
  const existing = commitments[key];
  if (hasSuccessReceipt || existing?.status === "confirmed") {
    throw new InvariantViolation(2, `action_key ${key.slice(0, 12)}… already has a success receipt; never re-executed`);
  }
  if (existing && (existing.status === "intent" || existing.status === "unknown")) {
    throw new InvariantViolation(2, `action_key ${key.slice(0, 12)}… has unresolved status ${existing.status}; reconcile by lookup first`);
  }
  for (const c of Object.values(commitments)) {
    if (c.action_key !== key && c.slot === slot && c.kind === "book" && ACTIVE.has(c.status)) {
      throw new InvariantViolation(4, `slot ${slot} already has active commitment ${c.action_key.slice(0, 12)}… (${c.status})`);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type HoldHook = HoldOptions & { selfKill?: boolean };

export async function executeBooking(deps: ProtocolDeps, step: BookingStep, hold: HoldHook = { holdAfterCommit: false }): Promise<BookingOutcome> {
  const { journal, desk } = deps;
  const log = deps.log ?? ((l: string) => console.log(l));
  const { run_id, arm } = journal.ctx;
  const key = deps.keyOverride ?? stableActionKey(run_id, step.step_id, step.resource, step.date, step.party);
  const commitments = deps.commitmentsView ?? journal.state.commitments;
  const receipts = deps.commitmentsView ? {} : journal.state.receipts;
  assertMayBook(commitments, receipts, key, step.slot);

  const args = { run_id, arm, slot: step.slot, resource: step.resource, date: step.date, party: step.party, expected_world_version: step.expected_world_version };
  const args_hash = bookArgsHash(args);
  // keep the step's depends_on (latest plan_steps row wins in the projection)
  const depends_on = journal.state.plan_steps[step.step_id]?.depends_on ?? [];

  // Invariant 1: the intent row must be acked before the desk is called. AckError propagates; no desk call.
  await journal.append("commitments", {
    action_key: key, kind: "book", slot: step.slot, resource: step.resource, date: step.date, party: step.party,
    args_hash, status: "intent", receipt_id: null, reversible: false, compensates: null, reason: `step ${step.step_id}`,
  });
  await journal.append("plan_steps", {
    step_id: step.step_id, slot: step.slot, resource: step.resource, depends_on, commitment_key: key, status: "active", reason: "intent acked",
  });

  if (deps.awaitIntentVisible) await deps.awaitIntentVisible(run_id, key);

  const receipt = await desk.book({ action_key: key, ...args, args_hash });

  if (hold.holdAfterCommit && receipt.committed) {
    log(`${HOLD_LINE_PREFIX} pid=${process.pid} receipt_id=${receipt.receipt_id} action_key=${key}`);
    if (hold.selfKill) process.kill(process.pid, "SIGKILL");
    await sleep(hold.holdMs ?? 120_000);
    log(`hold expired pid=${process.pid}; continuing`);
  }

  await journal.append("receipts", {
    action_key: key, receipt_id: receipt.receipt_id, slot: receipt.slot, resource: receipt.resource, outcome: receipt.outcome,
    reject_reason: receipt.reject_reason ?? null, service_ts: receipt.service_ts, amount: receipt.amount, recovered: false,
  });
  const status = receipt.committed ? "confirmed" : "rejected";
  await journal.append("commitments", {
    action_key: key, kind: "book", slot: step.slot, resource: step.resource, date: step.date, party: step.party,
    args_hash, status, receipt_id: receipt.receipt_id, reversible: false, compensates: null,
    reason: receipt.committed ? (receipt.dedupeHit ? "desk dedupe hit" : "desk committed") : `desk rejected: ${receipt.reject_reason}`,
  });
  await journal.append("plan_steps", {
    step_id: step.step_id, slot: step.slot, resource: step.resource, depends_on, commitment_key: key,
    status: receipt.committed ? "done" : "needs_repair", reason: receipt.committed ? `receipt ${receipt.receipt_id}` : `rejected: ${receipt.reject_reason}`,
  });
  return { action_key: key, receipt, commitment_status: status };
}

/** F3 ferry step (the ONE crash hook shared by r02-child and the runner). */
export function f3FerryStep(worldVersion = 1): BookingStep {
  const p = F3.plan.find((s) => s.step_id === "ferry")!;
  const r = F3.resources.find((x) => x.id === p.resource)!;
  return { step_id: p.step_id, slot: p.slot, resource: r.id, date: r.date, party: F3.trip.party, expected_world_version: worldVersion };
}

export function runFerryStep(deps: ProtocolDeps, hold: HoldHook, worldVersion = 1): Promise<BookingOutcome> {
  return executeBooking(deps, f3FerryStep(worldVersion), hold);
}
