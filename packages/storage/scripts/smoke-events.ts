// Live smoke: append 3 canonical events for a fresh mission id to real RawTree, then restore from events.
// Disposable — writes only to a fresh probe-ev-<4hex> run id. No secrets printed.
import { randomBytes } from "node:crypto";
import { makeEvent, type MissionEvent } from "@dr/shared";
import { RawTreeEventLog, rawTreeFromEnv, restoreFromEvents } from "../src/index.ts";

const { client } = rawTreeFromEnv();
const missionId = `probe-ev-${randomBytes(2).toString("hex")}`;
const log = new RawTreeEventLog(client);

const events: MissionEvent[] = [
  makeEvent({ missionId, batchId: "batch", arm: "dr", revision: 1, epoch: 1, type: "MISSION_CREATED", payload: { ownerId: "smoke", batchId: "batch", goal: "smoke test" } }),
  makeEvent({ missionId, batchId: "batch", arm: "dr", revision: 2, epoch: 1, type: "MISSION_STATUS_CHANGED", payload: { status: "queued" } }),
  makeEvent({ missionId, batchId: "batch", arm: "dr", revision: 3, epoch: 1, type: "MISSION_STATUS_CHANGED", payload: { status: "planning" } }),
];

console.log(`mission_id=${missionId}`);
for (const e of events) {
  const t0 = performance.now();
  const { revision, visibleMs } = await log.append(e);
  const ackMs = Math.round(performance.now() - t0);
  console.log(`appended revision=${revision} event_id=${e.eventId} ack_ms=${ackMs} visible_ms=${visibleMs}`);
}

const t1 = performance.now();
const r = await restoreFromEvents(client, missionId, { watermark: 3 });
const restoreMs = Math.round(performance.now() - t1);
console.log(`restore revision=${r.revision} events_replayed=${r.eventsReplayed} pages=${r.pages} checkpoint=${r.checkpoint ? r.checkpoint.id : "none"} restore_ms=${restoreMs}`);
console.log(`projection.mission.status=${r.projection.mission?.status} projection.mission.goal=${r.projection.mission?.goal}`);
