// F02: extraction fails, or only an old cache is available -> the fact stays stale with its label, and no
// freshness-dependent effect proceeds. Unit level, no live providers:
//   (1) NimbleSensor.extractStatusPage never turns a failed extraction into "closed" -- it throws SourceUnverified
//       (packages/providers/src/nimble.ts), so a caller cannot silently treat an unreachable source as fresh data.
//   (2) The runner's own stale-to-closed mapping (packages/runner/src/main.ts viewFromFacts, ~line 66-76: "a stale
//       or missing status is unverified -- never treated as open") feeds filterCandidates a "closed" candidate for
//       any non-active fact; filterCandidates (packages/providers/src/planner.ts) and the pre-planner block
//       (packages/runner/src/candidates.ts, called before any booking decision) reject it and block the step
//       instead of booking against stale/unverified evidence. main.ts itself is not imported here: it loads
//       `runner` config and spawns providers at module scope, so it is only exercisable through a live child
//       (already covered by the recovery/subprocess suites) -- this test exercises the same reusable functions
//       main.ts calls.
import { describe, expect, it } from "vitest";
import { SourceUnverified } from "@dr/shared";
import { NimbleSensor, filterCandidates, type CandidateX, type PlannerContext } from "@dr/providers";
import { NO_ACCESSIBLE_SITE, preplannerBlock } from "../src/candidates.ts";

/** Minimal fake fetch: queue of responders (status/json), no bodies needed for these cases. */
function fakeFetch(responders: Array<() => { status?: number; json?: unknown; text?: string }>) {
  let n = 0;
  const f = async (_url: string) => {
    const r = responders[Math.min(n, responders.length - 1)]!();
    n++;
    return new Response(r.text ?? JSON.stringify(r.json), { status: r.status ?? 200 });
  };
  return { f, callCount: () => n };
}

describe("F02 (1): a failed Nimble extraction is SourceUnverified, never a silent close", () => {
  it("non-success http status", async () => {
    const failing = fakeFetch([() => ({ status: 500, json: { status: "failed" } })]);
    const sensor = new NimbleSensor({ apiKey: "k", fetchImpl: failing.f });
    await expect(sensor.extractStatusPage("https://t.example/status.html")).rejects.toThrow(SourceUnverified);
  });

  it("transport error (unreachable source)", async () => {
    const broken = async () => { throw new Error("ECONNREFUSED"); };
    const sensor = new NimbleSensor({ apiKey: "k", fetchImpl: broken as unknown as typeof fetch });
    await expect(sensor.extractStatusPage("https://t.example/status.html")).rejects.toThrow(SourceUnverified);
  });

  it("nimble reports success but the target itself returned an error status", async () => {
    const badTarget = fakeFetch([() => ({ json: { task_id: "t", status: "success", status_code: 503, data: {} } })]);
    const sensor = new NimbleSensor({ apiKey: "k", fetchImpl: badTarget.f });
    await expect(sensor.extractStatusPage("https://t.example/status.html")).rejects.toThrow(/503/);
  });
});

describe("F02 (2): a stale/unverified campsite fact is never treated as bookable", () => {
  const ctx: PlannerContext = {
    constraints: { start: "2026-10-02", end: "2026-10-04", party: 2, budget_cents: 35000, accessible_required: true },
    spent_cents: 12000,
  };

  // Mirrors main.ts's viewFromFacts mapping exactly: only an "active" fact contributes its true last-known value;
  // anything else (stale cache, superseded, conflict, or never observed) is presented as closed regardless of what
  // that stale value used to say.
  type FactFreshness = "active" | "stale" | "superseded" | "conflict";
  const staleAwareCandidate = (resource: string, lastKnownStatus: "open" | "closed", freshness: FactFreshness): CandidateX => ({
    resource, slot: "campsite", price_cents: 8000, accessible: true,
    status: freshness === "active" ? lastKnownStatus : "closed",
    date: "2026-10-02",
  });

  it("a stale fact whose last-known value was 'open' is filtered out as closed (old cache != current)", () => {
    const { valid, rejected } = filterCandidates([staleAwareCandidate("site-A", "open", "stale")], ctx, "campsite");
    expect(valid).toHaveLength(0);
    expect(rejected).toEqual([{ resource: "site-A", reason: "closed" }]);
  });

  it("the same fact once fresh (active) books normally -- freshness, not the remembered value, is the gate", () => {
    const { valid, rejected } = filterCandidates([staleAwareCandidate("site-A", "open", "active")], ctx, "campsite");
    expect(rejected).toHaveLength(0);
    expect(valid).toHaveLength(1);
  });

  it("the pre-planner check blocks the step (never books) when every campsite candidate is stale/unverified", () => {
    const cands = (["site-A", "site-B", "site-C"] as const).map((r) => staleAwareCandidate(r, "open", "stale"));
    const reason = preplannerBlock(cands, ctx, "campsite");
    expect(reason).toBe(`${NO_ACCESSIBLE_SITE}: no campsite candidate satisfies accessible=true and status=open (site-A: closed, site-B: closed, site-C: closed)`);
  });

  it("a mix of one fresh-but-inaccessible and two stale/superseded candidates still blocks; no freshness-dependent booking slips through", () => {
    const cands: CandidateX[] = [
      staleAwareCandidate("site-A", "open", "stale"),
      { resource: "site-B", slot: "campsite", price_cents: 6000, accessible: false, status: "open", date: "2026-10-02" }, // fresh, but not accessible
      staleAwareCandidate("site-C", "open", "superseded"),
    ];
    const reason = preplannerBlock(cands, ctx, "campsite");
    expect(reason).toBe(`${NO_ACCESSIBLE_SITE}: no campsite candidate satisfies accessible=true and status=open (site-A: closed, site-B: not_accessible, site-C: closed)`);
  });

  it("a conflict-status fact is likewise never treated as open (no policy-selected value without a validator decision)", () => {
    const { valid, rejected } = filterCandidates([staleAwareCandidate("site-A", "open", "conflict")], ctx, "campsite");
    expect(valid).toHaveLength(0);
    expect(rejected[0]).toEqual({ resource: "site-A", reason: "closed" });
  });
});
