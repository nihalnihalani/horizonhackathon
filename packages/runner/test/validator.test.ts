import { describe, expect, it } from "vitest";
import type { CommitmentRow, DeskClient, DeskReceipt, LookupResult, PlanStepRow, Projection } from "@dr/shared";
import { emptyProjection } from "@dr/storage";
import { validateRun } from "../src/validator.ts";

const base = { run_id: "f3-20260925-test", ts: "2026-09-25T20:00:00Z", epoch: 1, rev: 1, arm: "dr" as const };
function commit(key: string, slot: CommitmentRow["slot"], resource: string, status: CommitmentRow["status"] = "confirmed"): CommitmentRow {
  return { ...base, action_key: key, kind: "book", slot, resource, date: "2026-10-09", party: 2, args_hash: "h", status, receipt_id: null, reversible: false, compensates: null, reason: null };
}
function step(step_id: string, slot: PlanStepRow["slot"], status: PlanStepRow["status"] = "done"): PlanStepRow {
  return { ...base, step_id, slot, resource: null, depends_on: [], commitment_key: null, status, reason: null };
}
class FakeDesk implements DeskClient {
  constructor(private m: Record<string, Partial<DeskReceipt>>) {}
  async book(): Promise<DeskReceipt> { throw new Error("no"); }
  async lookup(k: string): Promise<LookupResult> {
    const r = this.m[k];
    return r ? { status: "found", receipt: { action_key: k, receipt_id: `r-${k}`, slot: "ferry", resource: "x", outcome: "committed", amount: 1000, service_ts: "", committed: true, ...r } as DeskReceipt } : { status: "absent" };
  }
}
function proj(commitments: CommitmentRow[], steps: PlanStepRow[]): Projection {
  const p = emptyProjection(base.run_id);
  for (const c of commitments) p.commitments[c.action_key] = c;
  for (const s of steps) p.plan_steps[s.step_id] = s;
  return p;
}
const allDone = [step("ferry", "ferry"), step("campsite", "campsite"), step("permit", "permit"), step("gear", "gear")];

describe("terminal validator (shared by both arms)", () => {
  it("VALID: one committed receipt per slot, accessible campsite, within budget", async () => {
    const p = proj([commit("k1", "ferry", "ferry-tiburon-1009"), commit("k2", "campsite", "site-C")], allDone);
    const v = await validateRun(p, new FakeDesk({ k1: { slot: "ferry", amount: 12000 }, k2: { slot: "campsite", resource: "site-C", amount: 9000 } }));
    expect(v.verdict).toBe("VALID");
    expect(v.duplicate_effects).toBe(0);
  });
  it("INVALID: an orphan intent the desk committed plus a second key on the same slot = duplicate effect", async () => {
    const p = proj([commit("k1", "ferry", "ferry-tiburon-1009", "intent"), commit("k2", "ferry", "ferry-tiburon-1009")], allDone);
    const v = await validateRun(p, new FakeDesk({ k1: { slot: "ferry" }, k2: { slot: "ferry" } }));
    expect(v.verdict).toBe("INVALID");
    expect(v.duplicate_effects).toBe(1);
  });
  it("INVALID: inaccessible campsite committed", async () => {
    const p = proj([commit("k2", "campsite", "site-B")], allDone);
    const v = await validateRun(p, new FakeDesk({ k2: { slot: "campsite", resource: "site-B", amount: 6000 } }));
    expect(v.verdict).toBe("INVALID");
  });
  it("BLOCKED: a step not done, with its reason", async () => {
    const p = proj([commit("k1", "ferry", "ferry-tiburon-1009")], [step("ferry", "ferry"), { ...step("campsite", "campsite", "blocked"), reason: "curator_unavailable" }]);
    const v = await validateRun(p, new FakeDesk({ k1: { slot: "ferry" } }));
    expect(v.verdict).toBe("BLOCKED");
    expect(v.reason).toContain("curator_unavailable");
  });
  it("BLOCKED (not VALID): desk lookup unavailable means effects are unknown, never inferred as absent", async () => {
    const p = proj([commit("k1", "ferry", "ferry-tiburon-1009"), commit("k2", "campsite", "site-C"), commit("k3", "permit", "permit"), commit("k4", "gear", "gear")], allDone);
    const down: DeskClient = { book: async () => { throw new Error("no"); }, lookup: async (): Promise<LookupResult> => ({ status: "unavailable", reason: "timeout" }) as LookupResult };
    const v = await validateRun(p, down);
    expect(v.verdict).toBe("BLOCKED");
    expect(v.reason).toContain("desk unavailable for 4");
  });
});
