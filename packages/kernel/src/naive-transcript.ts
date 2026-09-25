// Naive "transcript resume" baseline (arm = naive). Honest naive behavior:
//  - state lives in a local transcript.json summary (lost facts, no typed constraints on resume)
//  - no reconcile, no stale marking
//  - action keys are derived from the attempt number (so a retry after a crash is a NEW key)
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { naiveActionKey, type CommitmentRow, type DeskClient } from "@dr/shared";
import type { Journal } from "./journal.ts";
import { executeBooking, type BookingStep, type HoldHook, type BookingOutcome, type ProtocolDeps } from "./protocol.ts";

export type Transcript = {
  run_id: string;
  arm: "naive";
  attempt: number;
  world_version: number;
  /** the growing chat-style transcript the naive planner is re-fed (context grows) */
  lines: string[];
  steps: Record<string, { status: "done" | "rejected"; resource: string; receipt_id?: string }>;
  facts: Record<string, string>;
};

export class NaiveTranscript {
  constructor(readonly path: string) {}

  load(runId: string): Transcript {
    if (existsSync(this.path)) {
      const t = JSON.parse(readFileSync(this.path, "utf8")) as Transcript;
      if (t.run_id === runId) return t;
    }
    return { run_id: runId, arm: "naive", attempt: 0, world_version: 1, lines: [], steps: {}, facts: {} };
  }

  save(t: Transcript): void {
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify(t, null, 2));
  }

  /** Called on every (re)start: the attempt counter advances and is persisted. */
  resume(runId: string): Transcript {
    const t = this.load(runId);
    t.attempt += 1;
    t.lines.push(`[resume attempt ${t.attempt}] continuing from transcript summary`);
    this.save(t);
    return t;
  }

  keyFor(t: Transcript, step: BookingStep): string {
    return naiveActionKey(t.run_id, step.step_id, step.resource, step.date, step.party, t.attempt);
  }

  /** Book through the same write-ahead protocol, but with the attempt-derived key and only the transcript's view. */
  async book(journal: Journal, desk: DeskClient, t: Transcript, step: BookingStep, hold?: HoldHook, log?: (l: string) => void, deps: Pick<ProtocolDeps, "claimDispatch"> = {}): Promise<BookingOutcome> {
    const view: Record<string, CommitmentRow> = {}; // the transcript has no typed commitments
    const out = await executeBooking({ journal, desk, keyOverride: this.keyFor(t, step), commitmentsView: view, log, claimDispatch: deps.claimDispatch }, step, hold);
    t.steps[step.step_id] = { status: out.receipt.committed ? "done" : "rejected", resource: step.resource, receipt_id: out.receipt.receipt_id };
    t.lines.push(`booked ${step.step_id} ${step.resource} → ${out.receipt.outcome} ${out.receipt.receipt_id}`);
    this.save(t);
    return out;
  }
}
