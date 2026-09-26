import { afterEach, describe, expect, it, vi } from "vitest";
import { renderStatusPage } from "@dr/shared";
import { applyContextOps, renderWorkingContext } from "../src/context.ts";
import { LocalPlanner, LocalStatusSensor, RuleCurator, createLocalProviders } from "../src/local.ts";
import { type CandidateX } from "../src/planner.ts";
import { f3Projection, fact, statusModel } from "./helpers.ts";

const FEED = "http://127.0.0.1:4402/status.html";
const CANDIDATES: CandidateX[] = [
  { resource: "site-A", slot: "campsite", price_cents: 8000, accessible: true, status: "closed", date: "2026-10-09" },
  { resource: "site-B", slot: "campsite", price_cents: 6000, accessible: false, status: "open", date: "2026-10-09" },
  { resource: "site-C", slot: "campsite", price_cents: 9000, accessible: true, status: "open", date: "2026-10-09" },
];
const rendered = () => renderWorkingContext({ projection: f3Projection({ ferry: "confirmed", siteA: "closed" }), step: "campsite" });
afterEach(() => vi.unstubAllGlobals());

describe("key-free local providers", () => {
  it("uses no network or provider usage for planning and curation", async () => {
    const fetch = vi.fn(() => { throw new Error("unexpected network request"); });
    vi.stubGlobal("fetch", fetch);
    const providers = createLocalProviders(FEED, 6000);
    const decision = await providers.planner.decide(rendered(), "campsite", CANDIDATES);
    expect(decision).toMatchObject({ action: "book", resource: "site-C", planner_tokens_in: 0, usage: null, response_id: null, validator: { ok: true } });
    expect(decision.context_tokens.count).toBeGreaterThan(0);
    expect(decision.rejected_candidates).toEqual([{ resource: "site-A", reason: "closed" }, { resource: "site-B", reason: "not_accessible" }]);
    const comparison = await providers.curator.compareFact(fact("site-A.status", "open", "2026-09-25T19:00:00Z"), {
      key: "site-A.status", value: "closed", observed_at: "2026-09-25T19:01:00Z",
    });
    expect(comparison).toMatchObject({ accepted: true, decision: "superseded", proposed_by: "rule", curator_ms: 0 });
    expect(comparison.model_decision).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("blocks when every accessible site is closed", async () => {
    const candidates = CANDIDATES.map((c) => c.resource === "site-C" ? { ...c, status: "closed" as const } : c);
    const decision = await new LocalPlanner(6000).decide(rendered(), "campsite", candidates);
    expect(decision.action).toBe("block");
    expect(decision.resource).toBeUndefined();
    expect(decision.valid_candidates).toEqual([]);
    expect(decision.reason).toContain("site-B: not_accessible");
  });

  it("enforces remaining budget, dates, party size and slot before choosing the cheapest valid candidate", async () => {
    const ctx = { constraints: { start: "2026-10-09", end: "2026-10-11", party: 2, budget_cents: 40000, accessible_required: true }, spent_cents: 35000 };
    const candidate: CandidateX = { resource: "okay", slot: "campsite", price_cents: 4500, accessible: true, status: "open", date: "2026-10-09", capacity: 2 };
    const decision = await new LocalPlanner(6000).decide(rendered(), "campsite", [
      { ...candidate, resource: "expensive", price_cents: 5100 },
      { ...candidate, resource: "wrong-date", date: "2026-10-12" },
      { ...candidate, resource: "too-small", capacity: 1 },
      { ...candidate, resource: "wrong-slot", slot: "gear" },
      candidate, { ...candidate, resource: "cheapest", price_cents: 4000 },
    ], ctx);
    expect(decision.resource).toBe("cheapest");
    expect(decision.rejected_candidates.map((c) => c.reason)).toEqual(["over_budget", "outside_dates", "party_exceeds_capacity", "wrong_slot"]);
    await expect(new LocalPlanner(1).decide(rendered(), "campsite", CANDIDATES)).rejects.toMatchObject({ code: "CONTEXT_CAPACITY" });
  });

  it("reads the current local page, rejects mismatched versions, and sends no credentials", async () => {
    const model = statusModel(2, "closed");
    const fetch = vi.fn(async () => new Response(renderStatusPage(model), { status: 200 }));
    const sensor = new LocalStatusSensor(FEED, { fetchImpl: fetch });
    const observation = await sensor.extractStatusPage(FEED, { expectedWorldVersion: 2 });
    expect(observation).toMatchObject({ retrieval_mode: "direct", parse_mode: "local-css", nimble_ms: 0, world_version: 2, metadata: { provider: "local", external_provider_calls: 0 } });
    expect(observation.task_id).toMatch(/^local-/);
    expect(observation.model.sites[0]?.status).toBe("closed");
    expect(fetch.mock.calls[0]).toEqual([FEED, expect.objectContaining({ headers: { Accept: "text/html" }, redirect: "error", credentials: "omit", cache: "no-store" })]);
    await expect(sensor.extractStatusPage(FEED, { expectedWorldVersion: 3 })).rejects.toThrow("world_version mismatch");
  });

  it("refuses external, changed, credential-bearing and redirecting sources", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 302, headers: { Location: "https://example.com/" } }));
    for (const url of ["https://example.com/status.html", "http://localhost:4402/status.html", "http://user:pass@127.0.0.1:4402/status.html", "http://127.0.0.1:4402/admin/ledger"]) {
      expect(() => new LocalStatusSensor(url, { fetchImpl: fetch })).toThrow("configured");
    }
    const sensor = new LocalStatusSensor(FEED, { fetchImpl: fetch });
    await expect(sensor.extractStatusPage("http://127.0.0.1:4401/status.html")).rejects.toThrow("other than its configured");
    await expect(sensor.extractPage("https://example.com/")).rejects.toThrow("disabled");
    expect(fetch).not.toHaveBeenCalled();
    await expect(sensor.extractStatusPage(FEED)).rejects.toThrow("redirects are forbidden");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("fails closed on malformed or unavailable local evidence", async () => {
    const fetch = vi.fn(async () => new Response("<html>Source offline</html>"));
    await expect(new LocalStatusSensor(FEED, { fetchImpl: fetch }).extractStatusPage(FEED)).rejects.toThrow("missing required status fields");
    const unavailable = new LocalStatusSensor(FEED, { fetchImpl: async () => { throw new TypeError("connection refused"); } });
    await expect(unavailable.extractStatusPage(FEED)).rejects.toMatchObject({ code: "SOURCE_UNVERIFIED" });
  });

  it("retains pins, receipts and active facts when evicting superseded evidence", async () => {
    const projection = f3Projection({ ferry: "confirmed" });
    const state = { projection, step: "campsite", evidence: [{ id: "fact:site-A.status@v1", text: "superseded open status" }, { id: "obs:old", text: "superseded source observation" }] };
    const before = renderWorkingContext(state);
    const proposal = await new RuleCurator().proposeContextOps(before);
    const applied = applyContextOps(state, proposal);
    expect(proposal.proposed_by).toBe("rule");
    expect(applied.accepted).toEqual(["fact:site-A.status@v1", "obs:old"]);
    expect(applied.rejected).toEqual([]);
    for (const item of before.items.filter((i) => i.pinned || i.class === "receipt" || i.id === "fact:site-A.status")) {
      expect(applied.rendered.items).toContainEqual(item);
    }
    expect(applied.rendered.text).not.toContain("superseded source observation");
  });

  it("validates rule comparisons against scope and observation time", async () => {
    const curator = new RuleCurator();
    const old = fact("site-A.status", "open", "2026-09-25T19:00:00Z");
    const earlier = await curator.compareFact(old, { key: old.key, value: "closed", observed_at: "2026-09-25T18:00:00Z" });
    expect(earlier).toMatchObject({ accepted: false, reject_reason: "older_observation" });
    const wrongKey = await curator.compareFact(old, { key: "site-B.status", value: "closed", observed_at: "2026-09-25T20:00:00Z" });
    expect(wrongKey.accepted).toBe(false);
    const simultaneous = await curator.compareFact(old, { key: old.key, value: "closed", observed_at: old.observed_at });
    expect(simultaneous).toMatchObject({ decision: "conflict", accepted: true });
  });
});
