// Mission lifecycle, commands and snapshot view (CONTRACTS §3, §5, §6). FROZEN for full-plan wave 1 by the lead.
// Pure types + transition table only; the reducer/actor logic lives in packages/control/src/lifecycle.ts.
import { z } from "zod";

export const MissionStatus = z.enum([
  "created", "queued", "restoring", "reconciling", "revalidating", "planning", "executing", "curating",
  "waiting_approval", "pausing", "paused", "cancelling", "cancelled", "valid", "blocked", "failed",
]);
export type MissionStatus = z.infer<typeof MissionStatus>;

/** Orthogonal operational field (CONTRACTS §6): not a mission success state. */
export const ReconciliationStatus = z.enum(["none", "polling", "blocked"]);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatus>;

export const TERMINAL_STATUSES: readonly MissionStatus[] = ["cancelled", "valid", "failed"];

/** Named fault-injection boundaries (Phase 3 P3.5). `desk_response_lost` = R04 (commit, drop the response). */
export const CrashPoint = z.enum(["after_intent", "after_claim", "after_desk_commit", "after_receipt", "desk_response_lost"]);
export type CrashPoint = z.infer<typeof CrashPoint>;

export const CommandKind = z.enum(["create", "resume", "pause", "cancel", "approve", "arm_crash"]);
export type CommandKind = z.infer<typeof CommandKind>;

/** Every mutation carries a commandId; existing-state mutations carry expectedRevision (D02–D04). */
export const MissionCommand = z.object({
  commandId: z.string().min(6).max(128).regex(/^[A-Za-z0-9._:-]+$/),
  kind: CommandKind,
  missionId: z.string().optional(),
  expectedRevision: z.number().int().nonnegative().optional(),
  args: z.record(z.unknown()).default({}),
});
export type MissionCommand = z.infer<typeof MissionCommand>;

export type CommandRecord = { commandId: string; kind: CommandKind; argsHash: string; result: unknown; revision: number };

/** A durable dispatch claim (DISPATCH_CLAIMED). The effect is "in flight" from this record on. */
export type DispatchClaim = { dispatchId: string; actionKey: string; argsHash: string; epoch: number; revision: number; slot: string };

/** Mission-level metadata carried in Projection.mission (derived from canonical events). */
export type MissionMeta = {
  missionId: string;
  ownerId: string;
  batchId: string;
  status: MissionStatus;
  reconciliationStatus: ReconciliationStatus;
  blockedReason: string | null;
  planRevision: number;
  goal: string;
  /** operator-armed crash point for the next generation (cleared once it fires) */
  armedCrash: CrashPoint | null;
  commands: Record<string, CommandRecord>;
  claims: Record<string, DispatchClaim>; // by actionKey
};

/** Allowed status transitions. Anything else is INVALID_TRANSITION. */
export const TRANSITIONS: Record<MissionStatus, readonly MissionStatus[]> = {
  created: ["queued", "cancelling", "cancelled"],
  queued: ["restoring", "pausing", "cancelling", "failed"],
  restoring: ["reconciling", "blocked", "pausing", "cancelling", "failed"],
  reconciling: ["revalidating", "blocked", "pausing", "cancelling", "failed"],
  revalidating: ["planning", "blocked", "pausing", "cancelling", "failed"],
  planning: ["executing", "curating", "waiting_approval", "valid", "blocked", "pausing", "cancelling", "failed"],
  executing: ["planning", "curating", "valid", "blocked", "pausing", "cancelling", "failed"],
  curating: ["planning", "executing", "blocked", "pausing", "cancelling", "failed"],
  waiting_approval: ["executing", "planning", "blocked", "pausing", "cancelling"],
  pausing: ["paused", "cancelling", "blocked"],
  paused: ["queued", "cancelling"],
  cancelling: ["cancelled"],
  cancelled: [],
  valid: [],
  // recoverable block: explicit Resume restarts from restore/reconcile
  blocked: ["queued", "cancelling"],
  failed: [],
};

export function canTransition(from: MissionStatus, to: MissionStatus): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** Error envelope (CONTRACTS §5). */
export type ApiError = { code: string; message: string; retryable: boolean; missionId?: string; currentRevision?: number; details?: unknown };

/** GET /missions/:id response consumed by the console mission route (Phase 5). */
export type MissionSnapshot = {
  missionId: string;
  revision: number;
  updatedAt: string;
  status: MissionStatus;
  reconciliationStatus: ReconciliationStatus;
  blockedReason: string | null;
  arm: string;
  epoch: number;
  worker: { pid: number | null; state: string; generation: number; lastExit: { pid: number; code: number | null; signal: string | null } | null };
  availability: { rawtree: "ok" | "unavailable"; desk: "ok" | "unavailable"; lastKnown?: boolean };
  constraints: { key: string; value: unknown }[];
  plan: { stepId: string; slot: string; resource: string | null; status: string; reason: string | null }[];
  commitments: { actionKey: string; slot: string; resource: string; status: string; receiptId: string | null }[];
  receipts: { receiptId: string; actionKey: string; slot: string; resource: string; outcome: string; amountCents: number; recovered: boolean }[];
  facts: { key: string; value: unknown; status: string; observedAt: string; taskId: string | null; retrievalMode: string | null }[];
  context: { items: string[]; tokens: number | null; lastOps: { op: string; key: string; accepted: boolean; proposedBy: string; reason: string }[] };
  verdict: { verdict: string; reason: string } | null;
};
