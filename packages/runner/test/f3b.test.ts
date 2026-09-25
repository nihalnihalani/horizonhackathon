// V01 / F3b companion: site A closed (F3 world edit) AND site C closed (companion_f3b extra edit). Site B is open but
// not accessible, so no campsite survives the code filter → explicit BLOCKED `no_accessible_site_available`, never a
// green result. Unit level: the runner has no provider injection, so this tests the same pre-planner check the runner
// calls (noCandidateReason) plus the terminal validator on the resulting projection.
import { describe, expect, it } from "vitest";
import { F3, type CommitmentRow, type DeskClient, type DeskReceipt, type LookupResult, type PlanStepRow } from "@dr/shared";
import { emptyProjection } from "@dr/storage";
import type { CandidateX, PlannerContext } from "@dr/providers";
import { NO_ACCESSIBLE_SITE, preplannerBlock as noCandidateReason } from "../src/candidates.ts";
import { validateRun } from "../src/validator.ts";

const f3b = F3.companion_f3b as { extra_world_edit: { site: string; status: "closed" }; verdict: string; reason: string };
const closed = new Set([...F3.world_edits.map((e) => e.site), f3b.extra_world_edit.site]);
const campsites = (): CandidateX[] => F3.resources.filter((r) => r.slot === "campsite").map((r) => ({
  resource: r.id, slot: r.slot, price_cents: r.price_cents, accessible: r.accessible, status: closed.has(r.id) ? "closed" : r.status, date: r.date,
}));
const ctx: PlannerContext = {
  constraints: { start: F3.trip.start_date, end: F3.trip.end_date, party: F3.trip.party, budget_cents: F3.trip.budget_cents, accessible_required: F3.trip.accessible_required },
  spent_cents: 12_000,
};

describe("F3b: no accessible available replacement (V01)", () => {
  it("fixture companion closes A and C; B is open but not accessible", () => {
    expect([...closed].sort()).toEqual(["site-A", "site-C"]);
    expect(f3b).toMatchObject({ verdict: "BLOCKED", reason: NO_ACCESSIBLE_SITE });
  });

  it("pre-planner check blocks with no_accessible_site_available (and passes when C is open, i.e. plain F3)", () => {
    const reason = noCandidateReason(campsites(), ctx, "campsite");
    expect(reason).toBe(`${NO_ACCESSIBLE_SITE}: no campsite candidate satisfies accessible=true and status=open (site-A: closed, site-B: not_accessible, site-C: closed)`);
    const f3 = campsites().map((c) => (c.resource === "site-C" ? { ...c, status: "open" as const } : c));
    expect(noCandidateReason(f3, ctx, "campsite")).toBeNull();
    // over budget is not mislabelled as an accessibility block
    expect(noCandidateReason(f3, { ...ctx, spent_cents: F3.trip.budget_cents }, "campsite")).toMatch(/^no_valid_campsite_candidate/);
  });

  it("terminal validator: BLOCKED with the explicit reason; never VALID", async () => {
    const base = { run_id: "f3-20260926-f3b0", ts: "2026-09-26T00:00:00Z", epoch: 2, rev: 1, arm: "dr" as const };
    const p = emptyProjection(base.run_id);
    const ferry: CommitmentRow = { ...base, action_key: "k-ferry", kind: "book", slot: "ferry", resource: "ferry-tiburon-1009", date: "2026-10-09", party: 2, args_hash: "h", status: "confirmed", receipt_id: "r1", reversible: false, compensates: null, reason: null };
    p.commitments[ferry.action_key] = ferry;
    const step = (step_id: string, slot: PlanStepRow["slot"], status: PlanStepRow["status"], reason: string | null = null): PlanStepRow =>
      ({ ...base, step_id, slot, resource: null, depends_on: [], commitment_key: null, status, reason });
    const blocked = noCandidateReason(campsites(), ctx, "campsite")!;
    for (const s of [step("ferry", "ferry", "done"), step("campsite", "campsite", "blocked", blocked), step("permit", "permit", "done"), step("gear", "gear", "done")]) p.plan_steps[s.step_id] = s;
    const desk: DeskClient = {
      book: async () => { throw new Error("no booking in the validator"); },
      lookup: async (k): Promise<LookupResult> => (k === "k-ferry"
        ? { status: "found", receipt: { action_key: k, receipt_id: "r1", slot: "ferry", resource: "ferry-tiburon-1009", outcome: "committed", amount: 12_000, service_ts: "", committed: true } as DeskReceipt }
        : { status: "absent" }),
    };
    const v = await validateRun(p, desk);
    expect(v.verdict).toBe("BLOCKED");
    expect(v.reason).toContain(`campsite: blocked (${NO_ACCESSIBLE_SITE}`);
    expect(v.duplicate_effects).toBe(0);
  });
});
