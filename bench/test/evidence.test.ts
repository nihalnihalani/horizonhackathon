import { describe, expect, it } from "vitest";
import { EvidenceRedefinitionError, EvidenceRegistry, recall } from "../evidence.ts";

const rec = (id: string, text: string) => ({ id, text, source_url: "https://sim/x", retrieval_mode: "live" as const, observed_at: "2026-10-08T09:00:00Z" });

describe("EvidenceRegistry", () => {
  it("put is idempotent for identical content", () => {
    const reg = new EvidenceRegistry();
    const a = reg.put(rec("obs:1", "hello"));
    const b = reg.put(rec("obs:1", "hello"));
    expect(a.content_hash).toBe(b.content_hash);
    expect(reg.size()).toBe(1);
  });
  it("rejects conflicting redefinition of the same id", () => {
    const reg = new EvidenceRegistry();
    reg.put(rec("obs:1", "hello"));
    expect(() => reg.put(rec("obs:1", "different text"))).toThrow(EvidenceRedefinitionError);
  });
});

describe("recall (C03: bounded, provenance-labelled)", () => {
  it("returns found:false for an unknown id", () => {
    const reg = new EvidenceRegistry();
    expect(recall(reg, "obs:missing", 500)).toEqual({ id: "obs:missing", found: false });
  });
  it("returns the full original text with provenance when it fits the budget", () => {
    const reg = new EvidenceRegistry();
    reg.put(rec("obs:1", "a short observation"));
    const r = recall(reg, "obs:1", 500);
    expect(r.found).toBe(true);
    if (r.found) {
      expect(r.excerpt).toContain("a short observation");
      expect(r.excerpt).toContain("source https://sim/x");
      expect(r.truncated).toBe(false);
    }
  });
  it("truncates a long original to fit maxTokens and labels it truncated", () => {
    const reg = new EvidenceRegistry();
    const long = "word ".repeat(2000);
    reg.put(rec("obs:big", long));
    const r = recall(reg, "obs:big", 50);
    expect(r.found).toBe(true);
    if (r.found) {
      expect(r.truncated).toBe(true);
      expect(r.tokens.count).toBeLessThanOrEqual(50);
      expect(r.excerpt).toMatch(/…$/);
    }
  });
});
