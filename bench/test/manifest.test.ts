import { describe, expect, it } from "vitest";
import { assertComparable, buildManifest } from "../manifest.ts";

const base = () => buildManifest({
  batchId: "test-batch",
  plannerInputCap: 6000,
  arms: [{ arm: "dr", policy_version: "dr-context-v1", mode: "stub", planner_model: null, curator_or_summarizer_model: "rule", prompt_hashes: {} }],
});

describe("B01: assertComparable refuses a measured comparison on manifest mismatch", () => {
  it("accepts two manifests built with identical config", () => {
    const a = base();
    const b = base();
    expect(assertComparable(a, b)).toEqual({ comparable: true, reasons: [] });
  });
  it("refuses when planner_input_cap differs", () => {
    const a = base();
    const b = buildManifest({ batchId: "test-batch", plannerInputCap: 4000, arms: a.arms });
    const r = assertComparable(a, b);
    expect(r.comparable).toBe(false);
    expect(r.reasons.some((x) => /planner_input_cap/.test(x))).toBe(true);
  });
  it("refuses when crash_schedule differs", () => {
    const a = base();
    const b = { ...base(), crash_schedule: ["after_desk_commit"] };
    const r = assertComparable(a, b);
    expect(r.comparable).toBe(false);
    expect(r.reasons.some((x) => /crash_schedule/.test(x))).toBe(true);
  });
  it("refuses when the fixture hash differs", () => {
    const a = base();
    const b = { ...base(), fixture: { ...a.fixture, sha256: "deadbeef" } };
    const r = assertComparable(a, b);
    expect(r.comparable).toBe(false);
    expect(r.reasons.some((x) => /fixture sha256/.test(x))).toBe(true);
  });
  it("refuses when planner models differ across arms", () => {
    const a = buildManifest({ batchId: "b", plannerInputCap: 6000, arms: [{ arm: "dr", policy_version: "v", mode: "live", planner_model: "gpt-5", curator_or_summarizer_model: "liquid", prompt_hashes: {} }] });
    const b = buildManifest({ batchId: "b", plannerInputCap: 6000, arms: [{ arm: "baseline", policy_version: "v", mode: "live", planner_model: "gpt-4", curator_or_summarizer_model: "gpt-4", prompt_hashes: {} }] });
    const r = assertComparable(a, b);
    expect(r.comparable).toBe(false);
    expect(r.reasons.some((x) => /planner model/.test(x))).toBe(true);
  });
});
