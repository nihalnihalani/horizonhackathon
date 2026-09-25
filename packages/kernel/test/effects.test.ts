// R04 (desk response lost after commit), R05 (desk unavailable during reconcile), dispatch-claim refusal, lookup-only
// reconciliation and original-args-only retry (R11 kernel half). FakeRawTree + real desk on loopback, in-process.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { InvariantViolation, actionKey, type BookRequest, type DeskClient, type DeskReceipt, type LookupResult } from "@dr/shared";
import { FakeRawTree, RawTreeClient, RawTreeLoader, RawTreeSink } from "@dr/storage";
import { startDesk, type RunningDesk } from "@dr/desk";
import {
  DeskUnavailable, DispatchRefused, HttpDeskClient, Journal, OutcomeUnknown, RetryArgsChanged, executeBooking, f3FerryStep, recover, runFerryStep,
} from "../src/index.ts";

const W = "wt", O = "ot";
let fake: FakeRawTree; let desk: RunningDesk; let client: RawTreeClient;
beforeAll(async () => {
  fake = await new FakeRawTree().start();
  client = new RawTreeClient({ baseUrl: fake.url, apiKey: fake.apiKey, database: "deadreckoning", timeoutMs: 500 });
  desk = await startDesk({ worldToken: W, operatorToken: O, port: 0, feedPort: null });
});
afterAll(async () => { await desk.close(); await fake.stop(); });
afterEach(() => { desk.store.lookupUnavailable = false; });

/** Real desk; `dropResponse` commits at the desk then throws as if the response never arrived. */
class LossyDesk implements DeskClient {
  books = 0; lookups = 0; dropResponse = false;
  constructor(private inner: DeskClient) {}
  async book(r: BookRequest): Promise<DeskReceipt> {
    this.books++;
    const rc = await this.inner.book(r);
    if (this.dropResponse) throw new DeskUnavailable("socket hang up after commit (test)");
    return rc;
  }
  lookup(k: string): Promise<LookupResult> { this.lookups++; return this.inner.lookup(k); }
}
let n = 0;
const mk = () => {
  const run = `f3-20260926-e${(++n).toString().padStart(3, "0")}`;
  const d = new LossyDesk(new HttpDeskClient({ baseUrl: desk.url, token: W, ns: { run_id: run, arm: "dr" } }));
  return { run, desk: d, journal: new Journal(new RawTreeSink(client), { run_id: run, arm: "dr", epoch: 1 }) };
};
const quiet = () => {};
const keyFor = (run: string) => { const f = f3FerryStep(); return actionKey(run, f.step_id, f.resource, f.date, f.party); };
const recoverRun = (run: string, d: DeskClient, lookupOnly?: boolean) =>
  recover({ loader: new RawTreeLoader(client), sink: new RawTreeSink(client), desk: d, run_id: run, arm: "dr", log: quiet, lookupOnly });

describe("R04: desk response lost after commit", () => {
  it.each([["real transport loss", false], ["desk_response_lost crash point", true]])("%s → unknown, then lookup recovers the same receipt (never a failed booking)", async (_l, viaPoint) => {
    const { run, desk: d, journal } = mk();
    if (!viaPoint) d.dropResponse = true;
    const out = await runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false, point: viaPoint ? "desk_response_lost" : null });
    expect(out.recovered).toBe(true);
    expect(out.commitment_status).toBe("confirmed");
    const statuses = fake.rows("commitments", run).map((r) => r.status);
    expect(statuses).toEqual(["intent", "unknown", "confirmed"]);
    expect(fake.rows("receipts", run)).toMatchObject([{ recovered: true, outcome: "committed", receipt_id: out.receipt.receipt_id }]);
    const l = desk.store.ledger({ run_id: run });
    expect(l.outcomes).toHaveLength(1);
    expect(l.requests).toHaveLength(1);
    expect(d.books).toBe(1);
  });

  it("lost response + lookup unavailable → OutcomeUnknown; unknown stays, no second request", async () => {
    const { run, desk: d, journal } = mk();
    d.dropResponse = true;
    desk.store.lookupUnavailable = true;
    await expect(runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false })).rejects.toBeInstanceOf(OutcomeUnknown);
    expect(fake.rows("commitments", run).at(-1)!.status).toBe("unknown");
    expect(desk.store.ledger({ run_id: run }).requests).toHaveLength(1);
    // the same business action cannot be dispatched again while unknown
    await expect(runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false })).rejects.toBeInstanceOf(InvariantViolation);
    expect(d.books).toBe(1);
  });
});

