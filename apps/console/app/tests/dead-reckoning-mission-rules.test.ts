import { describe, expect, test } from "bun:test";
import { allBookableStepsConfirmed, missionRefetchIntervalMs } from "../src/lib/dead-reckoning/mission-rules";
import type { MissionSnapshot } from "../src/lib/dead-reckoning/types";

function step(overrides: Partial<MissionSnapshot["plan"][number]> = {}): MissionSnapshot["plan"][number] {
  return { stepId: "step-1", slot: "outbound-travel", resource: "ferry-outbound", status: "planned", reason: null, ...overrides };
}
function commitment(
  overrides: Partial<MissionSnapshot["commitments"][number]> = {},
): MissionSnapshot["commitments"][number] {
  return { actionKey: "k1", slot: "outbound-travel", resource: "ferry-outbound", status: "confirmed", receiptId: "r1", ...overrides };
}

describe("allBookableStepsConfirmed (U01: never claim 'all booked' early)", () => {
  test("false when there are no plan steps at all", () => {
    expect(allBookableStepsConfirmed([], [])).toBe(false);
  });

  test("false when a bookable step has no commitment yet", () => {
    expect(allBookableStepsConfirmed([step()], [])).toBe(false);
  });

  test("false when a bookable step's commitment is still pending, not confirmed", () => {
    const plan = [step()];
    const commitments = [commitment({ status: "pending" })];
    expect(allBookableStepsConfirmed(plan, commitments)).toBe(false);
  });

  test("false when only some of several bookable steps are confirmed", () => {
    const plan = [step(), step({ stepId: "step-2", slot: "campsite", resource: "campsite-c" })];
    const commitments = [commitment()]; // only outbound-travel confirmed
    expect(allBookableStepsConfirmed(plan, commitments)).toBe(false);
  });

  test("true only once every bookable step has a confirmed commitment", () => {
    const plan = [step(), step({ stepId: "step-2", slot: "campsite", resource: "campsite-c" })];
    const commitments = [
      commitment(),
      commitment({ actionKey: "k2", slot: "campsite", resource: "campsite-c" }),
    ];
    expect(allBookableStepsConfirmed(plan, commitments)).toBe(true);
  });

  test("a rejected commitment on one step keeps the mission short of 'all booked'", () => {
    const plan = [step(), step({ stepId: "step-2", slot: "campsite", resource: "campsite-b" })];
    const commitments = [
      commitment(),
      commitment({ actionKey: "k2", slot: "campsite", resource: "campsite-b", status: "rejected", receiptId: null }),
    ];
    expect(allBookableStepsConfirmed(plan, commitments)).toBe(false);
  });

  test("a plan step with no resource (nothing to book) is ignored, not required", () => {
    const plan = [step(), step({ stepId: "step-2", slot: "note", resource: null })];
    const commitments = [commitment()];
    expect(allBookableStepsConfirmed(plan, commitments)).toBe(true);
  });
});

describe("missionRefetchIntervalMs (U01: keep polling until a terminal status)", () => {
  test("polls before any status is known yet", () => {
    expect(missionRefetchIntervalMs(undefined)).toBe(1_500);
  });

  test.each(["created", "queued", "executing", "blocked", "paused", "waiting_approval"] as const)(
    "polls while nonterminal: %s",
    (status) => {
      expect(missionRefetchIntervalMs(status)).toBe(1_500);
    },
  );

  test.each(["valid", "cancelled", "failed"] as const)("stops polling once terminal: %s", (status) => {
    expect(missionRefetchIntervalMs(status)).toBe(false);
  });
});
