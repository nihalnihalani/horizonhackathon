// Adapted from OpenMuse apps/server/src/engine/worker.ts (MIT, pin f5534c77). See ../NOTICE.md.
// The worker never checkpoints arbitrary partial state: it submits typed transitions to the single DR writer.
import type { MissionStatus } from "@dr/shared";

/** Thrown when the mission was paused, cancelled, or this runner generation was superseded. */
export class LostOwnershipError extends Error {
  constructor(public reason: "paused" | "cancelled" | "superseded" | "terminal", detail = "") {
    super(`runner lost ownership: ${reason}${detail ? ` (${detail})` : ""}`);
    this.name = "LostOwnershipError";
  }
}

/** A typed transition the worker proposes; the control actor validates and assigns the revision. */
export type Transition =
  | { kind: "row"; table: string; row: Record<string, unknown> }
  | { kind: "status"; status: MissionStatus; reason?: string }
  | { kind: "event"; title: string; detail?: string };

export type OwnershipView = { status: MissionStatus; generation: number };

export interface TaskContext {
  signal: AbortSignal;
  /** Throws LostOwnershipError unless this generation still owns an active, non-pausing mission. */
  guard(): Promise<void>;
  submit(t: Transition): Promise<{ revision: number }>;
  event(title: string, detail?: string): Promise<void>;
}

const STOPPING: Partial<Record<MissionStatus, LostOwnershipError["reason"]>> = {
  pausing: "paused", paused: "paused", cancelling: "cancelled", cancelled: "cancelled", valid: "terminal", failed: "terminal",
};

/** Pure guard decision (unit-testable): may generation `mine` keep doing new work? */
export function guardDecision(view: OwnershipView, mine: number): LostOwnershipError | null {
  if (view.generation !== mine) return new LostOwnershipError("superseded", `current generation ${view.generation}, mine ${mine}`);
  const r = STOPPING[view.status];
  return r ? new LostOwnershipError(r, view.status) : null;
}

export function createTaskContext(deps: {
  generation: number;
  fetchOwnership: () => Promise<OwnershipView>;
  submit: (t: Transition) => Promise<{ revision: number }>;
  signal?: AbortSignal;
}): TaskContext {
  const ctrl = new AbortController();
  deps.signal?.addEventListener("abort", () => ctrl.abort(deps.signal!.reason));
  return {
    signal: ctrl.signal,
    async guard() {
      if (ctrl.signal.aborted) throw new LostOwnershipError("cancelled", "aborted");
      const err = guardDecision(await deps.fetchOwnership(), deps.generation);
      if (err) { ctrl.abort(err); throw err; }
    },
    submit: (t) => deps.submit(t),
    async event(title, detail) { await deps.submit({ kind: "event", title, detail }); },
  };
}
