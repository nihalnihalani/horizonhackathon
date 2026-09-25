// Write-ahead booking protocol (invariants 1, 2, 4 enforced in code; thrown as InvariantViolation).
//   intent row acked → desk /book → [optional HOLD crash window] → receipts row acked → commitments confirmed acked.
import {
  DrError, F3, HOLD_LINE_PREFIX, InvariantViolation, actionKey as stableActionKey,
  type CommitmentRow, type CrashPoint, type DeskClient, type DeskReceipt, type HoldOptions, type Slot,
} from "@dr/shared";
import { bookArgsHash } from "@dr/desk/args";
import { DeskUnavailable } from "./desk-client.ts";
import type { Journal } from "./journal.ts";

export type ClaimResult = { granted: true; dispatchId: string } | { granted: false; code: string; reason: string };
export type ClaimDispatch = (a: { actionKey: string; argsHash: string; slot: Slot }) => Promise<ClaimResult>;

/** Control refused the dispatch claim (paused/cancelling/stale generation/slot busy): no desk POST was made. */
export class DispatchRefused extends DrError {
  constructor(public refusal: string, public reason: string) { super("DISPATCH_REFUSED", `dispatch claim refused (${refusal}): ${reason}`); }
}
/** Desk outcome could not be established (timeout/lost response, lookup absent or unavailable). Never a failure. */
export class OutcomeUnknown extends DrError {
  constructor(public actionKey: string, m: string) { super("OUTCOME_UNKNOWN", m, true); }
}
/** Retrying a not_executed key with different arguments would be a new business intent (CONTRACTS §6). */
export class RetryArgsChanged extends DrError {
  constructor(m: string) { super("PRECONDITION_CHANGED", m); }
}

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
  /** CONTRACTS §6: actor-serialized dispatch claim between intent visibility and the desk POST. Refusal → no POST. */
  claimDispatch?: ClaimDispatch;
};

export type BookingOutcome = { action_key: string; receipt: DeskReceipt; commitment_status: "confirmed" | "rejected"; recovered?: boolean };

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

/** `point` generalizes the crash hook; `holdAfterCommit: true` alone still means `after_desk_commit`. */
export type HoldHook = HoldOptions & { selfKill?: boolean; point?: CrashPoint | null };

export function holdLine(point: CrashPoint, extra: string): string {
  return point === "after_desk_commit" ? `${HOLD_LINE_PREFIX} pid=${process.pid} ${extra}` : `HOLDING AT ${point} pid=${process.pid} ${extra}`;
}

async function crashAt(hold: HoldHook, point: CrashPoint, extra: string, log: (l: string) => void): Promise<void> {
  const armed = hold.point ?? (hold.holdAfterCommit ? "after_desk_commit" : null);
  if (armed !== point || point === "desk_response_lost") return;
  log(holdLine(point, extra));
  if (hold.selfKill) process.kill(process.pid, "SIGKILL");
  await sleep(hold.holdMs ?? 120_000);
  log(`hold expired pid=${process.pid}; continuing`);
}

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
  const prior = commitments[key];
  if (prior?.status === "not_executed" && prior.args_hash !== args_hash) {
    throw new RetryArgsChanged(`action_key ${key.slice(0, 12)}… was not executed with other arguments; only the original key/args may retry`);
  }
  // keep the step's depends_on (latest plan_steps row wins in the projection)
  const depends_on = journal.state.plan_steps[step.step_id]?.depends_on ?? [];
  const commitment = (status: CommitmentRow["status"], receipt_id: string | null, reason: string) => journal.append("commitments", {
    action_key: key, kind: "book", slot: step.slot, resource: step.resource, date: step.date, party: step.party,
    args_hash, status, receipt_id, reversible: false, compensates: null, reason,
  });

  // Invariant 1: the intent row must be acked before the desk is called. AckError propagates; no desk call.
  await commitment("intent", null, `step ${step.step_id}`);
  await journal.append("plan_steps", {
    step_id: step.step_id, slot: step.slot, resource: step.resource, depends_on, commitment_key: key, status: "active", reason: "intent acked",
  });

  if (deps.awaitIntentVisible) await deps.awaitIntentVisible(run_id, key);
  await crashAt(hold, "after_intent", `action_key=${key}`, log);

  if (deps.claimDispatch) {
    const c = await deps.claimDispatch({ actionKey: key, argsHash: args_hash, slot: step.slot });
    if (!c.granted) {
      log(`DISPATCH REFUSED ${step.step_id} ${key.slice(0, 12)}… (${c.code}): ${c.reason}; no desk request`);
      throw new DispatchRefused(c.code, c.reason);
    }
    log(`DISPATCH CLAIMED ${step.step_id} ${c.dispatchId} action_key=${key.slice(0, 12)}…`);
    await crashAt(hold, "after_claim", `dispatch_id=${c.dispatchId} action_key=${key}`, log);
  }

  let receipt: DeskReceipt;
  let recovered = false;
  try {
    receipt = await desk.book({ action_key: key, ...args, args_hash });
    const armed = hold.point ?? null;
    if (armed === "desk_response_lost") {
      log(`FAULT desk_response_lost: desk answered ${receipt.outcome} ${receipt.receipt_id}; runner discards the response`);
      throw new DeskUnavailable("desk /book response lost (fault injection)");
    }
  } catch (e) {
    if (!(e instanceof DeskUnavailable)) throw e;
    // R04: no response is an unknown outcome, never a failed booking. Record it, then reconcile by the same key.
    await commitment("unknown", null, `desk response missing (${e.message}); reconciling by lookup`);
    const r = await desk.lookup(key);
    if (r.status !== "found") {
      log(`reconcile ${step.slot} ${key.slice(0, 12)}… → ${r.status}; outcome stays unknown`);
      throw new OutcomeUnknown(key, `desk outcome unknown for ${key.slice(0, 12)}… (lookup ${r.status})`);
    }
    receipt = r.receipt;
    recovered = true;
    log(`reconcile ${step.slot} ${key.slice(0, 12)}… → ${receipt.outcome} receipt ${receipt.receipt_id} RECOVERED FROM DESK`);
  }

  if (receipt.committed) await crashAt(hold, "after_desk_commit", `receipt_id=${receipt.receipt_id} action_key=${key}`, log);

  await journal.append("receipts", {
    action_key: key, receipt_id: receipt.receipt_id, slot: receipt.slot, resource: receipt.resource, outcome: receipt.outcome,
    reject_reason: receipt.reject_reason ?? null, service_ts: receipt.service_ts, amount: receipt.amount, recovered,
  });
  const status = receipt.committed ? "confirmed" : "rejected";
  await commitment(status, receipt.receipt_id,
    recovered ? "RECOVERED FROM DESK" : receipt.committed ? (receipt.dedupeHit ? "desk dedupe hit" : "desk committed") : `desk rejected: ${receipt.reject_reason}`);
  await journal.append("plan_steps", {
    step_id: step.step_id, slot: step.slot, resource: step.resource, depends_on, commitment_key: key,
    status: receipt.committed ? "done" : "needs_repair", reason: receipt.committed ? `receipt ${receipt.receipt_id}` : `rejected: ${receipt.reject_reason}`,
  });
  await crashAt(hold, "after_receipt", `receipt_id=${receipt.receipt_id} action_key=${key}`, log);
  return { action_key: key, receipt, commitment_status: status, recovered };
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
