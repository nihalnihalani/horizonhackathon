// Checkpoints: deterministic id, content-hash-verified full projection snapshots for bounded restore
// (CONTRACTS §4). Identical retries at the same mission/revision/content are harmless duplicates.
import {
  CHECKPOINTS_TABLE, EVENT_SCHEMA_VERSION, canonicalJson, checkpointIdFor, sha256Hex,
  type MissionEvent, type Projection, type StoredCheckpointRow,
} from "@dr/shared";
import { RawTreeClient, RawTreeQueryError } from "./client.ts";
import { selectCheckpointsPage } from "./event-sql.ts";

/**
 * A table that has NEVER been inserted into at all (not merely empty for this run) answers
 * `400 "Table not found"` — distinct from the documented `EMPTY_LIST_OF_COLUMNS_QUERIED` quirk for a
 * table that exists but has no rows for a run (observed live, WP 1-E). Both mean "zero rows" to callers.
 * `mission_events`/`mission_checkpoints` are new tables RawTree only creates on first insert.
 */
export async function queryOrEmpty(client: RawTreeClient, sql: string): Promise<Record<string, unknown>[]> {
  try {
    return await client.query(sql);
  } catch (e) {
    if (e instanceof RawTreeQueryError && e.status === 400 && e.body.includes("Table not found")) return [];
    throw e;
  }
}

export type StoredCheckpoint = {
  id: string;
  missionId: string;
  revision: number;
  schemaVersion: number;
  projection: Projection;
  contentHash: string;
  lastEventId: string;
  lastEventHash: string;
  ts: string;
};

export async function writeCheckpoint(
  client: RawTreeClient, missionId: string, revision: number, projection: Projection, lastEvent: MissionEvent,
): Promise<StoredCheckpoint> {
  const id = checkpointIdFor(missionId, revision);
  const projectionJson = canonicalJson(projection);
  const contentHash = sha256Hex(projectionJson);
  const row: StoredCheckpointRow = {
    run_id: missionId, ts: new Date().toISOString(), checkpoint_id: id, revision, schema_version: EVENT_SCHEMA_VERSION,
    projection: projectionJson, content_hash: contentHash, last_event_id: lastEvent.eventId, last_event_hash: lastEvent.payloadHash,
  };
  // Identical retry (same id/revision/content) is a harmless duplicate insert; RawTree keeps both rows,
  // restore dedupes by content_hash (checkpoint.ts callers group by revision before picking one).
  await client.insert(CHECKPOINTS_TABLE, [row as unknown as Record<string, unknown>]);
  return {
    id, missionId, revision, schemaVersion: EVENT_SCHEMA_VERSION, projection, contentHash,
    lastEventId: lastEvent.eventId, lastEventHash: lastEvent.payloadHash, ts: row.ts,
  };
}

export function parseStoredCheckpoint(raw: Record<string, unknown>): StoredCheckpoint {
  return {
    id: String(raw.checkpoint_id), missionId: String(raw.run_id), revision: Number(raw.revision),
    schemaVersion: Number(raw.schema_version), projection: JSON.parse(String(raw.projection)) as Projection,
    contentHash: String(raw.content_hash), lastEventId: String(raw.last_event_id), lastEventHash: String(raw.last_event_hash),
    ts: String(raw.ts),
  };
}

export async function loadCheckpoints(
  client: RawTreeClient, missionId: string, maxRevision: number, opts: { pageSize?: number } = {},
): Promise<StoredCheckpoint[]> {
  const pageSize = opts.pageSize ?? 200;
  const out: StoredCheckpoint[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await queryOrEmpty(client, selectCheckpointsPage(missionId, maxRevision, pageSize, offset));
    out.push(...page.map(parseStoredCheckpoint));
    if (page.length < pageSize) break;
  }
  return out;
}
