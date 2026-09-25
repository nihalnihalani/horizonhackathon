import { describe, expect, it } from "vitest";
import { countTokens } from "@dr/shared";
import { OpenAIPlanner, buildPlannerRequest, constraintsFromProjection, filterCandidates, plannerContextFromRendered, renderWorkingContext, spentCents, type CandidateX } from "../src/index.ts";
import { f3Projection, fakeFetch } from "./helpers.ts";

const CANDS: CandidateX[] = [
  { resource: "site-A", slot: "campsite", price_cents: 8000, accessible: true, status: "closed", date: "2026-10-09" },
  { resource: "site-B", slot: "campsite", price_cents: 6000, accessible: false, status: "open", date: "2026-10-09" },
  { resource: "site-C", slot: "campsite", price_cents: 9000, accessible: true, status: "open", date: "2026-10-09" },
];
const responses = (d: object, usage = { input_tokens: 777, output_tokens: 20, total_tokens: 797 }) => ({
  json: { id: "resp_1", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(d) }] }], usage },
});

describe("candidate filter (code, before the call)", () => {
  it("rejects A (closed) and B (not accessible); keeps C", () => {
    const p = f3Projection({ ferry: "confirmed" });
    const ctx = { constraints: constraintsFromProjection(p), spent_cents: spentCents(p, "campsite") };
    expect(ctx.spent_cents).toBe(12000);
    const { valid, rejected } = filterCandidates(CANDS, ctx, "campsite");
    expect(valid.map((c) => c.resource)).toEqual(["site-C"]);
    expect(rejected).toEqual([{ resource: "site-A", reason: "closed" }, { resource: "site-B", reason: "not_accessible" }]);
  });
  it("budget, dates and party are enforced", () => {
    const ctx = { constraints: { start: "2026-10-09", end: "2026-10-11", party: 2, budget_cents: 40000, accessible_required: true }, spent_cents: 35000 };
    const r = filterCandidates([
      { resource: "x", slot: "campsite", price_cents: 9000, accessible: true, status: "open" },
      { resource: "y", slot: "campsite", price_cents: 100, accessible: true, status: "open", date: "2026-10-20" },
      { resource: "z", slot: "campsite", price_cents: 100, accessible: true, status: "open", capacity: 1 },
    ], ctx, "campsite");
    expect(r.rejected.map((x) => x.reason)).toEqual(["over_budget", "outside_dates", "party_exceeds_capacity"]);
  });
  it("recovers constraints and spend from the rendered context", () => {
    const r = renderWorkingContext({ projection: f3Projection({ ferry: "confirmed" }), step: "campsite" });
    const ctx = plannerContextFromRendered(r, "campsite");
    expect(ctx.constraints).toEqual({ start: "2026-10-09", end: "2026-10-11", party: 2, budget_cents: 40000, accessible_required: true });
    expect(ctx.spent_cents).toBe(12000);
  });
});

describe("OpenAIPlanner.decide", () => {
  const rendered = renderWorkingContext({ projection: f3Projection({ ferry: "confirmed", siteA: "closed" }), step: "campsite" });
  it("sends strict json_schema over filtered candidates only; returns usage separately from the local estimate", async () => {
    const { f, calls } = fakeFetch([() => responses({ action: "book", resource: "site-C", action_key: null, reason: "accessible, open, in budget" })]);
    const d = await new OpenAIPlanner({ apiKey: "k", model: "gpt-5.5-2026-04-23", budget: 6000, fetchImpl: f }).decide(rendered, "campsite", CANDS);
    const b = calls[0]!.body;
    expect(calls[0]!.url).toBe("https://api.openai.com/v1/responses");
    expect(b).toMatchObject({ model: "gpt-5.5-2026-04-23", store: false, text: { format: { type: "json_schema", name: "dr_decision", strict: true } } });
    expect(b.text.format.schema.properties.action.enum).toEqual(["book", "cancel", "keep", "block"]);
    expect(b.text.format.schema.properties.resource.enum).toEqual(["site-C", null]);
    expect(b.input).not.toMatch(/site-B/);
    expect(d).toMatchObject({ action: "book", resource: "site-C", planner_tokens_in: 777, validator: { ok: true } });
    expect(d.rejected_candidates.map((r) => r.resource)).toEqual(["site-A", "site-B"]);
    const req = buildPlannerRequest(rendered, "campsite", [CANDS[2]!]);
    expect(d.context_tokens).toEqual(countTokens(req.counted));
    expect(d.context_tokens.count).toBeLessThanOrEqual(6000);
  });
  it("re-validates the returned book: a book of B becomes block", async () => {
    const { f } = fakeFetch([() => responses({ action: "book", resource: "site-B", action_key: null, reason: "cheapest" })]);
    const d = await new OpenAIPlanner({ apiKey: "k", model: "m", budget: 6000, fetchImpl: f }).decide(rendered, "campsite", CANDS);
    expect(d).toMatchObject({ action: "block", model_action: "book", validator: { ok: false } });
    expect(d.resource).toBeUndefined();
  });
  it("cancel with an invented action_key is rejected", async () => {
    const { f } = fakeFetch([() => responses({ action: "cancel", resource: null, action_key: "deadbeef", reason: "x" })]);
    const d = await new OpenAIPlanner({ apiKey: "k", model: "m", budget: 6000, fetchImpl: f }).decide(rendered, "campsite", CANDS);
    expect(d.action).toBe("block");
  });
});
