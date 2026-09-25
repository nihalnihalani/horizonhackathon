import { describe, expect, it } from "vitest";
import { fixtureById, MISSION_FIXTURES } from "../missions/fixtures.ts";
import { score, summaryTable, type ActualOutcome, type ScoredRun } from "../missions/oracle.ts";

const base = (over: Partial<ActualOutcome> = {}): ActualOutcome => ({
  fixture: "F1", arm: "dr", missionId: "m1", terminalStatus: "valid",
  verdict: { verdict: "VALID", reason: "all steps booked" },
  committedBySlot: { ferry: 1, campsite: 1, permit: 1, gear: 1 }, campsiteBooked: true, elapsedMs: 1000,
  ...over,
});

describe("fixtures", () => {
  it("defines exactly F1-F6", () => {
    expect(MISSION_FIXTURES.map((f) => f.id)).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
  });
  it("fixtureById throws on an unknown id", () => {
    // @ts-expect-error deliberate bad id
    expect(() => fixtureById("F9")).toThrow(/unknown fixture/);
  });
});

describe("oracle.score", () => {
  it("F1: matches when the actual outcome equals the expected outcome exactly", () => {
    const f = fixtureById("F1");
    const r = score(base(), f.expected);
    expect(r).toEqual({ pass: true, mismatches: [] });
  });

  it("F3: matches VALID with no reasonIncludes constraint regardless of exact wording", () => {
    const f = fixtureById("F3");
    const r = score(base({ fixture: "F3", verdict: { verdict: "VALID", reason: "repaired to site-C" } }), f.expected);
    expect(r.pass).toBe(true);
  });

  it("F5: fails (mismatch) when the mission FAILED at initialization instead of a clean per-step BLOCKED", () => {
    const f = fixtureById("F5");
    const actual = base({
      fixture: "F5", terminalStatus: "failed", verdict: null,
      committedBySlot: {}, campsiteBooked: false,
    });
    const r = score(actual, f.expected);
    expect(r.pass).toBe(false);
    expect(r.mismatches.some((m) => /verdict: expected BLOCKED, got FAILED/.test(m))).toBe(true);
    expect(r.mismatches.some((m) => /reason missing "source_unverified"/.test(m))).toBe(true);
    expect(r.mismatches.some((m) => /committed_by_slot\.ferry: expected 1, got 0/.test(m))).toBe(true);
  });

  it("F5: matches when campsite is honestly blocked and ferry/permit/gear still commit", () => {
    const f = fixtureById("F5");
    const actual = base({
      fixture: "F5", terminalStatus: "blocked", verdict: { verdict: "BLOCKED", reason: "campsite: blocked (source_unverified: nimble extract transport error: AbortError)" },
      committedBySlot: { ferry: 1, permit: 1, gear: 1, campsite: 0 }, campsiteBooked: false,
    });
    expect(score(actual, f.expected)).toEqual({ pass: true, mismatches: [] });
  });

  it("F6: reason substring check is case-insensitive", () => {
    const f = fixtureById("F6");
    const actual = base({
      fixture: "F6", terminalStatus: "blocked", verdict: { verdict: "BLOCKED", reason: "campsite: blocked, NO_ACCESSIBLE_SITE_AVAILABLE, accessible=true" },
      committedBySlot: { ferry: 1, permit: 1, gear: 1, campsite: 0 }, campsiteBooked: false,
    });
    expect(score(actual, f.expected).pass).toBe(true);
  });

  it("flags an unexpected extra campsite commit (duplicate effect) even if the verdict text matches", () => {
    const f = fixtureById("F1");
    const actual = base({ committedBySlot: { ferry: 1, campsite: 2, permit: 1, gear: 1 } });
    const r = score(actual, f.expected);
    expect(r.pass).toBe(false);
    expect(r.mismatches).toContain("committed_by_slot.campsite: expected 1, got 2");
  });
});

describe("summaryTable", () => {
  it("renders MATCH/MISMATCH per row and never omits a mismatch reason", () => {
    const passRow: ScoredRun = { fixture: "F1", arm: "dr", expectedVerdict: "VALID", oracle: { pass: true, mismatches: [] }, actual: base() };
    const failRow: ScoredRun = {
      fixture: "F5", arm: "dr", expectedVerdict: "BLOCKED",
      oracle: { pass: false, mismatches: ["verdict: expected BLOCKED, got FAILED"] },
      actual: base({ fixture: "F5", terminalStatus: "failed", verdict: null, committedBySlot: {}, campsiteBooked: false }),
    };
    const md = summaryTable([passRow, failRow]);
    expect(md).toMatch(/\| F1 \| dr \| VALID \| VALID \(status valid\) \| MATCH \| - \|/);
    expect(md).toMatch(/\| F5 \| dr \| BLOCKED \| FAILED \(status failed\) \| MISMATCH \| verdict: expected BLOCKED, got FAILED \|/);
  });
});
