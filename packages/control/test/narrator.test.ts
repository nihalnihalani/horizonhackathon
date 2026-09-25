import { describe, expect, it } from "vitest";
import type { SseEnvelope } from "@dr/shared";
import { Narrator, explainReason, scorecard, type ArmResult } from "../src/narrator.ts";

const ev = (arm: "dr" | "naive", data: Record<string, unknown>, type: SseEnvelope["type"] = "worker"): SseEnvelope =>
  ({ type, seq: 1, ts: "2026-09-25T00:00:00Z", arm, run_id: `r-${arm}`, data }) as SseEnvelope;

describe("narrator", () => {
  it("marks each arm with its own colour and name", () => {
    const n = new Narrator();
    expect(n.line(ev("dr", { kind: "verdict", verdict: "VALID", reason: "all 4 steps done; total $280.00 <= $400.00; one receipt per slot" })))
      .toBe("🔵 **Dead Reckoning** ✅ **Trip valid**: all 4 steps booked · $280 of $400 budget · one receipt per booking.");
    expect(n.line(ev("naive", { kind: "verdict", verdict: "INVALID", reason: "invariant 4: 2 distinct committed ferry receipts (rcpt-a, rcpt-b)" })))
      .toBe("🟠 **Ordinary agent** ❌ **Trip invalid**: paid for the ferry 2 times (duplicate charge).");
  });

  it("explains recovery from RawTree and the desk reconcile", () => {
    const out = new Narrator().line(ev("dr", { kind: "recovered", epoch: 2, restored_rows: 18, stale: ["site-A.status"], reconciled: [{ slot: "ferry", result: "recovered", receipt_id: "rcpt-ffe71dd72471" }] }))!;
    expect(out).toContain("no local state");
    expect(out).toContain("18 records");
    expect(out).toContain("**already paid**");
    expect(out).toContain("ffe71dd7");
    expect(out).toContain("Site A status");
  });

  it("skips the first-boot recovery and the ordinary agent's page reads", () => {
    const n = new Narrator();
    expect(n.line(ev("dr", { kind: "recovered", epoch: 1, restored_rows: 0 }))).toBeNull();
    expect(n.line(ev("naive", { kind: "observation", sites: {} }))).toBeNull();
  });

  it("names the code-rejected campsites and folds planner context into the booking line", () => {
    const n = new Narrator();
    const plan = n.line(ev("dr", { kind: "planner", action: "book", resource: "site-C", context_tokens: 612, rejected: [{ resource: "site-A", reason: "closed" }, { resource: "site-B", reason: "not_accessible" }] }));
    expect(plan).toBe("🔵 **Dead Reckoning** Planner (GPT-5.5) chose **Site C**. Ruled out in code: Site A (closed), Site B (not wheelchair accessible).");
    expect(n.line(ev("dr", { kind: "booking", resource: "site-C", outcome: "committed", amount: 9000 })))
      .toBe("🔵 **Dead Reckoning** ✓ Booked Site C: $90 · planner context 612 tokens.");
  });

  it("calls out the ordinary agent's second ferry ticket and its closed-site attempt", () => {
    const n = new Narrator();
    expect(n.line(ev("naive", { kind: "booking", resource: "ferry-tiburon-1009", outcome: "committed", amount: 12000, epoch: 2 }))).toContain("Booked the ferry **again**");
    expect(n.line(ev("naive", { kind: "booking", resource: "site-A", outcome: "rejected", reject_reason: "closed", amount: 8000, epoch: 2 })))
      .toContain("it still believes the site is open");
  });

  it("turns the F3b block reason into plain words", () => {
    expect(explainReason("no_accessible_site_available: no campsite candidate satisfies accessible=true and status=open (site-A: closed, site-B: not_accessible, site-C: closed); planner block"))
      .toBe("no open, wheelchair-accessible campsite is left (Site A closed, Site B not accessible, Site C closed)");
  });
});

describe("scorecard", () => {
  const led = (slot: string, resource: string, amount: number, committed = true, reject_reason: string | null = null) =>
    ({ slot, resource, amount, committed, reject_reason, outcome: committed ? "committed" : "rejected" });
  const results: ArmResult[] = [
    { arm: "dr", run_id: "a", verdict: { verdict: "VALID", reason: "", duplicate_effects: 0, stale_actions: 0 }, tokens: [526, 612, 438, 454],
      ledger: [led("ferry", "ferry-tiburon-1009", 12000), led("campsite", "site-C", 9000), led("permit", "permit", 3000), led("gear", "gear", 4000)] },
    { arm: "naive", run_id: "b", verdict: { verdict: "INVALID", reason: "", duplicate_effects: 1, stale_actions: 1 }, tokens: [481, 550, 682, 738, 830],
      ledger: [led("ferry", "ferry-tiburon-1009", 12000), led("ferry", "ferry-tiburon-1009", 12000), led("campsite", "site-A", 8000, false, "closed"), led("permit", "permit", 3000), led("gear", "gear", 4000)] },
  ];
  it("counts effects from the desk ledger", () => {
    const md = scorecard(results);
    expect(md).toContain("| Ferry tickets paid (desk ledger) | 1 | **2** (charged twice) |");
    expect(md).toContain("| Campsite | Site C (accessible) | tried Site A, rejected: closed |");
    expect(md).toContain("| Bookings made on stale info | 0 | 1 |");
    expect(md).toContain("| Total charged | $280 | $310 |");
    expect(md).toContain("| Planner context per step (tokens) | 526 → 612 → 438 → 454 | 481 → 550 → 682 → 738 → 830 |");
    expect(md).toContain("🔵 Dead Reckoning | 🟠 Ordinary agent");
  });
  it("shows ? rather than guessing when the desk is unreachable", () => {
    expect(scorecard([{ ...results[0]!, ledger: null }])).toContain("| Ferry tickets paid (desk ledger) | ? |");
  });
});
