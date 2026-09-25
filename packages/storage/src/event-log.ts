// RawTreeEventLog: single-writer append + pending-append resolution over mission_events (CONTRACTS §4).
// Implements the CanonicalEventSink seam (packages/shared/src/events.ts) the control actor codes against.
import { EVENTS_TABLE, EventConflictError, PendingAppendError, fromStoredEvent, toStoredEvent, type MissionEvent } from "@dr/shared";
import { RawTreeClient } from "./client.ts";
import { selectEventById } from "./event-sql.ts";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type PendingDescriptor = { event: MissionEvent; since: string };

/**
 * Parent-retained watermark + pending-append descriptor per mission. `pending` survives `forget()`:
 * clearing the disposable projection cache must not lose retry/ownership metadata (S10).
 */
export class RawTreeEventLog {
  private watermarks = new Map<string, number>();
  private pendingMap = new Map<string, PendingDescriptor>();

  constructor(private client: RawTreeClient, private opts: { visibilityDeadlineMs?: number; pollMs?: number } = {}) {}

  watermark(missionId: string): number {
    return this.watermarks.get(missionId) ?? 0;
  }

  pending(missionId: string): PendingDescriptor | null {
    return this.pendingMap.get(missionId) ?? null;
  }

  /** True once this parent has a watermark or a pending append for the mission (CONTROL_RECOVERY_REQUIRED check). */
  hasOwnership(missionId: string): boolean {
    return this.watermarks.has(missionId) || this.pendingMap.has(missionId);
  }

  isSuspended(missionId: string): boolean {
    return this.pendingMap.has(missionId);
  }

  /** Clears the disposable watermark cache only; pending append metadata is retained (S10). */
  forget(missionId: string): void {
    this.watermarks.delete(missionId);
  }

  /** Seed the watermark after a validated restore (never touches pending). */
  setWatermark(missionId: string, n: number): void {
    this.watermarks.set(missionId, n);
  }

  /**
   * Appends exactly revision watermark+1. Retains the pending descriptor BEFORE the insert, and only
   * clears it once the row is acked AND query-visible with the same hash (S05/S06). While a mission has
   * a pending append, further calls throw immediately — no new revision is assigned until resolvePending.
   */
  async append(event: MissionEvent): Promise<{ revision: number; visibleMs: number }> {
    const existingPending = this.pendingMap.get(event.missionId);
    if (existingPending) {
      throw new PendingAppendError(`mission ${event.missionId}: pending append ${existingPending.event.eventId} unresolved`);
    }
    const expected = this.watermark(event.missionId) + 1;
    if (event.revision !== expected) {
      throw new EventConflictError(`mission ${event.missionId}: expected revision ${expected}, got ${event.revision}`);
    }
    this.pendingMap.set(event.missionId, { event, since: new Date().toISOString() });
    try {
      await this.client.insert(EVENTS_TABLE, [toStoredEvent(event) as unknown as Record<string, unknown>]);
    } catch (e) {
      // Ambiguous/failed ack (S05): keep pending, mission suspended until resolvePending settles it.
      throw new PendingAppendError(`mission ${event.missionId}: append ${event.eventId} ack failed/ambiguous: ${(e as Error).message}`);
    }
    const t0 = Date.now();
    const deadline = t0 + (this.opts.visibilityDeadlineMs ?? 5000);
    const pollMs = this.opts.pollMs ?? 200;
    for (;;) {
      const found = await this.findEvent(event.missionId, event.eventId);
      if (found && found.payloadHash === event.payloadHash) {
        this.watermarks.set(event.missionId, event.revision);
        this.pendingMap.delete(event.missionId);
        return { revision: event.revision, visibleMs: Date.now() - t0 };
      }
      if (Date.now() >= deadline) {
        // S06: acked but not visible within the bound. Pending stays set; caller must block until resolved.
        throw new PendingAppendError(`mission ${event.missionId}: event ${event.eventId} acked but not visible within ${deadline - t0} ms`);
      }
      await sleep(pollMs);
    }
  }

  /** Resolve a pending append by its original event id/hash before any restore or new revision (S10). */
  async resolvePending(missionId: string): Promise<"none" | "resolved" | "blocked"> {
    const p = this.pendingMap.get(missionId);
    if (!p) return "none";
    let found = await this.findEvent(missionId, p.event.eventId);
    if (!found) {
      // Absent: retry the identical insert once (same identity/payload), then re-check.
      try {
        await this.client.insert(EVENTS_TABLE, [toStoredEvent(p.event) as unknown as Record<string, unknown>]);
      } catch {
        // insert failed again; fall through to a final visibility check before giving up
      }
      found = await this.findEvent(missionId, p.event.eventId);
    }
    if (!found) return "blocked"; // still invisible
    if (found.payloadHash !== p.event.payloadHash) return "blocked"; // conflict at the same id
    this.watermarks.set(missionId, p.event.revision);
    this.pendingMap.delete(missionId);
    return "resolved";
  }

  private async findEvent(missionId: string, eventId: string): Promise<MissionEvent | null> {
    const rows = await this.client.query(selectEventById(missionId, eventId));
    for (const raw of rows) {
      try {
        const e = fromStoredEvent(raw);
        if (e.eventId === eventId) return e;
      } catch {
        // a row that doesn't parse as a full MissionEvent is not a match
      }
    }
    return null;
  }
}
