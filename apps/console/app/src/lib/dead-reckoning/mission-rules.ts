import type { MissionSnapshot, MissionStatus } from "./types";
import { isTerminalStatus } from "./types";

/**
 * Whether every step that names a resource has a confirmed simulated receipt.
 *
 * Never derived from `status === "valid"` or from the plan alone (AGENTS.md invariant 11: "A
 * valid plan with pending bookings must not be labeled fully booked") — a step is only "booked"
 * once its own `commitments[].status === "confirmed"` row exists. A mission with no bookable
 * steps at all is not "everything booked"; there is nothing to book yet.
 */
export function allBookableStepsConfirmed(
  plan: MissionSnapshot["plan"],
  commitments: MissionSnapshot["commitments"],
): boolean {
  const bookable = plan.filter((step) => step.resource !== null);
  if (bookable.length === 0) return false;
  return bookable.every(
    (step) => commitments.find((c) => c.slot === step.slot)?.status === "confirmed",
  );
}

/** Poll while the mission can still change; stop once it has reached a terminal status (U01). */
export function missionRefetchIntervalMs(status: MissionStatus | undefined): number | false {
  if (status === undefined) return 1_500;
  return isTerminalStatus(status) ? false : 1_500;
}