describe("R05: desk unavailable during reconcile", () => {
  it("intent + lookup 503 → unknown visible, step blocked, no booking, no new key", async () => {
    const { run, desk: d, journal } = mk();
    await expect(runFerryStep({ journal, desk: d, log: quiet, claimDispatch: async () => ({ granted: false, code: "DISPATCH_REFUSED", reason: "test stop" }) }, { holdAfterCommit: false }))
      .rejects.toBeInstanceOf(DispatchRefused);
    desk.store.lookupUnavailable = true;
    const r = await recoverRun(run, d);
    expect(r.reconciled).toEqual([{ action_key: keyFor(run), slot: "ferry", result: "unknown", lookup: true }]);
    expect(r.blocked_steps).toEqual(["ferry"]);
    expect(r.journal.state.commitments[keyFor(run)]!.status).toBe("unknown");
    expect(Object.keys(r.journal.state.commitments)).toEqual([keyFor(run)]);
    expect(d.books).toBe(0);
    expect(desk.store.ledger({ run_id: run }).requests).toHaveLength(0);
  });
});

describe("dispatch claim + lookup-only reconciliation", () => {
  it("refused claim → no desk POST; intent stays for reconciliation", async () => {
    const { run, desk: d, journal } = mk();
    const seen: unknown[] = [];
    await expect(runFerryStep({ journal, desk: d, log: quiet, claimDispatch: async (a) => { seen.push(a); return { granted: false, code: "DISPATCH_REFUSED", reason: "mission is cancelling" }; } }, { holdAfterCommit: false }))
      .rejects.toMatchObject({ code: "DISPATCH_REFUSED" });
    expect(seen).toMatchObject([{ actionKey: keyFor(run), slot: "ferry" }]);
    expect(d.books).toBe(0);
    expect(fake.rows("commitments", run).map((r) => r.status)).toEqual(["intent"]);
  });

  it("granted claim precedes the POST", async () => {
    const { desk: d, journal } = mk();
    const order: string[] = [];
    const wrapped: DeskClient = { book: (r) => { order.push("book"); return d.book(r); }, lookup: (k) => d.lookup(k) };
    await runFerryStep({ journal, desk: wrapped, log: quiet, claimDispatch: async () => { order.push("claim"); return { granted: true, dispatchId: "dsp-1" }; } }, { holdAfterCommit: false });
    expect(order).toEqual(["claim", "book"]);
  });

  it("R11 kernel half: lookup-only 404 keeps unknown (no not_executed); explicit resume then retries ONLY the original args", async () => {
    const { run, desk: d, journal } = mk();
    await expect(runFerryStep({ journal, desk: d, log: quiet, claimDispatch: async () => ({ granted: false, code: "X", reason: "stop" }) }, { holdAfterCommit: false })).rejects.toBeInstanceOf(DispatchRefused);
    const paused = await recoverRun(run, d, true);
    expect(paused.reconciled[0]!.result).toBe("unknown");
    expect(paused.journal.state.commitments[keyFor(run)]!.status).toBe("unknown");
    expect(d.books).toBe(0);
    // explicit Resume: authoritative 404 → not_executed, blocked step reopened for the original key
    const resumed = await recoverRun(run, d);
    expect(resumed.reconciled[0]!.result).toBe("not_executed");
    expect(resumed.journal.state.plan_steps.ferry!.status).toBe("needs_repair");
    // changed preconditions (another world version → other args hash) are refused before any POST
    await expect(executeBooking({ journal: resumed.journal, desk: d, log: quiet }, f3FerryStep(2), { holdAfterCommit: false })).rejects.toBeInstanceOf(RetryArgsChanged);
    expect(d.books).toBe(0);
    const out = await executeBooking({ journal: resumed.journal, desk: d, log: quiet }, f3FerryStep(1), { holdAfterCommit: false });
    expect(out.action_key).toBe(keyFor(run));
    expect(desk.store.ledger({ run_id: run }).outcomes).toHaveLength(1);
  });
});
