// F02/F5 (IMPLEMENTATION_PLAN P4.2): an unreachable status source (tunnel down, HTTP 530) blocks the dependent steps
// with `source_unverified: …` instead of crashing the runner; the campsite is never booked on unverified data.
// Function level: runner main.ts needs live providers, so this tests the init/candidate helpers it calls plus the
// terminal validator on the resulting state.
import { describe, expect, it } from "vitest";
import { AckError, SourceUnverified, type DeskClient, type LookupResult, type RowSink, type TableName } from "@dr/shared";
import { Journal } from "@dr/kernel";
import { campsiteCandidatesFrom, ensureInitialization, sourceUnverifiedReason } from "../src/initialization.ts";
import { validateRun } from "../src/validator.ts";

class MemSink implements RowSink {
  rows: { table: TableName; row: Record<string, unknown> }[] = [];
  async append(table: TableName, row: Record<string, unknown>): Promise<{ inserted: 1 }> { this.rows.push({ table, row }); return { inserted: 1 }; }
}
const journal = () => { const sink = new MemSink(); return { sink, j: new Journal(sink, { run_id: "f3-20260926-src0", arm: "dr", epoch: 1 }) }; };

describe("source failure at initialization", () => {
  it("SourceUnverified (HTTP 530) → init reports source_unverified; plan/constraints seeded; no site facts invented", async () => {
    const { sink, j } = journal();
    const r = await ensureInitialization(j, async () => { throw new SourceUnverified("direct fetch http 530"); });
    expect(r).toEqual({ ok: false, reason: "source_unverified: direct fetch http 530" });
    expect(Object.keys(j.state.plan_steps).sort()).toEqual(["campsite", "ferry", "gear", "permit"]);
    expect(Object.keys(j.state.constraints).length).toBeGreaterThan(0);
    expect(sink.rows.filter((x) => x.table === "facts")).toHaveLength(0);
  });

  it("other provider errors are labelled; storage failures still fail closed", async () => {
    const { j } = journal();
    const e = Object.assign(new Error("desk /world HTTP 503"), { code: "DESK_UNAVAILABLE" });
    expect(await ensureInitialization(j, async () => { throw e; })).toEqual({ ok: false, reason: "source_unverified: DESK_UNAVAILABLE: desk /world HTTP 503" });
    await expect(ensureInitialization(journal().j, async () => { throw new AckError("control down"); })).rejects.toBeInstanceOf(AckError);
    expect(sourceUnverifiedReason(new SourceUnverified("x"))).toBe("source_unverified: x");
  });
});

describe("no campsite on unverified data", () => {
  it("missing site views are not candidates (naive arm no longer crashes on undefined price_cents)", () => {
    expect(campsiteCandidatesFrom({})).toEqual([]);
    const only = campsiteCandidatesFrom({ siteC: { status: "open", accessible: true, price_cents: 9000 }, siteA: undefined });
    expect(only.map((c) => c.resource)).toEqual(["site-C"]);
  });

  it("terminal validator: campsite blocked source_unverified, other steps done → BLOCKED with that reason, no campsite effect", async () => {
    const { j } = journal();
    const init = await ensureInitialization(j, async () => { throw new SourceUnverified("direct fetch http 530"); });
    expect(init.ok).toBe(false);
    for (const id of ["ferry", "permit", "gear"] as const) {
      const s = j.state.plan_steps[id]!;
      await j.append("plan_steps", { step_id: id, slot: s.slot, resource: s.resource, depends_on: s.depends_on, commitment_key: null, status: "done", reason: "booked" });
    }
    const c = j.state.plan_steps.campsite!;
    await j.append("plan_steps", { step_id: "campsite", slot: c.slot, resource: c.resource, depends_on: c.depends_on, commitment_key: null, status: "blocked", reason: init.ok ? "" : init.reason });
    const desk: DeskClient = { book: async () => { throw new Error("no booking"); }, lookup: async (): Promise<LookupResult> => ({ status: "absent" }) };
    const v = await validateRun(j.state, desk);
    expect(v.verdict).toBe("BLOCKED");
    expect(v.reason).toBe("campsite: blocked (source_unverified: direct fetch http 530)");
    expect(Object.values(j.state.commitments).some((x) => x.slot === "campsite")).toBe(false);
  });
});
