// SSE event envelope emitted by control GET /events and consumed by board.html / AG-UI status.
// FROZEN at scaffold.
import type { Arm } from "./records.ts";
import type { TableName } from "./tables.ts";

export type SseEventType = "snapshot" | "row" | "worker" | "metric" | "log";

export type SseEnvelope<D = unknown> = {
  type: SseEventType;
  seq: number; // control-assigned monotonically increasing sequence
  ts: string; // ISO
  run_id?: string;
  arm?: Arm;
  table?: TableName; // for type "row"
  data: D;
};

/** worker payload: child lifecycle as observed by the supervisor. */
export type WorkerEvent = {
  state: "spawned" | "holding" | "exited";
  pid: number;
  epoch: number;
  signal?: string | null;
  code?: number | null;
  line?: string; // e.g. "HOLDING AFTER DESK COMMIT pid=123 receipt_id=..."
};

export function encodeSse(e: SseEnvelope): string {
  return `event: ${e.type}\nid: ${e.seq}\ndata: ${JSON.stringify(e)}\n\n`;
}
