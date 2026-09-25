// Restore = latest valid checkpoint at or below the watermark + contiguous ordered events (CONTRACTS §4, S01–S10).
// `applyEvent` is the pure reducer the control actor also applies live to the disposable in-memory projection.
import {
  CheckpointConflictError, EventConflictError, RestoreGapError, canonicalJson, fromStoredEvent, sha256Hex,
  type CommandKind, type CrashPoint, type MissionEvent, type MissionStatus, type Projection,
  type ReconciliationStatus, type TableName,
} from "@dr/shared";
import { RawTreeClient } from "./client.ts";
import { loadCheckpoints, queryOrEmpty, type StoredCheckpoint } from "./checkpoint.ts";
import { emptyProjection, applyRow, parseStoredRow } from "./projection.ts";
import { selectEventsPage } from "./event-sql.ts";

/** Apply one canonical event to a projection in place (mutates and returns the same reference). */
export function applyEvent(p: Projection, e: MissionEvent): Projection {
  p.rev = Math.max(p.rev, e.revision);
  p.epoch = Math.max(p.epoch, e.epoch);
  if (!p.arm) p.arm = e.arm;
  const payload = e.payload as Record<string, unknown>;
  const mission = () => {
    if (!p.mission) throw new EventConflictError(`event ${e.eventId}: ${e.type} before MISSION_CREATED`);
    return p.mission;
  };
  switch (e.type) {
    case "MISSION_CREATED": {
      p.mission = {
        missionId: e.missionId,
        ownerId: String(payload.ownerId ?? ""),
        batchId: String(payload.batchId ?? e.batchId),
        status: (payload.status as MissionStatus | undefined) ?? "created",
        reconciliationStatus: "none",
        blockedReason: null,
        planRevision: 0,
        goal: String(payload.goal ?? ""),
        armedCrash: null,
        commands: {},
        claims: {},
      };
      return p;
    }
    case "MISSION_STATUS_CHANGED": {
      const m = mission();
      if (typeof payload.status === "string") m.status = payload.status as MissionStatus;
      if (typeof payload.reconciliationStatus === "string") m.reconciliationStatus = payload.reconciliationStatus as ReconciliationStatus;
      if ("blockedReason" in payload) m.blockedReason = (payload.blockedReason as string | null) ?? null;
      return p;
    }
    case "DISPATCH_CLAIMED": {
      const m = mission();
      const actionKey = String(payload.actionKey);
      m.claims[actionKey] = {
        dispatchId: String(payload.dispatchId), actionKey, argsHash: String(payload.argsHash),
        epoch: Number(payload.epoch), revision: e.revision, slot: String(payload.slot),
      };
      return p;
    }
    case "COMMAND_ACCEPTED": {
      const m = mission();
      const commandId = String(payload.commandId);
      const kind = payload.kind as CommandKind;
      m.commands[commandId] = { commandId, kind, argsHash: String(payload.argsHash ?? ""), result: payload.result, revision: e.revision };
      if (kind === "arm_crash") {
        const args = payload.args as Record<string, unknown> | undefined;
        const result = payload.result as Record<string, unknown> | undefined;
        m.armedCrash = ((args?.point ?? result?.point) as CrashPoint | undefined) ?? null;
      }
      return p;
    }
    case "MISSION_PAUSED": mission().status = "paused"; return p;
    case "MISSION_CANCELLED": mission().status = "cancelled"; return p;
    case "MISSION_BLOCKED": {
      const m = mission();
      m.status = "blocked";
      m.blockedReason = typeof payload.reason === "string" ? payload.reason : null;
      return p;
    }
    case "MISSION_VALIDATED": mission().status = "valid"; return p;
    default: {
      // Row-carrying event: payload = {table,row}; metrics are never canonical (events.ts eventTypeForRow).
      if (typeof payload.table === "string" && payload.table !== "metrics" && payload.row && typeof payload.row === "object") {
        const table = payload.table as Exclude<TableName, "metrics">;
        const row = parseStoredRow(table, payload.row as Record<string, unknown>);
        applyRow(p, table, row);
      }
      return p;
    }
  }
}

export type RestoreResult = {
  projection: Projection;
  revision: number;
  checkpoint: { id: string; revision: number } | null;
  eventsReplayed: number;
  pages: number;
};

