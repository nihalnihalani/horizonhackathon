import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AckError, InvariantViolation, actionKey, type BookRequest, type DeskClient, type DeskReceipt, type LookupResult } from "@dr/shared";
import { FakeRawTree, RawTreeClient, RawTreeLoader, RawTreeSink, intentVisibilityGate } from "@dr/storage";
import { startDesk, type RunningDesk } from "@dr/desk";
import { HttpDeskClient, Journal, NaiveTranscript, executeBooking, f3FerryStep, recover, runFerryStep } from "../src/index.ts";

const W = "wt", O = "ot";
let fake: FakeRawTree; let desk: RunningDesk; let client: RawTreeClient;
beforeAll(async () => {
  fake = await new FakeRawTree().start();
  client = new RawTreeClient({ baseUrl: fake.url, apiKey: fake.apiKey, database: "deadreckoning", timeoutMs: 500 });
  desk = await startDesk({ worldToken: W, operatorToken: O, port: 0, feedPort: null });
});
afterAll(async () => { await desk.close(); await fake.stop(); });
afterEach(() => { desk.store.lookupUnavailable = false; });

/** Wraps the real desk client and counts calls. */
class CountingDesk implements DeskClient {
  books = 0; lookups = 0;
  constructor(private inner: DeskClient, private lookupOverride?: () => LookupResult) {}
  book(r: BookRequest): Promise<DeskReceipt> { this.books++; return this.inner.book(r); }
  lookup(k: string): Promise<LookupResult> { this.lookups++; return this.lookupOverride ? Promise.resolve(this.lookupOverride()) : this.inner.lookup(k); }
}
const mk = (run: string) => {
  const sink = new RawTreeSink(client);
  const d = new CountingDesk(new HttpDeskClient({ baseUrl: desk.url, token: W }));
  return { sink, desk: d, journal: new Journal(sink, { run_id: run, arm: "dr", epoch: 1 }), loader: new RawTreeLoader(client) };
};
const quiet = () => {};

describe("kernel invariants", () => {
  it("invariant 1: intent not acked → AckError and NO desk call", async () => {
    const run = "f3-20260925-inv1";
    const { journal, desk: d } = mk(run);
    fake.failNext("commitments", "wrong-count");
    await expect(runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false })).rejects.toBeInstanceOf(AckError);
    expect(d.books).toBe(0);
    expect(desk.store.ledger({ run_id: run }).requests).toHaveLength(0);
    fake.failNext("commitments", "hang");
    await expect(runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false })).rejects.toBeInstanceOf(AckError);
    expect(d.books).toBe(0);
  });

  it("S06 / invariant 1: acked-but-invisible intent → bounded wait, then AckError and NO desk call", async () => {
    const run = "f3-20260925-vis1";
    const { journal, desk: d } = mk(run);
    fake.visibilityDelayMs = 60_000;
    try {
      const gate = intentVisibilityGate(client, { deadlineMs: 400, intervalMs: 100 });
      await expect(runFerryStep({ journal, desk: d, log: quiet, awaitIntentVisible: gate }, { holdAfterCommit: false })).rejects.toBeInstanceOf(AckError);
      expect(d.books).toBe(0);
    } finally { fake.visibilityDelayMs = 0; }
    const run2 = "f3-20260925-vis2";
    const m2 = mk(run2);
    fake.visibilityDelayMs = 300;
    try {
      const out = await runFerryStep({ journal: m2.journal, desk: m2.desk, log: quiet, awaitIntentVisible: intentVisibilityGate(client, { deadlineMs: 3000, intervalMs: 100 }) }, { holdAfterCommit: false });
      expect(out.commitment_status).toBe("confirmed");
      expect(m2.desk.books).toBe(1);
    } finally { fake.visibilityDelayMs = 0; }
  });

  it("happy path writes intent → receipt → confirmed, in rev order", async () => {
    const run = "f3-20260925-happ";
    const { journal, desk: d } = mk(run);
    const out = await runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false });
    expect(out.commitment_status).toBe("confirmed");
    const rows = fake.rows("commitments", run).map((r) => [r.rev, r.status]);
    expect(rows).toEqual([[1, "intent"], [4, "confirmed"]]);
    expect(fake.rows("receipts", run)).toHaveLength(1);
  });

  it("invariant 2: an action_key with a success receipt is never re-executed", async () => {
    const run = "f3-20260925-inv2";
    const { journal, desk: d } = mk(run);
    await runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false });
    const before = fake.insertAttempts.length;
    await expect(runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false })).rejects.toMatchObject({ invariant: 2 });
    expect(d.books).toBe(1);
    expect(fake.insertAttempts.length).toBe(before); // nothing written
  });

  it("invariant 4: at most one active commitment per slot", async () => {
    const run = "f3-20260925-inv4";
    const { journal, desk: d } = mk(run);
    await runFerryStep({ journal, desk: d, log: quiet }, { holdAfterCommit: false });
    const other = { ...f3FerryStep(), step_id: "ferry-again" }; // new business key, same slot
    const err = await executeBooking({ journal, desk: d, log: quiet }, other).catch((e) => e);
    expect(err).toBeInstanceOf(InvariantViolation);
    expect(err.invariant).toBe(4);
    expect(d.books).toBe(1);
  });
});

