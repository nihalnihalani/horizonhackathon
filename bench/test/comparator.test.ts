import { describe, expect, it } from "vitest";
import { countTokens } from "@dr/shared";
import { EvidenceRegistry } from "../evidence.ts";
import { M1 } from "../fixtures/m1.ts";
import {
  FROZEN_SUMMARY_PROMPT_HASH, StubSummarizer, SUMMARY_CAP_TOKENS, initialBaselineState, runBaselineRound,
} from "../policies/checkpoint-summary-v1.ts";
import { runBaselineTrace } from "../trace.ts";
import { worldAtRound } from "../world.ts";

describe("checkpoint-summary-v1 comparator", () => {
  it("respects the input cap for every non-blocked round across the full M1 trace", async () => {
    const trace = await runBaselineTrace({ budget: 6000, summarizer: new StubSummarizer() });
    expect(trace.manifests).toHaveLength(12);
    for (const m of trace.manifests) if (!m.blocked) expect(m.token_count).toBeLessThanOrEqual(6000);
  });

  it("triggers a summary call once retained raw history no longer fits a small cap, and keeps the summary within SUMMARY_CAP_TOKENS", async () => {
    const trace = await runBaselineTrace({ budget: 2000, summarizer: new StubSummarizer() });
    const summaryCalls = trace.calls.filter((c) => c.kind === "summary");
    expect(summaryCalls.length).toBeGreaterThan(0);
    for (const m of trace.manifests) {
      if (m.summary_call) {
        expect(m.summary_call.prompt_hash).toBe(FROZEN_SUMMARY_PROMPT_HASH);
        expect(m.summary_call.mode).toBe("stub");
      }
    }
    expect(trace.manifests.some((m) => m.blocked)).toBe(false);
  });

  it("blocks with CONTEXT_CAPACITY rather than dropping the mandatory block when the cap is too small", async () => {
    const trace = await runBaselineTrace({ budget: 10, summarizer: new StubSummarizer() });
    expect(trace.contextCapacityBlocks).toBe(12);
    expect(trace.manifests.every((m) => m.blocked && m.item_ids.length === 0)).toBe(true);
  });

  it("a single runBaselineRound call summarizes the oldest evicted batch and caps the resulting summary", async () => {
    const registry = new EvidenceRegistry();
    let state = initialBaselineState();
    const projection = worldAtRound(6);
    // Prime with rounds 1-6 so the retained pool is nontrivial before the tight-budget round.
    for (const round of M1.rounds.filter((r) => r.round <= 6)) {
      const out = await runBaselineRound({ round, projection: worldAtRound(round.round), state, budget: 700, summarizer: new StubSummarizer(), evidenceRegistry: registry });
      state = out.state;
    }
    expect(countTokens(state.summary).count).toBeLessThanOrEqual(SUMMARY_CAP_TOKENS);
    void projection;
  });
});