/**
 * Pure core: no I/O. `checkpoints` and `events` are already-fetched pages (possibly containing
 * duplicates/conflicts/gaps — this function is the one place that validates and rejects them).
 */
export function replay(
  missionId: string, checkpoints: StoredCheckpoint[], events: MissionEvent[], watermark: number, pages = 1,
): RestoreResult {
  // ---- events: dedupe identical (S01), reject conflicting hash/duplicate revision (S02), never above watermark ----
  const byRevision = new Map<number, MissionEvent>();
  const byEventId = new Map<string, MissionEvent>();
  for (const e of events) {
    if (e.missionId !== missionId || e.revision > watermark) continue;
    const seen = byEventId.get(e.eventId);
    if (seen) {
      if (seen.payloadHash !== e.payloadHash) throw new EventConflictError(`event ${e.eventId}: conflicting payload hash for the same id`);
      continue; // identical duplicate — applies once
    }
    byEventId.set(e.eventId, e);
    const atRevision = byRevision.get(e.revision);
    if (atRevision && atRevision.eventId !== e.eventId) {
      throw new EventConflictError(`revision ${e.revision}: two different events (${atRevision.eventId} vs ${e.eventId})`);
    }
    byRevision.set(e.revision, e);
  }

  // ---- checkpoints: conflicting content at one revision blocks outright (S08); pick the newest that validates (S09) ----
  const grouped = new Map<number, StoredCheckpoint[]>();
  for (const c of checkpoints) {
    if (c.revision > watermark) continue; // ignore checkpoints above the watermark
    const arr = grouped.get(c.revision) ?? [];
    arr.push(c);
    grouped.set(c.revision, arr);
  }
  for (const [rev, arr] of grouped) {
    const distinct = new Set(arr.map((c) => c.contentHash));
    if (distinct.size > 1) throw new CheckpointConflictError(`checkpoint conflict at revision ${rev}: ${distinct.size} distinct contents`);
  }
  let chosen: StoredCheckpoint | null = null;
  for (const rev of [...grouped.keys()].sort((a, b) => b - a)) {
    const c = grouped.get(rev)![0]!;
    if (sha256Hex(canonicalJson(c.projection)) !== c.contentHash) continue; // corrupt snapshot: fall back
    const boundary = byRevision.get(c.revision);
    if (!boundary || boundary.eventId !== c.lastEventId || boundary.payloadHash !== c.lastEventHash) continue; // wrong boundary: fall back
    chosen = c;
    break;
  }

  // ---- replay contiguous events after the chosen checkpoint through the watermark (S03 revision order, S04 gaps) ----
  let projection: Projection = chosen ? (structuredClone(chosen.projection) as Projection) : emptyProjection(missionId);
  let prevRev = chosen ? chosen.revision : 0;
  let eventsReplayed = 0;
  for (const rev of [...byRevision.keys()].sort((a, b) => a - b)) {
    if (rev <= prevRev) continue;
    const e = byRevision.get(rev)!;
    if (rev !== prevRev + 1 || e.previousRevision !== prevRev) {
      throw new RestoreGapError(`restore gap: expected revision ${prevRev + 1}, found event ${e.eventId} at revision ${rev} (previousRevision ${e.previousRevision})`);
    }
    projection = applyEvent(projection, e);
    prevRev = rev;
    eventsReplayed++;
  }
  if (prevRev !== watermark) {
    throw new RestoreGapError(`restore incomplete: reached revision ${prevRev}, watermark is ${watermark}`);
  }

  return { projection, revision: prevRev, checkpoint: chosen ? { id: chosen.id, revision: chosen.revision } : null, eventsReplayed, pages };
}

/** Fetches checkpoints + paginated events (never silently truncates; S07) and delegates to `replay`. */
export async function restoreFromEvents(
  client: RawTreeClient, missionId: string, opts: { watermark: number; pageSize?: number },
): Promise<RestoreResult> {
  const pageSize = opts.pageSize ?? 500;
  const checkpoints = await loadCheckpoints(client, missionId, opts.watermark);
  const events: MissionEvent[] = [];
  let pages = 0;
  for (let offset = 0; ; offset += pageSize) {
    const page = await queryOrEmpty(client, selectEventsPage(missionId, opts.watermark, pageSize, offset));
    pages++;
    events.push(...page.map(fromStoredEvent));
    if (page.length < pageSize) break;
  }
  return replay(missionId, checkpoints, events, opts.watermark, pages);
}
