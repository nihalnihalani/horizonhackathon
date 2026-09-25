// Canonical ordered mission events (CONTRACTS §4). FROZEN for full-plan wave 1 by the lead.
// Design: every canonical row the single writer appends is ALSO (first) an event in `mission_events` whose payload
// carries the row, so the legacy tables become derived mirrors and restore = checkpoint + ordered events.
// Non-row transitions (DISPATCH_CLAIMED, COMMAND_ACCEPTED, pause/cancel...) are events only.
import { z } from "zod";
import { canonicalJson, sha256Hex } from "./action-key.ts";
import { Arm } from "./records.ts";
import type { TableName } from "./tables.ts";

export const EVENTS_TABLE = "mission_events" as const;
export const CHECKPOINTS_TABLE = "mission_checkpoints" as const;
export const EVENT_SCHEMA_VERSION = 1 as const;

export const EventType = z.enum([
  "MISSION_CREATED", "COMMAND_ACCEPTED", "RUNNER_STARTED", "CONSTRAINT_SET", "EVIDENCE_OBSERVED", "FACT_REPLACED",
  "FACT_MARKED_STALE", "PLAN_PROPOSED", "PLAN_ACCEPTED", "APPROVAL_REQUESTED", "APPROVAL_DECIDED", "INTENT_RECORDED",
  "DISPATCH_CLAIMED", "OUTCOME_RECORDED", "CONTEXT_EDIT_DECIDED", "MISSION_STATUS_CHANGED", "MISSION_PAUSED",
  "MISSION_BLOCKED", "MISSION_VALIDATED", "MISSION_CANCELLED",
]);
export type EventType = z.infer<typeof EventType>;

/** Row-carrying payload: the row as validated by ROW_SCHEMAS[table] (metrics are never canonical). */
export const RowPayload = z.object({ table: z.string(), row: z.record(z.unknown()) });
export type RowPayload = { table: Exclude<TableName, "metrics">; row: Record<string, unknown> };

export const MissionEvent = z.object({
  schemaVersion: z.literal(EVENT_SCHEMA_VERSION),
  eventId: z.string().min(8),
  missionId: z.string().min(1), // = run_id
  batchId: z.string().min(1),
  arm: Arm,
  revision: z.number().int().positive(),
  previousRevision: z.number().int().nonnegative(),
  commandId: z.string().nullish(),
  epoch: z.number().int().nonnegative(),
  writtenAt: z.string().min(1),
  type: EventType,
  payload: z.record(z.unknown()),
  payloadHash: z.string().length(64),
});
export type MissionEvent = z.infer<typeof MissionEvent>;

export const hashPayload = (payload: unknown): string => sha256Hex(canonicalJson(payload));

/** Deterministic event id: same mission/revision/payload → same id (retries are identical; conflicts differ in hash). */
export function eventIdFor(missionId: string, revision: number, payloadHash: string): string {
  return `ev-${sha256Hex(`${missionId}|${revision}|${payloadHash}`).slice(0, 24)}`;
}

export function makeEvent(e: Omit<MissionEvent, "schemaVersion" | "eventId" | "payloadHash" | "previousRevision" | "writtenAt"> & { writtenAt?: string }): MissionEvent {
  const payloadHash = hashPayload(e.payload);
  return MissionEvent.parse({
    ...e, schemaVersion: EVENT_SCHEMA_VERSION, previousRevision: e.revision - 1, payloadHash,
    eventId: eventIdFor(e.missionId, e.revision, payloadHash), writtenAt: e.writtenAt ?? new Date().toISOString(),
  });
}

/** Map a canonical row write to its typed event. Returns null for non-canonical tables (metrics). */
export function eventTypeForRow(table: TableName, row: Record<string, unknown>): EventType | null {
  switch (table) {
    case "metrics": return null;
    case "epochs":
      if (row.reason === "terminal") return row.verdict === "VALID" ? "MISSION_VALIDATED" : "MISSION_BLOCKED";
      return "RUNNER_STARTED";
    case "constraints": return "CONSTRAINT_SET";
    case "facts":
      if (row.status === "stale") return "FACT_MARKED_STALE";
      if (row.status === "superseded" || row.status === "conflict") return "FACT_REPLACED";
      return "EVIDENCE_OBSERVED";
    case "commitments": return row.status === "intent" ? "INTENT_RECORDED" : "OUTCOME_RECORDED";
    case "receipts": return "OUTCOME_RECORDED";
    case "plan_steps": return "PLAN_ACCEPTED";
    case "context_ops": return "CONTEXT_EDIT_DECIDED";
  }
}

/** Flat RawTree row for `mission_events` (payload JSON-encoded; numbers as JSON numbers). */
export type StoredEventRow = {
  run_id: string; ts: string; schema_version: number; event_id: string; batch_id: string; arm: string;
  revision: number; previous_revision: number; command_id: string | null; epoch: number; written_at: string;
  type: string; payload: string; payload_hash: string;
};

export function toStoredEvent(e: MissionEvent): StoredEventRow {
  return {
    run_id: e.missionId, ts: e.writtenAt, schema_version: e.schemaVersion, event_id: e.eventId, batch_id: e.batchId, arm: e.arm,
    revision: e.revision, previous_revision: e.previousRevision, command_id: e.commandId ?? null, epoch: e.epoch,
    written_at: e.writtenAt, type: e.type, payload: canonicalJson(e.payload), payload_hash: e.payloadHash,
  };
}

export function fromStoredEvent(r: Record<string, unknown>): MissionEvent {
  const payload = typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload;
  return MissionEvent.parse({
    schemaVersion: Number(r.schema_version), eventId: r.event_id, missionId: r.run_id, batchId: r.batch_id, arm: r.arm,
    revision: Number(r.revision), previousRevision: Number(r.previous_revision), commandId: r.command_id ?? null,
    epoch: Number(r.epoch), writtenAt: String(r.written_at), type: r.type, payload, payloadHash: r.payload_hash,
  });
}

/** Checkpoint record (deterministic id from mission/revision/schema version). */
export type StoredCheckpointRow = {
  run_id: string; ts: string; checkpoint_id: string; revision: number; schema_version: number;
  projection: string; content_hash: string; last_event_id: string; last_event_hash: string;
};
export const checkpointIdFor = (missionId: string, revision: number): string => `cp-${missionId}-${revision}-v${EVENT_SCHEMA_VERSION}`;

/** Single-writer seam used by the control actor. Wave 1 builders code against this; storage implements it. */
export interface CanonicalEventSink {
  /** Current acknowledged watermark for a mission (0 if none). */
  watermark(missionId: string): number;
  /** Appends exactly revision watermark+1; resolves only once acked AND query-visible with the same hash. */
  append(event: MissionEvent): Promise<{ revision: number; visibleMs: number }>;
  /** Parent-retained pending append (survives child death and projection-cache clears). */
  pending(missionId: string): { event: MissionEvent; since: string } | null;
  /** Resolve a pending append by its original id/hash before any restore or new revision (S10). */
  resolvePending(missionId: string): Promise<"none" | "resolved" | "blocked">;
}

export class EventConflictError extends Error { code = "EVENT_CONFLICT"; }
export class RestoreGapError extends Error { code = "RESTORE_GAP"; }
export class CheckpointConflictError extends Error { code = "CHECKPOINT_CONFLICT"; }
export class PendingAppendError extends Error { code = "OUTCOME_UNKNOWN"; }
