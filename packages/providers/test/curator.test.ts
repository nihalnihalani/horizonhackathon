import { describe, expect, it } from "vitest";
import { CURATOR_SYSTEM_PROMPT, LiquidCurator, compareOpRow, curatorMetricRows, parseObservedAt, validateCuratorDecision } from "../src/index.ts";
import { fact, fakeFetch } from "./helpers.ts";

const OLD = fact("site-A.status", "open", "2026-09-25 19:00:00"); // RawTree-normalized form (UTC)
const LATER = "2026-09-25T19:30:00.000Z";
const obs = (value: unknown, observed_at = LATER, key = "site-A.status") => ({ key, value, observed_at, task_id: "t2" });
const model = (decision: string, new_value = "closed", key = "site-A.status") => ({ key, decision, new_value, reason: "r" });

describe("validateCuratorDecision", () => {
  it("accepts a direct superseded with the OBSERVED value", () => {
    const v = validateCuratorDecision(OLD, obs("closed"), model("superseded"));
    expect(v).toMatchObject({ accepted: true, decision: "superseded", new_value: "closed" });
    expect(v.promoted_by).toBeUndefined();
  });
  it("promotes conflict→superseded when the observation is strictly later", () => {
    const v = validateCuratorDecision(OLD, obs("closed"), model("conflict", "closed for storm damage"));
    expect(v).toMatchObject({ accepted: true, decision: "superseded", promoted_by: "validator", model_decision: "conflict" });
  });
  it("keeps conflict for same-time disagreement", () => {
    const v = validateCuratorDecision(OLD, obs("closed", "2026-09-25T19:00:00Z"), model("conflict"));
    expect(v).toMatchObject({ accepted: true, decision: "conflict" });
  });
  it("accepts unchanged when values match", () => {
    expect(validateCuratorDecision(OLD, obs("open"), model("unchanged", "open"))).toMatchObject({ accepted: true, decision: "unchanged" });
  });
  describe("F03 rejections (wrong scope/date/resource)", () => {
    it("rejects an observation for a different key before trusting the model", () => {
      expect(validateCuratorDecision(OLD, obs("closed", LATER, "site-B.status"), model("superseded"))).toMatchObject({ accepted: false });
    });
    it("rejects a model answer about another key", () => {
      expect(validateCuratorDecision(OLD, obs("closed"), model("superseded", "closed", "site-C.status")).reject_reason).toMatch(/key_mismatch/);
    });
    it("rejects superseded from an older observation", () => {
      expect(validateCuratorDecision(OLD, obs("closed", "2026-09-25T18:00:00Z"), model("superseded")).reject_reason).toMatch(/not_later/);
    });
    it("rejects a model-authored value that was not observed", () => {
      expect(validateCuratorDecision(OLD, obs("closed"), model("superseded", "open")).reject_reason).toMatch(/value_not_observed/);
    });
    it("rejects out-of-scope keys and schema garbage", () => {
      const o = fact("budget_cents", 1, "2026-09-25 19:00:00");
      expect(validateCuratorDecision(o, obs(2, LATER, "budget_cents"), model("superseded", "2", "budget_cents")).reject_reason).toMatch(/out_of_scope/);
      expect(validateCuratorDecision(OLD, obs("closed"), { decision: "delete" }).reject_reason).toBe("schema_invalid");
    });
    it("rejects unchanged when values differ", () => {
      expect(validateCuratorDecision(OLD, obs("closed"), model("unchanged", "open")).accepted).toBe(false);
    });
  });
  it("parses RawTree timestamps as UTC", () => {
    expect(parseObservedAt("2026-09-25 19:00:00")).toBe(Date.parse("2026-09-25T19:00:00Z"));
  });
});

describe("LiquidCurator", () => {
  it("sends the supersede rule, temperature 0.1, max_tokens 120, json_schema; times the call", async () => {
    const { f, calls } = fakeFetch([() => ({ json: { choices: [{ message: { content: JSON.stringify(model("conflict")) } }] } })]);
    const c = new LiquidCurator({ fetchImpl: f });
    const r = await c.compareFact(OLD, obs("closed"));
    const b = calls[0]!.body;
    expect(calls[0]!.url).toBe("http://127.0.0.1:8081/v1/chat/completions");
    expect(b.temperature).toBe(0.1);
    expect(b.max_tokens).toBe(120);
    expect(b.response_format.type).toBe("json_schema");
    expect(b.messages[0].content).toBe(CURATOR_SYSTEM_PROMPT);
    expect(b.messages[0].content).toMatch(/strictly later observed_at SUPERSEDES/);
    expect(b.messages[1].content).not.toMatch(/markdown/i);
    expect(r).toMatchObject({ decision: "superseded", promoted_by: "validator", accepted: true, key: "site-A.status" });
    expect(r.curator_ms).toBeGreaterThanOrEqual(0);
    expect(c.latencyStats().n).toBe(1);
    const row = compareOpRow("campsite", r);
    expect(row).toMatchObject({ op: "compare", accepted: true, decision: "superseded", promoted_by: "validator", proposed_by: "liquid" });
    expect(curatorMetricRows("campsite", c.timings)[0]).toMatchObject({ phase: "curator", curator_ms: r.curator_ms });
  });
  it("rejections become context_ops rows with accepted:false", async () => {
    const { f } = fakeFetch([() => ({ json: { choices: [{ message: { content: JSON.stringify(model("superseded", "closed", "site-B.status")) } }] } })]);
    const r = await new LiquidCurator({ fetchImpl: f }).compareFact(OLD, obs("closed"));
    expect(r.accepted).toBe(false);
    expect(compareOpRow("campsite", r)).toMatchObject({ op: "compare", accepted: false, reason: expect.stringMatching(/^rejected by validator: key_mismatch/) });
  });
  it("unreachable llama-server is CURATOR_UNAVAILABLE, not a decision", async () => {
    const f = async () => { throw new TypeError("fetch failed"); };
    await expect(new LiquidCurator({ fetchImpl: f }).compareFact(OLD, obs("closed"))).rejects.toMatchObject({ code: "CURATOR_UNAVAILABLE" });
  });
});
