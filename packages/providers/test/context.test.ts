import { describe, expect, it } from "vitest";
import { ContextCapacity } from "@dr/shared";
import { LiquidCurator, OpenAIPlanner, applyContextOps, contextOpRows, renderWorkingContext, ruleProposeContextOps, validateContextOps } from "../src/index.ts";
import { f3Projection, fakeFetch } from "./helpers.ts";

const evidence = [
  { id: "fact:site-A.status@2026-09-25T19:00:00Z", text: "SUPERSEDED site-A.status = open (epoch 1)" },
  { id: "obs:task-epoch1", text: "raw Nimble observation stub, task task-epoch1, world v1" },
];

describe("render (re-rendered from state, never appended)", () => {
  it("pins every constraint, the unresolved ferry intent and the frontier", () => {
    const r = renderWorkingContext({ projection: f3Projection(), step: "campsite" });
    const pinned = r.items.filter((i) => i.pinned).map((i) => i.id);
    expect(pinned).toEqual(expect.arrayContaining(["constraint:accessible_required", "constraint:budget_cents", "constraint:dates", "constraint:party_size", `commitment:${"a".repeat(64)}`, "plan:frontier"]));
    expect(r.tokens.count).toBeGreaterThan(0);
    expect(renderWorkingContext({ projection: f3Projection(), step: "campsite" }).text).toBe(r.text);
  });
  it("renders receipt stubs, drops superseded facts, caps unpinned items at 8", () => {
    const p = f3Projection({ ferry: "confirmed", siteAStatus: "superseded" });
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `obs:x${i}`, text: "stub" }));
    const r = renderWorkingContext({ projection: p, step: "campsite", evidence: many });
    const ids = r.items.map((i) => i.id);
    expect(ids).toContain("receipt:rcpt-ferry-1");
    expect(r.text).toMatch(/RECOVERED FROM DESK/);
    expect(ids).not.toContain("fact:site-A.status");
    expect(r.items.filter((i) => !i.pinned)).toHaveLength(8);
    expect(ids.some((i) => i.startsWith("commitment:"))).toBe(false); // confirmed ≠ unresolved
  });
});

describe("context ops validator", () => {
  it("C01: evicting accessibility or the pending intent is rejected; pinned items remain in the next input", () => {
    const state = { projection: f3Projection(), step: "campsite" };
    const res = applyContextOps(state, { evict: ["constraint:accessible_required", `commitment:${"a".repeat(64)}`], keep: [], reason: "x", proposed_by: "liquid" });
    expect(res.accepted).toEqual([]);
    expect(res.rejected.map((r) => r.reason)).toEqual(["constraint_pinned", "unresolved_commitment_pinned"]);
    expect(res.after).toEqual(expect.arrayContaining(["constraint:accessible_required", `commitment:${"a".repeat(64)}`]));
    const rows = contextOpRows("campsite", { evict: [], keep: [], reason: "x", proposed_by: "liquid" }, res);
    expect(rows.every((r) => r.accepted === false)).toBe(true);
  });
  it("C02: invented receipt / action key ids are rejected", () => {
    const v = validateContextOps({ projection: f3Projection(), step: "campsite" }, { evict: ["receipt:rcpt-invented", "commitment:deadbeef"], keep: ["receipt:rcpt-success"], reason: "x", proposed_by: "liquid" });
    expect(v.accepted).toEqual([]);
    expect(v.rejected.every((r) => /unknown_item/.test(r.reason))).toBe(true);
  });
  it("an accepted eviction changes the next planner input's item-id set", () => {
    const state = { projection: f3Projection({ ferry: "confirmed", siteA: "closed" }), step: "campsite", evidence };
    const before = renderWorkingContext(state);
    const res = applyContextOps(state, { evict: evidence.map((e) => e.id), keep: [], reason: "superseded", proposed_by: "liquid" });
    expect(res.accepted).toEqual(evidence.map((e) => e.id));
    expect(res.after).not.toEqual(res.before);
    expect(res.rendered.tokens.count).toBeLessThan(before.tokens.count);
    const rows = contextOpRows("campsite", { evict: [], keep: [], reason: "superseded", proposed_by: "liquid" }, res);
    expect(rows[0]).toMatchObject({ op: "evict", accepted: true, proposed_by: "liquid", items_before: res.before, items_after: res.after });
    expect(ruleProposeContextOps(before).proposed_by).toBe("rule");
  });
  it("Liquid proposal is grammar-constrained to existing ids", async () => {
    const { f, calls } = fakeFetch([() => ({ json: { choices: [{ message: { content: JSON.stringify({ evict: ["obs:task-epoch1"], keep: [], reason: "stub" }) } }] } })]);
    const r = renderWorkingContext({ projection: f3Projection({ ferry: "confirmed" }), step: "campsite", evidence });
    const p = await new LiquidCurator({ fetchImpl: f }).proposeContextOps(r, "campsite");
    expect(p).toMatchObject({ evict: ["obs:task-epoch1"], proposed_by: "liquid" });
    expect(calls[0]!.body.response_format.json_schema.schema.properties.evict.items.enum).toEqual(evidence.map((e) => e.id));
  });
});

describe("C04: pinned overflow", () => {
  it("render with a tiny budget throws ContextCapacity rather than evicting pins", () => {
    expect(() => renderWorkingContext({ projection: f3Projection(), step: "campsite", budget: 20 })).toThrow(ContextCapacity);
  });
  it("planner refuses to send an input over budget", async () => {
    const { f, calls } = fakeFetch([() => ({ json: {} })]);
    const pl = new OpenAIPlanner({ apiKey: "k", model: "m", budget: 50, fetchImpl: f });
    const r = renderWorkingContext({ projection: f3Projection({ ferry: "confirmed" }), step: "campsite" });
    await expect(pl.decide(r, "campsite", [])).rejects.toThrow(ContextCapacity);
    expect(calls).toHaveLength(0);
  });
});

describe("protected items", () => {
  it("receipts and live dependency facts cannot be evicted", () => {
    const v = validateContextOps({ projection: f3Projection({ ferry: "confirmed", siteA: "closed" }), step: "campsite" }, { evict: ["receipt:rcpt-ferry-1", "fact:site-A.status"], keep: [], reason: "x", proposed_by: "liquid" });
    expect(v.accepted).toEqual([]);
    expect(v.rejected.map((r) => r.reason)).toEqual(["receipt_protected", expect.stringMatching(/^live_dependency_protected/)]);
  });
  it("evidence ids that collide with live fact ids are refused", () => {
    expect(() => renderWorkingContext({ projection: f3Projection(), step: "campsite", evidence: [{ id: "fact:site-A.status", text: "x" }] })).toThrow(/collides/);
  });
});