describe("recovery 1–4", () => {
  async function orphanIntent(run: string) {
    // write only the intent (simulates a crash before the desk call returned to the agent)
    const { journal } = mk(run);
    const s = f3FerryStep();
    const key = actionKey(run, s.step_id, s.resource, s.date, s.party);
    await journal.append("epochs", { reason: "boot", restored_rows: 0, sim_clock: "2026-10-08T09:00:00-07:00", pid: 1, verdict: null, verdict_reason: null });
    await journal.append("facts", { key: "site-A.status", value: '"open"', source_url: "x", observed_at: "2026-10-08T09:00:00-07:00", valid_until: null, volatile: true, trust: "extract", status: "active", superseded_by: null, excerpt: null, nimble_request_id: "t1", world_version: 1 });
    await journal.append("facts", { key: "site-A.accessible", value: "true", source_url: "x", observed_at: "2026-10-08T09:00:00-07:00", valid_until: null, volatile: false, trust: "extract", status: "active", superseded_by: null, excerpt: null, nimble_request_id: "t1", world_version: 1 });
    await journal.append("commitments", { action_key: key, kind: "book", slot: "ferry", resource: s.resource, date: s.date, party: s.party, args_hash: "h", status: "intent", receipt_id: null, reversible: false, compensates: null, reason: null });
    return key;
  }

  it("absent at desk → not_executed; volatile fact from epoch 1 marked stale", async () => {
    const run = "f3-20260925-rabs";
    const key = await orphanIntent(run);
    const { sink, desk: d, loader } = mk(run);
    const r = await recover({ loader, sink, desk: d, run_id: run, arm: "dr", log: quiet });
    expect(r.epoch).toBe(2);
    expect(r.restored_rows).toBe(4);
    expect(r.reconciled).toEqual([{ action_key: key, slot: "ferry", result: "not_executed", lookup: true }]);
    expect(r.journal.state.commitments[key]!.status).toBe("not_executed");
    expect(r.stale).toEqual(["site-A.status"]);
    expect(r.journal.state.facts["site-A.accessible"]!.status).toBe("active");
    expect(r.journal.state.epochs.map((e) => [e.epoch, e.reason])).toEqual([[1, "boot"], [2, "resume"]]);
  });

  it("desk unavailable → unknown + dependent step blocked (never inferred as failure)", async () => {
    const run = "f3-20260925-runk";
    const key = await orphanIntent(run);
    const { sink, loader } = mk(run);
    desk.store.lookupUnavailable = true;
    const d = new HttpDeskClient({ baseUrl: desk.url, token: W });
    const r = await recover({ loader, sink, desk: d, run_id: run, arm: "dr", log: quiet });
    expect(r.reconciled[0]!.result).toBe("unknown");
    expect(r.journal.state.commitments[key]!.status).toBe("unknown");
    expect(r.blocked_steps).toEqual(["ferry"]);
    expect(r.journal.state.plan_steps.ferry!.status).toBe("blocked");
    // later epoch, desk back: unknown is reconciled again
    desk.store.lookupUnavailable = false;
    const r2 = await recover({ loader, sink, desk: d, run_id: run, arm: "dr", log: quiet });
    expect(r2.epoch).toBe(3);
    expect(r2.reconciled[0]!.result).toBe("not_executed");
  });

  it("I2b: second kill between recovered receipt and confirmed → next epoch skips lookup, one receipt_id", async () => {
    const run = "f3-20260925-i2bb";
    const { journal, desk: real } = mk(run);
    // desk commits but agent never records the receipt: write intent via protocol with a desk that commits then "crashes"
    const s = f3FerryStep();
    const key = actionKey(run, s.step_id, s.resource, s.date, s.party);
    class CrashAfterBook implements DeskClient {
      async book(r: BookRequest): Promise<DeskReceipt> { await real.book(r); throw new Error("simulated crash after desk commit"); }
      lookup(k: string) { return real.lookup(k); }
    }
    await expect(runFerryStep({ journal, desk: new CrashAfterBook(), log: quiet }, { holdAfterCommit: false })).rejects.toThrow(/simulated crash/);
    const { sink, loader } = mk(run);
    const d2 = new CountingDesk(new HttpDeskClient({ baseUrl: desk.url, token: W }));
    await expect(recover({ loader, sink, desk: d2, run_id: run, arm: "dr", log: quiet, afterRecoveredReceipt: () => { throw new Error("second kill"); } })).rejects.toThrow(/second kill/);
    expect(d2.lookups).toBe(1);
    const d3 = new CountingDesk(new HttpDeskClient({ baseUrl: desk.url, token: W }));
    const r3 = await recover({ loader, sink, desk: d3, run_id: run, arm: "dr", log: quiet });
    expect(r3.epoch).toBe(3);
    expect(d3.lookups).toBe(0);
    expect(r3.reconciled).toMatchObject([{ action_key: key, result: "confirmed_from_projection", lookup: false }]);
    expect(r3.journal.state.commitments[key]!.status).toBe("confirmed");
    const ids = new Set(fake.rows("receipts", run).map((x) => x.receipt_id));
    expect(ids.size).toBe(1);
    expect(desk.store.ledger({ run_id: run }).requests).toHaveLength(1);
  });

  it("naive transcript arm: no reconcile, attempt-derived key → second ferry at the desk", async () => {
    const run = "f3-20260925-naiv";
    const dir = mkdtempSync(join(tmpdir(), "dr-naive-"));
    try {
      const tr = new NaiveTranscript(join(dir, "transcript.json"));
      const sink = new RawTreeSink(client);
      const d = new HttpDeskClient({ baseUrl: desk.url, token: W });
      const t1 = tr.resume(run);
      const j1 = new Journal(sink, { run_id: run, arm: "naive", epoch: 1 });
      class CrashAfterBook implements DeskClient {
        async book(r: BookRequest): Promise<DeskReceipt> { await d.book(r); throw new Error("killed"); }
        lookup(k: string) { return d.lookup(k); }
      }
      await expect(tr.book(j1, new CrashAfterBook(), t1, f3FerryStep(), undefined, quiet)).rejects.toThrow();
      const t2 = tr.resume(run);
      expect(t2.attempt).toBe(2);
      const j2 = new Journal(sink, { run_id: run, arm: "naive", epoch: 2 });
      const out = await tr.book(j2, d, t2, f3FerryStep(), undefined, quiet);
      expect(out.receipt.committed).toBe(true);
      expect(desk.store.ledger({ run_id: run, arm: "naive" }).committed_by_slot.ferry).toBe(2);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
