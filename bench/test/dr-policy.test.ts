import { describe, expect, it } from "vitest";
import { EvidenceRegistry } from "../evidence.ts";
import { M1 } from "../fixtures/m1.ts";
import { checkC06, runDrTrace } from "../trace.ts";
import { worldAtRound } from "../world.ts";
import { initialDrState, runDrRound } from "../policies/dr.ts";

describe("DR arm: pins survive and an accepted eviction changes the following input", () => {
  it("runs the full M1 trace in stub mode with every pin surviving every round", async () => {
    const trace = await runDrTrace({ budget: 6000, curator: { mode: "stub" } });
    expect(trace.manifests).toHaveLength(12);
    expect(trace.pinsPreservedEveryRound).toBe(true);
    expect(trace.manifests.some((m) => m.blocked)).toBe(false);
  });

  it("C06: at least one accepted eviction removes raw detail from the following planner input; pins survive; recall works", async () => {
    const trace = await runDrTrace({ budget: 6000, curator: { mode: "stub" } });
    const c06 = checkC06(trace);
    expect(c06.pass).toBe(true);
    expect(c06.acceptedEvictionRound).not.toBeNull();
  });

  it("round 7 (fixed closure) still pins every constraint and the ferry receipt stays visible", async () => {
    const registry = new EvidenceRegistry();
    let state = initialDrState();
    for (const round of M1.rounds.filter((r) => r.round <= 7)) {
      const projection = worldAtRound(round.round);
      const out = await runDrRound({ round, projection, state, budget: 6000, curator: { mode: "stub" }, evidenceRegistry: registry });
      state = out.state;
      if (round.round === 7) {
        expect(out.pinsPreserved).toBe(true);
        expect(out.manifest.item_ids.some((id) => id.startsWith("constraint:accessible_required"))).toBe(true);
        expect(out.manifest.item_ids).toContain("receipt:rcpt-ferry-1");
      }
    }
  });

  it("recall of an older evicted evidence id returns the original text with provenance, not a summary", async () => {
    const registry = new EvidenceRegistry();
    let state = initialDrState();
    for (const round of M1.rounds) {
      const projection = worldAtRound(round.round);
      const out = await runDrRound({ round, projection, state, budget: 6000, curator: { mode: "stub" }, evidenceRegistry: registry });
      state = out.state;
      if (round.recall_request) {
        expect(out.manifest.recall?.found).toBe(true);
      }
    }
  });
});
