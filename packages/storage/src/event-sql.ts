// Fixed SQL templates for mission_events / mission_checkpoints (CONTRACTS §4). Same guards as sql.ts:
// RawTree has NO bind params and no IN(...)/argMax on Dynamic columns (WORKLOG: use OR / direct casts).
// Nothing outside packages/storage builds SQL for these tables.
import { CHECKPOINTS_TABLE, EVENTS_TABLE, assertRunId, sqlLiteral } from "@dr/shared";

const SAFE_INT = (n: number, name: string): number => {
  if (!Number.isInteger(n) || n < 0 || n > 10_000_000) throw new Error(`event-sql: invalid ${name}`);
  return n;
};

const EVENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
function assertEventId(id: string): string {
  if (!EVENT_ID_RE.test(id)) throw new Error(`event-sql: invalid event_id for SQL`);
  return id;
}

/** Ordered page of a mission's events at or below maxRevision (never truncate silently; S07). */
export function selectEventsPage(missionId: string, maxRevision: number, limit: number, offset: number): string {
  const r = sqlLiteral(assertRunId(missionId));
  const mr = SAFE_INT(maxRevision, "maxRevision");
  return `SELECT * FROM ${EVENTS_TABLE} WHERE run_id = ${r} AND toInt64(revision) <= ${mr} ORDER BY toInt64(revision), event_id LIMIT ${SAFE_INT(limit, "limit")} OFFSET ${SAFE_INT(offset, "offset")}`;
}

/** Exact lookup by the original event_id (S05/S10 pending-append resolution). */
export function selectEventById(missionId: string, eventId: string): string {
  const r = sqlLiteral(assertRunId(missionId));
  const e = sqlLiteral(assertEventId(eventId));
  return `SELECT * FROM ${EVENTS_TABLE} WHERE run_id = ${r} AND event_id = ${e} LIMIT 5`;
}

/** Checkpoints at or below maxRevision, newest first (restore picks the first one that validates). */
export function selectCheckpointsPage(missionId: string, maxRevision: number, limit: number, offset: number): string {
  const r = sqlLiteral(assertRunId(missionId));
  const mr = SAFE_INT(maxRevision, "maxRevision");
  return `SELECT * FROM ${CHECKPOINTS_TABLE} WHERE run_id = ${r} AND toInt64(revision) <= ${mr} ORDER BY toInt64(revision) DESC LIMIT ${SAFE_INT(limit, "limit")} OFFSET ${SAFE_INT(offset, "offset")}`;
}
