import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { actionKey, type DeskReceipt } from "@dr/shared";
import { bookArgsHash, startDesk, type RunningDesk } from "../src/index.ts";

const W = "world-token-test", O = "operator-token-test";
let desk: RunningDesk;
beforeAll(async () => { desk = await startDesk({ worldToken: W, operatorToken: O, port: 0, feedPort: 0 }); });
afterAll(async () => { await desk.close(); });

const RUN = "f3-20260925-aaaa";
function req(over: Partial<{ run_id: string; arm: "dr" | "naive"; slot: "ferry" | "campsite"; resource: string; date: string; party: number; expected_world_version: number; step: string }> = {}) {
  const a = { run_id: RUN, arm: "dr" as const, slot: "ferry" as const, resource: "ferry-tiburon-1009", date: "2026-10-09", party: 2, expected_world_version: 1, ...over };
  const { step, ...args } = a as typeof a & { step?: string };
  return { action_key: actionKey(args.run_id, step ?? args.slot, args.resource, args.date, args.party), ...args, args_hash: bookArgsHash(args) };
}
const post = (path: string, body: unknown, token = W) =>
  fetch(`${desk.url}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
const ledger = () => desk.store.ledger({ run_id: RUN });

describe("desk", () => {
  it("A01: same key + args twice → two attempts recorded, one outcome/receipt", async () => {
    const b = req();
    const r1 = (await (await post("/book", b)).json()) as DeskReceipt;
    const r2 = (await (await post("/book", b)).json()) as DeskReceipt;
    expect(r1.committed).toBe(true);
    expect(r2.receipt_id).toBe(r1.receipt_id);
    expect(r2.dedupeHit).toBe(true);
    const l = desk.store.ledger({ run_id: RUN });
    expect(l.outcomes.filter((o) => o.action_key === b.action_key)).toHaveLength(1);
    expect(l.requests.filter((q: any) => q.action_key === b.action_key)).toHaveLength(2);
    expect(r1.amount).toBe(12000);
  });

  it("A02: same key with altered args → 409, original unchanged", async () => {
    const b = req();
    const altered = { ...b, party: 3 };
    altered.args_hash = bookArgsHash({ run_id: b.run_id, arm: b.arm, slot: b.slot, resource: b.resource, date: b.date, party: 3, expected_world_version: 1 });
    const res = await post("/book", altered);
    expect(res.status).toBe(409);
    const look = await fetch(`${desk.url}/actions/${b.action_key}`, { headers: { authorization: `Bearer ${W}` } });
    expect(((await look.json()) as DeskReceipt).committed).toBe(true);
  });

  it("A03: world changes after fetch, before booking → stale action rejected and recorded", async () => {
    const run = "f3-20260925-a03a";
    await post("/admin/reset", {}, O);
    const w = await post("/admin/world", { site: "A", status: "closed", notice: "Storm damage" }, O);
    expect(((await w.json()) as any).world_version).toBe(2);
    const b = req({ run_id: run, slot: "campsite", resource: "site-A", expected_world_version: 1 });
    const r = (await (await post("/book", b)).json()) as DeskReceipt;
    expect(r.committed).toBe(false);
    expect(r.outcome).toBe("rejected");
    expect(r.reject_reason).toBe("closed");
    expect(desk.store.ledger({ run_id: run }).outcomes).toHaveLength(1);
    // unaffected resource at the older expected version still books (per-resource precondition)
    const f = (await (await post("/book", req({ run_id: run, expected_world_version: 1 }))).json()) as DeskReceipt;
    expect(f.committed).toBe(true);
    // reopen A: a v1 intent is now stale_version (A changed at v3)
    await post("/admin/world", { site: "A", status: "open" }, O);
    const s = (await (await post("/book", req({ run_id: run, slot: "campsite", resource: "site-A", step: "campsite2", expected_world_version: 1 }))).json()) as DeskReceipt;
    expect(s.reject_reason).toBe("stale_version");
  });

  it("A05: commit, mutate world, retry identical → original receipt before world check; saved rejection stays rejected after reopen", async () => {
    await post("/admin/reset", {}, O);
    const run = "f3-20260925-a05a";
    const b = req({ run_id: run, slot: "campsite", resource: "site-A" });
    const r1 = (await (await post("/book", b)).json()) as DeskReceipt;
    expect(r1.committed).toBe(true);
    await post("/admin/world", { site: "A", status: "closed" }, O);
    const r2 = (await (await post("/book", b)).json()) as DeskReceipt;
    expect(r2).toMatchObject({ receipt_id: r1.receipt_id, committed: true, dedupeHit: true });
    // saved rejection: C closed → rejected; reopen; identical retry still rejected (dedupe)
    await post("/admin/world", { site: "C", status: "closed" }, O);
    const c = req({ run_id: run, slot: "campsite", resource: "site-C", step: "campsite-c", expected_world_version: 3 });
    const rj = (await (await post("/book", c)).json()) as DeskReceipt;
    expect(rj.committed).toBe(false);
    await post("/admin/world", { site: "C", status: "open" }, O);
    const rj2 = (await (await post("/book", c)).json()) as DeskReceipt;
    expect(rj2).toMatchObject({ receipt_id: rj.receipt_id, committed: false, dedupeHit: true });
  });

  it("A06: forged args hash rejected with attempt retained; no cross-run lookup", async () => {
    const run = "f3-20260925-a06a";
    const b = { ...req({ run_id: run }), args_hash: "0".repeat(64) };
    const res = await post("/book", b);
    expect(res.status).toBe(400);
    const l = desk.store.ledger({ run_id: run });
    expect(l.outcomes).toHaveLength(0);
    expect(l.requests).toHaveLength(1);
    // real booking in run, then lookup namespaced to another run → 404
    const ok = req({ run_id: run });
    await post("/book", ok);
    const own = await fetch(`${desk.url}/actions/${ok.action_key}?run_id=${run}&arm=dr`, { headers: { authorization: `Bearer ${W}` } });
    expect(own.status).toBe(200);
    const other = await fetch(`${desk.url}/actions/${ok.action_key}?run_id=f3-20260925-zzzz`, { headers: { authorization: `Bearer ${W}` } });
    expect(other.status).toBe(404);
    const wrongArm = await fetch(`${desk.url}/actions/${ok.action_key}?arm=naive`, { headers: { authorization: `Bearer ${W}` } });
    expect(wrongArm.status).toBe(404);
  });

  it("lookup: 404 authoritative absence, 503 when desk cannot answer, 401 without token", async () => {
    const key = "f".repeat(64);
    expect((await fetch(`${desk.url}/actions/${key}`, { headers: { authorization: `Bearer ${W}` } })).status).toBe(404);
    expect((await fetch(`${desk.url}/actions/${key}`)).status).toBe(401);
    await post("/admin/fault", { lookup: "unavailable" }, O);
    expect((await fetch(`${desk.url}/actions/${key}`, { headers: { authorization: `Bearer ${W}` } })).status).toBe(503);
    await post("/admin/fault", { lookup: "ok" }, O);
  });

  it("status.html follows the shared DOM contract; /admin/world needs the operator token; feed serves only status.html", async () => {
    await post("/admin/reset", {}, O);
    const html = await (await fetch(`${desk.url}/status.html`)).text();
    expect(html.match(/id="site-A"/g)).toHaveLength(1);
    expect(html).toMatch(/<tr id="site-A"><td class="site-id">A<\/td><td class="status">open<\/td><td class="accessible">yes<\/td><td class="price">80<\/td>/);
    expect(html).toMatch(/<tr id="site-B">.*<td class="accessible">no<\/td>/);
    expect(html).toContain('<span id="world-version">1</span>');
    expect((await post("/admin/world", { site: "A", status: "closed" }, W)).status).toBe(401);
    const ok = await post("/admin/world", { site: "A", status: "closed", notice: "Storm damage" }, O);
    expect(ok.status).toBe(200);
    const feedHtml = await (await fetch(`${desk.feedUrl}/status.html`)).text();
    expect(feedHtml).toMatch(/<tr id="site-A">.*<td class="status">closed<\/td>.*Storm damage/);
    expect(feedHtml).toContain('<span id="world-version">2</span>');
    expect((await fetch(`${desk.feedUrl}/book`, { method: "POST" })).status).toBe(404);
    expect((await fetch(`${desk.feedUrl}/actions/${"a".repeat(64)}`)).status).toBe(404);
    expect((await fetch(`${desk.feedUrl}/world`)).status).toBe(404);
  });

  it("time and cancel routes", async () => {
    expect(((await (await fetch(`${desk.url}/time`)).json()) as any).sim_clock).toMatch(/SIMULATED/);
    const b = req({ run_id: "f3-20260925-cncl" });
    await post("/book", b);
    const c = (await (await post("/cancel", { action_key: b.action_key })).json()) as DeskReceipt;
    expect(c.committed).toBe(false);
    expect(desk.store.ledger({ run_id: "f3-20260925-cncl" }).committed_by_slot.ferry ?? 0).toBe(0);
  });
});
