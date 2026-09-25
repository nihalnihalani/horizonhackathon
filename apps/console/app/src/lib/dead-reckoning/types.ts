/**
 * Mirrors `MissionSnapshot` (and the enums it references) from
 * `packages/shared/src/mission.ts`, the FROZEN full-plan wave-1 canonical contract.
 *
 * The console is a separate bun workspace from `packages/shared`, so it cannot import that
 * package's TypeScript source directly today. Generating this file from the canonical contract at
 * build time — rather than hand-copying it — is future work; until then, keep this in sync by
 * hand whenever `packages/shared/src/mission.ts` changes, and prefer narrowing (adding a field the
 * server already sends) over guessing at a shape the contract does not have yet.
 */

export const MISSION_STATUSES = [
  "created",
  "queued",
  "restoring",
  "reconciling",
  "revalidating",
  "planning",
  "executing",
  "curating",
  "waiting_approval",
  "pausing",
  "paused",
  "cancelling",
  "cancelled",
  "valid",
  "blocked",
  "failed",
] as const;
export type MissionStatus = (typeof MISSION_STATUSES)[number];

export const TERMINAL_STATUSES: readonly MissionStatus[] = ["cancelled", "valid", "failed"];

export function isTerminalStatus(status: MissionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** Orthogonal operational field (CONTRACTS §6): not a mission success state. */
export type ReconciliationStatus = "none" | "polling" | "blocked";

/** GET /missions/:id response consumed by this route (Phase 5). */
export type MissionSnapshot = {
  missionId: string;
  revision: number;
  updatedAt: string;
  status: MissionStatus;
  reconciliationStatus: ReconciliationStatus;
  blockedReason: string | null;
  arm: string;
  epoch: number;
  worker: {
    pid: number | null;
    state: string;
    generation: number;
    lastExit: { pid: number; code: number | null; signal: string | null } | null;
  };
  availability: { rawtree: "ok" | "unavailable"; desk: "ok" | "unavailable"; lastKnown?: boolean };
  constraints: { key: string; value: unknown }[];
  plan: { stepId: string; slot: string; resource: string | null; status: string; reason: string | null }[];
  commitments: { actionKey: string; slot: string; resource: string; status: string; receiptId: string | null }[];
  receipts: {
    receiptId: string;
    actionKey: string;
    slot: string;
    resource: string;
    outcome: string;
    amountCents: number;
    recovered: boolean;
  }[];
  facts: { key: string; value: unknown; status: string; observedAt: string; taskId: string | null; retrievalMode: string | null }[];
  context: {
    items: string[];
    tokens: number | null;
    lastOps: { op: string; key: string; accepted: boolean; proposedBy: string; reason: string }[];
  };
  verdict: { verdict: string; reason: string } | null;
};

/** Error envelope (CONTRACTS §5). */
export type MissionApiError = {
  code: string;
  message: string;
  retryable: boolean;
  missionId?: string;
  currentRevision?: number;
  details?: unknown;
};

/** Minimal shape the (proposed) `GET /api/dead-reckoning/missions` list route would return. */
export type MissionListItem = {
  missionId: string;
  revision: number;
  updatedAt: string;
  status: MissionStatus;
  goal: string;
};
