// In-memory CanonicalEventSink for tests/dev. Same contract as the RawTree event log: contiguous revisions,
// identical retries deduplicate, conflicting duplicates throw. NOT durable: a new control process starts empty.
import { EventConflictError, type CanonicalEventSink, type MissionEvent } from "@dr/shared";

export class MemoryEventLog implements CanonicalEventSink {
  private events = new Map<string, MissionEvent[]>();

  watermark(missionId: string): number { return this.events.get(missionId)?.length ?? 0; }

  async append(event: MissionEvent): Promise<{ revision: number; visibleMs: number }> {
    const list = this.events.get(event.missionId) ?? [];
    const existing = list[event.revision - 1];
    if (existing) {
      if (existing.eventId === event.eventId && existing.payloadHash === event.payloadHash) return { revision: event.revision, visibleMs: 0 };
      throw new EventConflictError(`revision ${event.revision} of ${event.missionId} already holds a different event`);
    }
    if (event.revision !== list.length + 1) throw new EventConflictError(`revision gap: watermark ${list.length}, got ${event.revision}`);
    list.push(event);
    this.events.set(event.missionId, list);
    return { revision: event.revision, visibleMs: 0 };
  }

  pending(): null { return null; }
  async resolvePending(): Promise<"none"> { return "none"; }

  list(missionId: string): MissionEvent[] { return [...(this.events.get(missionId) ?? [])]; }
}
