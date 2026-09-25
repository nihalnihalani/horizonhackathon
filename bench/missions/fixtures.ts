// F1-F6 mission fixture definitions (VALIDATION_AND_DEMO.md §6: "Begin with six paired fixtures").
// FROZEN once a batch starts (bench/manifest.ts-style discipline): edits change the fixture set for the
// NEXT batch, not the one already running. World is a single shared desk instance (packages/desk/src/store.ts
// is NOT namespaced by run_id) so fixtures with different preconditions cannot run concurrently — the
// orchestrator (bench/run-missions.ts) resets/edits the world immediately before each mission and runs
// missions strictly sequentially.
import type { CrashPoint } from "@dr/shared";

export type WorldEdit = { site: "A" | "B" | "C"; status: "open" | "closed"; notice?: string };

export type MissionFixture = {
  id: "F1" | "F2" | "F3" | "F4" | "F5" | "F6";
  name: string;
  description: string;
  /** Arm-crash point (after_intent | after_claim | after_desk_commit | after_receipt), applied at the ferry
   *  step (the only step packages/runner/src/main.ts wires a hold hook to — F3.crash_step). null = no crash. */
  crashPoint: CrashPoint | null;
  /** Applied via /demo/world after /demo/reset, BEFORE the mission is created. */
  worldEditsBeforeStart: WorldEdit[];
  /** Applied via /demo/world AFTER the held child is killed, BEFORE the explicit Resume (F3 only). */
  worldEditsWhileStopped: WorldEdit[];
  /** Overrides POST /missions statusUrl (F5: point at an unreachable port). */
  statusUrlOverride: string | null;
  expected: {
    verdict: "VALID" | "BLOCKED";
    /** Every one of these substrings must appear (case-insensitive) somewhere in the verdict reason. */
    reasonIncludes: string[];
    /** Expected desk-ledger COMMITTED count per slot (0 slots omitted are not checked). */
    committedBySlot: Partial<Record<"ferry" | "campsite" | "permit" | "gear", number>>;
    campsiteBooked: boolean;
  };
};

/** F5 points at TCP port 1 on loopback: reserved, nothing listens, connection is refused immediately (no hang). */
export const F5_UNREACHABLE_STATUS_URL = "http://127.0.0.1:1/status.html";

export const MISSION_FIXTURES: MissionFixture[] = [
  {
    id: "F1", name: "normal completion", description: "No crash, default open/accessible world. Every step books once.",
    crashPoint: null, worldEditsBeforeStart: [], worldEditsWhileStopped: [], statusUrlOverride: null,
    expected: { verdict: "VALID", reasonIncludes: [], committedBySlot: { ferry: 1, campsite: 1, permit: 1, gear: 1 }, campsiteBooked: true },
  },
  {
    id: "F2", name: "kill after intent", description: "Crash armed after_intent on the ferry step (R01): no initial effect; resumed request reuses the original key.",
    crashPoint: "after_intent", worldEditsBeforeStart: [], worldEditsWhileStopped: [], statusUrlOverride: null,
    expected: { verdict: "VALID", reasonIncludes: [], committedBySlot: { ferry: 1, campsite: 1, permit: 1, gear: 1 }, campsiteBooked: true },
  },
  {
    id: "F3", name: "kill after desk commit plus site-A closure", description: "Crash armed after_desk_commit on the ferry step (R02); site-A closes while the runner is stopped; DR must repair the campsite step from revalidated evidence.",
    crashPoint: "after_desk_commit", worldEditsBeforeStart: [], worldEditsWhileStopped: [{ site: "A", status: "closed", notice: "Storm damage (mission batch)" }], statusUrlOverride: null,
    expected: { verdict: "VALID", reasonIncludes: [], committedBySlot: { ferry: 1, campsite: 1, permit: 1, gear: 1 }, campsiteBooked: true },
  },
  {
    id: "F4", name: "kill after receipt", description: "Crash armed after_receipt on the ferry step (R03): the completed ferry action must not be resent on resume.",
    crashPoint: "after_receipt", worldEditsBeforeStart: [], worldEditsWhileStopped: [], statusUrlOverride: null,
    expected: { verdict: "VALID", reasonIncludes: [], committedBySlot: { ferry: 1, campsite: 1, permit: 1, gear: 1 }, campsiteBooked: true },
  },
  {
    id: "F5", name: "required source unreachable", description: "statusUrl points at a closed loopback port from mission creation. Ferry/permit/gear do not depend on the status page; the campsite step must stay honestly blocked, never treat an unverified source as open.",
    crashPoint: null, worldEditsBeforeStart: [], worldEditsWhileStopped: [], statusUrlOverride: F5_UNREACHABLE_STATUS_URL,
    expected: { verdict: "BLOCKED", reasonIncludes: ["source_unverified"], committedBySlot: { ferry: 1, permit: 1, gear: 1, campsite: 0 }, campsiteBooked: false },
  },
  {
    id: "F6", name: "no accessible alternative", description: "Site A and site C are closed before the mission starts; site B is open but not accessible; no valid campsite candidate exists.",
    crashPoint: null, worldEditsBeforeStart: [{ site: "A", status: "closed", notice: "Storm damage (mission batch)" }, { site: "C", status: "closed", notice: "Flooded access road (mission batch)" }], worldEditsWhileStopped: [], statusUrlOverride: null,
    expected: { verdict: "BLOCKED", reasonIncludes: ["no_accessible_site_available"], committedBySlot: { ferry: 1, permit: 1, gear: 1, campsite: 0 }, campsiteBooked: false },
  },
];

export function fixtureById(id: MissionFixture["id"]): MissionFixture {
  const f = MISSION_FIXTURES.find((x) => x.id === id);
  if (!f) throw new Error(`unknown fixture ${id}`);
  return f;
}
