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
    case "MISSION_STATUS_CHANGED":
    case "MISSION_PAUSED":
    case "MISSION_CANCELLED":
    case "MISSION_BLOCKED":
    case "MISSION_VALIDATED": {
      // Writer payload (control actor setStatus/setReconciliation): {from, to, reason, reconciliationStatus?}.
      // F3: a row-carrying status-type event (a runner's terminal epochs row) is a report: apply the row, never the status.
      if (typeof payload.table === "string" && payload.row && typeof payload.row === "object") return applyRowPayload(p, payload);
      const m = mission();
      const fallback: Partial<Record<string, MissionStatus>> = { MISSION_PAUSED: "paused", MISSION_CANCELLED: "cancelled", MISSION_BLOCKED: "blocked", MISSION_VALIDATED: "valid" };
      const to = (typeof payload.to === "string" ? payload.to : typeof payload.status === "string" ? payload.status : fallback[e.type]) as MissionStatus | undefined;
      const reason = typeof payload.reason === "string" ? payload.reason : null;
      if (typeof payload.reconciliationStatus === "string") {
        m.reconciliationStatus = payload.reconciliationStatus as ReconciliationStatus;
        if (m.reconciliationStatus === "blocked") m.blockedReason = reason;
      } else if (to && to !== m.status) {
        m.status = to;
        if (to === "blocked") m.blockedReason = reason;
        else if (to === "queued") m.blockedReason = null;
        if (to === "restoring") m.armedCrash = null; // a crash point fires for exactly one generation (actor spawn)
      }
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
        const result = payload.result as { point?: unknown; body?: { armedCrash?: unknown } } | undefined;
        m.armedCrash = ((args?.point ?? result?.body?.armedCrash ?? result?.point) as CrashPoint | undefined) ?? null;
      }
      return p;
    }
    case "APPROVAL_REQUESTED": {
      // F7: approvals survive restore (actor payload {approval}); keyed by the deterministic approvalId
      const a = payload.approval as Record<string, unknown> | undefined;
      if (a && typeof a.approvalId === "string") approvalsOf(mission())[a.approvalId] = { ...a };
      return p;
    }
    case "APPROVAL_DECIDED": {
      // actor payload {approvalId, status, decidedBy?, bindingHash?, commandId}
      const id = String(payload.approvalId ?? "");
      const ap = approvalsOf(mission());
      if (ap[id]) ap[id] = { ...ap[id], status: payload.status, ...(payload.decidedBy ? { decidedBy: payload.decidedBy } : {}), ...(payload.commandId ? { decisionCommandId: payload.commandId } : {}) };
      return p;
    }
    default: return applyRowPayload(p, payload);
  }
}

/** Approvals are carried on the mission projection (MissionMeta has no field yet: contract request). */
export type MissionApprovals = Record<string, Record<string, unknown>>;
export function approvalsOf(m: NonNullable<Projection["mission"]>): MissionApprovals {
  const x = m as NonNullable<Projection["mission"]> & { approvals?: MissionApprovals };
  return (x.approvals ??= {});
}

/** Row-carrying event: payload = {table,row}; metrics are never canonical (events.ts eventTypeForRow). */
function applyRowPayload(p: Projection, payload: Record<string, unknown>): Projection {
  if (typeof payload.table === "string" && payload.table !== "metrics" && payload.row && typeof payload.row === "object") {
    const table = payload.table as Exclude<TableName, "metrics">;
    const row = parseStoredRow(table, payload.row as Record<string, unknown>);
    applyRow(p, table, row);
    // planRevision is carried on the row event that changed the plan (control actor planChange)
    if (p.mission && typeof payload.planRevision === "number" && payload.planRevision > p.mission.planRevision) p.mission.planRevision = payload.planRevision;
    // A definitive commitment outcome resolves its dispatch claim (mirrors the actor's onCommitment).
    const r = row as { action_key?: string; status?: string };
    if (table === "commitments" && p.mission && r.action_key && ["confirmed", "rejected", "not_executed"].includes(String(r.status))) {
      delete p.mission.claims[r.action_key];
    }
  }
  return p;
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
